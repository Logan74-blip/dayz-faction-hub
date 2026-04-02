import {
  Client, GatewayIntentBits, REST, Routes,
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, EmbedBuilder
} from 'discord.js'
import { createClient } from '@supabase/supabase-js'
import { createServer } from 'http'

// ─── Config ───────────────────────────────────────────────────────────────────
const DISCORD_TOKEN  = process.env.DISCORD_BOT_TOKEN
const CLIENT_ID      = process.env.DISCORD_CLIENT_ID
const SUPABASE_URL   = process.env.SUPABASE_URL
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY

// ─── Role IDs ─────────────────────────────────────────────────────────────────
const ROLE_VERIFIED    = '1488909539775348866'
const ROLE_XBOX        = '1488909931439587481'
const ROLE_PLAYSTATION = '1488910086913917149'
const ROLE_PC          = '1488910185178337290'

// ─── Channel IDs ──────────────────────────────────────────────────────────────
const CHANNEL_RULES    = '1488907927371649135'
const CHANNEL_MODS     = '1488933427771215924'

// ─── Links ────────────────────────────────────────────────────────────────────
const HUB_URL     = 'https://dayz-faction-hub.vercel.app'
const DISCORD_URL = 'https://discord.gg/qcGJKnqE'
const RULES_URL   = `https://ptb.discord.com/channels/1488907170253902044/${CHANNEL_RULES}`

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const client   = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ]
})

// ─── Slash Commands ───────────────────────────────────────────────────────────
const commands = [
  // Existing commands
  new SlashCommandBuilder().setName('faction').setDescription('Get your faction info and stats'),
  new SlashCommandBuilder().setName('raids').setDescription('See upcoming raids'),
  new SlashCommandBuilder().setName('bounties').setDescription('See active bounties'),
  new SlashCommandBuilder().setName('treasury').setDescription('Check treasury balance'),
  new SlashCommandBuilder().setName('diplomacy').setDescription('See active pacts and wars'),
  new SlashCommandBuilder().setName('members').setDescription('List faction members by role'),
  new SlashCommandBuilder().setName('war').setDescription('See active war status'),
  new SlashCommandBuilder().setName('resources').setDescription('Check stockpile summary'),
  new SlashCommandBuilder().setName('rsvp').setDescription('RSVP to the next upcoming raid'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('See server leaderboard'),
  new SlashCommandBuilder().setName('wipe').setDescription('Check the next server wipe countdown'),
  // New commands
  new SlashCommandBuilder().setName('verify').setDescription('Verify yourself to access the server'),
  new SlashCommandBuilder().setName('system').setDescription('Set your gaming platform — Xbox, PlayStation or PC'),
  new SlashCommandBuilder().setName('hub').setDescription('Get the Faction Hub link'),
  new SlashCommandBuilder().setName('lfg').setDescription('Looking for a faction? Post a callout'),
  new SlashCommandBuilder().setName('report').setDescription('Report a player or issue to the mods'),
  new SlashCommandBuilder().setName('stats').setDescription('See your personal Faction Hub stats'),
  new SlashCommandBuilder().setName('ping').setDescription('Check if the bot is alive'),
].map(c => c.toJSON())

// ─── Helpers ──────────────────────────────────────────────────────────────────
const FOOTER = { text: 'Faction Hub • dayz-faction-hub.vercel.app' }
const TS     = () => new Date().toISOString()

async function getFactionAndUser(discordUserId) {
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const user = authUsers?.users?.find(u =>
    u.user_metadata?.provider_id === discordUserId ||
    u.user_metadata?.sub         === discordUserId ||
    u.user_metadata?.full_name   === discordUserId
  )
  if (!user) return { faction: null, userId: null }
  const { data: mem } = await supabase
    .from('faction_members')
    .select('*, factions(*)')
    .eq('user_id', user.id)
    .maybeSingle()
  return { faction: mem?.factions || null, userId: user.id, role: mem?.role }
}

function noFactionReply() {
  return {
    content: `❌ your discord isn't linked to a faction yet\n\n**step 1** — login at ${HUB_URL}\n**step 2** — create or join a faction\n**step 3** — try this command again`,
    ephemeral: true
  }
}

// ─── Bot Ready ────────────────────────────────────────────────────────────────
client.on('ready', async () => {
  console.log(`✅ Bot ready as ${client.user.tag}`)
  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN)
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands })
    console.log('✅ Slash commands registered')
  } catch (err) {
    console.error('Failed to register commands:', err)
  }
})

