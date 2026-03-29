import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Save, Link, Copy, RefreshCw, Bell, TestTube } from 'lucide-react'

const OFFICIAL_SERVERS = [
  'Chernarus Official #1',
  'Chernarus Official #2',
  'Livonia Official #1',
  'Livonia Official #2',
  'Sakhal Official #1',
  'Sakhal Official #2',
]

export async function sendWebhookNotification(factionId, type, title, fields = [], color = 0x4ade80) {
  const { data: settings } = await supabase
    .from('notification_settings')
    .select('webhook_url, notify_raids, notify_diplomacy, notify_bounties, notify_announcements')
    .eq('faction_id', factionId)
    .maybeSingle()
  if (!settings?.webhook_url) return
  const typeMap = {
    raid: settings.notify_raids,
    diplomacy: settings.notify_diplomacy,
    bounty: settings.notify_bounties,
    announcement: settings.notify_announcements,
  }
  if (type !== 'general' && typeMap[type] === false) return
  await fetch(settings.webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title,
        color,
        fields,
        footer: { text: `Faction Hub • ${new Date().toLocaleDateString()}` },
        timestamp: new Date().toISOString()
      }]
    })
  }).catch(() => {})
}

export default function Settings({ session }) {
  const { role, faction, reload } = useRole(session.user.id)
  const [form, setForm] = useState({ name:'', tag:'', description:'', is_recruiting:true })
  const [serverInput, setServerInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [existingServers, setExistingServers] = useState([])
  const [settings, setSettings] = useState({ webhook_url:'', notify_raids:true, notify_diplomacy:true, notify_bounties:true, notify_announcements:true })
  const [invite, setInvite] = useState(null)
  const [members, setMembers] = useState([])
  const [saved, setSaved] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
const [showDeleteModal, setShowDeleteModal] = useState(false)
const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [testingWebhook, setTestingWebhook] = useState(false)
  const userId = session.user.id
  const canEdit = role === 'leader' || role === 'co-leader'

  useEffect(() => {
    if (faction?.id) {
      setForm({
        name: faction.name || '',
        tag: faction.tag || '',
        description: faction.description || '',
        is_recruiting: faction.is_recruiting ?? true
      })
      setServerInput(faction.server_name || '')
      loadSettings()
      loadInvite()
      loadMembers()
      loadExistingServers()
    }
  }, [faction?.id, faction?.name, faction?.server_name, faction?.tag, faction?.description])

  async function loadExistingServers() {
    const { data } = await supabase.from('factions').select('server_name').not('server_name', 'is', null).neq('server_name', '')
    const names = [...new Set((data || []).map(f => f.server_name).filter(Boolean))]
    setExistingServers(names)
  }

  async function loadSettings() {
    const { data } = await supabase.from('notification_settings').select('*').eq('faction_id', faction.id).maybeSingle()
    if (data) setSettings(data)
  }

  async function loadInvite() {
    const { data } = await supabase.from('invites').select('*').eq('faction_id', faction.id).maybeSingle()
    setInvite(data)
  }

  async function loadMembers() {
    const { data } = await supabase.from('faction_members').select('*, profile:profiles(discord_username, discord_avatar)').eq('faction_id', faction.id).order('joined_at')
    setMembers(data || [])
  }

  async function saveFaction() {
    if (!faction || !canEdit) return
    const serverToSave = serverInput.trim()
    const { error } = await supabase.from('factions').update({
      name: form.name,
      tag: form.tag,
      description: form.description,
      server_name: serverToSave || null,
      is_recruiting: form.is_recruiting
    }).eq('id', faction.id)
    if (!error) {
      setSaved(true)
      setShowCustomInput(false)
      await reload()
      loadExistingServers()
      setTimeout(() => setSaved(false), 2000)
    } else {
      alert('Failed to save: ' + error.message)
    }
  }

  async function saveSettings() {
    if (!faction) return
    const { data: existing } = await supabase.from('notification_settings').select('id').eq('faction_id', faction.id).maybeSingle()
    if (existing) {
      await supabase.from('notification_settings').update(settings).eq('faction_id', faction.id)
    } else {
      await supabase.from('notification_settings').insert({ ...settings, faction_id: faction.id })
    }
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  }

  async function testWebhook() {
    if (!settings.webhook_url) return
    setTestingWebhook(true)
    try {
      await fetch(settings.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: '✅ Webhook Test — Faction Hub',
            description: `Your webhook for **${faction.name}** is working correctly!`,
            color: 0x4ade80,
            fields: [
              { name: '⚔️ Raids', value: settings.notify_raids ? 'Enabled' : 'Disabled', inline: true },
              { name: '🤝 Diplomacy', value: settings.notify_diplomacy ? 'Enabled' : 'Disabled', inline: true },
              { name: '🎯 Bounties', value: settings.notify_bounties ? 'Enabled' : 'Disabled', inline: true },
              { name: '📣 Announcements', value: settings.notify_announcements ? 'Enabled' : 'Disabled', inline: true },
            ],
            footer: { text: `Faction Hub • ${new Date().toLocaleDateString()}` },
            timestamp: new Date().toISOString()
          }]
        })
      })
      alert('✅ Test notification sent successfully!')
    } catch {
      alert('❌ Failed to send test. Check your webhook URL.')
    }
    setTestingWebhook(false)
  }

  async function sendReport(type) {
    if (!settings.webhook_url || !faction) return
    const [membersRes, territoriesRes, raidsRes, bountiesRes, resourcesRes] = await Promise.all([
      supabase.from('faction_members').select('id', { count:'exact', head:true }).eq('faction_id', faction.id),
      supabase.from('territories').select('id', { count:'exact', head:true }).eq('faction_id', faction.id),
      supabase.from('raids').select('id', { count:'exact', head:true }).eq('faction_id', faction.id),
      supabase.from('bounties').select('id', { count:'exact', head:true }).eq('faction_id', faction.id).eq('status', 'completed'),
      supabase.from('resources').select('quantity').eq('faction_id', faction.id),
    ])
    const totalResources = resourcesRes.data?.reduce((sum, r) => sum + (r.quantity || 0), 0) || 0
    const fields = [
      { name:'👥 Members', value:`${membersRes.count || 0}`, inline:true },
      { name:'🗺️ Territories', value:`${territoriesRes.count || 0}`, inline:true },
      { name:'⚔️ Total Raids', value:`${raidsRes.count || 0}`, inline:true },
      { name:'🎯 Bounties Collected', value:`${bountiesRes.count || 0}`, inline:true },
      { name:'📦 Stockpile Items', value:`${totalResources}`, inline:true },
    ]
    await fetch(settings.webhook_url, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        embeds:[{
          title: `${type === 'weekly' ? '📊 Weekly' : '📋 Daily'} Report — ${faction.name}`,
          color: 0x4ade80, fields,
          footer:{ text:`Faction Hub • ${new Date().toLocaleDateString()}` },
          timestamp: new Date().toISOString()
        }]
      })
    }).catch(() => {})
    await supabase.from('faction_reports').insert({ faction_id: faction.id, type, summary:{ members: membersRes.count } })
    alert(`${type === 'weekly' ? 'Weekly' : 'Daily'} report sent to Discord!`)
  }

  async function generateInvite() {
    setInviteLoading(true)
    const code = Math.random().toString(36).substring(2, 10).toUpperCase()
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    if (invite) {
      const { data } = await supabase.from('invites').update({ code, expires_at: expires, uses: 0 }).eq('id', invite.id).select().single()
      setInvite(data)
    } else {
      const { data } = await supabase.from('invites').insert({ faction_id: faction.id, code, expires_at: expires, max_uses: 50, uses: 0 }).select().single()
      setInvite(data)
    }
    setInviteLoading(false)
  }

  async function copyInvite() {
    const url = `${window.location.origin}/invite/${invite.code}`
    await navigator.clipboard.writeText(url)
    alert('Invite link copied!')
  }

  async function kickMember(userIdToKick) {
    if (!window.confirm('Remove this member from the faction?')) return
    await supabase.from('faction_members').delete().eq('faction_id', faction.id).eq('user_id', userIdToKick)
    await supabase.from('member_history').insert({ faction_id: faction.id, user_id: userIdToKick, action: 'left' })
    loadMembers()
  }
