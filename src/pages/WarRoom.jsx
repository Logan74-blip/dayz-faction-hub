import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Flame, Plus, Sword } from 'lucide-react'

export default function WarRoom({ session }) {
  const { faction, role } = useRole(session.user.id)
  const [wars, setWars] = useState([])
  const [selectedWar, setSelectedWar] = useState(null)
  const [warLogs, setWarLogs] = useState([])
  const [logForm, setLogForm] = useState({ entry_type:'raid', title:'', description:'' })
  const [showLogForm, setShowLogForm] = useState(false)
  const userId = session.user.id
  const canLog = role === 'leader' || role === 'co-leader'

  useEffect(() => { if (faction) loadWars() }, [faction])

  async function loadWars() {
    const { data } = await supabase
      .from('diplomacy')
      .select('*, faction_a_info:factions!diplomacy_faction_a_fkey(id,name,tag), faction_b_info:factions!diplomacy_faction_b_fkey(id,name,tag)')
      .eq('type', 'war')
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
      setLogForm({ entry_type:'raid', title:'', description:'' })
      setShowLogForm(false)
    }
  }

  async function endWar(warId, outcome) {
    await supabase.from('diplomacy').update({ status: outcome }).eq('id', warId)
    setWars(w => w.filter(x => x.id !== warId))
    setSelectedWar(null)
    await supabase.from('events').insert({
      faction_id: faction.id,
      created_by: userId,
      type: 'diplomacy',
      title: `War ${outcome === 'active' ? 'continues' : 'ended'}`,
      description: `War concluded`
    })
  }

  const LOG_TYPES = [
    { value:'raid', label:'⚔️ Raid', color:'var(--red)' },
    { value:'defense', label:'🛡️ Defense', color:'#818cf8' },
    { value:'intel', label:'🔍 Intel', color:'var(--yellow)' },
    { value:'territory', label:'🗺️ Territory', color:'var(--green)' },
    { value:'ceasefire', label:'🏳️ Ceasefire', color:'var(--muted)' },
  ]

  return (
    <div style={{ maxWidth:960, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--red)' }}>💀 WAR ROOM</h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>Track active conflicts and war logs</p>
      </div>

      {wars.length === 0 && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
          No active wars. Declare war through the Diplomacy Board.
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns: selectedWar ? '1fr 1fr' : '1fr', gap:'20px' }}>
        {/* Wars list */}
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {wars.map(war => {
            const enemy = war.faction_a === faction.id ? war.faction_b_info : war.faction_a_info
            const isSelected = selectedWar?.id === war.id
            return (
              <div key={war.id} className="card" onClick={() => { setSelectedWar(war); loadWarLogs(war.id); setShowLogForm(false) }}
                style={{ cursor:'pointer', borderLeft:`3px solid var(--red)`, background: isSelected ? '#7f1d1d11' : 'var(--surface)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#f87171'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--red)'}
              >
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <Flame size={20} color="var(--red)" />
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:'16px' }}>
                      {faction.tag || faction.name} <span style={{ color:'var(--red)' }}>vs</span> {enemy?.tag || ''} {enemy?.name}
                    </div>
                    <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px' }}>
                      War declared {new Date(war.created_at).toLocaleDateString()}
                    </div>
                    {war.terms && <div style={{ fontSize:'13px', color:'var(--muted)', marginTop:'4px' }}>{war.terms}</div>}
                  </div>
                  <span className="tag tag-red">Active</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* War detail */}
        {selectedWar && (
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <div className="card" style={{ borderColor:'var(--red)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--red)', fontSize:'14px' }}>WAR LOG</h3>
                <div style={{ display:'flex', gap:'6px' }}>
                  {canLog && (
                    <button className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px', display:'flex', alignItems:'center', gap:'4px' }} onClick={() => setShowLogForm(f => !f)}>
                      <Plus size={12} /> Log Entry
                    </button>
                  )}
                  {canLog && (
                    <button className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px', color:'var(--muted)' }} onClick={() => endWar(selectedWar.id, 'expired')}>
                      End War
                    </button>
                  )}
                </div>
              </div>

              {showLogForm && canLog && (
                <div style={{ background:'#0d1a0d', border:'1px solid var(--border)', borderRadius:'6px', padding:'12px', marginBottom:'12px', display:'flex', flexDirection:'column', gap:'8px' }}>
                  <select value={logForm.entry_type} onChange={e => setLogForm(f => ({...f, entry_type:e.target.value}))}>
                    {LOG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input placeholder="Entry title..." value={logForm.title} onChange={e => setLogForm(f => ({...f, title:e.target.value}))} />
                  <textarea placeholder="Details..." value={logForm.description} onChange={e => setLogForm(f => ({...f, description:e.target.value}))} rows={2} />
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button className="btn btn-green" style={{ fontSize:'12px' }} onClick={addLog}>Add</button>
                    <button className="btn btn-ghost" style={{ fontSize:'12px' }} onClick={() => setShowLogForm(false)}>Cancel</button>
                  </div>
                </div>
              )}

              <div style={{ display:'flex', flexDirection:'column', gap:'8px', maxHeight:'400px', overflowY:'auto' }}>
                {warLogs.length === 0 && <p style={{ color:'var(--muted)', fontSize:'13px', textAlign:'center', padding:'20px' }}>No war log entries yet.</p>}
                {warLogs.map(log => {
                  const meta = LOG_TYPES.find(t => t.value === log.entry_type) || LOG_TYPES[0]
                  return (
                    <div key={log.id} style={{ display:'flex', gap:'10px', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                      <span style={{ fontSize:'16px', flexShrink:0 }}>{meta.label.split(' ')[0]}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:'13px', color:meta.color }}>{log.title}</div>
                        {log.description && <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px' }}>{log.description}</div>}
                        <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'4px', display:'flex', alignItems:'center', gap:'6px' }}>
                          {log.profile?.discord_avatar && <img src={log.profile.discord_avatar} style={{ width:14, height:14, borderRadius:'50%' }} />}
                          <span>{log.profile?.discord_username}</span>
                          <span>•</span>
                          <span>{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}