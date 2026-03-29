import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Plus, Trash2, MapPin, Calendar, Users, AlertTriangle } from 'lucide-react'
import { sendWebhookNotification } from './Settings'
import { useToast } from '../hooks/useToast'

export default function Raids({ session }) {
  const { role, faction } = useRole(session.user.id)
  const [raids, setRaids] = useState([])
  const [rsvps, setRsvps] = useState({})
  const [templates, setTemplates] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)
  const [form, setForm] = useState({ title:'', target_location:'', scheduled_at:'', description:'' })
  const userId = session.user.id
  const canManage = role === 'leader' || role === 'co-leader'
  const { success, error, ToastContainer } = useToast()

  useEffect(() => {
    if (faction?.id) {
      loadRaids(faction.id)
      loadTemplates(faction.id)
    }
  }, [faction?.id])

  async function loadRaids(fid) {
    const { data } = await supabase.from('raids').select('*').eq('faction_id', fid).order('scheduled_at')
    setRaids(data || [])
    if (data?.length) loadRsvps(data.map(r => r.id))
  }

  async function loadTemplates(fid) {
    const { data } = await supabase.from('raid_templates').select('*').eq('faction_id', fid)
    setTemplates(data || [])
  }

  async function loadRsvps(raidIds) {
    const { data } = await supabase.from('raid_rsvps').select('*').in('raid_id', raidIds)
    const map = {}
    data?.forEach(r => {
      if (!map[r.raid_id]) map[r.raid_id] = []
      map[r.raid_id].push(r)
    })
    setRsvps(map)
  }

  async function createRaid() {
    if (!form.title.trim() || !form.scheduled_at || !faction) return
    const { data, error } = await supabase.from('raids').insert({
      faction_id: faction.id,
      created_by: userId,
      title: form.title,
      target_location: form.target_location,
      scheduled_at: form.scheduled_at,
      description: form.description,
      status: 'planned'
    }).select().single()
    if (!error) {
      setRaidssuccess('Item added to stockpile!')(r => [...r, data].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)))
      setForm({ title:'', target_location:'', scheduled_at:'', description:'' })
      setShowForm(false)
      notifyDiscord(faction.id, data)
      await supabase.from('events').insert({
        faction_id: faction.id, created_by: userId, type: 'raid',
        title: `⚔️ Raid Scheduled: ${data.title}`,
        description: `Target: ${data.target_location || 'TBD'} — ${new Date(data.scheduled_at).toLocaleString()}`
      })
      const { data: members } = await supabase.from('faction_members').select('user_id').eq('faction_id', faction.id).neq('user_id', userId)
      if (members?.length) {
        await supabase.from('notifications').insert(members.map(m => ({
          faction_id: faction.id, user_id: m.user_id, type: 'raid',
          title: `⚔️ Raid Scheduled: ${data.title}`,
          body: `Target: ${data.target_location || 'TBD'} at ${new Date(data.scheduled_at).toLocaleString()}`
        })))
      }
    }
  }

  async function saveTemplate() {
    if (!faction || !form.title) return
    const { data } = await supabase.from('raid_templates').insert({
      faction_id: faction.id, created_by: userId,
      title: form.title, target_location: form.target_location, description: form.description
    }).select().single()
    if (data) { setTemplates(t => [...t, data]); alert('Template saved!') }
  }

  async function deleteRaid(id) {
    success('Item removed.')
    await supabase.from('raids').delete().eq('id', id)
    setRaids(r => r.filter(x => x.id !== id))
  }

  async function clearAllRaids() {
    if (!faction) return
    success('Stockpile cleared.')
    await supabase.from('raid_rsvps').delete().in('raid_id', raids.map(r => r.id))
    await supabase.from('raids').delete().eq('faction_id', faction.id)
    await supabase.from('events').insert({
      faction_id: faction.id, created_by: userId, type: 'raid',
      title: '🗑️ All Raids Cleared',
      description: 'Raid history cleared by leadership'
    })
    setRaids([])
    setRsvps({})
    setShowClearModal(false)
  }

  async function toggleRsvp(raidId) {
    const existing = rsvps[raidId]?.find(r => r.user_id === userId)
    if (existing) {
      await supabase.from('raid_rsvps').delete().eq('id', existing.id)
      setRsvps(r => ({ ...r, [raidId]: r[raidId].filter(x => x.user_id !== userId) }))
    } else {
      const { data } = await supabase.from('raid_rsvps').insert({ raid_id: raidId, user_id: userId, status: 'going' }).select().single()
      setRsvps(r => ({ ...r, [raidId]: [...(r[raidId] || []), data] }))
      const raid = raids.find(r => r.id === raidId)
      if (raid && faction) {
        const { data: profile } = await supabase.from('profiles').select('discord_username').eq('id', userId).single()
        const username = profile?.discord_username || 'A member'
        const { data: leaders } = await supabase.from('faction_members').select('user_id').eq('faction_id', faction.id).in('role', ['leader', 'co-leader'])
        if (leaders?.length) {
          await supabase.from('notifications').insert(leaders.map(l => ({
            faction_id: faction.id, user_id: l.user_id, type: 'raid',
            title: `✅ ${username} is going on ${raid.title}`,
            body: new Date(raid.scheduled_at).toLocaleString()
          })))
        }
        await sendWebhookNotification(
          faction.id, 'raid',
          `✅ RSVP — ${raid.title}`,
          [
            { name:'Member', value:username, inline:true },
            { name:'Operation', value:raid.title, inline:true },
            { name:'Time', value:new Date(raid.scheduled_at).toLocaleString(), inline:false },
            { name:'Total Going', value:`${(rsvps[raidId]?.length || 0) + 1}`, inline:true },
          ],
          0x4ade80
        )
      }
    }
  }

  async function notifyDiscord(factionId, raid) {
    const { data: settings } = await supabase.from('notification_settings').select('webhook_url, notify_raids').eq('faction_id', factionId).maybeSingle()
    if (!settings?.webhook_url || !settings?.notify_raids) return
    await fetch(settings.webhook_url, {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ embeds:[{ title:'⚔️ Raid Scheduled', fields:[
        { name:'Operation', value:raid.title, inline:true },
        { name:'Target', value:raid.target_location || 'TBD', inline:true },
        { name:'Time', value:new Date(raid.scheduled_at).toLocaleString(), inline:false },
      ], color:0xf87171, timestamp:new Date().toISOString() }] })
    }).catch(() => {})
  }

  const upcoming = raids.filter(r => new Date(r.scheduled_at) >= new Date())
  const past = raids.filter(r => new Date(r.scheduled_at) < new Date())

  if (!faction) return (
    <div style={{ padding:'80px', textAlign:'center', color:'var(--muted)' }}>
      Join or create a faction to access the Raid Planner.
    </div>
  )

  return (
    <div style={{ maxWidth:900, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>RAID PLANNER</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>Schedule operations and track attendance</p>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {canManage && raids.length > 0 && (
            <button className="btn btn-ghost" style={{ fontSize:'13px', color:'var(--red)', display:'flex', alignItems:'center', gap:'6px' }} onClick={() => setShowClearModal(true)}>
              <AlertTriangle size={13} /> Clear All Raids
            </button>
          )}
          {canManage && (
            <button className="btn btn-green" style={{ display:'flex', alignItems:'center', gap:'8px' }} onClick={() => setShowForm(f => !f)}>
              <Plus size={15} /> Schedule Raid
            </button>
          )}
        </div>
      </div>

      {/* Clear Modal */}
      {showClearModal && (
        <div style={{ position:'fixed', inset:0, background:'#00000088', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }} onClick={() => setShowClearModal(false)}>
          <div className="card" style={{ maxWidth:'420px', width:'100%', display:'flex', flexDirection:'column', gap:'16px', borderColor:'var(--red)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <AlertTriangle size={20} color="var(--red)" />
              <h3 style={{ fontWeight:700, fontSize:'18px', color:'var(--red)' }}>Clear All Raids</h3>
            </div>
            <p style={{ color:'var(--muted)', fontSize:'14px' }}>
              This will permanently delete all <strong style={{ color:'var(--text)' }}>{raids.length} raids</strong> and their RSVPs. This cannot be undone.
            </p>
            <div style={{ display:'flex', gap:'8px' }}>
              <button className="btn" style={{ flex:1, background:'#b91c1c', color:'#fff', border:'none', fontWeight:700 }} onClick={clearAllRaids}>
                Yes, Clear Everything
              </button>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setShowClearModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {!canManage && (
        <div className="card" style={{ background:'#1a1a0d', borderColor:'var(--yellow)', fontSize:'13px', color:'var(--muted)' }}>
          🔒 Only <strong style={{ color:'var(--yellow)' }}>Leaders</strong> and <strong style={{ color:'var(--yellow)' }}>Co-Leaders</strong> can schedule raids. You can RSVP below.
        </div>
      )}

      {showForm && canManage && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'15px' }}>NEW OPERATION</h3>
          {templates.length > 0 && (
            <div>
              <p style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'6px' }}>LOAD TEMPLATE</p>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {templates.map(t => (
                  <button key={t.id} onClick={() => setForm(f => ({...f, title:t.title, target_location:t.target_location||'', description:t.description||''}))}
                    className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px' }}>
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <input placeholder="Operation name" value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} />
            <input placeholder="Target location" value={form.target_location} onChange={e => setForm(f => ({...f, target_location:e.target.value}))} />
          </div>
          <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({...f, scheduled_at:e.target.value}))} />
          <textarea placeholder="Briefing..." value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} rows={2} />
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            <button className="btn btn-green" onClick={createRaid}>Create Operation</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            {form.title && (
              <button className="btn btn-ghost" style={{ fontSize:'12px' }} onClick={saveTemplate}>
                💾 Save as Template
              </button>
            )}
          </div>
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
          No raids scheduled yet.{canManage ? ' Click "Schedule Raid" to plan your first operation.' : ' Check back when your leaders schedule an operation.'}
        </div>
      )}

      {upcoming.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px', letterSpacing:'0.1em' }}>UPCOMING OPERATIONS ({upcoming.length})</h3>
          {upcoming.map(raid => {
            const myRsvp = rsvps[raid.id]?.find(r => r.user_id === userId)
            const goingCount = rsvps[raid.id]?.length || 0
            return (
              <div key={raid.id} className="card" style={{ borderLeft:'3px solid var(--red)', display:'flex', flexDirection:'column', gap:'10px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <h3 style={{ fontSize:'18px', fontWeight:700 }}>{raid.title}</h3>
                    <div style={{ display:'flex', gap:'16px', marginTop:'6px', flexWrap:'wrap' }}>
                      {raid.target_location && <span style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'13px', color:'var(--muted)' }}><MapPin size={13} /> {raid.target_location}</span>}
                      <span style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'13px', color:'var(--muted)' }}><Calendar size={13} /> {new Date(raid.scheduled_at).toLocaleString()}</span>
                      <span style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'13px', color:'var(--green)' }}><Users size={13} /> {goingCount} going</span>
                    </div>
                    {raid.description && <p style={{ fontSize:'14px', color:'var(--muted)', marginTop:'8px' }}>{raid.description}</p>}
                  </div>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center', flexShrink:0 }}>
                    <button onClick={() => toggleRsvp(raid.id)} className={`btn ${myRsvp ? 'btn-ghost' : 'btn-green'}`} style={{ fontSize:'13px', padding:'6px 14px' }}>
                      {myRsvp ? '✓ Going' : 'RSVP'}
                    </button>
                    {canManage && (
                      <button onClick={() => deleteRaid(raid.id)} className="btn btn-ghost" style={{ padding:'6px' }}>
                        <Trash2 size={14} color="var(--red)" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {past.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--muted)', fontSize:'14px', letterSpacing:'0.1em' }}>PAST OPERATIONS ({past.length})</h3>
          {past.map(raid => (
            <PastRaid key={raid.id} raid={raid} userId={userId} faction={faction} canManage={canManage} setRaids={setRaids} />
          ))}
        </div>
      )}
    </div>
  )
}

function PastRaid({ raid, userId, faction, canManage, setRaids }) {
  const [open, setOpen] = useState(false)
  const [debrief, setDebrief] = useState({
    outcome: raid.outcome || '',
    casualties: raid.casualties || 0,
    loot_summary: raid.loot_summary || '',
    debrief_notes: raid.debrief_notes || '',
    rating: raid.rating || 0
  })

  async function save() {
    await supabase.from('raids').update(debrief).eq('id', raid.id)
    setRaids(r => r.map(x => x.id === raid.id ? {...x, ...debrief} : x))
    setOpen(false)
    if (faction) {
      await supabase.from('events').insert({
        faction_id: faction.id, created_by: userId, type: 'raid',
        title: `📋 Raid Debrief: ${raid.title}`,
        description: `Outcome: ${debrief.outcome} | Casualties: ${debrief.casualties} | Loot: ${debrief.loot_summary}`
      })
    }
  }

  return (
    <div className="card" style={{ borderLeft:'3px solid var(--border)', display:'flex', flexDirection:'column', gap:'10px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
        <div>
          <span style={{ fontWeight:700 }}>{raid.title}</span>
          {raid.target_location && <span style={{ color:'var(--muted)', fontSize:'13px', marginLeft:'10px' }}>{raid.target_location}</span>}
          <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px' }}>{new Date(raid.scheduled_at).toLocaleString()}</div>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          {raid.outcome && (
            <span style={{ fontSize:'13px', color: raid.outcome==='success' ? 'var(--green)' : 'var(--red)' }}>
              {raid.outcome==='success' ? '✅ Success' : raid.outcome==='partial' ? '⚠️ Partial' : raid.outcome==='aborted' ? '🚫 Aborted' : '❌ Failed'}
            </span>
          )}
          {raid.rating > 0 && <span style={{ color:'var(--yellow)' }}>{'★'.repeat(raid.rating)}</span>}
          {canManage && (
            <button onClick={() => setOpen(o => !o)} className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px' }}>
              {raid.outcome ? 'Edit Debrief' : '📋 Debrief'}
            </button>
          )}
        </div>
      </div>

      {open && canManage && (
        <div style={{ background:'#0d1a0d', border:'1px solid var(--green-dim)', borderRadius:'6px', padding:'14px', display:'flex', flexDirection:'column', gap:'10px' }}>
          <h4 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'13px' }}>OPERATION DEBRIEF</h4>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div>
              <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>OUTCOME</label>
              <select value={debrief.outcome} onChange={e => setDebrief(d => ({...d, outcome:e.target.value}))}>
                <option value="">Select outcome...</option>
                <option value="success">✅ Success</option>
                <option value="partial">⚠️ Partial</option>
                <option value="fail">❌ Failed</option>
                <option value="aborted">🚫 Aborted</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>CASUALTIES</label>
              <input type="number" min={0} value={debrief.casualties} onChange={e => setDebrief(d => ({...d, casualties:parseInt(e.target.value)||0}))} />
            </div>
          </div>
          <input placeholder="Loot summary (e.g. 3x KA-74, medical kits...)" value={debrief.loot_summary} onChange={e => setDebrief(d => ({...d, loot_summary:e.target.value}))} />
          <textarea placeholder="Notes — what went well, what to improve..." value={debrief.debrief_notes} onChange={e => setDebrief(d => ({...d, debrief_notes:e.target.value}))} rows={2} />
          <div>
            <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'6px' }}>RATING</label>
            <div style={{ display:'flex', gap:'4px' }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setDebrief(d => ({...d, rating:n}))} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:'22px' }}>
                  {n <= debrief.rating ? '★' : '☆'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button className="btn btn-green" onClick={save}>Save Debrief</button>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
      <ToastContainer />
    </div>
  )
}