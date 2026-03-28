import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Plus } from 'lucide-react'

const EVENT_TYPES = [
  { value:'all', label:'All Events' },
  { value:'raid', label:'⚔️ Raids' },
  { value:'diplomacy', label:'🤝 Diplomacy' },
  { value:'territory', label:'🗺️ Territory' },
  { value:'member', label:'👤 Members' },
  { value:'bounty', label:'🎯 Bounties' },
  { value:'custom', label:'📝 Custom' },
]

const TYPE_ICONS = {
  raid:'⚔️', diplomacy:'🤝', territory:'🗺️',
  member:'👤', bounty:'🎯', custom:'📝',
  announcement:'📣', trade:'🛒', war:'💀',
  stockpile_add:'📦', stockpile_remove:'🗑️',
  stockpile_edit:'✏️', stockpile_adjust:'🔢',
  stockpile_scan:'📷', stockpile_clear:'🧹',
  treasury_deposit:'💰', treasury_withdrawal:'💸',
  trade_post:'🛒'
}

const ACTIVITY_LABELS = {
  stockpile_add: 'Added to Stockpile',
  stockpile_remove: 'Removed from Stockpile',
  stockpile_edit: 'Edited Stockpile Item',
  stockpile_adjust: 'Adjusted Stockpile',
  stockpile_scan: 'Scanner Import',
  stockpile_clear: 'Stockpile Cleared',
  treasury_deposit: 'Treasury Deposit',
  treasury_withdrawal: 'Treasury Withdrawal',
  trade_post: 'Trading Post Listing',
}

