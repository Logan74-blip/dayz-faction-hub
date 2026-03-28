import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Flame, Plus, Swords, Shield, Search, Map, Flag, X } from 'lucide-react'

const LOG_TYPES = [
  { value:'raid', label:'⚔️ Raid', color:'var(--red)' },
  { value:'defense', label:'🛡️ Defense', color:'#818cf8' },
  { value:'intel', label:'🔍 Intel', color:'var(--yellow)' },
  { value:'territory', label:'🗺️ Territory', color:'var(--green)' },
  { value:'ceasefire', label:'🏳️ Ceasefire', color:'var(--muted)' },
]

export default function WarRoom({ session }) {
  const { faction, role } = useRole(session.user.id)
  const [wars, setWars] = useState([])
  const [selectedWar, setSelectedWar] = useState(null)
  const [warLogs, setWarLogs] = useState([])
  const [logForm, setLogForm] = useState({ entry_type:'raid', title:'', description:'' })
  const [showLogForm, setShowLogForm] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [endOutcome, setEndOutcome] = useState('won')
  const [stats, setStats] = useState({})
  const userId = session.user.id
  const canManage = role === 'leader' || role === 'co-leader'

  useEffect(() => { if (faction?.id) loadWars() }, [faction?.id])

  async function loadWars() {
    const { data } = await supabase
      .from('diplomacy')
      .select(`
        *,
        faction_a_info:factions!diplomacy_faction_a_fkey(id,name,tag),
        faction_b_info:factions!diplomacy_faction_b_fkey(id,name,tag)
      `)
      .eq('type', 'war')
      .eq('status', 'active')
      .or(`faction_a.eq.${faction.id},faction_b.eq.${faction.id}`)
      .order('created_at', { ascending: false })
    setWars(data || [])
  }

  async function loadWarLogs(warId) {
    const { data } = await supabase
      .from('war_logs')
      .select('*, profile:profiles!war_logs_created_by_fkey(discord_username,discord_avatar)')
      .eq('war_id', warId)
      .order('created_at', { ascending: false })
    setWarLogs(data || [])
    // Calculate stats
    const counts = {}
    data?.forEach(l => { counts[l.entry_type] = (counts[l.entry_type] || 0) + 1 })
    setStats(counts)
  }

  async function addLog() {
    if (!logForm.title.trim() || !selectedWar) return
    const { data, error } = await supabase.from('war_logs').insert({
      war_id: selectedWar.id,
      faction_id: faction.id,
      entry_type: logForm.entry_type,
      title: logForm.title,
      description: logForm.description,
      created_by: userId
    }).select('*, profile:profiles!war_logs_created_by_fkey(discord_username,discord_avatar)').single()
    if (!error) {
      setWarLogs(w => [data, ...w])
      setStats(s => ({ ...s, [logForm.entry_type]: (s[logForm.entry_type] || 0) + 1 }))
      setLogForm({ entry_type:'raid', title:'', description:'' })
      setShowLogForm(false)
    }
  }

  async function deleteLog(id, entryType) {
    await supabase.from('war_logs').delete().eq('id', id)
    setWarLogs(w => w.filter(x => x.id !== id))
    setStats(s => ({ ...s, [entryType]: Math.max(0, (s[entryType] || 1) - 1) }))
  }

  async function endWar() {
    if (!selectedWar || !canManage) return
    await supabase.from('diplomacy').update({ status: endOutcome }).eq('id', selectedWar.id)
    const enemy = selectedWar.faction_a === faction.id ? selectedWar.faction_b_info : selectedWar.faction_a_info
    await supabase.from('events').insert({
      faction_id: faction.id,
      created_by: userId,
      type: 'war',
      title: `War ${endOutcome === 'won' ? 'Won 🏆' : endOutcome === 'lost' ? 'Lost ☠️' : endOutcome === 'draw' ? 'Ended in Draw 🤝' : 'Ended'} vs ${enemy?.name}`,
      description: `After ${warLogs.length} logged engagements`
    })
    // Check achievements
    if (endOutcome === 'won') {
      const { count } = await supabase.from('diplomacy').select('id', { count:'exact', head:true }).eq('status', 'won').or(`faction_a.eq.${faction.id},faction_b.eq.${faction.id}`)
      if (count === 0) {
        await supabase.from('achievements').upsert({ faction_id: faction.id, type:'first_war_won', unlocked_at: new Date().toISOString() })
      }
    }
    setWars(w => w.filter(x => x.id !== selectedWar.id))
    setSelectedWar(null)
    setWarLogs([])
    setStats({})
    setShowEndModal(false)
  }

  function selectWar(war) {
    setSelectedWar(war)
    loadWarLogs(war.id)
    setShowLogForm(false)
  }

  const getEnemy = (war) => war.faction_a === faction?.id ? war.faction_b_info : war.faction_a_info

  if (!faction) return (
    <div style={{ padding:'80px', textAlign:'center', color:'var(--muted)' }}>
      Join or create a faction to access the War Room.
    </div>
  )

  return (
    <div style={{ maxWidth:960, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--red)' }}>💀 WAR ROOM</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>Track active conflicts and war logs</p>
        </div>
        {canManage && (
          <a href="/diplomacy" style={{ fontSize:'13px', color:'var(--muted)', textDecoration:'none', display:'flex', alignItems:'center', gap:'6px', border:'1px solid var(--border)', padding:'6px 12px', borderRadius:'6px' }}>
            <Swords size={13} /> Declare War
          </a>
        )}
      </div>

      {wars.length === 0 && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px', display:'flex', flexDirection:'column', alignItems:'center', gap:'12px' }}>
          <Flame size={32} color="var(--border)" />
          <p>No active wars. Declare war through the <a href="/diplomacy" style={{ color:'var(--green)' }}>Diplomacy Board</a>.</p>
        </div>
      )}

      {wars.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns: selectedWar ? '300px 1fr' : '1fr', gap:'20px', alignItems:'start' }}>

          {/* Wars list */}
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {wars.map(war => {
              const enemy = getEnemy(war)
              const isSelected = selectedWar?.id === war.id
              const daysSince = Math.floor((Date.now() - new Date(war.created_at)) / (1000 * 60 * 60 * 24))
              return (
                <div key={war.id} className="card" onClick={() => selectWar(war)}
                  style={{ cursor:'pointer', borderLeft:`3px solid var(--red)`, background: isSelected ? '#7f1d1d22' : 'var(--surface)', transition:'all 0.15s' }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <Flame size={18} color="var(--red)" style={{ flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:'15px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        vs {enemy?.name}
                        {enemy?.tag && <span style={{ color:'var(--muted)', fontSize:'13px', marginLeft:'6px' }}>{enemy.tag}</span>}
                      </div>
                      <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>
                        Day {daysSince + 1} of war • {new Date(war.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="tag tag-red" style={{ flexShrink:0 }}>Active</span>
                  </div>
                  {war.terms && (
                    <p style={{ fontSize:'12px', color:'var(--muted)', marginTop:'8px', paddingTop:'8px', borderTop:'1px solid var(--border)' }}>{war.terms}</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* War detail panel */}
          {selectedWar && (
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

              {/* War header */}
              <div className="card" style={{ borderColor:'var(--red)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
                  <div>
                    <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--red)', fontSize:'16px' }}>
                      {faction.name} <span style={{ opacity:0.6 }}>vs</span> {getEnemy(selectedWar)?.name}
                    </h3>
                    <p style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px' }}>
                      War started {new Date(selectedWar.created_at).toLocaleDateString()} • {warLogs.length} log entries
                    </p>
                  </div>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={() => setSelectedWar(null)} className="btn btn-ghost" style={{ padding:'5px 8px' }}>
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  {LOG_TYPES.map(t => (
                    <div key={t.value} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'6px', padding:'6px 10px', textAlign:'center', minWidth:'60px' }}>
                      <div style={{ fontSize:'16px' }}>{t.label.split(' ')[0]}</div>
                      <div style={{ fontFamily:'Share Tech Mono', color:t.color, fontSize:'16px', fontWeight:700 }}>{stats[t.value] || 0}</div>
                      <div style={{ fontSize:'10px', color:'var(--muted)' }}>{t.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Log entries */}
              <div className="card" style={{ borderColor:'var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                  <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'13px' }}>ENGAGEMENT LOG</h3>
                  <div style={{ display:'flex', gap:'6px' }}>
                    {canManage && (
                      <>
                        <button className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px', display:'flex', alignItems:'center', gap:'4px' }} onClick={() => setShowLogForm(f => !f)}>
                          <Plus size={12} /> Log Entry
                        </button>
                        <button className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px', color:'var(--red)' }} onClick={() => setShowEndModal(true)}>
                          End War
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {showLogForm && canManage && (
                  <div style={{ background:'#0d1a0d', border:'1px solid var(--green-dim)', borderRadius:'6px', padding:'12px', marginBottom:'12px', display:'flex', flexDirection:'column', gap:'8px' }}>
                    <select value={logForm.entry_type} onChange={e => setLogForm(f => ({...f, entry_type:e.target.value}))}>
                      {LOG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <input placeholder="Entry title (e.g. Raided their base at Electro)" value={logForm.title} onChange={e => setLogForm(f => ({...f, title:e.target.value}))} autoFocus />
                    <textarea placeholder="Details (optional)..." value={logForm.description} onChange={e => setLogForm(f => ({...f, description:e.target.value}))} rows={2} />
                    <div style={{ display:'flex', gap:'6px' }}>
                      <button className="btn btn-green" style={{ fontSize:'12px' }} onClick={addLog}>Add Entry</button>
                      <button className="btn btn-ghost" style={{ fontSize:'12px' }} onClick={() => setShowLogForm(false)}>Cancel</button>
                    </div>
                  </div>
                )}

                <div style={{ display:'flex', flexDirection:'column', gap:'8px', maxHeight:'400px', overflowY:'auto' }}>
                  {warLogs.length === 0 && (
                    <p style={{ color:'var(--muted)', fontSize:'13px', textAlign:'center', padding:'24px' }}>
                      No entries yet. Log your first engagement.
                    </p>
                  )}
                  {warLogs.map(log => {
                    const meta = LOG_TYPES.find(t => t.value === log.entry_type) || LOG_TYPES[0]
                    return (
                      <div key={log.id} style={{ display:'flex', gap:'10px', padding:'10px', borderRadius:'6px', background:'var(--bg)', border:'1px solid var(--border)' }}>
                        <span style={{ fontSize:'18px', flexShrink:0 }}>{meta.label.split(' ')[0]}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:600, fontSize:'13px', color:meta.color }}>{log.title}</div>
                          {log.description && <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px' }}>{log.description}</div>}
                          <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'6px', display:'flex', alignItems:'center', gap:'6px' }}>
                            {log.profile?.discord_avatar && <img src={log.profile.discord_avatar} style={{ width:14, height:14, borderRadius:'50%' }} />}
                            <span>{log.profile?.discord_username || 'Unknown'}</span>
                            <span>•</span>
                            <span>{new Date(log.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                        {canManage && (
                          <button onClick={() => deleteLog(log.id, log.entry_type)} className="btn btn-ghost" style={{ padding:'3px 6px', flexShrink:0, opacity:0.5 }}
                            onMouseEnter={e => e.currentTarget.style.opacity='1'}
                            onMouseLeave={e => e.currentTarget.style.opacity='0.5'}
                          >
                            <X size={12} color="var(--red)" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* End War Modal */}
      {showEndModal && (
        <div style={{ position:'fixed', inset:0, background:'#00000088', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }} onClick={() => setShowEndModal(false)}>
          <div className="card" style={{ maxWidth:'380px', width:'100%', display:'flex', flexDirection:'column', gap:'16px', borderColor:'var(--red)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight:700, fontSize:'18px', color:'var(--red)' }}>End War</h3>
            <p style={{ color:'var(--muted)', fontSize:'14px' }}>How did the war with <strong style={{ color:'var(--text)' }}>{getEnemy(selectedWar)?.name}</strong> conclude?</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {[
                { value:'won', label:'🏆 We Won', color:'var(--green)' },
                { value:'lost', label:'☠️ We Lost', color:'var(--red)' },
                { value:'draw', label:'🤝 Draw / Ceasefire', color:'var(--yellow)' },
                { value:'expired', label:'💨 Abandoned / No Conclusion', color:'var(--muted)' },
              ].map(opt => (
                <button key={opt.value} onClick={() => setEndOutcome(opt.value)}
                  style={{ padding:'10px 14px', border:`2px solid ${endOutcome===opt.value ? opt.color : 'var(--border)'}`, borderRadius:'8px', background: endOutcome===opt.value ? `${opt.color}22` : 'transparent', color: endOutcome===opt.value ? opt.color : 'var(--muted)', cursor:'pointer', fontSize:'14px', fontWeight:600, textAlign:'left', transition:'all 0.15s' }}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button className="btn btn-green" style={{ flex:1 }} onClick={endWar}>Confirm</button>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setShowEndModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}