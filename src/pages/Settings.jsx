import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Copy, Check, RefreshCw, Bell, Link, Server, Users } from 'lucide-react'
import ServerSelect from '../components/ServerSelect'
import { useRole } from '../hooks/useRole'

const ROLES = ['leader', 'co-leader', 'recruiter', 'member']
const ROLE_COLORS = { leader:'tag-green', 'co-leader':'tag-green', recruiter:'tag-yellow', member:'tag-yellow' }
const ROLE_ICONS = { leader:'👑', 'co-leader':'⭐', recruiter:'📋', member:'👤' }

export default function Settings({ session }) {
  const { role, faction, perms, loading } = useRole(session.user.id)
  const [invite, setInvite] = useState(null)
  const [copied, setCopied] = useState(false)
  const [settings, setSettings] = useState({ webhook_url:'', notify_raids:true, notify_diplomacy:true, notify_members:true, notify_war:true })
  const [factionForm, setFactionForm] = useState({ server_name:'', tag:'', description:'', is_recruiting:true })
  const [saved, setSaved] = useState(false)
  const [factionSaved, setFactionSaved] = useState(false)
  const [members, setMembers] = useState([])
  const [changingRole, setChangingRole] = useState(null)
  const userId = session.user.id

  useEffect(() => { if (faction) loadData() }, [faction])

  async function loadData() {
    setFactionForm({
      server_name: faction.server_name || '',
      tag: faction.tag || '',
      description: faction.description || '',
      is_recruiting: faction.is_recruiting ?? true
    })
    const { data: inv } = await supabase.from('invites').select('*').eq('faction_id', faction.id).order('created_at', { ascending:false }).limit(1).maybeSingle()
    setInvite(inv)
    const { data: notif } = await supabase.from('notification_settings').select('*').eq('faction_id', faction.id).maybeSingle()
    if (notif) setSettings(notif)
    loadMembers()
  }

  async function loadMembers() {
    const { data } = await supabase
      .from('faction_members')
      .select('*, profile:profiles(discord_username, discord_avatar)')
      .eq('faction_id', faction.id)
      .order('joined_at')
    setMembers(data || [])
  }

  async function saveFactionInfo() {
    await supabase.from('factions').update(factionForm).eq('id', faction.id)
    setFactionSaved(true)
    setTimeout(() => setFactionSaved(false), 2000)
  }

  async function toggleRecruiting() {
    const newVal = !factionForm.is_recruiting
    await supabase.from('factions').update({ is_recruiting: newVal }).eq('id', faction.id)
    setFactionForm(f => ({...f, is_recruiting: newVal}))
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

  async function changeRole(memberId, newRole) {
    await supabase.from('faction_members').update({ role: newRole }).eq('id', memberId)
    setMembers(m => m.map(x => x.id === memberId ? {...x, role: newRole} : x))
    setChangingRole(null)

    // Notify the member
    const member = members.find(m => m.id === memberId)
    if (member) {
      await supabase.from('notifications').insert({
        faction_id: faction.id,
        user_id: member.user_id,
        type: 'general',
        title: 'Your role has been updated',
        body: `You have been assigned the role: ${newRole}`
      })
    }
  }

  async function removeMember(memberId, memberUserId) {
    await supabase.from('faction_members').delete().eq('id', memberId)
    await supabase.from('member_history').insert({ faction_id: faction.id, user_id: memberUserId, action: 'left' })
    await supabase.from('notifications').insert({
      faction_id: faction.id,
      user_id: memberUserId,
      type: 'general',
      title: 'You have been removed from the faction',
      body: `You were removed from ${faction.name}`
    })
    setMembers(m => m.filter(x => x.id !== memberId))
  }

  if (loading) return <div style={{ padding:'40px', textAlign:'center', color:'var(--muted)' }}>Loading...</div>

  if (!faction) return (
    <div style={{ maxWidth:600, margin:'80px auto', padding:'0 24px', textAlign:'center', color:'var(--muted)' }}>
      You need to be in a faction to access settings.
    </div>
  )

  return (
    <div style={{ maxWidth:700, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>FACTION SETTINGS</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>{faction.name}</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span className={`tag ${ROLE_COLORS[role]}`}>{ROLE_ICONS[role]} {role}</span>
        </div>
      </div>

      {/* Recruiting Toggle — visible to leader, co-leader, recruiter */}
      {perms.recruiting && (
        <div className="card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px' }}>
          <div>
            <h3 style={{ fontWeight:700, fontSize:'15px' }}>Faction Status</h3>
            <p style={{ color:'var(--muted)', fontSize:'13px', marginTop:'2px' }}>
              {factionForm.is_recruiting ? 'Your faction is open to new members' : 'Your faction is currently full'}
            </p>
          </div>
          <button
            onClick={toggleRecruiting}
            className={`btn ${factionForm.is_recruiting ? 'btn-green' : 'btn-red'}`}
            style={{ minWidth:'120px', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}
          >
            {factionForm.is_recruiting ? '✅ Recruiting' : '🚫 Full'}
          </button>
        </div>
      )}

      {/* Faction Info — leader and co-leader only */}
      {(role === 'leader' || role === 'co-leader') && (
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
          <button className="btn btn-green" style={{ alignSelf:'flex-start' }} onClick={saveFactionInfo}>
            {factionSaved ? '✓ Saved!' : 'Save Faction Info'}
          </button>
        </div>
      )}

      {/* Invite Link — leader, co-leader, recruiter */}
      {perms.invites && (
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
      )}

      {/* Discord Notifications — leader only */}
      {role === 'leader' && (
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
      )}

      {/* Members */}
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        <h3 style={{ display:'flex', alignItems:'center', gap:'8px', fontWeight:700, fontSize:'16px' }}>
          <Users size={16} color="var(--green)" /> Members ({members.length})
        </h3>
        {members.map(m => (
          <div key={m.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
            {m.profile?.discord_avatar ? (
              <img src={m.profile.discord_avatar} style={{ width:32, height:32, borderRadius:'50%', border:'1px solid var(--border)' }} />
            ) : (
              <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {ROLE_ICONS[m.role]}
              </div>
            )}
            <div style={{ flex:1 }}>
              <span style={{ fontSize:'14px', fontWeight:600 }}>{m.profile?.discord_username || 'Unknown'}</span>
            </div>

            {/* Role badge / changer */}
            {(perms.kick && m.user_id !== userId) ? (
              changingRole === m.id ? (
                <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                  {ROLES.filter(r => r !== 'leader').map(r => (
                    <button key={r} onClick={() => changeRole(m.id, r)} className="btn btn-ghost" style={{ fontSize:'11px', padding:'3px 8px', color: r === m.role ? 'var(--green)' : 'var(--muted)', border: r === m.role ? '1px solid var(--green)' : '1px solid var(--border)' }}>
                      {ROLE_ICONS[r]} {r}
                    </button>
                  ))}
                  <button onClick={() => setChangingRole(null)} className="btn btn-ghost" style={{ fontSize:'11px', padding:'3px 8px' }}>✕</button>
                </div>
              ) : (
                <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                  <button onClick={() => setChangingRole(m.id)} className={`tag ${ROLE_COLORS[m.role]}`} style={{ cursor:'pointer', border:'none' }}>
                    {ROLE_ICONS[m.role]} {m.role}
                  </button>
                  <button onClick={() => removeMember(m.id, m.user_id)} className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px', color:'var(--red)' }}>
                    Kick
                  </button>
                </div>
              )
            ) : (
              <span className={`tag ${ROLE_COLORS[m.role]}`}>{ROLE_ICONS[m.role]} {m.role === userId ? 'You' : m.role}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}