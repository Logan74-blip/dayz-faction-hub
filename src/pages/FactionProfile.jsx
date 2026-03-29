import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Users, Map, Sword, Shield, Star, Edit2, Check, X, StickyNote, Trophy, Target, Copy, Package, Flame } from 'lucide-react'

const ROLE_ICONS = { leader:'👑', 'co-leader':'⭐', recruiter:'📋', member:'👤' }
const ROLE_COLORS = { leader:'tag-green', 'co-leader':'tag-green', recruiter:'tag-yellow', member:'tag-yellow' }

const ACHIEVEMENTS_META = {
  first_raid: { label:'First Raid', icon:'⚔️' },
  members_10: { label:'10 Members', icon:'👥' },
  members_25: { label:'25 Members', icon:'👥' },
  members_50: { label:'50 Members', icon:'👥' },
  territories_5: { label:'5 Territories', icon:'🗺️' },
  first_alliance: { label:'First Alliance', icon:'🤝' },
  first_bounty: { label:'First Bounty', icon:'🎯' },
  first_war_won: { label:'War Winner', icon:'🏆' },
  raids_100: { label:'100 Raids', icon:'💀' },
}

export default function FactionProfile({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { role, faction: myFaction } = useRole(session.user.id)
  const [faction, setFaction] = useState(null)
  const [stats, setStats] = useState({})
  const [members, setMembers] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [recentRaids, setRecentRaids] = useState([])
  const [achievements, setAchievements] = useState([])
  const [diplomacyStatus, setDiplomacyStatus] = useState(null)
  const [notes, setNotes] = useState({})
  const [editingNote, setEditingNote] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')
  const [nameHistory, setNameHistory] = useState([])
  const [showNameHistory, setShowNameHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
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

    const [mems, territories, raids, pacts, events, achvs, bounties, resources, wars] = await Promise.all([
      supabase.from('faction_members').select('*, profile:profiles(discord_username, discord_avatar)').eq('faction_id', id).order('joined_at'),
      supabase.from('territories').select('id', { count:'exact', head:true }).eq('faction_id', id),
      supabase.from('raids').select('*').eq('faction_id', id).order('scheduled_at', { ascending:false }).limit(5),
      supabase.from('diplomacy').select('*, faction_a_info:factions!diplomacy_faction_a_fkey(name), faction_b_info:factions!diplomacy_faction_b_fkey(name)').or(`faction_a.eq.${id},faction_b.eq.${id}`).eq('status', 'active'),
      supabase.from('events').select('*').eq('faction_id', id).order('created_at', { ascending:false }).limit(6),
      supabase.from('achievements').select('*').eq('faction_id', id),
      supabase.from('bounties').select('id', { count:'exact', head:true }).eq('faction_id', id).eq('status', 'active'),
      supabase.from('resources').select('quantity').eq('faction_id', id),
      supabase.from('diplomacy').select('id', { count:'exact', head:true }).or(`faction_a.eq.${id},faction_b.eq.${id}`).eq('type', 'war').eq('status', 'active'),
    ])

    const totalStock = resources.data?.reduce((s, r) => s + (r.quantity || 0), 0) || 0

    setMembers(mems.data || [])
    setStats({
      members: mems.data?.length || 0,
      territories: territories.count || 0,
      raids: raids.data?.length || 0,
      alliances: pacts.data?.filter(p => p.type === 'nap').length || 0,
      bounties: bounties.count || 0,
      stockpile: totalStock,
      activeWars: wars.count || 0,
    })
    setRecentRaids(raids.data || [])
    setRecentEvents(events.data || [])
    setAchievements(achvs.data || [])

    if (myFaction && !isOwnFaction) {
      const { data: diplo } = await supabase.from('diplomacy')
        .select('*')
        .or(`and(faction_a.eq.${myFaction.id},faction_b.eq.${id}),and(faction_a.eq.${id},faction_b.eq.${myFaction.id})`)
        .eq('status', 'active')
        .maybeSingle()
      setDiplomacyStatus(diplo)
    }

    if (canManage) {
      const { data: noteData } = await supabase.from('member_notes').select('*').eq('faction_id', id)
      const noteMap = {}
      noteData?.forEach(n => { noteMap[n.target_user_id] = n })
      setNotes(noteMap)
    }

    setLoading(false)
  }

  async function saveName() {
    if (!newName.trim() || newName === faction.name) { setEditingName(false); return }
    const oldName = faction.name
    await supabase.from('factions').update({ name: newName.trim() }).eq('id', id)
    await supabase.from('faction_name_history').insert({
      faction_id: id, old_name: oldName, new_name: newName.trim(), changed_by: userId
    })
    await supabase.from('events').insert({
      faction_id: id, created_by: userId, type: 'custom',
      title: `Faction renamed: ${oldName} → ${newName.trim()}`,
      description: 'Name changed by leadership'
    })
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
        faction_id: id, target_user_id: targetUserId, note: noteText, created_by: userId
      }).select().single()
      if (data) setNotes(n => ({...n, [targetUserId]: data}))
    }
    setEditingNote(null)
    setNoteText('')
  }

  async function loadNameHistory() {
    const { data } = await supabase.from('faction_name_history')
      .select('*, profile:profiles!faction_name_history_changed_by_fkey(discord_username)')
      .eq('faction_id', id)
      .order('created_at', { ascending: false })
    setNameHistory(data || [])
  }

  function copyLink() {
    try { navigator.clipboard.writeText(`${window.location.origin}/faction/${id}`) } catch {}
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const diploColor = diplomacyStatus?.type === 'nap' ? 'var(--green)' : diplomacyStatus?.type === 'war' ? 'var(--red)' : 'var(--yellow)'
  const diploLabel = diplomacyStatus?.type === 'nap' ? '🤝 Allied' : diplomacyStatus?.type === 'war' ? '💀 At War' : diplomacyStatus?.type === 'trade' ? '🛒 Trade Partner' : null
  const factionColor = faction?.primary_color || 'var(--green)'

  if (loading) return (
    <div className="page-loading"><div className="spinner" /></div>
  )

  if (!faction) return null

  return (
    <div style={{ maxWidth:900, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'20px' }}>

      {/* Header */}
      <div className="card" style={{ borderLeft:`4px solid ${factionColor}`, padding:'24px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:'16px', flexWrap:'wrap' }}>
          <div style={{ fontSize:'52px', flexShrink:0, lineHeight:1 }}>{faction.flag || '☢️'}</div>
          <div style={{ flex:1, minWidth:'200px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap', marginBottom:'6px' }}>
              {faction.tag && (
                <span style={{ fontFamily:'Share Tech Mono', color:factionColor, fontSize:'14px', border:`1px solid ${factionColor}44`, padding:'2px 8px', borderRadius:'4px' }}>
                  {faction.tag}
                </span>
              )}
              {editingName && canManage ? (
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  <input value={newName} onChange={e => setNewName(e.target.value)} style={{ fontSize:'20px', fontWeight:700, width:'220px' }} onKeyDown={e => e.key==='Enter' && saveName()} autoFocus />
                  <button onClick={saveName} className="btn btn-green" style={{ padding:'4px 10px' }}><Check size={14} /></button>
                  <button onClick={() => setEditingName(false)} className="btn btn-ghost" style={{ padding:'4px 10px' }}><X size={14} /></button>
                </div>
              ) : (
                <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'26px', color:factionColor, margin:0 }}>{faction.name}</h1>
              )}
              {canManage && !editingName && (
                <button onClick={() => setEditingName(true)} className="btn btn-ghost" style={{ padding:'4px 8px' }}>
                  <Edit2 size={13} color="var(--muted)" />
                </button>
              )}
            </div>
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'8px' }}>
              {isOwnFaction && <span className="tag tag-green">Your Faction</span>}
              {faction.is_recruiting && <span className="tag tag-yellow">🔎 Recruiting</span>}
              {stats.activeWars > 0 && (
                <span style={{ background:'#450a0a', color:'var(--red)', padding:'2px 10px', borderRadius:'999px', fontSize:'12px', fontWeight:700 }}>
                  💀 {stats.activeWars} Active War{stats.activeWars !== 1 ? 's' : ''}
                </span>
              )}
              {diploLabel && (
                <span style={{ background:`${diploColor}22`, color:diploColor, padding:'2px 10px', borderRadius:'999px', fontSize:'12px', fontWeight:700 }}>
                  {diploLabel}
                </span>
              )}
              {achievements.length > 0 && (
                <span style={{ background:'#78350f22', color:'var(--yellow)', padding:'2px 10px', borderRadius:'999px', fontSize:'12px', fontWeight:700 }}>
                  🏆 {achievements.length} Achievement{achievements.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {faction.server_name && <p style={{ color:'var(--muted)', fontSize:'13px', marginBottom:'6px' }}>📡 {faction.server_name}</p>}
            {faction.description && <p style={{ color:'var(--text)', fontSize:'14px', lineHeight:1.6 }}>{faction.description}</p>}
          </div>
          <button className="btn btn-ghost" style={{ fontSize:'12px', display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }} onClick={copyLink}>
            <Copy size={12} /> {copied ? '✓ Copied!' : 'Share'}
          </button>
        </div>
      </div>

      {/* Stats — 7 categories */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:'10px' }}>
        {[
          { label:'Members', value:stats.members, icon:Users, color:'var(--green)' },
          { label:'Territories', value:stats.territories, icon:Map, color:'var(--yellow)' },
          { label:'Raids', value:stats.raids, icon:Sword, color:'var(--red)' },
          { label:'Alliances', value:stats.alliances, icon:Shield, color:'#818cf8' },
          { label:'Bounties', value:stats.bounties, icon:Target, color:'var(--yellow)' },
          { label:'Stockpile', value:stats.stockpile, icon:Package, color:'#60a5fa' },
          { label:'Active Wars', value:stats.activeWars, icon:Flame, color: stats.activeWars > 0 ? 'var(--red)' : 'var(--muted)' },
        ].map(({ label, value, icon:Icon, color }) => (
          <div key={label} className="card" style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'14px 10px', textAlign:'center', gap:'6px' }}>
            <div style={{ background:`${color}22`, borderRadius:'8px', padding:'8px' }}>
              <Icon size={16} color={color} />
            </div>
            <div style={{ fontFamily:'Share Tech Mono', fontSize:'22px', color, fontWeight:700, lineHeight:1 }}>{value ?? 0}</div>
            <div style={{ fontSize:'11px', color:'var(--muted)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <h3 style={{ fontWeight:700, fontSize:'15px', display:'flex', alignItems:'center', gap:'8px' }}>
            <Trophy size={15} color="var(--yellow)" /> Achievements
          </h3>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            {achievements.map(a => {
              const meta = ACHIEVEMENTS_META[a.type] || { label:a.type, icon:'🏅' }
              return (
                <div key={a.id} style={{ display:'flex', alignItems:'center', gap:'6px', background:'#78350f22', border:'1px solid #92400e44', borderRadius:'8px', padding:'6px 12px' }}>
                  <span style={{ fontSize:'16px' }}>{meta.icon}</span>
                  <span style={{ fontSize:'13px', color:'var(--yellow)', fontWeight:600 }}>{meta.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Members + Activity — stack on mobile */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'16px' }}>

        {/* Members */}
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <h3 style={{ fontWeight:700, fontSize:'15px', display:'flex', alignItems:'center', gap:'8px' }}>
            <Users size={15} color="var(--green)" /> Members ({members.length})
          </h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'2px', maxHeight:'320px', overflowY:'auto' }}>
            {members.length === 0 && <p style={{ color:'var(--muted)', fontSize:'13px' }}>No members yet.</p>}
            {members.map(m => (
              <div key={m.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                {m.profile?.discord_avatar
                  ? <img src={m.profile.discord_avatar} style={{ width:26, height:26, borderRadius:'50%', border:'1px solid var(--border)', flexShrink:0 }} />
                  : <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', flexShrink:0 }}>👤</div>
                }
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'13px', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {m.profile?.discord_username || 'Unknown'}
                  </div>
                  {canManage && notes[m.user_id] && (
                    <div style={{ fontSize:'11px', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      📝 {notes[m.user_id].note}
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', gap:'4px', alignItems:'center', flexShrink:0 }}>
                  <span className={`tag ${ROLE_COLORS[m.role]}`} style={{ fontSize:'10px', padding:'1px 6px' }}>
                    {ROLE_ICONS[m.role]} {m.role}
                  </span>
                  {canManage && m.user_id !== userId && (
                    <button onClick={() => { setEditingNote(m.user_id); setNoteText(notes[m.user_id]?.note || '') }} style={{ background:'transparent', border:'none', cursor:'pointer', padding:'2px' }}>
                      <StickyNote size={12} color={notes[m.user_id] ? 'var(--green)' : 'var(--muted)'} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {editingNote && canManage && (
            <div style={{ background:'#0d1a0d', border:'1px solid var(--green-dim)', borderRadius:'6px', padding:'10px', display:'flex', flexDirection:'column', gap:'8px' }}>
              <span style={{ fontSize:'12px', color:'var(--green)' }}>📝 Private note — only leadership can see</span>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} placeholder="Add a private note about this member..." />
              <div style={{ display:'flex', gap:'6px' }}>
                <button className="btn btn-green" style={{ fontSize:'12px', padding:'4px 10px' }} onClick={() => saveNote(editingNote)}>Save</button>
                {notes[editingNote] && (
                  <button className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px', color:'var(--red)' }}
                    onClick={() => { setEditingNote(null); setNotes(n => { const c = {...n}; delete c[editingNote]; return c }) }}>
                    Delete
                  </button>
                )}
                <button className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px' }} onClick={() => setEditingNote(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Activity */}
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <div className="card" style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            <h3 style={{ fontWeight:700, fontSize:'15px', display:'flex', alignItems:'center', gap:'8px' }}>
              <Sword size={15} color="var(--red)" /> Recent Raids
            </h3>
            {recentRaids.length === 0 && <p style={{ color:'var(--muted)', fontSize:'13px' }}>No raids yet.</p>}
            {recentRaids.map(r => (
              <div key={r.id} style={{ fontSize:'13px', padding:'6px 0', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px' }}>
                <span style={{ fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</span>
                <div style={{ display:'flex', gap:'4px', alignItems:'center', flexShrink:0 }}>
                  {r.outcome && <span style={{ fontSize:'12px' }}>{r.outcome==='success'?'✅':r.outcome==='fail'?'❌':r.outcome==='partial'?'⚠️':'🚫'}</span>}
                  {r.rating > 0 && <span style={{ color:'var(--yellow)', fontSize:'11px' }}>{'★'.repeat(r.rating)}</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            <h3 style={{ fontWeight:700, fontSize:'15px', display:'flex', alignItems:'center', gap:'8px' }}>
              <Star size={15} color="var(--yellow)" /> Recent Activity
            </h3>
            {recentEvents.length === 0 && <p style={{ color:'var(--muted)', fontSize:'13px' }}>No activity yet.</p>}
            {recentEvents.map(e => (
              <div key={e.id} style={{ fontSize:'13px', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.title}</div>
                <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>{new Date(e.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Name History */}
      {canManage && (
        <div className="card">
          <button
            onClick={() => { setShowNameHistory(s => !s); if (!showNameHistory) loadNameHistory() }}
            style={{ background:'transparent', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'13px', display:'flex', alignItems:'center', gap:'6px' }}
          >
            📜 {showNameHistory ? 'Hide' : 'Show'} Name History
          </button>
          {showNameHistory && (
            <div style={{ marginTop:'12px', display:'flex', flexDirection:'column', gap:'6px' }}>
              {nameHistory.length === 0 && <p style={{ fontSize:'12px', color:'var(--muted)' }}>No name changes recorded.</p>}
              {nameHistory.map(h => (
                <div key={h.id} style={{ fontSize:'13px', display:'flex', gap:'8px', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
                  <span style={{ color:'var(--muted)' }}>{h.old_name}</span>
                  <span style={{ color:'var(--green)' }}>→</span>
                  <span style={{ fontWeight:600 }}>{h.new_name}</span>
                  <span style={{ color:'var(--muted)', fontSize:'11px', marginLeft:'auto' }}>
                    by {h.profile?.discord_username} • {new Date(h.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}