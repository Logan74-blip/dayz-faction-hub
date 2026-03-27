import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Copy, Check, RefreshCw, Bell, Link, Server } from 'lucide-react'
import ServerSelect from '../components/ServerSelect'

export default function Settings({ session }) {
  const [faction, setFaction] = useState(null)
  const [invite, setInvite] = useState(null)
  const [copied, setCopied] = useState(false)
  const [settings, setSettings] = useState({ webhook_url:'', notify_raids:true, notify_diplomacy:true, notify_members:true, notify_war:true })
  const [factionForm, setFactionForm] = useState({ server_name:'', tag:'', description:'', is_recruiting:true })
  const [saved, setSaved] = useState(false)
  const [factionSaved, setFactionSaved] = useState(false)
  const [members, setMembers] = useState([])
  const userId = session.user.id

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: mem } = await supabase.from('faction_members').select('*, factions(*)').eq('user_id', userId).maybeSingle()
    if (!mem?.factions) return
    setFaction(mem.factions)
    setFactionForm({
      server_name: mem.factions.server_name || '',
      tag: mem.factions.tag || '',
      description: mem.factions.description || '',
      is_recruiting: mem.factions.is_recruiting ?? true
    })
    const { data: inv } = await supabase.from('invites').select('*').eq('faction_id', mem.factions.id).order('created_at', { ascending:false }).limit(1).maybeSingle()
    setInvite(inv)
    const { data: notif } = await supabase.from('notification_settings').select('*').eq('faction_id', mem.factions.id).maybeSingle()
    if (notif) setSettings(notif)
    const { data: mems } = await supabase.from('faction_members').select('*').eq('faction_id', mem.factions.id)
    setMembers(mems || [])
  }

  async function saveFactionInfo() {
    await supabase.from('factions').update(factionForm).eq('id', faction.id)
    setFaction(f => ({...f, ...factionForm}))
    setFactionSaved(true)
    setTimeout(() => setFactionSaved(false), 2000)
  }

  async function generateInvite() {
    const { data, error } = await supabase.from('invites').insert({ faction_id: faction.id, created_by: userId }).select().single()
    if (!error) setInvite(data)
  }

  async function regenerateInvite() {
    if (invite) await supabase.from('invites').delete().eq('id', invite.id)
    generateInvite()
  }

  function getInviteUrl() { return `${window.location.origin}/invite/${invite?.code}` }

  async function copyInvite() {
    await navigator.clipboard.writeText(getInviteUrl())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveSettings() {
    const { data: existing } = await supabase.from('notification_settings').select('id').eq('faction_id', faction.id).maybeSingle()
    if (existing) {
      await supabase.from('notification_settings').update({ ...settings, updated_at: new Date().toISOString() }).eq('faction_id', faction.id)
    } else {
      await supabase.from('notification_settings').insert({ ...settings, faction_id: faction.id, created_by: userId })
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function testWebhook() {
    if (!settings.webhook_url) return
    await fetch(settings.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [{ title: '☢️ Faction Hub Connected', description: 'Your Discord notifications are working!', color: 0x4ade80, timestamp: new Date().toISOString() }] })
    }).catch(() => {})
    alert('Test notification sent!')
  }

  async function removeMember(memberId) {
    await supabase.from('faction_members').delete().eq('id', memberId)
    setMembers(m => m.filter(x => x.id !== memberId))
  }

  if (!faction) return (
    <div style={{ maxWidth:600, margin:'80px auto', padding:'0 24px', textAlign:'center', color:'var(--muted)' }}>
      You need to be in a faction to access settings.
    </div>
  )

  return (
    <div style={{ maxWidth:700, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>FACTION SETTINGS</h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>{faction.name}</p>
      </div>

      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
        <h3 style={{ display:'flex', alignItems:'center', gap:'8px', fontWeight:700, fontSize:'16px' }}>
          <Server size={16} color="var(--green)" /> Faction Info
        </h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <div>
            <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>SERVER</label>
            <ServerSelect value={factionForm.server_name} onChange={v => setFactionForm(f => ({...f, server_name:v}))} />
          </div>
          <div>
            <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>TAG (e.g. [SLAM])</label>
            <input placeholder="[TAG]" value={factionForm.tag} onChange={e => setFactionForm(f => ({...f, tag:e.target.value}))} maxLength={8} />
          </div>
        </div>
        <div>
          <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>DESCRIPTION</label>
          <textarea placeholder="Tell other factions about your group..." value={factionForm.description} onChange={e => setFactionForm(f => ({...f, description:e.target.value}))} rows={2} />
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', fontSize:'14px' }}>
          <input type="checkbox" checked={factionForm.is_recruiting} onChange={e => setFactionForm(f => ({...f, is_recruiting:e.target.checked}))} style={{ width:'auto', accentColor:'var(--green)' }} />
          Currently recruiting members
        </label>
        <button className="btn btn-green" style={{ alignSelf:'flex-start' }} onClick={saveFactionInfo}>
          {factionSaved ? '✓ Saved!' : 'Save Faction Info'}
        </button>
      </div>

      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
        <h3 style={{ display:'flex', alignItems:'center', gap:'8px', fontWeight:700, fontSize:'16px' }}>
          <Link size={16} color="var(--green)" /> Invite Link
        </h3>
        {!invite ? (
          <button className="btn btn-green" style={{ alignSelf:'flex-start' }} onClick={generateInvite}>Generate Invite Link</button>
        ) : (
          <>
            <div style={{ display:'flex', gap:'8px' }}>
              <input readOnly value={getInviteUrl()} style={{ flex:1, fontFamily:'Share Tech Mono', fontSize:'12px' }} />
              <button className="btn btn-green" onClick={copyInvite} style={{ display:'flex', alignItems:'center', gap:'6px', whiteSpace:'nowrap' }}>
                {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
              </button>
              <button className="btn btn-ghost" onClick={regenerateInvite} title="Regenerate">
                <RefreshCw size={14} />
              </button>
            </div>
            <div style={{ fontSize:'12px', color:'var(--muted)', display:'flex', gap:'16px' }}>
              <span>Uses: {invite.uses}/{invite.max_uses}</span>
              <span>Expires: {new Date(invite.expires_at).toLocaleDateString()}</span>
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
        <h3 style={{ display:'flex', alignItems:'center', gap:'8px', fontWeight:700, fontSize:'16px' }}>
          <Bell size={16} color="var(--green)" /> Discord Notifications
        </h3>
        <p style={{ fontSize:'13px', color:'var(--muted)' }}>
          Discord Server → Edit Channel → Integrations → Webhooks → New Webhook → Copy URL
        </p>
        <input placeholder="https://discord.com/api/webhooks/..." value={settings.webhook_url} onChange={e => setSettings(s => ({...s, webhook_url:e.target.value}))} />
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {[
            { key:'notify_raids', label:'⚔️ Raid scheduled' },
            { key:'notify_diplomacy', label:'🤝 Diplomacy updates' },
            { key:'notify_members', label:'👤 New member joins' },
            { key:'notify_war', label:'💀 War declarations' },
          ].map(({ key, label }) => (
            <label key={key} style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', fontSize:'14px' }}>
              <input type="checkbox" checked={settings[key]} onChange={e => setSettings(s => ({...s, [key]:e.target.checked}))} style={{ width:'auto', accentColor:'var(--green)' }} />
              {label}
            </label>
          ))}
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button className="btn btn-green" onClick={saveSettings}>{saved ? '✓ Saved!' : 'Save Settings'}</button>
          {settings.webhook_url && <button className="btn btn-ghost" onClick={testWebhook}>Test</button>}
        </div>
      </div>

      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        <h3 style={{ fontWeight:700, fontSize:'16px' }}>Members ({members.length})</h3>
        {members.map(m => (
          <div key={m.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ fontSize:'14px' }}>{m.user_id === userId ? '👑 You' : '👤 Member'}</span>
              <span className={`tag ${m.role === 'leader' ? 'tag-green' : 'tag-yellow'}`}>{m.role}</span>
            </div>
            {m.user_id !== userId && (
              <button onClick={() => removeMember(m.id)} className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px', color:'var(--red)' }}>Remove</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}