// ─── Interaction Handler ──────────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {

  // ── Button Interactions ──────────────────────────────────────────────────────
  if (interaction.isButton()) {
    const { customId, member, guild } = interaction

    // VERIFY button
    if (customId === 'verify_confirm') {
      try {
        await member.roles.add(ROLE_VERIFIED)
        return interaction.reply({
          content: `✅ you're verified! welcome to the server, survivor\n\nhead to <#${CHANNEL_RULES}> to read the rules then explore the rest of the server`,
          ephemeral: true
        })
      } catch (err) {
        console.error('Failed to assign verified role:', err)
        return interaction.reply({
          content: `❌ something went wrong assigning your role. ping a mod or join our discord: ${DISCORD_URL}`,
          ephemeral: true
        })
      }
    }

    // SYSTEM buttons
    if (['system_xbox', 'system_playstation', 'system_pc'].includes(customId)) {
      const roleMap = {
        system_xbox:        ROLE_XBOX,
        system_playstation: ROLE_PLAYSTATION,
        system_pc:          ROLE_PC,
      }
      const labelMap = {
        system_xbox:        '🟢 Xbox',
        system_playstation: '🔵 PlayStation',
        system_pc:          '🖥️ PC',
      }
      try {
        const roleId = roleMap[customId]
        const hasRole = member.roles.cache.has(roleId)
        if (hasRole) {
          await member.roles.remove(roleId)
          return interaction.reply({
            content: `removed **${labelMap[customId]}** from your roles`,
            ephemeral: true
          })
        } else {
          await member.roles.add(roleId)
          return interaction.reply({
            content: `✅ added **${labelMap[customId]}** to your roles\n\nyou can run \`/system\` again to add more platforms or remove one`,
            ephemeral: true
          })
        }
      } catch (err) {
        console.error('Failed to assign system role:', err)
        return interaction.reply({
          content: `❌ something went wrong. ping a mod`,
          ephemeral: true
        })
      }
    }

    return
  }

  // ── Slash Commands ────────────────────────────────────────────────────────────
  if (!interaction.isChatInputCommand()) return

  const { commandName } = interaction

  // ── /ping ──────────────────────────────────────────────────────────────────
  if (commandName === 'ping') {
    return interaction.reply({
      content: `🟢 bot is alive — ${client.ws.ping}ms`,
      ephemeral: true
    })
  }

  // ── /hub ───────────────────────────────────────────────────────────────────
  if (commandName === 'hub') {
    return interaction.reply({
      embeds: [{
        title: '☢️ Faction Hub',
        description: `free faction management for dayz — track your stockpile, plan raids, manage diplomacy, handle bounties and more\n\n**[click here to open Faction Hub](${HUB_URL})**`,
        color: 0x4ade80,
        footer: FOOTER,
        timestamp: TS()
      }]
    })
  }

  // ── /verify ────────────────────────────────────────────────────────────────
  if (commandName === 'verify') {
    const hasVerified = interaction.member.roles.cache.has(ROLE_VERIFIED)
    if (hasVerified) {
      return interaction.reply({
        content: `✅ you're already verified`,
        ephemeral: true
      })
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify_confirm')
        .setLabel('✅ I agree — verify me')
        .setStyle(ButtonStyle.Success)
    )

    return interaction.reply({
      embeds: [{
        title: '☢️ Welcome to Faction Hub',
        description: `before you get access, please read the rules in <#${CHANNEL_RULES}>\n\nonce you've read the rules, click the button below to get verified and unlock the rest of the server`,
        color: 0x4ade80,
        footer: FOOTER,
      }],
      components: [row],
      ephemeral: true
    })
  }

  // ── /system ────────────────────────────────────────────────────────────────
  if (commandName === 'system') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('system_xbox')
        .setLabel('🟢 Xbox')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('system_playstation')
        .setLabel('🔵 PlayStation')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('system_pc')
        .setLabel('🖥️ PC')
        .setStyle(ButtonStyle.Secondary),
    )

    return interaction.reply({
      embeds: [{
        title: '🎮 What do you play on?',
        description: `pick your platform(s) below — you can select more than one\nclick again to remove a platform`,
        color: 0x818cf8,
        footer: FOOTER,
      }],
      components: [row],
      ephemeral: true
    })
  }

  // ── /lfg ───────────────────────────────────────────────────────────────────
  if (commandName === 'lfg') {
    await interaction.deferReply()
    return interaction.editReply({
      embeds: [{
        title: '🔍 Looking for Faction',
        description: `**${interaction.user.username}** is looking for a faction to join`,
        color: 0xfbbf24,
        fields: [
          { name: '📌 How to recruit them', value: `send them an invite from your faction page on ${HUB_URL}`, inline: false },
          { name: '🔗 Faction Hub', value: HUB_URL, inline: false },
        ],
        footer: FOOTER,
        timestamp: TS()
      }]
    })
  }

  // ── /report ────────────────────────────────────────────────────────────────
  if (commandName === 'report') {
    await interaction.deferReply({ ephemeral: true })
    try {
      const modChannel = await client.channels.fetch(CHANNEL_MODS)
      if (modChannel) {
        await modChannel.send({
          embeds: [{
            title: '🚨 New Report',
            description: `**${interaction.user.username}** (${interaction.user.id}) submitted a report`,
            color: 0xf87171,
            fields: [
              { name: 'Channel', value: `<#${interaction.channelId}>`, inline: true },
              { name: 'Time', value: new Date().toLocaleString(), inline: true },
            ],
            footer: FOOTER,
            timestamp: TS()
          }]
        })
      }
    } catch (err) {
      console.error('Failed to send report:', err)
    }
    return interaction.editReply({
      content: `✅ your report has been sent to the mods\n\nif it's urgent you can also join our discord and open a ticket: ${DISCORD_URL}`,
    })
  }

  // ── /stats ─────────────────────────────────────────────────────────────────
  if (commandName === 'stats') {
    await interaction.deferReply()
    const discordUserId = interaction.user.id
    const { faction, userId, role } = await getFactionAndUser(discordUserId)

    if (!faction) {
      return interaction.editReply({
        content: `❌ your discord isn't linked to Faction Hub yet\n\nlogin at ${HUB_URL} to get started`,
      })
    }

    const fid = faction.id
    const [raidsRes, rsvpsRes, bountiesRes, territoriesRes] = await Promise.all([
      supabase.from('raids').select('id', { count: 'exact', head: true }).eq('faction_id', fid),
      supabase.from('raid_rsvps').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('bounties').select('id', { count: 'exact', head: true }).eq('faction_id', fid).eq('status', 'active'),
      supabase.from('territories').select('id', { count: 'exact', head: true }).eq('faction_id', fid),
    ])

    return interaction.editReply({
      embeds: [{
        title: `📊 ${interaction.user.username}'s Stats`,
        color: 0x4ade80,
        fields: [
          { name: '🛡️ Faction', value: faction.name, inline: true },
          { name: '🎖️ Role', value: role || 'member', inline: true },
          { name: '⚔️ Faction Raids', value: `${raidsRes.count || 0}`, inline: true },
          { name: '✅ Your RSVPs', value: `${rsvpsRes.count || 0}`, inline: true },
          { name: '🎯 Active Bounties', value: `${bountiesRes.count || 0}`, inline: true },
          { name: '🗺️ Territories', value: `${territoriesRes.count || 0}`, inline: true },
        ],
        footer: FOOTER,
        timestamp: TS()
      }]
    })
  }

  // ─── From here down = existing commands that need faction ──────────────────
  await interaction.deferReply()
  const discordUserId = interaction.user.id
  const { faction, userId, role } = await getFactionAndUser(discordUserId)

  if (!faction && !['leaderboard'].includes(commandName)) {
    return interaction.editReply(noFactionReply())
  }

  const fid = faction?.id

  // ── /faction ───────────────────────────────────────────────────────────────
  if (commandName === 'faction') {
    const [members, territories, raids, bounties, wars, resources] = await Promise.all([
      supabase.from('faction_members').select('id', { count: 'exact', head: true }).eq('faction_id', fid),
      supabase.from('territories').select('id', { count: 'exact', head: true }).eq('faction_id', fid),
      supabase.from('raids').select('id', { count: 'exact', head: true }).eq('faction_id', fid),
      supabase.from('bounties').select('id', { count: 'exact', head: true }).eq('faction_id', fid).eq('status', 'active'),
      supabase.from('diplomacy').select('id', { count: 'exact', head: true }).eq('type', 'war').eq('status', 'active').or(`faction_a.eq.${fid},faction_b.eq.${fid}`),
      supabase.from('resources').select('quantity').eq('faction_id', fid),
    ])
    const totalStock = resources.data?.reduce((s, r) => s + (r.quantity || 0), 0) || 0
    return interaction.editReply({
      embeds: [{
        title: `${faction.flag || '☢️'} ${faction.name}${faction.tag ? ` [${faction.tag}]` : ''}`,
        description: faction.description || 'No description set.',
        color: 0x4ade80,
        fields: [
          { name: '👥 Members',        value: `${members.count || 0}`,    inline: true },
          { name: '🗺️ Territories',    value: `${territories.count || 0}`, inline: true },
          { name: '⚔️ Raids',          value: `${raids.count || 0}`,      inline: true },
          { name: '🎯 Active Bounties', value: `${bounties.count || 0}`,  inline: true },
          { name: '💀 Active Wars',    value: `${wars.count || 0}`,       inline: true },
          { name: '📦 Stockpile Items', value: `${totalStock}`,           inline: true },
          { name: '📡 Server',         value: faction.server_name || 'Not set', inline: true },
          { name: '🔎 Recruiting',     value: faction.is_recruiting ? '✅ Yes' : '🚫 No', inline: true },
          { name: '🎖 Your Role',      value: role || 'member',           inline: true },
        ],
        footer: FOOTER,
        timestamp: TS()
      }]
    })
  }

  // ── /raids ─────────────────────────────────────────────────────────────────
  if (commandName === 'raids') {
    const { data } = await supabase
      .from('raids')
      .select('*, raid_rsvps(count)')
      .eq('faction_id', fid)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at')
      .limit(5)
    if (!data?.length) return interaction.editReply({ content: `📅 no upcoming raids. schedule one at ${HUB_URL}/raids` })
    return interaction.editReply({
      embeds: [{
        title: '⚔️ Upcoming Raids',
        color: 0xf87171,
        fields: data.map(r => ({
          name: r.title,
          value: `📍 ${r.target_location || 'TBD'}\n📅 ${new Date(r.scheduled_at).toLocaleString()}\n✅ ${r.raid_rsvps?.[0]?.count || 0} going${r.description ? `\n📋 ${r.description.slice(0, 80)}` : ''}`,
          inline: false
        })),
        footer: FOOTER,
        timestamp: TS()
      }]
    })
  }

  // ── /rsvp ──────────────────────────────────────────────────────────────────
  if (commandName === 'rsvp') {
    const { data: raids } = await supabase
      .from('raids')
      .select('*')
      .eq('faction_id', fid)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at')
      .limit(1)

    if (!raids?.length) return interaction.editReply({ content: '📅 no upcoming raids to RSVP to' })

    const raid = raids[0]
    const { data: existing } = await supabase
      .from('raid_rsvps')
      .select('id')
      .eq('raid_id', raid.id)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      await supabase.from('raid_rsvps').delete().eq('id', existing.id)
      return interaction.editReply({
        embeds: [{
          title: '❌ RSVP Cancelled',
          description: `you cancelled your RSVP for **${raid.title}**`,
          color: 0xf87171,
          footer: FOOTER,
          timestamp: TS()
        }]
      })
    } else {
      await supabase.from('raid_rsvps').insert({ raid_id: raid.id, user_id: userId, status: 'going' })

      const { data: leaders } = await supabase
        .from('faction_members')
        .select('user_id')
        .eq('faction_id', fid)
        .in('role', ['leader', 'co-leader'])

      if (leaders?.length) {
        await supabase.from('notifications').insert(leaders.map(l => ({
          faction_id: fid,
          user_id: l.user_id,
          type: 'raid',
          title: `✅ ${interaction.user.username} is going on ${raid.title}`,
          body: `RSVP via Discord bot — ${new Date(raid.scheduled_at).toLocaleString()}`
        })))
      }

      const { count } = await supabase
        .from('raid_rsvps')
        .select('id', { count: 'exact', head: true })
        .eq('raid_id', raid.id)

      return interaction.editReply({
        embeds: [{
          title: '✅ RSVP Confirmed!',
          description: `you're going on **${raid.title}**`,
          color: 0x4ade80,
          fields: [
            { name: '📍 Target',     value: raid.target_location || 'TBD', inline: true },
            { name: '📅 Time',       value: new Date(raid.scheduled_at).toLocaleString(), inline: true },
            { name: '👥 Total Going', value: `${count || 1}`, inline: true },
          ],
          footer: FOOTER,
          timestamp: TS()
        }]
      })
    }
  }

  // ── /bounties ──────────────────────────────────────────────────────────────
  if (commandName === 'bounties') {
    const { data } = await supabase
      .from('bounties')
      .select('*')
      .eq('faction_id', fid)
      .eq('status', 'active')
      .limit(8)
    if (!data?.length) return interaction.editReply({ content: `🎯 no active bounties. post one at ${HUB_URL}/bounties` })
    return interaction.editReply({
      embeds: [{
        title: '🎯 Active Bounties',
        color: 0xfbbf24,
        fields: data.map(b => ({
          name: `🎯 ${b.target_name}`,
          value: `💰 **Reward:** ${b.reward}${b.description ? `\n📝 ${b.description}` : ''}`,
          inline: false
        })),
        footer: FOOTER,
        timestamp: TS()
      }]
    })
  }

  // ── /treasury ──────────────────────────────────────────────────────────────
  if (commandName === 'treasury') {
    const { data } = await supabase.from('treasury').select('*').eq('faction_id', fid)
    const stockMap = {}
    data?.forEach(t => {
      if (!stockMap[t.item_name]) stockMap[t.item_name] = 0
      stockMap[t.item_name] += t.transaction_type === 'deposit' ? t.quantity : -t.quantity
    })
    const stock = Object.entries(stockMap).filter(([, q]) => q > 0).sort((a, b) => b[1] - a[1]).slice(0, 15)
    return interaction.editReply({
      embeds: [{
        title: '💰 Treasury Balance',
        color: 0x4ade80,
        description: stock.length ? stock.map(([name, qty]) => `**${name}** ×${qty}`).join('\n') : '📦 treasury is empty',
        footer: FOOTER,
        timestamp: TS()
      }]
    })
  }

  // ── /resources ─────────────────────────────────────────────────────────────
  if (commandName === 'resources') {
    const { data } = await supabase
      .from('resources')
      .select('name, category, quantity')
      .eq('faction_id', fid)
      .order('category')
      .order('quantity', { ascending: false })
      .limit(20)
    if (!data?.length) return interaction.editReply({ content: `📦 stockpile is empty. add items at ${HUB_URL}/resources` })
    const total = data.reduce((s, r) => s + r.quantity, 0)
    const cats = [...new Set(data.map(r => r.category))]
    const fields = cats.map(cat => ({
      name: `📂 ${cat}`,
      value: data.filter(r => r.category === cat).map(r => `**${r.name}** ×${r.quantity}`).join('\n').slice(0, 1024),
      inline: true
    }))
    return interaction.editReply({
      embeds: [{
        title: `📦 Stockpile — ${data.length} unique items (${total} total)`,
        color: 0x818cf8,
        fields: fields.slice(0, 10),
        footer: FOOTER,
        timestamp: TS()
      }]
    })
  }

  // ── /diplomacy ─────────────────────────────────────────────────────────────
  if (commandName === 'diplomacy') {
    const { data } = await supabase
      .from('diplomacy')
      .select('*, faction_a_info:factions!diplomacy_faction_a_fkey(name,tag), faction_b_info:factions!diplomacy_faction_b_fkey(name,tag)')
      .or(`faction_a.eq.${fid},faction_b.eq.${fid}`)
      .eq('status', 'active')
    if (!data?.length) return interaction.editReply({ content: '🤝 no active diplomacy records' })
    const typeEmoji = { nap: '🤝', war: '💀', trade: '🛒' }
    return interaction.editReply({
      embeds: [{
        title: '🤝 Active Diplomacy',
        color: 0x818cf8,
        fields: data.map(d => ({
          name: `${typeEmoji[d.type] || '📋'} ${d.type === 'nap' ? 'Non-Aggression Pact' : d.type === 'war' ? 'War Declaration' : 'Trade Agreement'}`,
          value: `${d.faction_a_info?.name} ↔ ${d.faction_b_info?.name}${d.terms ? `\n📋 ${d.terms}` : ''}`,
          inline: false
        })),
        footer: FOOTER,
        timestamp: TS()
      }]
    })
  }

  // ── /members ───────────────────────────────────────────────────────────────
  if (commandName === 'members') {
    const { data } = await supabase
      .from('faction_members')
      .select('role, profile:profiles(discord_username)')
      .eq('faction_id', fid)
      .order('joined_at')
    if (!data?.length) return interaction.editReply({ content: '👥 no members found' })
    const grouped = { leader: [], 'co-leader': [], recruiter: [], member: [] }
    data.forEach(m => { if (grouped[m.role]) grouped[m.role].push(m.profile?.discord_username || 'Unknown') })
    const roleEmoji = { leader: '👑', 'co-leader': '⭐', recruiter: '📋', member: '👤' }
    return interaction.editReply({
      embeds: [{
        title: `👥 ${faction.name} — ${data.length} Members`,
        color: 0x4ade80,
        fields: Object.entries(grouped)
          .filter(([, v]) => v.length > 0)
          .map(([role, names]) => ({
            name: `${roleEmoji[role]} ${role.charAt(0).toUpperCase() + role.slice(1)} (${names.length})`,
            value: names.join(', ').slice(0, 1024),
            inline: false
          })),
        footer: FOOTER,
        timestamp: TS()
      }]
    })
  }

  // ── /war ───────────────────────────────────────────────────────────────────
  if (commandName === 'war') {
    const { data } = await supabase
      .from('diplomacy')
      .select('*, faction_a_info:factions!diplomacy_faction_a_fkey(name,tag), faction_b_info:factions!diplomacy_faction_b_fkey(name,tag)')
      .or(`faction_a.eq.${fid},faction_b.eq.${fid}`)
      .eq('type', 'war')
      .eq('status', 'active')
    if (!data?.length) return interaction.editReply({ content: '☮️ no active wars. stay frosty, survivor' })
    return interaction.editReply({
      embeds: [{
        title: '💀 Active Wars',
        color: 0xf87171,
        fields: data.map(w => ({
          name: `${w.faction_a_info?.name} ⚔️ ${w.faction_b_info?.name}`,
          value: `📅 Declared: ${new Date(w.created_at).toLocaleDateString()}\n⏱ Day ${Math.floor((Date.now() - new Date(w.created_at)) / (1000 * 60 * 60 * 24)) + 1} of conflict${w.terms ? `\n📋 ${w.terms}` : ''}`,
          inline: false
        })),
        footer: FOOTER,
        timestamp: TS()
      }]
    })
  }

  // ── /leaderboard ───────────────────────────────────────────────────────────
  if (commandName === 'leaderboard') {
    const serverName = faction?.server_name
    let query = supabase.from('factions').select('id, name, tag, flag, server_name').eq('status', 'active')
    if (serverName) query = query.eq('server_name', serverName)
    const { data: facs } = await query.limit(20)
    if (!facs?.length) return interaction.editReply({ content: '🏆 no factions found' })
    const ids = facs.map(f => f.id)
    const [membersRes, raidsRes, territoriesRes] = await Promise.all([
      supabase.from('faction_members').select('faction_id').in('faction_id', ids),
      supabase.from('raids').select('faction_id').in('faction_id', ids),
      supabase.from('territories').select('faction_id').in('faction_id', ids),
    ])
    const scores = facs.map(f => ({
      ...f,
      members:     membersRes.data?.filter(m => m.faction_id === f.id).length || 0,
      raids:       raidsRes.data?.filter(r => r.faction_id === f.id).length || 0,
      territories: territoriesRes.data?.filter(t => t.faction_id === f.id).length || 0,
    })).sort((a, b) => (b.members + b.raids + b.territories) - (a.members + a.raids + a.territories))
    const medals = ['🥇', '🥈', '🥉']
    return interaction.editReply({
      embeds: [{
        title: `🏆 Leaderboard${serverName ? ` — ${serverName}` : ''}`,
        color: 0xfbbf24,
        description: scores.slice(0, 10).map((f, i) =>
          `${medals[i] || `**#${i + 1}**`} ${f.flag || '☢️'} **${f.name}** — 👥${f.members} ⚔️${f.raids} 🗺️${f.territories}`
        ).join('\n'),
        footer: FOOTER,
        timestamp: TS()
      }]
    })
  }

  // ── /wipe ──────────────────────────────────────────────────────────────────
  if (commandName === 'wipe') {
    return interaction.editReply({
      embeds: [{
        title: '🗓️ Server Wipe',
        description: `check your server's schedule for the next wipe date\n\ntrack your server events at **[${HUB_URL}/server-calendar](${HUB_URL}/server-calendar)**`,
        color: 0xfbbf24,
        footer: FOOTER,
        timestamp: TS()
      }]
    })
  }
})

// ─── Login ────────────────────────────────────────────────────────────────────
client.login(DISCORD_TOKEN).catch(err => {
  console.error('Failed to login:', err)
  process.exit(1)
})

// ─── Keep Railway alive ───────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000
createServer((req, res) => res.end('Bot is running')).listen(PORT, () => {
  console.log(`✅ Health check on port ${PORT}`)
})