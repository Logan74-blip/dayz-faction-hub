import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js'
import { createClient } from '@supabase/supabase-js'
import { createServer } from 'http'

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN
const CLIENT_ID = process.env.DISCORD_CLIENT_ID
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const client = new Client({ intents: [GatewayIntentBits.Guilds] })

const commands = [
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
].map(c => c.toJSON())

async function getFactionAndUser(discordUserId) {
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const user = authUsers?.users?.find(u =>
    u.user_metadata?.provider_id === discordUserId ||
    u.user_metadata?.sub === discordUserId ||
    u.user_metadata?.full_name === discordUserId
  )
  if (!user) return { faction: null, userId: null }
  const { data: mem } = await supabase
    .from('faction_members')
    .select('*, factions(*)')
    .eq('user_id', user.id)
    .maybeSingle()
  return { faction: mem?.factions || null, userId: user.id, role: mem?.role }
}

const FOOTER = { text: 'Faction Hub • dayz-faction-hub.vercel.app' }
const TS = () => new Date().toISOString()

function noFactionReply() {
  return {
    content: `❌ Your Discord account isn't linked to a faction yet.\n\n**Step 1:** Login at https://dayz-faction-hub.vercel.app\n**Step 2:** Create or join a faction\n**Step 3:** Try this command again`
  }
}

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

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return
  await interaction.deferReply()

  const discordUserId = interaction.user.id
  const { faction, userId, role } = await getFactionAndUser(discordUserId)

  if (!faction && interaction.commandName !== 'leaderboard') {
    return interaction.editReply(noFactionReply())
  }

  const fid = faction?.id

  // ─── /faction ───────────────────────────────────────
  if (interaction.commandName === 'faction') {
    const [members, territories, raids, bounties, wars, resources] = await Promise.all([
      supabase.from('faction_members').select('id', { count:'exact', head:true }).eq('faction_id', fid),
      supabase.from('territories').select('id', { count:'exact', head:true }).eq('faction_id', fid),
      supabase.from('raids').select('id', { count:'exact', head:true }).eq('faction_id', fid),
      supabase.from('bounties').select('id', { count:'exact', head:true }).eq('faction_id', fid).eq('status', 'active'),
      supabase.from('diplomacy').select('id', { count:'exact', head:true }).eq('type', 'war').eq('status', 'active').or(`faction_a.eq.${fid},faction_b.eq.${fid}`),
      supabase.from('resources').select('quantity').eq('faction_id', fid),
    ])
    const totalStock = resources.data?.reduce((s, r) => s + (r.quantity || 0), 0) || 0
    return interaction.editReply({
      embeds: [{
        title: `${faction.flag || '☢️'} ${faction.name}${faction.tag ? ` [${faction.tag}]` : ''}`,
        description: faction.description || 'No description set.',
        color: 0x4ade80,
        fields: [
          { name: '👥 Members', value: `${members.count || 0}`, inline: true },
          { name: '🗺️ Territories', value: `${territories.count || 0}`, inline: true },
          { name: '⚔️ Raids', value: `${raids.count || 0}`, inline: true },
          { name: '🎯 Active Bounties', value: `${bounties.count || 0}`, inline: true },
          { name: '💀 Active Wars', value: `${wars.count || 0}`, inline: true },
          { name: '📦 Stockpile Items', value: `${totalStock}`, inline: true },
          { name: '📡 Server', value: faction.server_name || 'Not set', inline: true },
          { name: '🔎 Recruiting', value: faction.is_recruiting ? '✅ Yes' : '🚫 No', inline: true },
          { name: '🎭 Your Role', value: role || 'member', inline: true },
        ],
        footer: FOOTER,
        timestamp: TS()
      }]
    })
  }

  // ─── /raids ─────────────────────────────────────────
  if (interaction.commandName === 'raids') {
    const { data } = await supabase
      .from('raids')
      .select('*, raid_rsvps(count)')
      .eq('faction_id', fid)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at')
      .limit(5)
    if (!data?.length) return interaction.editReply({ content: '📅 No upcoming raids. Schedule one at dayz-faction-hub.vercel.app/raids' })
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

  if (interaction.commandName === 'bounties') {
    const { data } = await supabase.from('bounties').select('*').eq('faction_id', fid).eq('status', 'active').limit(5)
    if (!data?.length) return interaction.editReply({ content:'🎯 No active bounties. Post one on the Bounty Board.' })
    return interaction.editReply({
      embeds: [{
        title:'🎯 Active Bounties',
        color: 0xfbbf24,
        fields: data.map(b => ({
          name: `🎯 ${b.target_name}`,
          value: `💰 **Reward:** ${b.reward}${b.description ? `\n📝 ${b.description}` : ''}`,
          inline: false
        })),
        footer: { text:'Faction Hub' },
        timestamp: new Date().toISOString()
      }]
    })
  }

  if (interaction.commandName === 'treasury') {
    const { data } = await supabase.from('treasury').select('*').eq('faction_id', fid)
    const stockMap = {}
    data?.forEach(t => {
      if (!stockMap[t.item_name]) stockMap[t.item_name] = 0
      stockMap[t.item_name] += t.transaction_type === 'deposit' ? t.quantity : -t.quantity
    })
    const stock = Object.entries(stockMap).filter(([,q]) => q > 0).sort((a,b) => b[1] - a[1]).slice(0, 15)
    return interaction.editReply({
      embeds: [{
        title:'💰 Treasury Balance',
        color: 0x4ade80,
        description: stock.length
          ? stock.map(([name, qty]) => `**${name}** ×${qty}`).join('\n')
          : '📦 Treasury is empty. Log deposits in the Treasury page.',
        footer: { text:'Faction Hub' },
        timestamp: new Date().toISOString()
      }]
    })
  }

  if (interaction.commandName === 'diplomacy') {
    const { data } = await supabase
      .from('diplomacy')
      .select('*, faction_a_info:factions!diplomacy_faction_a_fkey(name,tag), faction_b_info:factions!diplomacy_faction_b_fkey(name,tag)')
      .or(`faction_a.eq.${fid},faction_b.eq.${fid}`)
      .eq('status', 'active')
    if (!data?.length) return interaction.editReply({ content:'🤝 No active diplomacy. Use the Diplomacy Board to send proposals.' })
    const typeEmoji = { nap:'🤝', war:'💀', trade:'🛒' }
    return interaction.editReply({
      embeds: [{
        title:'🤝 Active Diplomacy',
        color: 0x818cf8,
        fields: data.map(d => ({
          name: `${typeEmoji[d.type] || '📋'} ${d.type === 'nap' ? 'Non-Aggression Pact' : d.type === 'war' ? 'War Declaration' : 'Trade Agreement'}`,
          value: `${d.faction_a_info?.tag ? d.faction_a_info.tag + ' ' : ''}${d.faction_a_info?.name} ↔ ${d.faction_b_info?.tag ? d.faction_b_info.tag + ' ' : ''}${d.faction_b_info?.name}`,
          inline: false
        })),
        footer: { text:'Faction Hub' },
        timestamp: new Date().toISOString()
      }]
    })
  }

  if (interaction.commandName === 'members') {
    const { data } = await supabase
      .from('faction_members')
      .select('role, profile:profiles(discord_username)')
      .eq('faction_id', fid)
      .order('joined_at')
    if (!data?.length) return interaction.editReply({ content:'👥 No members found.' })
    const grouped = { leader:[], 'co-leader':[], recruiter:[], member:[] }
    data.forEach(m => { if (grouped[m.role]) grouped[m.role].push(m.profile?.discord_username || 'Unknown') })
    const roleEmoji = { leader:'👑', 'co-leader':'⭐', recruiter:'📋', member:'👤' }
    return interaction.editReply({
      embeds: [{
        title:`👥 ${faction.name} — ${data.length} Members`,
        color: 0x4ade80,
        fields: Object.entries(grouped)
          .filter(([,v]) => v.length > 0)
          .map(([role, names]) => ({
            name: `${roleEmoji[role]} ${role.charAt(0).toUpperCase() + role.slice(1)} (${names.length})`,
            value: names.join(', ').slice(0, 1024),
            inline: false
          })),
        footer: { text:'Faction Hub' },
        timestamp: new Date().toISOString()
      }]
    })
  }

  if (interaction.commandName === 'war') {
    const { data } = await supabase
      .from('diplomacy')
      .select('*, faction_a_info:factions!diplomacy_faction_a_fkey(name,tag), faction_b_info:factions!diplomacy_faction_b_fkey(name,tag)')
      .or(`faction_a.eq.${fid},faction_b.eq.${fid}`)
      .eq('type', 'war')
      .eq('status', 'active')
    if (!data?.length) return interaction.editReply({ content:'☮️ No active wars. Stay frosty, survivor.' })
    return interaction.editReply({
      embeds: [{
        title:'💀 Active Wars',
        color: 0xf87171,
        fields: data.map(w => ({
          name: `${w.faction_a_info?.tag ? w.faction_a_info.tag + ' ' : ''}${w.faction_a_info?.name} ⚔️ ${w.faction_b_info?.tag ? w.faction_b_info.tag + ' ' : ''}${w.faction_b_info?.name}`,
          value: `📅 Declared: ${new Date(w.created_at).toLocaleDateString()}${w.terms ? `\n📋 Terms: ${w.terms}` : ''}`,
          inline: false
        })),
        footer: { text:'Faction Hub' },
        timestamp: new Date().toISOString()
      }]
    })
  }
})

client.login(DISCORD_TOKEN).catch(err => {
  console.error('Failed to login:', err)
  process.exit(1)
})

// Keep Railway happy by listening on a port
import { createServer } from 'http'
const PORT = process.env.PORT || 3000
createServer((req, res) => res.end('Bot is running')).listen(PORT, () => {
  console.log(`✅ Health check listening on port ${PORT}`)
})