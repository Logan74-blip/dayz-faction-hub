import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js'
import { createClient } from '@supabase/supabase-js'

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN
const CLIENT_ID = process.env.DISCORD_CLIENT_ID
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const client = new Client({ intents: [GatewayIntentBits.Guilds] })

const commands = [
  new SlashCommandBuilder().setName('faction').setDescription('Get your faction info'),
  new SlashCommandBuilder().setName('raids').setDescription('See upcoming raids'),
  new SlashCommandBuilder().setName('bounties').setDescription('See active bounties'),
  new SlashCommandBuilder().setName('treasury').setDescription('Check treasury balance'),
  new SlashCommandBuilder().setName('diplomacy').setDescription('See active pacts and wars'),
  new SlashCommandBuilder().setName('members').setDescription('List faction members'),
  new SlashCommandBuilder().setName('war').setDescription('See war status'),
].map(c => c.toJSON())

async function getFactionByDiscordId(discordId) {
  const { data: profile } = await supabase.from('profiles').select('id').eq('discord_id', discordId).maybeSingle()
  if (!profile) return null
  const { data: mem } = await supabase.from('faction_members').select('*, factions(*)').eq('user_id', profile.id).maybeSingle()
  return mem?.factions || null
}

client.on('ready', async () => {
  console.log(`Bot ready as ${client.user.tag}`)
  const rest = new REST({ version:'10' }).setToken(DISCORD_TOKEN)
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands })
  console.log('Slash commands registered')
})

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return
  const faction = await getFactionByDiscordId(interaction.user.id)

  if (!faction) {
    return interaction.reply({ content: '❌ You are not linked to a faction. Log into Faction Hub first: https://dayz-faction-hub.vercel.app', ephemeral: true })
  }

  const factionId = faction.id

  if (interaction.commandName === 'faction') {
    const [members, territories, raids] = await Promise.all([
      supabase.from('faction_members').select('id', { count:'exact' }).eq('faction_id', factionId),
      supabase.from('territories').select('id', { count:'exact' }).eq('faction_id', factionId),
      supabase.from('raids').select('id', { count:'exact' }).eq('faction_id', factionId),
    ])
    return interaction.reply({
      embeds: [{
        title: `☢️ ${faction.name}`,
        description: faction.description || 'No description set.',
        color: 0x4ade80,
        fields: [
          { name:'Members', value:`${members.count || 0}`, inline:true },
          { name:'Territories', value:`${territories.count || 0}`, inline:true },
          { name:'Raids', value:`${raids.count || 0}`, inline:true },
          { name:'Server', value:faction.server_name || 'Unknown', inline:true },
          { name:'Recruiting', value:faction.is_recruiting ? '✅ Yes' : '🚫 No', inline:true },
        ],
        footer: { text:'Faction Hub' }
      }]
    })
  }

  if (interaction.commandName === 'raids') {
    const { data } = await supabase.from('raids').select('*').eq('faction_id', factionId).gte('scheduled_at', new Date().toISOString()).order('scheduled_at').limit(5)
    if (!data?.length) return interaction.reply({ content:'No upcoming raids scheduled.', ephemeral:true })
    return interaction.reply({
      embeds: [{
        title:'⚔️ Upcoming Raids',
        color: 0xf87171,
        fields: data.map(r => ({ name: r.title, value: `📍 ${r.target_location || 'TBD'}\n📅 ${new Date(r.scheduled_at).toLocaleString()}`, inline: false })),
        footer: { text:'Faction Hub' }
      }]
    })
  }

  if (interaction.commandName === 'bounties') {
    const { data } = await supabase.from('bounties').select('*').eq('faction_id', factionId).eq('status', 'active').limit(5)
    if (!data?.length) return interaction.reply({ content:'No active bounties.', ephemeral:true })
    return interaction.reply({
      embeds: [{
        title:'🎯 Active Bounties',
        color: 0xfbbf24,
        fields: data.map(b => ({ name: `🎯 ${b.target_name}`, value: `💰 Reward: ${b.reward}${b.description ? `\n${b.description}` : ''}`, inline: false })),
        footer: { text:'Faction Hub' }
      }]
    })
  }

  if (interaction.commandName === 'treasury') {
    const { data } = await supabase.from('treasury').select('*').eq('faction_id', factionId)
    const stockMap = {}
    data?.forEach(t => {
      if (!stockMap[t.item_name]) stockMap[t.item_name] = 0
      stockMap[t.item_name] += t.transaction_type === 'deposit' ? t.quantity : -t.quantity
    })
    const stock = Object.entries(stockMap).filter(([,q]) => q > 0).slice(0, 10)
    return interaction.reply({
      embeds: [{
        title:'💰 Treasury Balance',
        color: 0x4ade80,
        description: stock.length ? stock.map(([name, qty]) => `**${name}** ×${qty}`).join('\n') : 'Treasury is empty.',
        footer: { text:'Faction Hub' }
      }]
    })
  }

  if (interaction.commandName === 'diplomacy') {
    const { data } = await supabase.from('diplomacy').select('*, faction_a_info:factions!diplomacy_faction_a_fkey(name), faction_b_info:factions!diplomacy_faction_b_fkey(name)').or(`faction_a.eq.${factionId},faction_b.eq.${factionId}`).eq('status', 'active')
    if (!data?.length) return interaction.reply({ content:'No active diplomacy.', ephemeral:true })
    return interaction.reply({
      embeds: [{
        title:'🤝 Active Diplomacy',
        color: 0x818cf8,
        fields: data.map(d => ({ name: d.type === 'nap' ? '🤝 NAP' : d.type === 'war' ? '💀 War' : '🛒 Trade', value: `${d.faction_a_info?.name} ↔ ${d.faction_b_info?.name}`, inline: false })),
        footer: { text:'Faction Hub' }
      }]
    })
  }

  if (interaction.commandName === 'members') {
    const { data } = await supabase.from('faction_members').select('role, profile:profiles(discord_username)').eq('faction_id', factionId).order('role')
    if (!data?.length) return interaction.reply({ content:'No members found.', ephemeral:true })
    const grouped = { leader:[], 'co-leader':[], recruiter:[], member:[] }
    data.forEach(m => { if (grouped[m.role]) grouped[m.role].push(m.profile?.discord_username || 'Unknown') })
    return interaction.reply({
      embeds: [{
        title:`👥 ${faction.name} Members (${data.length})`,
        color: 0x4ade80,
        fields: Object.entries(grouped).filter(([,v]) => v.length > 0).map(([role, names]) => ({ name: `${role.charAt(0).toUpperCase() + role.slice(1)} (${names.length})`, value: names.join(', ').slice(0, 1024) || 'None', inline: false })),
        footer: { text:'Faction Hub' }
      }]
    })
  }

  if (interaction.commandName === 'war') {
    const { data } = await supabase.from('diplomacy').select('*, faction_a_info:factions!diplomacy_faction_a_fkey(name), faction_b_info:factions!diplomacy_faction_b_fkey(name)').or(`faction_a.eq.${factionId},faction_b.eq.${factionId}`).eq('type', 'war').eq('status', 'active')
    if (!data?.length) return interaction.reply({ content:'☮️ No active wars. Stay frosty.', ephemeral:true })
    return interaction.reply({
      embeds: [{
        title:'💀 War Status',
        color: 0xf87171,
        fields: data.map(w => ({ name:`${w.faction_a_info?.name} vs ${w.faction_b_info?.name}`, value: `Declared: ${new Date(w.created_at).toLocaleDateString()}${w.terms ? `\n${w.terms}` : ''}`, inline: false })),
        footer: { text:'Faction Hub' }
      }]
    })
  }
})

client.login(DISCORD_TOKEN)