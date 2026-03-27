import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, Trash2, Calendar, MapPin, Users } from 'lucide-react'
import { useRole } from '../hooks/useRole'

const STATUS_COLORS = {
  planned: 'tag-yellow',
  active: 'tag-green',
  completed: 'tag-green',
  cancelled: 'tag-red'
}

export default function Raids({ session }) {
  const [faction, setFaction] = useState(null)
  const [raids, setRaids] = useState([])
  const [rsvps, setRsvps] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title:'', target_location:'', scheduled_at:'', description:'' })
  const userId = session.user.id
  const { perms } = useRole(session.user.id)

  useEffect(() => { loadFaction() }, [])

  async function loadFaction() {
    const { data } = await supabase.from('faction_members').select('*, factions(*)').eq('user_id', userId).maybeSingle()
    if (data?.factions) { setFaction(data.factions); loadRaids(data.factions.id) }
  }

  async function loadRaids(fid) {
    const { data } = await supabase.from('raids').select('*').eq('faction_id', fid).order('scheduled_at')
    setRaids(data || [])
    if (data?.length) loadRsvps(data.map(r => r.id))
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
    if (!form.title.trim() || !form.scheduled_at) return
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
      setRaids(r => [...r, data].sort((a,b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)))
      setForm({ title:'', target_location:'', scheduled_at:'', description:'' })
      setShowForm(false)
      notifyDiscord(faction.id, data)
    }
  }

  async function deleteRaid(id) {
    await supabase.from('raids').delete().eq('id', id)
    setRaids(r => r.filter(x => x.id !== id))
  }

  async function toggleRsvp(raidId) {
    const existing = rsvps[raidId]?.find(r => r.user_id === userId)
    if (existing) {
      await supabase.from('raid_rsvps').delete().eq('id', existing.id)
      setRsvps(r => ({ ...r, [raidId]: r[raidId].filter(x => x.user_id !== userId) }))
    } else {
      const { data } = await supabase.from('raid_rsvps').insert({ raid_id: raidId, user_id: userId, status: 'going' }).select().single()
      setRsvps(r => ({ ...r, [raidId]: [...(r[raidId] || []), data] }))
    }
  }

  async function notifyDiscord(factionId, raid) {
    const { data: settings } = await supabase.from('notification_settings').select('webhook_url, notify_raids').eq('faction_id', factionId).maybeSingle()
    if (!settings?.webhook_url || !settings?.notify_raids) return
    await fetch(settings.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '⚔️ Raid Scheduled',
          fields: [
            { name: 'Operation', value: raid.title, inline: true },
            { name: 'Target', value: raid.target_location || 'TBD', inline: true },
            { name: 'Time', value: new Date(raid.scheduled_at).toLocaleString(), inline: false },
            { name: 'Briefing', value: raid.description || 'No briefing provided.' }
          ],
          color: 0xf87171,
          timestamp: new Date().toISOString()
        }]
      })
    }).catch(() => {})
  }

  const upcoming = raids.filter(r => new Date(r.scheduled_at) >= new Date())
  {past.length > 0 && (
  <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
    <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--muted)', fontSize:'14px', letterSpacing:'0.1em' }}>PAST OPERATIONS</h3>
    {past.map(raid => {
      const [debriefOpen, setDebriefOpen] = useState(false)
      const [debrief, setDebrief] = useState({
        outcome: raid.outcome || '',
        casualties: raid.casualties || 0,
        loot_summary: raid.loot_summary || '',
        debrief_notes: raid.debrief_notes || '',
        rating: raid.rating || 0
      })

      async function saveDebrief(raidId) {
        await supabase.from('raids').update(debrief).eq('id', raidId)
        setRaids(r => r.map(x => x.id === raidId ? {...x, ...debrief} : x))
        setDebriefOpen(false)
        await supabase.from('events').insert({
          faction_id: faction.id,
          created_by: userId,
          type: 'raid',
          title: `Raid Debrief: ${raid.title}`,
          description: `Outcome: ${debrief.outcome} | Casualties: ${debrief.casualties} | ${debrief.loot_summary}`
        })
      }

      return (
        <div key={raid.id} className="card" style={{ borderLeft:'3px solid var(--border)', display:'flex', flexDirection:'column', gap:'10px', opacity: raid.outcome ? 0.8 : 1 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <span style={{ fontWeight:700 }}>{raid.title}</span>
              {raid.target_location && <span style={{ color:'var(--muted)', fontSize:'13px', marginLeft:'10px' }}>{raid.target_location}</span>}
              <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px' }}>{new Date(raid.scheduled_at).toLocaleString()}</div>
            </div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              {raid.outcome && (
                <span style={{ fontSize:'13px', color: raid.outcome==='success' ? 'var(--green)' : 'var(--red)' }}>
                  {raid.outcome==='success' ? '✅ Success' : '❌ Failed'}
                </span>
              )}
              {raid.rating && <span style={{ color:'var(--yellow)' }}>{'⭐'.repeat(raid.rating)}</span>}
              {perms.raids && (
                <button onClick={() => setDebriefOpen(d => !d)} className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px' }}>
                  {raid.outcome ? 'Edit Debrief' : '📋 Debrief'}
                </button>
              )}
            </div>
          </div>

          {debriefOpen && perms.raids && (
            <div style={{ background:'#0d1a0d', border:'1px solid var(--green-dim)', borderRadius:'6px', padding:'14px', display:'flex', flexDirection:'column', gap:'10px' }}>
              <h4 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'13px' }}>OPERATION DEBRIEF</h4>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>OUTCOME</label>
                  <select value={debrief.outcome} onChange={e => setDebrief(d => ({...d, outcome:e.target.value}))}>
                    <option value="">Select outcome...</option>
                    <option value="success">✅ Success</option>
                    <option value="partial">⚠️ Partial Success</option>
                    <option value="fail">❌ Failed</option>
                    <option value="aborted">🚫 Aborted</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>CASUALTIES</label>
                  <input type="number" min={0} value={debrief.casualties} onChange={e => setDebrief(d => ({...d, casualties:parseInt(e.target.value)||0}))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>LOOT SUMMARY</label>
                <input placeholder="e.g. 3x AK-74, 5x medical kits, vehicle parts..." value={debrief.loot_summary} onChange={e => setDebrief(d => ({...d, loot_summary:e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>NOTES</label>
                <textarea placeholder="What went well? What to improve?" value={debrief.debrief_notes} onChange={e => setDebrief(d => ({...d, debrief_notes:e.target.value}))} rows={2} />
              </div>
              <div>
                <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'6px' }}>RATING</label>
                <div style={{ display:'flex', gap:'4px' }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setDebrief(d => ({...d, rating:n}))} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:'20px' }}>
                      {n <= debrief.rating ? '⭐' : '☆'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button className="btn btn-green" onClick={() => saveDebrief(raid.id)}>Save Debrief</button>
                <button className="btn btn-ghost" onClick={() => setDebriefOpen(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )
    })}
  </div>
)}

  return (
    <div style={{ maxWidth:900, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>RAID PLANNER</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>Schedule operations and track attendance</p>
        </div>
        {faction && perms.raids && (
  <button className="btn btn-green" style={{ display:'flex', alignItems:'center', gap:'8px' }} onClick={() => setShowForm(f => !f)}>
    <Plus size={15} /> Schedule Raid
  </button>
)}
      </div>

      {showForm && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'15px' }}>NEW OPERATION</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <input placeholder="Operation name (e.g. Strike on NWAF)" value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} />
            <input placeholder="Target location" value={form.target_location} onChange={e => setForm(f => ({...f, target_location:e.target.value}))} />
          </div>
          <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({...f, scheduled_at:e.target.value}))} />
          <textarea placeholder="Briefing / description (optional)..." value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} rows={2} />
          <div style={{ display:'flex', gap:'8px' }}>
            <button className="btn btn-green" onClick={createRaid}>Create Operation</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
          No raids scheduled yet. Click "Schedule Raid" to plan your first operation.
        </div>
      )}

      {upcoming.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px', letterSpacing:'0.1em' }}>UPCOMING OPERATIONS</h3>
          {upcoming.map(raid => {
            const myRsvp = rsvps[raid.id]?.find(r => r.user_id === userId)
            const goingCount = rsvps[raid.id]?.length || 0
            return (
              <div key={raid.id} className="card" style={{ borderLeft:'3px solid var(--red)', display:'flex', flexDirection:'column', gap:'10px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                  <div>
                    <h3 style={{ fontSize:'18px', fontWeight:700 }}>{raid.title}</h3>
                    <div style={{ display:'flex', gap:'16px', marginTop:'6px', flexWrap:'wrap' }}>
                      {raid.target_location && (
                        <span style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'13px', color:'var(--muted)' }}>
                          <MapPin size={13} /> {raid.target_location}
                        </span>
                      )}
                      <span style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'13px', color:'var(--muted)' }}>
                        <Calendar size={13} /> {new Date(raid.scheduled_at).toLocaleString()}
                      </span>
                      <span style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'13px', color:'var(--green)' }}>
                        <Users size={13} /> {goingCount} going
                      </span>
                    </div>
                    {raid.description && <p style={{ fontSize:'14px', color:'var(--muted)', marginTop:'8px' }}>{raid.description}</p>}
                  </div>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                    <button
                      onClick={() => toggleRsvp(raid.id)}
                      className={`btn ${myRsvp ? 'btn-ghost' : 'btn-green'}`}
                      style={{ fontSize:'13px', padding:'6px 14px' }}
                    >
                      {myRsvp ? '✓ Going' : 'RSVP'}
                    </button>
                    {raid.created_by === userId && (
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
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--muted)', fontSize:'14px', letterSpacing:'0.1em' }}>PAST OPERATIONS</h3>
          {past.map(raid => (
            <div key={raid.id} className="card" style={{ borderLeft:'3px solid var(--border)', opacity:0.6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <span style={{ fontWeight:700 }}>{raid.title}</span>
                {raid.target_location && <span style={{ color:'var(--muted)', fontSize:'13px', marginLeft:'10px' }}>{raid.target_location}</span>}
                <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px' }}>{new Date(raid.scheduled_at).toLocaleString()}</div>
              </div>
              <span style={{ fontSize:'12px', color:'var(--muted)' }}>{rsvps[raid.id]?.length || 0} attended</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}