import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Users, Map, Sword, Shield, Star, Edit2, Check, X, StickyNote } from 'lucide-react'

export default function FactionProfile({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { role, faction: myFaction, perms } = useRole(session.user.id)
  const [faction, setFaction] = useState(null)
  const [stats, setStats] = useState({})
  const [members, setMembers] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [recentRaids, setRecentRaids] = useState([])
  const [diplomacyStatus, setDiplomacyStatus] = useState(null)
  const [notes, setNotes] = useState({})
  const [editingNote, setEditingNote] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const userId = session.user.id
  const isOwnFaction = myFaction?.id === id
  const canManage = isOwnFaction && (role === 'leader' || role === 'co-leader')

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    setLoading(true)
    const { data: f } = await supabase.from('factions').select('*').eq('id', id).single()
    if (!f) { navigate('/directory'); return }
    setFaction(f)
    setNewName(f.name)

    const [mems, territories, raids, pacts, events] = await Promise.all([
      supabase.from('faction_members').select('*, profile:profiles(discord_username, discord_avatar)').eq('faction_id', id),
      supabase.from('territories').select('id', { count:'exact' }).eq('faction_id', id),
      supabase.from('raids').select('*').eq('faction_id', id).order('scheduled_at', { ascending:false }).limit(5),
      supabase.from('diplomacy').select('*, faction_a_info:factions!diplomacy_faction_a_fkey(name), faction_b_info:factions!diplomacy_faction_b_fkey(name)').or(`faction_a.eq.${id},faction_b.eq.${id}`).eq('status', 'active'),
      supabase.from('events').select('*').eq('faction_id', id).order('created_at', { ascending:false }).limit(5)
    ])

    setMembers(mems.data || [])
    setStats({
      members: mems.data?.length || 0,
      territories: territories.count || 0,
      raids: raids.data?.length || 0,
      pacts: pacts.data?.length || 0,
    })
    setRecentRaids(raids.data || [])
    setRecentEvents(events.data || [])

    // Check diplomacy status between my faction and this one
    if (myFaction && !isOwnFaction) {
      const { data: diplo } = await supabase.from('diplomacy')
        .select('*')
        .or(`and(faction_a.eq.${myFaction.id},faction_b.eq.${id}),and(faction_a.eq.${id},faction_b.eq.${myFaction.id})`)
        .eq('status', 'active')
        .maybeSingle()
      setDiplomacyStatus(diplo)
    }

    // Load member notes if can manage
    if (isOwnFaction && (role === 'leader' || role === 'co-leader')) {
      const { data: noteData } = await supabase.from('member_notes').select('*').eq('faction_id', id)
      const noteMap = {}
      noteData?.forEach(n => { noteMap[n.target_user_id] = n })
      setNotes(noteMap)
    }

    setLoading(false)
  }

  async function saveName() {
    if (!newName.trim() || newName === faction.name) { setEditingName(false); return }
    await supabase.from('factions').update({ name: newName.trim() }).eq('id', id)
    setFaction(f => ({...f, name: newName.trim()}))
    setEditingName(false)
  }

  async function saveNote(targetUserId) {
    const existing = notes[targetUserId]
    if (existing) {
      await supabase.from('member_notes').update({ note: noteText, updated_at: new Date().toISOString() }).eq('id', existing.id)
      setNotes(n => ({...n, [targetUserId]: {...existing, note: noteText}}))
    } else {
      const { data } = await supabase.from('member_notes').insert({
        faction_id: id, target_user_id: targetUserId,
        note: noteText, created_by: userId
      }).select().single()
      if (data) setNotes(n => ({...n, [targetUserId]: data}))
    }
    setEditingNote(null)
    setNoteText('')
  }

  async function deleteNote(targetUserId) {
    const existing = notes[targetUserId]
    if (existing) {
      await supabase.from('member_notes').delete().eq('id', existing.id)
      setNotes(n => { const copy = {...n}; delete copy[targetUserId]; return copy })
    }
  }

  const ROLE_ICONS = { leader:'👑', 'co-leader':'⭐', recruiter:'📋', member:'👤' }
  const ROLE_COLORS = { leader:'tag-green', 'co-leader':'tag-green', recruiter:'tag-yellow', member:'tag-yellow' }

  const diploColor = diplomacyStatus?.type === 'nap' ? 'var(--green)' : diplomacyStatus?.type === 'war' ? 'var(--red)' : diplomacyStatus?.type === 'trade' ? 'var(--yellow)' : null
  const diploLabel = diplomacyStatus?.type === 'nap' ? '🤝 Allied' : diplomacyStatus?.type === 'war' ? '💀 At War' : diplomacyStatus?.type === 'trade' ? '🛒 Trade Partner' : null

  if (loading) return <div style={{ padding:'80px', textAlign:'center', color:'var(--muted)', fontFamily:'Share Tech Mono' }}>LOADING FACTION DATA...</div>
  if (!faction) return null

  return (
    <div style={{ maxWidth:900, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>

      {/* Header */}
      <div className="card" style={{ display:'flex', alignItems:'center', gap:'20px', padding:'24px', borderLeft:'4px solid var(--green)' }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
            {faction.tag && <span style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'16px' }}>{faction.tag}</span>}
            {editingName && canManage ? (
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                <input value={newName} onChange={e => setNewName(e.target.value)} style={{ fontSize:'22px', fontWeight:700, width:'240px' }} onKeyDown={e => e.key==='Enter' && saveName()} autoFocus />
                <button onClick={saveName} className="btn btn-green" style={{ padding:'4px 10px' }}><Check size={14} /></button>
                <button onClick={() => setEditingName(false)} className="btn btn-ghost" style={{ padding:'4px 10px' }}><X size={14} /></button>
              </div>
            ) : (
              <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'28px', color:'var(--green)', margin:0 }}>{faction.name}</h1>
            )}
            {canManage && !editingName && (
              <button onClick={() => setEditingName(true)} className="btn btn-ghost" style={{ padding:'4px 8px' }}>
                <Edit2 size={13} color="var(--muted)" />
              </button>
            )}
            {isOwnFaction && <span className="tag tag-green">Your Faction</span>}
            {diploLabel && <span style={{ background:`${diploColor}22`, color:diploColor, padding:'3px 10px', borderRadius:'999px', fontSize:'13px', fontWeight:700 }}>{diploLabel}</span>}
            {faction.is_recruiting && <span className="tag tag-yellow">Recruiting</span>}
          </div>
          {faction.server_name && <p style={{ color:'var(--muted)', fontSize:'13px', marginTop:'4px' }}>📡 {faction.server_name}</p>}
          {faction.description && <p style={{ color:'var(--text)', fontSize:'14px', marginTop:'8px', lineHeight:1.6 }}>{faction.description}</p>}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'12px' }}>
        {[
          { label:'Members', value:stats.members, icon:Users, color:'var(--green)' },
          { label:'Territories', value:stats.territories, icon:Map, color:'var(--yellow)' },
          { label:'Raids', value:stats.raids, icon:Sword, color:'var(--red)' },
          { label:'Active Pacts', value:stats.pacts, icon:Shield, color:'#818cf8' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card" style={{ display:'flex', gap:'12px', alignItems:'center', padding:'14px' }}>
            <div style={{ background:`${color}22`, borderRadius:'8px', padding:'8px' }}>
              <Icon size={18} color={color} />
            </div>
            <div>
              <div style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color, fontWeight:700 }}>{value}</div>
              <div style={{ fontSize:'12px', color:'var(--muted)' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
        {/* Members */}
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <h3 style={{ fontWeight:700, fontSize:'15px', display:'flex', alignItems:'center', gap:'8px' }}>
            <Users size={15} color="var(--green)" /> Members ({members.length})
          </h3>
          {members.map(m => (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
              {m.profile?.discord_avatar
                ? <img src={m.profile.discord_avatar} style={{ width:28, height:28, borderRadius:'50%', border:'1px solid var(--border)', flexShrink:0 }} />
                : <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', flexShrink:0 }}>{ROLE_ICONS[m.role]}</div>
              }
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'13px', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.profile?.discord_username || 'Unknown'}</div>
                {canManage && notes[m.user_id] && (
                  <div style={{ fontSize:'11px', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📝 {notes[m.user_id].note}</div>
                )}
              </div>
              <div style={{ display:'flex', gap:'4px', alignItems:'center', flexShrink:0 }}>
                <span className={`tag ${ROLE_COLORS[m.role]}`} style={{ fontSize:'10px' }}>{ROLE_ICONS[m.role]} {m.role}</span>
                {canManage && m.user_id !== userId && (
                  <button onClick={() => { setEditingNote(m.user_id); setNoteText(notes[m.user_id]?.note || '') }} style={{ background:'transparent', border:'none', cursor:'pointer', padding:'2px' }}>
                    <StickyNote size={12} color={notes[m.user_id] ? 'var(--green)' : 'var(--muted)'} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Note editor */}
          {editingNote && canManage && (
            <div style={{ background:'#0d1a0d', border:'1px solid var(--green-dim)', borderRadius:'6px', padding:'10px', display:'flex', flexDirection:'column', gap:'8px' }}>
              <span style={{ fontSize:'12px', color:'var(--green)' }}>📝 Private note (only leadership can see)</span>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} placeholder="Add a private note about this member..." />
              <div style={{ display:'flex', gap:'6px' }}>
                <button className="btn btn-green" style={{ fontSize:'12px', padding:'4px 10px' }} onClick={() => saveNote(editingNote)}>Save</button>
                {notes[editingNote] && <button className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px', color:'var(--red)' }} onClick={() => { deleteNote(editingNote); setEditingNote(null) }}>Delete</button>}
                <button className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px' }} onClick={() => setEditingNote(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          {/* Recent Raids */}
          <div className="card" style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            <h3 style={{ fontWeight:700, fontSize:'15px', display:'flex', alignItems:'center', gap:'8px' }}>
              <Sword size={15} color="var(--red)" /> Recent Raids
            </h3>
            {recentRaids.length === 0 && <p style={{ color:'var(--muted)', fontSize:'13px' }}>No raids yet.</p>}
            {recentRaids.map(r => (
              <div key={r.id} style={{ fontSize:'13px', padding:'6px 0', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontWeight:600 }}>{r.title}</span>
                <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                  {r.outcome && <span style={{ fontSize:'11px', color: r.outcome === 'success' ? 'var(--green)' : r.outcome === 'fail' ? 'var(--red)' : 'var(--muted)' }}>
                    {r.outcome === 'success' ? '✅' : r.outcome === 'fail' ? '❌' : '⏳'}
                  </span>}
                  {r.rating && <span style={{ color:'var(--yellow)', fontSize:'11px' }}>{'⭐'.repeat(r.rating)}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Recent Events */}
          <div className="card" style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            <h3 style={{ fontWeight:700, fontSize:'15px', display:'flex', alignItems:'center', gap:'8px' }}>
              <Star size={15} color="var(--yellow)" /> Recent Events
            </h3>
            {recentEvents.length === 0 && <p style={{ color:'var(--muted)', fontSize:'13px' }}>No events yet.</p>}
            {recentEvents.map(e => (
              <div key={e.id} style={{ fontSize:'13px', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontWeight:600 }}>{e.title}</div>
                <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>{new Date(e.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Share link */}
      <div className="card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px' }}>
        <div>
          <span style={{ fontSize:'13px', color:'var(--muted)' }}>Share this faction profile:</span>
          <div style={{ fontFamily:'Share Tech Mono', fontSize:'12px', color:'var(--green)', marginTop:'2px' }}>
            {window.location.origin}/faction/{id}
          </div>
        </div>
        <button className="btn btn-green" style={{ fontSize:'13px' }} onClick={() => navigator.clipboard.writeText(`${window.location.origin}/faction/${id}`)}>
          Copy Link
        </button>
      </div>
    </div>
  )
}