async function leaveFaction() {
  if (!window.confirm('Are you sure you want to leave this faction? You will lose access to all faction data.')) return
  await supabase.from('faction_members').delete().eq('faction_id', faction.id).eq('user_id', userId)
  await supabase.from('member_history').insert({ faction_id: faction.id, user_id: userId, action: 'left' })
  window.location.href = '/'
}

async function deleteFaction() {
  if (deleteConfirmName.trim().toLowerCase() !== faction.name.toLowerCase()) {
    alert('Faction name does not match. Please type the exact faction name to confirm.')
    return
  }
  // Notify all members before deleting
  const { data: allMembers } = await supabase
    .from('faction_members')
    .select('user_id')
    .eq('faction_id', faction.id)
    .neq('user_id', userId)
  if (allMembers?.length) {
    await supabase.from('notifications').insert(allMembers.map(m => ({
      faction_id: faction.id,
      user_id: m.user_id,
      type: 'general',
      title: `💀 ${faction.name} has been disbanded`,
      body: 'The faction leader has dissolved the faction. You are now factionless.'
    })))
  }
  // Delete faction — cascade will handle all related data
  await supabase.from('factions').delete().eq('id', faction.id)
  window.location.href = '/'
}
  async function changeRole(memberId, newRole) {
  if (newRole === 'leader') {
    if (!window.confirm('Transfer leadership? You will become Co-Leader and this member will become the new Leader.')) return
    // Demote current leader to co-leader
    await supabase.from('faction_members').update({ role: 'co-leader' }).eq('faction_id', faction.id).eq('user_id', userId)
    // Promote selected member to leader
    await supabase.from('faction_members').update({ role: 'leader' }).eq('id', memberId)
    await supabase.from('events').insert({
      faction_id: faction.id,
      created_by: userId,
      type: 'member',
      title: '👑 Leadership Transferred',
      description: 'Faction leadership has been transferred to a new leader'
    })
    await reload()
    loadMembers()
  } else {
    await supabase.from('faction_members').update({ role: newRole }).eq('id', memberId)
    loadMembers()
  }
}

  const communityServers = existingServers.filter(s => !OFFICIAL_SERVERS.includes(s))

  if (!faction) return (
    <div style={{ padding:'80px', textAlign:'center', color:'var(--muted)' }}>
      Join or create a faction to access settings.
    </div>
  )

  return (
    <div style={{ maxWidth:800, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>FACTION SETTINGS</h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>Manage your faction info, members and notifications</p>
      </div>

      {/* Faction Info */}
      {canEdit && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <h3 style={{ fontWeight:700, fontSize:'16px' }}>⚙️ Faction Info</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div>
              <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>FACTION NAME</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} placeholder="Faction name..." />
            </div>
            <div>
              <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>TAG (optional)</label>
              <input value={form.tag} onChange={e => setForm(f => ({...f, tag:e.target.value}))} placeholder="[TAG]" maxLength={8} />
            </div>
          </div>
          <div>
            <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>DESCRIPTION</label>
            <textarea value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} placeholder="Tell other factions about your group..." rows={2} />
          </div>

          <div>
            <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>
              SERVER {serverInput && <span style={{ color:'var(--green)' }}>— currently: {serverInput}</span>}
            </label>
            {!showCustomInput ? (
              <select
                value={serverInput}
                onChange={e => {
                  if (e.target.value === '__custom__') {
                    setShowCustomInput(true)
                    setServerInput('')
                  } else {
                    setServerInput(e.target.value)
                  }
                }}
              >
                <option value="">— No server set —</option>
                <optgroup label="🏢 Official Servers">
                  {OFFICIAL_SERVERS.map(s => <option key={s} value={s}>{s}</option>)}
                </optgroup>
                {communityServers.length > 0 && (
                  <optgroup label="⚡ Community & Modded Servers">
                    {communityServers.map(s => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                )}
                <option value="__custom__">➕ Add a new server...</option>
              </select>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                <input autoFocus placeholder="Type your server name exactly (e.g. DayZ Community PvP #1)" value={serverInput} onChange={e => setServerInput(e.target.value)} />
                <div style={{ display:'flex', gap:'8px' }}>
                  <button className="btn btn-green" style={{ fontSize:'12px' }} onClick={() => setShowCustomInput(false)} disabled={!serverInput.trim()}>
                    ✓ Use This Server
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize:'12px' }} onClick={() => { setShowCustomInput(false); setServerInput(faction.server_name || '') }}>
                    Cancel
                  </button>
                </div>
                <p style={{ fontSize:'11px', color:'var(--yellow)' }}>
                  ⚠️ Type carefully — other factions will see this exact name. Click "Use This Server" then "Save Changes".
                </p>
              </div>
            )}
          </div>

          <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', fontSize:'14px' }}>
            <input type="checkbox" checked={form.is_recruiting} onChange={e => setForm(f => ({...f, is_recruiting: e.target.checked}))} style={{ width:'auto', accentColor:'var(--green)' }} />
            Open for recruitment
          </label>

          <button className="btn btn-green" style={{ alignSelf:'flex-start', display:'flex', alignItems:'center', gap:'8px' }} onClick={saveFaction}>
            <Save size={14} /> {saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Invite Link */}
      {canEdit && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <h3 style={{ fontWeight:700, fontSize:'16px' }}>🔗 Invite Link</h3>
          <p style={{ fontSize:'13px', color:'var(--muted)' }}>Share this link with players you want to recruit. Expires after 7 days or 50 uses.</p>
          {invite ? (
            <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
              <code style={{ background:'#0d1a0d', padding:'8px 12px', borderRadius:'4px', fontSize:'13px', flex:1, wordBreak:'break-all' }}>
                {window.location.origin}/invite/{invite.code}
              </code>
              <button className="btn btn-green" style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }} onClick={copyInvite}>
                <Copy size={13} /> Copy
              </button>
              <button className="btn btn-ghost" style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }} onClick={generateInvite}>
                <RefreshCw size={13} /> New Link
              </button>
            </div>
          ) : (
            <button className="btn btn-green" style={{ alignSelf:'flex-start', display:'flex', alignItems:'center', gap:'8px' }} onClick={generateInvite} disabled={inviteLoading}>
              <Link size={14} /> {inviteLoading ? 'Generating...' : 'Generate Invite Link'}
            </button>
          )}
        </div>
      )}

      {/* Members */}
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
        <h3 style={{ fontWeight:700, fontSize:'16px' }}>👥 Members ({members.length})</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'8px', maxHeight:'400px', overflowY:'auto' }}>
          {members.map(m => (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'8px 12px', background:'var(--surface)', borderRadius:'6px', border:'1px solid var(--border)' }}>
              {m.profile?.discord_avatar
                ? <img src={m.profile.discord_avatar} style={{ width:32, height:32, borderRadius:'50%', border:'1px solid var(--border)', flexShrink:0 }} />
                : <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>👤</div>
              }
              <span style={{ flex:1, fontWeight:600, fontSize:'14px' }}>{m.profile?.discord_username || 'Unknown'}</span>
              {canEdit && m.user_id !== userId ? (
                <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                  <select value={m.role} onChange={e => changeRole(m.id, e.target.value)} style={{ fontSize:'12px', padding:'3px 8px', width:'auto' }}>
                    <option value="member">Member</option>
                    <option value="recruiter">Recruiter</option>
                    <option value="co-leader">Co-Leader</option>
                    {role === 'leader' && <option value="leader">Leader</option>}
                  </select>
                  <button onClick={() => kickMember(m.user_id)} className="btn btn-ghost" style={{ fontSize:'11px', padding:'3px 8px', color:'var(--red)' }}>
                    Kick
                  </button>
                </div>
              ) : (
                <span className={`tag ${m.role === 'leader' ? 'tag-green' : 'tag-yellow'}`}>{m.role}</span>
              )}
            </div>
          ))}
        </div>

        {/* Leave Faction — all non-leader members */}
        {role !== 'leader' && (
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:'14px' }}>
            <button
              className="btn btn-ghost"
              style={{ color:'var(--red)', fontSize:'13px', display:'flex', alignItems:'center', gap:'6px' }}
              onClick={leaveFaction}
            >
              🚪 Leave Faction
            </button>
            <p style={{ fontSize:'11px', color:'var(--muted)', marginTop:'6px' }}>
              You will lose access to all faction data. You can join or create a new faction afterwards.
            </p>
          </div>
        )}

        {/* Delete Faction — leader only */}
        {role === 'leader' && (
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:'14px', display:'flex', flexDirection:'column', gap:'8px' }}>
            <p style={{ fontSize:'12px', color:'var(--muted)' }}>
              As leader, you cannot leave the faction — you must either transfer leadership to another member or delete the faction entirely.
            </p>
            <button
              className="btn btn-ghost"
              style={{ color:'var(--red)', fontSize:'13px', alignSelf:'flex-start', display:'flex', alignItems:'center', gap:'6px', border:'1px solid var(--red)' }}
              onClick={() => setShowDeleteModal(true)}
            >
              💀 Disband Faction
            </button>
          </div>
        )}
      </div>

      {/* Discord Notifications */}
      {canEdit && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <h3 style={{ fontWeight:700, fontSize:'16px' }}>🔔 Discord Notifications</h3>
          <p style={{ fontSize:'13px', color:'var(--muted)' }}>
            Paste a Discord webhook URL to get automatic notifications in your Discord server.
            <a href="https://support.discord.com/hc/en-us/articles/228383668" target="_blank" rel="noreferrer" style={{ color:'var(--green)', marginLeft:'6px' }}>
              How to create a webhook →
            </a>
          </p>

          <div style={{ display:'flex', gap:'8px' }}>
            <input
              placeholder="https://discord.com/api/webhooks/..."
              value={settings.webhook_url || ''}
              onChange={e => setSettings(s => ({...s, webhook_url:e.target.value}))}
              style={{ flex:1 }}
            />
            {settings.webhook_url && (
              <button className="btn btn-ghost" style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', flexShrink:0 }} onClick={testWebhook} disabled={testingWebhook}>
                <TestTube size={12} /> {testingWebhook ? 'Testing...' : 'Test'}
              </button>
            )}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
            {[
              { key:'notify_raids', label:'⚔️ Raid scheduled' },
              { key:'notify_diplomacy', label:'🤝 Diplomacy proposals' },
              { key:'notify_bounties', label:'🎯 New bounties' },
              { key:'notify_announcements', label:'📣 Announcements' },
            ].map(({ key, label }) => (
              <label key={key} style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', fontSize:'13px' }}>
                <input type="checkbox" checked={settings[key] ?? true} onChange={e => setSettings(s => ({...s, [key]:e.target.checked}))} style={{ width:'auto', accentColor:'var(--green)' }} />
                {label}
              </label>
            ))}
          </div>

          <button className="btn btn-green" style={{ alignSelf:'flex-start', display:'flex', alignItems:'center', gap:'8px' }} onClick={saveSettings}>
            <Bell size={14} /> {settingsSaved ? '✓ Saved!' : 'Save Notification Settings'}
          </button>

          {settings.webhook_url && (
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:'14px', display:'flex', flexDirection:'column', gap:'10px' }}>
              <h4 style={{ fontWeight:700, fontSize:'14px' }}>📊 Faction Reports</h4>
              <p style={{ fontSize:'13px', color:'var(--muted)' }}>
                Send a full faction summary to your Discord channel including members, territories, raids, bounties and stockpile count.
              </p>
              <div style={{ display:'flex', gap:'8px' }}>
                <button className="btn btn-ghost" style={{ fontSize:'13px' }} onClick={() => sendReport('daily')}>📋 Send Daily Report</button>
                <button className="btn btn-ghost" style={{ fontSize:'13px' }} onClick={() => sendReport('weekly')}>📊 Send Weekly Report</button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Delete Faction Modal */}
      {showDeleteModal && (
        <div style={{ position:'fixed', inset:0, background:'#00000088', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }} onClick={() => setShowDeleteModal(false)}>
          <div className="card" style={{ maxWidth:'420px', width:'100%', display:'flex', flexDirection:'column', gap:'16px', borderColor:'var(--red)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight:700, fontSize:'18px', color:'var(--red)' }}>💀 Disband Faction</h3>
            <p style={{ color:'var(--muted)', fontSize:'14px', lineHeight:1.6 }}>
              This will <strong style={{ color:'var(--red)' }}>permanently delete</strong> your faction and kick all {members.length} members. All raids, resources, bounties, announcements and war logs will be destroyed forever.
            </p>
            <p style={{ color:'var(--muted)', fontSize:'14px' }}>
              All members will receive a notification that the faction has been disbanded and will become factionless.
            </p>
            <div>
              <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'6px' }}>
                TYPE YOUR FACTION NAME TO CONFIRM: <strong style={{ color:'var(--text)' }}>{faction.name}</strong>
              </label>
              <input
                placeholder={faction.name}
                value={deleteConfirmName}
                onChange={e => setDeleteConfirmName(e.target.value)}
                style={{ borderColor: deleteConfirmName && deleteConfirmName.toLowerCase() !== faction.name.toLowerCase() ? 'var(--red)' : 'var(--border)' }}
                autoFocus
              />
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button
                className="btn"
                style={{ flex:1, background: deleteConfirmName.toLowerCase() === faction.name.toLowerCase() ? '#b91c1c' : '#374151', color:'#fff', border:'none', fontWeight:700, cursor: deleteConfirmName.toLowerCase() === faction.name.toLowerCase() ? 'pointer' : 'not-allowed' }}
                onClick={deleteFaction}
                disabled={deleteConfirmName.toLowerCase() !== faction.name.toLowerCase()}
              >
                Permanently Disband
              </button>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => { setShowDeleteModal(false); setDeleteConfirmName('') }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}