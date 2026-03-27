import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Plus, Calendar, Trash2 } from 'lucide-react'

const EVENT_TYPES = [
  { value:'wipe', label:'🔄 Server Wipe', color:'var(--red)' },
  { value:'truce', label:'🕊️ Server Truce', color:'#818cf8' },
  { value:'raid', label:'⚔️ Community Raid', color:'var(--red)' },
  { value:'trade', label:'🛒 Trade Meet', color:'var(--yellow)' },
  { value:'general', label:'📢 General Event', color:'var(--green)' },
]

export default function ServerCalendar({ session }) {
  const { faction, role } = useRole(session.user.id)
  const [events, setEvents] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title:'', description:'', event_type:'general', scheduled_at:'' })
  const userId = session.user.id
  const canPost = role === 'leader' || role === 'co-leader'

  useEffect(() => { if (faction) loadEvents() }, [faction])

  async function loadEvents() {
    const { data } = await supabase
      .from('server_events')
      .select('*, faction:factions(name,tag)')
      .eq('server_name', faction.server_name || 'Unknown Server')
      .order('scheduled_at')
    setEvents(data || [])
  }

  async function post() {
    if (!form.title.trim() || !form.scheduled_at) return
    const { data, error } = await supabase.from('server_events').insert({
      server_name: faction.server_name || 'Unknown Server',
      faction_id: faction.id,
      title: form.title,
      description: form.description,
      event_type: form.event_type,
      scheduled_at: form.scheduled_at,
      created_by: userId
    }).select('*, faction:factions(name,tag)').single()
    if (!error) {
      setEvents(e => [...e, data].sort((a,b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)))
      setForm({ title:'', description:'', event_type:'general', scheduled_at:'' })
      setShowForm(false)
    }
  }

  async function deleteEvent(id) {
    await supabase.from('server_events').delete().eq('id', id)
    setEvents(e => e.filter(x => x.id !== id))
  }

  const upcoming = events.filter(e => new Date(e.scheduled_at) >= new Date())
  const past = events.filter(e => new Date(e.scheduled_at) < new Date())

  function getTypeMeta(type) { return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[EVENT_TYPES.length - 1] }

  return (
    <div style={{ maxWidth:800, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>SERVER EVENTS</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>
            {faction?.server_name ? `Events for ${faction.server_name}` : 'Set your server name in Settings to see server events'}
          </p>
        </div>
        {canPost && faction?.server_name && (
          <button className="btn btn-green" style={{ display:'flex', alignItems:'center', gap:'8px' }} onClick={() => setShowForm(f => !f)}>
            <Plus size={14} /> Add Event
          </button>
        )}
      </div>

      {!faction?.server_name && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
          Go to <strong style={{ color:'var(--text)' }}>Settings</strong> and set your server name to see and post server events.
        </div>
      )}

      {showForm && canPost && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px', borderColor:'var(--green-dim)' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px' }}>NEW SERVER EVENT</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <input placeholder="Event title..." value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} />
            <select value={form.event_type} onChange={e => setForm(f => ({...f, event_type:e.target.value}))}>
              {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({...f, scheduled_at:e.target.value}))} />
          <textarea placeholder="Description..." value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} rows={2} />
          <div style={{ display:'flex', gap:'8px' }}>
            <button className="btn btn-green" onClick={post}>Post Event</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'13px', letterSpacing:'0.1em' }}>UPCOMING ({upcoming.length})</h3>
          {upcoming.map(e => {
            const meta = getTypeMeta(e.event_type)
            return (
              <div key={e.id} className="card" style={{ display:'flex', gap:'14px', borderLeft:`3px solid ${meta.color}` }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                    <span style={{ fontWeight:700, fontSize:'15px' }}>{e.title}</span>
                    <span style={{ fontSize:'12px', color:meta.color }}>{meta.label}</span>
                  </div>
                  <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'4px', display:'flex', gap:'12px' }}>
                    <span>📅 {new Date(e.scheduled_at).toLocaleString()}</span>
                    <span>Posted by {e.faction?.tag || ''} {e.faction?.name}</span>
                  </div>
                  {e.description && <p style={{ fontSize:'13px', color:'var(--text)', marginTop:'6px' }}>{e.description}</p>}
                </div>
                {e.created_by === userId && (
                  <button onClick={() => deleteEvent(e.id)} className="btn btn-ghost" style={{ padding:'6px', alignSelf:'flex-start' }}>
                    <Trash2 size={13} color="var(--red)" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {past.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--muted)', fontSize:'13px', letterSpacing:'0.1em' }}>PAST EVENTS</h3>
          {past.map(e => {
            const meta = getTypeMeta(e.event_type)
            return (
              <div key={e.id} className="card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', opacity:0.5, borderLeft:`3px solid var(--border)` }}>
                <div>
                  <span style={{ fontWeight:600 }}>{e.title}</span>
                  <span style={{ fontSize:'12px', color:'var(--muted)', marginLeft:'10px' }}>{meta.label}</span>
                  <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>{new Date(e.scheduled_at).toLocaleDateString()}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && faction?.server_name && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
          No server events yet. Be the first to post one!
        </div>
      )}
    </div>
  )
}