export default function EventLog({ session }) {
  const { role, faction } = useRole(session.user.id)
  const [events, setEvents] = useState([])
  const [activity, setActivity] = useState([])
  const [filter, setFilter] = useState('all')
  const [tab, setTab] = useState('events')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title:'', description:'' })
  const [loading, setLoading] = useState(true)
  const userId = session.user.id
  const canManage = role === 'leader' || role === 'co-leader'

  useEffect(() => { if (faction?.id) { loadEvents(); if (canManage) loadActivity() } }, [faction?.id, canManage])

  async function loadEvents() {
    setLoading(true)
    const { data } = await supabase
      .from('events')
      .select('*, profile:profiles!events_created_by_fkey(discord_username, discord_avatar)')
      .eq('faction_id', faction.id)
      .order('created_at', { ascending: false })
      .limit(100)
    setEvents(data || [])
    setLoading(false)
  }

  async function loadActivity() {
    const { data } = await supabase
      .from('activity_log')
      .select('*, profile:profiles!activity_log_user_id_fkey(discord_username, discord_avatar)')
      .eq('faction_id', faction.id)
      .order('created_at', { ascending: false })
      .limit(100)
    setActivity(data || [])
  }

  async function addEvent() {
    if (!form.title.trim() || !faction) return
    const { data, error } = await supabase.from('events').insert({
      faction_id: faction.id,
      created_by: userId,
      type: 'custom',
      title: form.title,
      description: form.description
    }).select('*, profile:profiles!events_created_by_fkey(discord_username, discord_avatar)').single()
    if (!error) {
      setEvents(e => [data, ...e])
      setForm({ title:'', description:'' })
      setShowForm(false)
    }
  }

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter)

  return (
    <div style={{ maxWidth:800, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>EVENT LOG</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>Faction activity feed and history</p>
        </div>
        {tab === 'events' && (
          <button className="btn btn-green" style={{ display:'flex', alignItems:'center', gap:'8px' }} onClick={() => setShowForm(f => !f)}>
            <Plus size={14} /> Log Event
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'4px', borderBottom:'1px solid var(--border)' }}>
        <button onClick={() => setTab('events')} style={{ background:'transparent', border:'none', padding:'8px 16px', cursor:'pointer', fontSize:'13px', fontWeight:600, color:tab==='events'?'var(--green)':'var(--muted)', borderBottom:tab==='events'?'2px solid var(--green)':'2px solid transparent', fontFamily:'Rajdhani' }}>
          📋 Event Log
        </button>
        {canManage && (
          <button onClick={() => setTab('activity')} style={{ background:'transparent', border:'none', padding:'8px 16px', cursor:'pointer', fontSize:'13px', fontWeight:600, color:tab==='activity'?'var(--green)':'var(--muted)', borderBottom:tab==='activity'?'2px solid var(--green)':'2px solid transparent', fontFamily:'Rajdhani' }}>
            🔍 Member Activity
            {activity.length > 0 && <span style={{ marginLeft:'6px', background:'var(--green-dim)', color:'var(--green)', borderRadius:'999px', fontSize:'10px', padding:'1px 6px' }}>{activity.length}</span>}
          </button>
        )}
      </div>

      {/* Event Log Tab */}
      {tab === 'events' && (
        <>
          {showForm && (
            <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px', borderColor:'var(--green-dim)' }}>
              <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px' }}>LOG CUSTOM EVENT</h3>
              <input placeholder="Event title..." value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} autoFocus />
              <textarea placeholder="Details (optional)..." value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} rows={2} />
              <div style={{ display:'flex', gap:'8px' }}>
                <button className="btn btn-green" onClick={addEvent}>Log Event</button>
                <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {EVENT_TYPES.map(t => (
              <button key={t.value} onClick={() => setFilter(t.value)} className="btn" style={{ padding:'4px 12px', fontSize:'12px', background:filter===t.value?'var(--green-dim)':'var(--surface)', color:filter===t.value?'#fff':'var(--muted)', border:'1px solid var(--border)' }}>
                {t.label}
              </button>
            ))}
          </div>

          {loading && <div className="page-loading"><div className="spinner" /></div>}

          {!loading && filtered.length === 0 && (
            <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
              No events yet. Actions like raids, diplomacy and announcements are logged here automatically.
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {filtered.map(e => (
              <div key={e.id} className="card" style={{ display:'flex', gap:'12px', alignItems:'flex-start', padding:'12px 16px', borderLeft:`3px solid var(--border)` }}>
                <span style={{ fontSize:'20px', flexShrink:0 }}>{TYPE_ICONS[e.type] || '📋'}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:'14px' }}>{e.title}</div>
                  {e.description && <div style={{ fontSize:'13px', color:'var(--muted)', marginTop:'3px' }}>{e.description}</div>}
                  <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'6px', display:'flex', alignItems:'center', gap:'6px' }}>
                    {e.profile?.discord_avatar && <img src={e.profile.discord_avatar} style={{ width:14, height:14, borderRadius:'50%' }} />}
                    <span>{e.profile?.discord_username || 'System'}</span>
                    <span>•</span>
                    <span>{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Member Activity Tab — Leader/Co-Leader only */}
      {tab === 'activity' && canManage && (
        <>
          <div className="card" style={{ background:'#14532d22', borderColor:'var(--green-dim)', fontSize:'13px', color:'var(--muted)' }}>
            🔍 <strong style={{ color:'var(--text)' }}>Leader view only</strong> — This shows all member actions on stockpile, treasury and trading post.
          </div>

          {activity.length === 0 && (
            <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
              No member activity logged yet.
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {activity.map(a => (
              <div key={a.id} className="card" style={{ display:'flex', gap:'12px', alignItems:'flex-start', padding:'12px 16px', borderLeft:'3px solid var(--green-dim)' }}>
                <span style={{ fontSize:'20px', flexShrink:0 }}>{TYPE_ICONS[a.action_type] || '📋'}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                    <span style={{ fontWeight:600, fontSize:'14px' }}>{a.description}</span>
                    <span style={{ fontSize:'11px', color:'var(--green)', background:'var(--green-dim)', padding:'1px 8px', borderRadius:'999px' }}>
                      {ACTIVITY_LABELS[a.action_type] || a.action_type}
                    </span>
                  </div>
                  <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'6px', display:'flex', alignItems:'center', gap:'6px' }}>
                    {a.profile?.discord_avatar && <img src={a.profile.discord_avatar} style={{ width:14, height:14, borderRadius:'50%' }} />}
                    <span style={{ fontWeight:600, color:'var(--text)' }}>{a.profile?.discord_username || 'Unknown'}</span>
                    <span>•</span>
                    <span>{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}