import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Plus, Calendar, Trash2, Clock } from 'lucide-react'

const EVENT_TYPES = [
  { value:'wipe', label:'🔄 Server Wipe', color:'var(--red)' },
  { value:'truce', label:'🕊️ Server Truce', color:'#818cf8' },
  { value:'raid', label:'⚔️ Community Raid', color:'#f87171' },
  { value:'trade', label:'🛒 Trade Meet', color:'var(--yellow)' },
  { value:'general', label:'📢 General Event', color:'var(--green)' },
]

export default function ServerCalendar({ session }) {
  const { faction, role } = useRole(session.user.id)
  const [events, setEvents] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title:'', description:'', event_type:'general', scheduled_at:'' })
  const [filter, setFilter] = useState('all')
  const userId = session.user.id
  const canPost = role === 'leader' || role === 'co-leader'

  useEffect(() => { if (faction?.id) loadEvents() }, [faction?.id])

  async function loadEvents() {
    const { data } = await supabase
      .from('server_events')
      .select('*, faction:factions(name, tag, primary_color)')
      .eq('server_name', faction.server_name || '')
      .order('scheduled_at')
    setEvents(data || [])
  }

  async function post() {
    if (!form.title.trim() || !form.scheduled_at || !faction) return
    const { data, error } = await supabase.from('server_events').insert({
      server_name: faction.server_name || '',
      faction_id: faction.id,
      title: form.title,
      description: form.description,
      event_type: form.event_type,
      scheduled_at: form.scheduled_at,
      created_by: userId
    }).select('*, faction:factions(name, tag, primary_color)').single()
    if (!error) {
      setEvents(e => [...e, data].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)))
      setForm({ title:'', description:'', event_type:'general', scheduled_at:'' })
      setShowForm(false)
    } else {
      alert('Failed to post event: ' + error.message)
    }
  }

  async function deleteEvent(id) {
    await supabase.from('server_events').delete().eq('id', id)
    setEvents(e => e.filter(x => x.id !== id))
  }

  function getTypeMeta(type) {
    return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[EVENT_TYPES.length - 1]
  }

  function getTimeUntil(date) {
    const diff = new Date(date) - new Date()
    if (diff < 0) return null
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    if (days > 0) return `in ${days}d ${hours}h`
    if (hours > 0) return `in ${hours}h ${mins}m`
    return `in ${mins}m`
  }

  const upcoming = events.filter(e => new Date(e.scheduled_at) >= new Date())
  const past = events.filter(e => new Date(e.scheduled_at) < new Date())
  const filtered = filter === 'all' ? upcoming : upcoming.filter(e => e.event_type === filter)

  if (!faction) return (
    <div style={{ padding:'80px', textAlign:'center', color:'var(--muted)' }}>
      Join or create a faction to view server events.
    </div>
  )

  return (
    <div style={{ maxWidth:800, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>SERVER EVENTS</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>
            {faction?.server_name
              ? `Community events for ${faction.server_name}`
              : 'Set your server name in Settings to see events'}
          </p>
        </div>
        {canPost && faction?.server_name && (
          <button className="btn btn-green" style={{ display:'flex', alignItems:'center', gap:'8px' }} onClick={() => setShowForm(f => !f)}>
            <Plus size={14} /> Post Event
          </button>
        )}
      </div>

      {!faction?.server_name && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px', display:'flex', flexDirection:'column', alignItems:'center', gap:'12px' }}>
          <Calendar size={32} color="var(--border)" />
          <p>Go to <a href="/settings" style={{ color:'var(--green)' }}>Settings</a> and set your server name to see and post server events.</p>
        </div>
      )}

      {faction?.server_name && (
        <>
          {showForm && canPost && (
            <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px', borderColor:'var(--green-dim)' }}>
              <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px' }}>NEW SERVER EVENT</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <input placeholder="Event title..." value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} autoFocus />
                <select value={form.event_type} onChange={e => setForm(f => ({...f, event_type:e.target.value}))}>
                  {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({...f, scheduled_at:e.target.value}))} />
              <textarea placeholder="Description — who can attend, rules, location, etc..." value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} rows={3} />
              <div style={{ display:'flex', gap:'8px' }}>
                <button className="btn btn-green" onClick={post}>Post Event</button>
                <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          )}

          {!canPost && (
            <div className="card" style={{ background:'#1a1a0d', borderColor:'var(--yellow)', fontSize:'13px', color:'var(--muted)' }}>
              🔒 Only <strong style={{ color:'var(--yellow)' }}>Leaders</strong> and <strong style={{ color:'var(--yellow)' }}>Co-Leaders</strong> can post server events.
            </div>
          )}

          {/* Filter tabs */}
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            <button onClick={() => setFilter('all')} className="btn" style={{ padding:'4px 12px', fontSize:'12px', background:filter==='all'?'var(--green-dim)':'var(--surface)', color:filter==='all'?'#fff':'var(--muted)', border:'1px solid var(--border)' }}>
              All ({upcoming.length})
            </button>
            {EVENT_TYPES.map(t => {
              const count = upcoming.filter(e => e.event_type === t.value).length
              if (count === 0) return null
              return (
                <button key={t.value} onClick={() => setFilter(t.value)} className="btn" style={{ padding:'4px 12px', fontSize:'12px', background:filter===t.value?'var(--green-dim)':'var(--surface)', color:filter===t.value?'#fff':'var(--muted)', border:'1px solid var(--border)' }}>
                  {t.label} ({count})
                </button>
              )
            })}
          </div>

          {/* Upcoming events */}
          {filtered.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'13px', letterSpacing:'0.1em' }}>
                UPCOMING — {filtered.length} EVENT{filtered.length !== 1 ? 'S' : ''}
              </h3>
              {filtered.map(e => {
                const meta = getTypeMeta(e.event_type)
                const timeUntil = getTimeUntil(e.scheduled_at)
                const isOwn = e.faction_id === faction.id
                return (
                  <div key={e.id} className="card" style={{ display:'flex', gap:'14px', borderLeft:`3px solid ${meta.color}` }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'4px' }}>
                        <span style={{ fontWeight:700, fontSize:'15px' }}>{e.title}</span>
                        <span style={{ fontSize:'12px', color:meta.color, border:`1px solid ${meta.color}44`, padding:'1px 8px', borderRadius:'999px' }}>{meta.label}</span>
                        {timeUntil && (
                          <span style={{ fontSize:'11px', color:'var(--green)', display:'flex', alignItems:'center', gap:'3px' }}>
                            <Clock size={10} /> {timeUntil}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:'12px', color:'var(--muted)', display:'flex', gap:'12px', flexWrap:'wrap' }}>
                        <span>📅 {new Date(e.scheduled_at).toLocaleString()}</span>
                        <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                          Posted by
                          <span style={{ color: e.faction?.primary_color || 'var(--green)', fontWeight:600 }}>
                            {e.faction?.tag ? `${e.faction.tag} ` : ''}{e.faction?.name}
                          </span>
                        </span>
                      </div>
                      {e.description && (
                        <p style={{ fontSize:'13px', color:'var(--text)', marginTop:'8px', lineHeight:1.5 }}>{e.description}</p>
                      )}
                    </div>
                    {(isOwn || canPost) && (
                      <button onClick={() => deleteEvent(e.id)} className="btn btn-ghost" style={{ padding:'6px', alignSelf:'flex-start', flexShrink:0 }}>
                        <Trash2 size={13} color="var(--red)" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {filtered.length === 0 && upcoming.length === 0 && (
            <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
              No upcoming events for <strong style={{ color:'var(--text)' }}>{faction.server_name}</strong>.
              {canPost && ' Be the first to post one!'}
            </div>
          )}

          {filtered.length === 0 && upcoming.length > 0 && (
            <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'32px' }}>
              No events matching that filter.
            </div>
          )}

          {/* Past events */}
          {past.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--muted)', fontSize:'13px', letterSpacing:'0.1em' }}>
                PAST EVENTS ({past.length})
              </h3>
              {past.slice(0, 5).map(e => {
                const meta = getTypeMeta(e.event_type)
                return (
                  <div key={e.id} className="card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', opacity:0.5, borderLeft:`3px solid var(--border)`, padding:'10px 16px' }}>
                    <div>
                      <span style={{ fontWeight:600, fontSize:'14px' }}>{e.title}</span>
                      <span style={{ fontSize:'12px', color:'var(--muted)', marginLeft:'10px' }}>{meta.label}</span>
                      <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>
                        {new Date(e.scheduled_at).toLocaleDateString()} • {e.faction?.name}
                      </div>
                    </div>
                    {(e.faction_id === faction.id || canPost) && (
                      <button onClick={() => deleteEvent(e.id)} className="btn btn-ghost" style={{ padding:'4px 6px' }}>
                        <Trash2 size={12} color="var(--red)" />
                      </button>
                    )}
                  </div>
                )
              })}
              {past.length > 5 && (
                <p style={{ fontSize:'12px', color:'var(--muted)', textAlign:'center' }}>+ {past.length - 5} more past events</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}