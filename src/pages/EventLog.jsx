import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Activity, Plus } from 'lucide-react'

const EVENT_TYPES = [
  { value:'kill', label:'Kill', icon:'💀', color:'var(--red)' },
  { value:'raid', label:'Raid', icon:'⚔️', color:'var(--red)' },
  { value:'bounty', label:'Bounty', icon:'🎯', color:'var(--yellow)' },
  { value:'diplomacy', label:'Diplomacy', icon:'🤝', color:'#818cf8' },
  { value:'territory', label:'Territory', icon:'🗺️', color:'var(--green)' },
  { value:'member', label:'Member', icon:'👤', color:'var(--green)' },
  { value:'trade', label:'Trade', icon:'🛒', color:'var(--yellow)' },
  { value:'custom', label:'Custom', icon:'📝', color:'var(--muted)' },
]

function getEventMeta(type) { return EVENT_TYPES.find(e => e.value === type) || EVENT_TYPES[EVENT_TYPES.length - 1] }

export default function EventLog({ session }) {
  const { role, faction } = useRole(session.user.id)
  const [events, setEvents] = useState([])
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type:'custom', title:'', description:'' })
  const userId = session.user.id

  useEffect(() => {
    if (faction) {
      load()
      // Realtime
      const channel = supabase.channel('events')
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'events', filter:`faction_id=eq.${faction.id}` },
          payload => setEvents(e => [payload.new, ...e])
        ).subscribe()
      return () => supabase.removeChannel(channel)
    }
  }, [faction])

  async function load() {
    const { data } = await supabase.from('events')
      .select('*, profile:profiles!events_created_by_fkey(discord_username, discord_avatar)')
      .eq('faction_id', faction.id)
      .order('created_at', { ascending:false })
      .limit(100)
    setEvents(data || [])
  }

  async function post() {
    if (!form.title.trim()) return
    const { data, error } = await supabase.from('events').insert({
      faction_id: faction.id,
      created_by: userId,
      type: form.type,
      title: form.title,
      description: form.description
    }).select('*, profile:profiles!events_created_by_fkey(discord_username, discord_avatar)').single()
    if (!error) {
      setEvents(e => [data, ...e])
      setForm({ type:'custom', title:'', description:'' })
      setShowForm(false)
    }
  }

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter)

  return (
    <div style={{ maxWidth:800, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>EVENT LOG</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>Live faction activity feed</p>
        </div>
        {faction && (
          <button className="btn btn-green" style={{ display:'flex', alignItems:'center', gap:'8px' }} onClick={() => setShowForm(f => !f)}>
            <Plus size={15} /> Log Event
          </button>
        )}
      </div>

      {showForm && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px', borderColor:'var(--green-dim)' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px' }}>LOG CUSTOM EVENT</h3>
          <select value={form.type} onChange={e => setForm(f => ({...f, type:e.target.value}))}>
            {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
          </select>
          <input placeholder="Event title..." value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} />
          <textarea placeholder="Details (optional)..." value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} rows={2} />
          <div style={{ display:'flex', gap:'8px' }}>
            <button className="btn btn-green" onClick={post}>Log Event</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
        <button onClick={() => setFilter('all')} className="btn" style={{ padding:'4px 12px', fontSize:'12px', background: filter==='all' ? 'var(--green-dim)' : 'var(--surface)', color: filter==='all' ? '#fff' : 'var(--muted)', border:'1px solid var(--border)' }}>All</button>
        {EVENT_TYPES.map(t => (
          <button key={t.value} onClick={() => setFilter(t.value)} className="btn" style={{
            padding:'4px 12px', fontSize:'12px',
            background: filter===t.value ? '#1a2e1a' : 'var(--surface)',
            color: filter===t.value ? t.color : 'var(--muted)',
            border: filter===t.value ? `1px solid ${t.color}` : '1px solid var(--border)'
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
          No events logged yet. Actions in the app auto-log here.
        </div>
      )}

      {/* Timeline */}
      <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>
        {filtered.map((e, i) => {
          const meta = getEventMeta(e.type)
          return (
            <div key={e.id} style={{ display:'flex', gap:'12px', position:'relative' }}>
              {/* Timeline line */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:`${meta.color}22`, border:`2px solid ${meta.color}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', zIndex:1, flexShrink:0 }}>
                  {meta.icon}
                </div>
                {i < filtered.length - 1 && <div style={{ width:'2px', flex:1, background:'var(--border)', minHeight:'16px' }} />}
              </div>

              <div style={{ flex:1, paddingBottom:'16px', paddingTop:'4px' }}>
                <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'10px 14px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px' }}>
                    <span style={{ fontWeight:700, fontSize:'14px', color: meta.color }}>{e.title}</span>
                    <span style={{ fontSize:'11px', color:'var(--muted)', whiteSpace:'nowrap' }}>{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                  {e.description && <p style={{ fontSize:'12px', color:'var(--muted)', marginTop:'4px' }}>{e.description}</p>}
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'6px', fontSize:'11px', color:'var(--muted)' }}>
                    {e.profile?.discord_avatar && <img src={e.profile.discord_avatar} style={{ width:16, height:16, borderRadius:'50%' }} />}
                    <span>{e.profile?.discord_username || 'System'}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}