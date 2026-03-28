import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'

const STATS = [
  { key:'members', label:'Members', icon:'👥', query: (fid) => supabase.from('faction_members').select('id', { count:'exact', head:true }).eq('faction_id', fid) },
  { key:'territories', label:'Territories', icon:'🗺️', query: (fid) => supabase.from('territories').select('id', { count:'exact', head:true }).eq('faction_id', fid) },
  { key:'raids', label:'Total Raids', icon:'⚔️', query: (fid) => supabase.from('raids').select('id', { count:'exact', head:true }).eq('faction_id', fid) },
  { key:'bounties', label:'Bounties Collected', icon:'🎯', query: (fid) => supabase.from('bounties').select('id', { count:'exact', head:true }).eq('faction_id', fid).eq('status', 'completed') },
  { key:'alliances', label:'Active Alliances', icon:'🤝', query: (fid) => supabase.from('diplomacy').select('id', { count:'exact', head:true }).eq('status', 'active').eq('type', 'nap').or(`faction_a.eq.${fid},faction_b.eq.${fid}`) },
  { key:'achievements', label:'Achievements', icon:'🏆', query: (fid) => supabase.from('achievements').select('id', { count:'exact', head:true }).eq('faction_id', fid) },
  { key:'treasury', label:'Treasury Items', icon:'💰', query: (fid) => supabase.from('treasury').select('quantity').eq('faction_id', fid).eq('transaction_type', 'deposit') },
  { key:'resources', label:'Stockpile Items', icon:'📦', query: (fid) => supabase.from('resources').select('quantity').eq('faction_id', fid) },
]

export default function FactionVsFaction({ session }) {
  const { faction: myFaction } = useRole(session.user.id)
  const [allFactions, setAllFactions] = useState([])
  const [factionA, setFactionA] = useState('')
  const [factionB, setFactionB] = useState('')
  const [statsA, setStatsA] = useState(null)
  const [statsB, setStatsB] = useState(null)
  const [loading, setLoading] = useState(false)
  const [infoA, setInfoA] = useState(null)
  const [infoB, setInfoB] = useState(null)

  useEffect(() => { loadFactions() }, [])
  useEffect(() => { if (myFaction) setFactionA(myFaction.id) }, [myFaction?.id])

  async function loadFactions() {
    const { data } = await supabase.from('factions').select('id, name, tag, flag, primary_color, server_name, description').order('name')
    setAllFactions(data || [])
  }

  async function compare() {
    if (!factionA || !factionB || factionA === factionB) return
    setLoading(true)
    setStatsA(null)
    setStatsB(null)
    const facA = allFactions.find(f => f.id === factionA)
    const facB = allFactions.find(f => f.id === factionB)
    setInfoA(facA)
    setInfoB(facB)
    const [resA, resB] = await Promise.all([fetchStats(factionA), fetchStats(factionB)])
    setStatsA(resA)
    setStatsB(resB)
    setLoading(false)
  }

  async function fetchStats(fid) {
    const results = {}
    await Promise.all(STATS.map(async stat => {
      const { count, data } = await stat.query(fid)
      if (stat.key === 'treasury') {
        results[stat.key] = data?.reduce((sum, t) => sum + (t.quantity || 0), 0) || 0
      } else if (stat.key === 'resources') {
        results[stat.key] = data?.reduce((sum, r) => sum + (r.quantity || 0), 0) || 0
      } else {
        results[stat.key] = count || 0
      }
    }))
    return results
  }

  function getWinner() {
    if (!statsA || !statsB) return null
    let scoreA = 0, scoreB = 0
    STATS.forEach(s => {
      if (statsA[s.key] > statsB[s.key]) scoreA++
      else if (statsB[s.key] > statsA[s.key]) scoreB++
    })
    if (scoreA > scoreB) return 'A'
    if (scoreB > scoreA) return 'B'
    return 'tie'
  }

  function StatBar({ valueA, valueB, label, icon }) {
    const total = valueA + valueB
    const pctA = total === 0 ? 50 : Math.round((valueA / total) * 100)
    const pctB = 100 - pctA
    const aWins = valueA > valueB
    const bWins = valueB > valueA
    const tie = valueA === valueB

    return (
      <div style={{ display:'flex', flexDirection:'column', gap:'8px', padding:'14px 0', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px' }}>
          <span style={{ fontFamily:'Share Tech Mono', color: aWins ? (infoA?.primary_color || 'var(--green)') : 'var(--text)', fontSize:'20px', fontWeight:700, minWidth:'60px' }}>
            {valueA} {aWins && '👑'}
          </span>
          <span style={{ fontSize:'13px', color:'var(--muted)', textAlign:'center', flex:1 }}>{icon} {label}</span>
          <span style={{ fontFamily:'Share Tech Mono', color: bWins ? (infoB?.primary_color || '#60a5fa') : 'var(--text)', fontSize:'20px', fontWeight:700, minWidth:'60px', textAlign:'right' }}>
            {bWins && '👑'} {valueB}
          </span>
        </div>
        <div style={{ display:'flex', height:'10px', borderRadius:'999px', overflow:'hidden', gap:'2px' }}>
          <div style={{ width:`${pctA}%`, background: aWins ? (infoA?.primary_color || 'var(--green)') : tie ? '#374151' : '#374151', borderRadius:'999px 0 0 999px', transition:'width 0.8s ease' }} />
          <div style={{ width:`${pctB}%`, background: bWins ? (infoB?.primary_color || '#60a5fa') : tie ? '#374151' : '#374151', borderRadius:'0 999px 999px 0', transition:'width 0.8s ease' }} />
        </div>
      </div>
    )
  }

  const winner = getWinner()
  const winsA = statsA && statsB ? STATS.filter(s => statsA[s.key] > statsB[s.key]).length : 0
  const winsB = statsA && statsB ? STATS.filter(s => statsB[s.key] > statsA[s.key]).length : 0

  return (
    <div style={{ maxWidth:800, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>FACTION VS FACTION</h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>Compare two factions head to head across {STATS.length} categories</p>
      </div>

      {/* Selector */}
      <div className="card" style={{ display:'flex', gap:'16px', alignItems:'center', flexWrap:'wrap' }}>
        <select value={factionA} onChange={e => setFactionA(e.target.value)} style={{ flex:1, minWidth:'160px' }}>
          <option value="">Select Faction A...</option>
          {allFactions.map(f => <option key={f.id} value={f.id}>{f.tag ? `${f.tag} ` : ''}{f.name}</option>)}
        </select>
        <span style={{ fontFamily:'Share Tech Mono', color:'var(--red)', fontSize:'20px', fontWeight:700, flexShrink:0 }}>VS</span>
        <select value={factionB} onChange={e => setFactionB(e.target.value)} style={{ flex:1, minWidth:'160px' }}>
          <option value="">Select Faction B...</option>
          {allFactions.filter(f => f.id !== factionA).map(f => <option key={f.id} value={f.id}>{f.tag ? `${f.tag} ` : ''}{f.name}</option>)}
        </select>
        <button className="btn btn-green" onClick={compare} disabled={!factionA || !factionB || factionA === factionB || loading} style={{ flexShrink:0 }}>
          {loading ? 'Comparing...' : 'Compare ⚔️'}
        </button>
      </div>

      {loading && (
        <div className="page-loading">
          <div className="spinner" />
          Crunching the numbers...
        </div>
      )}

      {statsA && statsB && infoA && infoB && !loading && (
        <>
          {/* Winner banner */}
          <div className="card" style={{
            textAlign:'center', padding:'28px',
            borderColor: winner === 'tie' ? 'var(--yellow)' : winner === 'A' ? (infoA.primary_color || 'var(--green)') : (infoB.primary_color || '#60a5fa'),
            background: winner === 'tie' ? '#78350f22' : '#14532d22'
          }}>
            {winner === 'tie' ? (
              <>
                <div style={{ fontSize:'48px' }}>🤝</div>
                <div style={{ fontFamily:'Share Tech Mono', fontSize:'22px', color:'var(--yellow)', marginTop:'8px' }}>IT'S A TIE</div>
                <div style={{ color:'var(--muted)', fontSize:'14px', marginTop:'4px' }}>Both factions are evenly matched — {winsA} categories each</div>
              </>
            ) : (
              <>
                <div style={{ fontSize:'48px' }}>{winner === 'A' ? (infoA.flag || '☢️') : (infoB.flag || '☢️')}</div>
                <div style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color: winner === 'A' ? (infoA.primary_color || 'var(--green)') : (infoB.primary_color || '#60a5fa'), marginTop:'8px' }}>
                  {winner === 'A' ? infoA.name : infoB.name} WINS
                </div>
                <div style={{ color:'var(--muted)', fontSize:'14px', marginTop:'4px' }}>
                  Dominant in {winner === 'A' ? winsA : winsB} out of {STATS.length} categories
                </div>
              </>
            )}
          </div>

          {/* Faction headers */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            {[
              { info:infoA, stats:statsA, wins:winsA, side:'A', color:infoA.primary_color || 'var(--green)' },
              { info:infoB, stats:statsB, wins:winsB, side:'B', color:infoB.primary_color || '#60a5fa' }
            ].map(({ info, wins, side, color }) => (
              <div key={side} className="card" style={{
                textAlign:'center', padding:'20px',
                borderColor: winner === side ? color : 'var(--border)',
                background: winner === side ? `${color}11` : 'var(--surface)'
              }}>
                <div style={{ fontSize:'36px', marginBottom:'8px' }}>{info.flag || '☢️'}</div>
                <div style={{ fontFamily:'Share Tech Mono', color, fontSize:'18px', fontWeight:700 }}>
                  {info.tag ? `${info.tag} ` : ''}{info.name}
                </div>
                {info.server_name && <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'4px' }}>📡 {info.server_name}</div>}
                {info.description && <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'6px', fontStyle:'italic' }}>{info.description}</div>}
                <div style={{ marginTop:'10px', fontFamily:'Share Tech Mono', fontSize:'28px', color }}>
                  {wins}
                </div>
                <div style={{ fontSize:'11px', color:'var(--muted)' }}>categories won</div>
                {winner === side && <div style={{ fontSize:'13px', color, marginTop:'8px', fontWeight:700 }}>👑 WINNER</div>}
              </div>
            ))}
          </div>

          {/* Stats bars */}
          <div className="card" style={{ display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
              <span style={{ fontFamily:'Share Tech Mono', color: infoA.primary_color || 'var(--green)', fontSize:'13px' }}>{infoA.name}</span>
              <span style={{ fontFamily:'Share Tech Mono', color:'var(--muted)', fontSize:'12px', letterSpacing:'0.1em' }}>STAT BREAKDOWN</span>
              <span style={{ fontFamily:'Share Tech Mono', color: infoB.primary_color || '#60a5fa', fontSize:'13px' }}>{infoB.name}</span>
            </div>
            {STATS.map(stat => (
              <StatBar
                key={stat.key}
                valueA={statsA[stat.key]}
                valueB={statsB[stat.key]}
                label={stat.label}
                icon={stat.icon}
              />
            ))}
          </div>

          {/* Score summary */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:'12px', alignItems:'center' }}>
            <div className="card" style={{ textAlign:'center', borderColor: winner === 'A' ? (infoA.primary_color || 'var(--green)') : 'var(--border)' }}>
              <div style={{ fontFamily:'Share Tech Mono', fontSize:'48px', color: infoA.primary_color || 'var(--green)' }}>{winsA}</div>
              <div style={{ fontSize:'12px', color:'var(--muted)' }}>Categories Won</div>
              <div style={{ fontSize:'13px', fontWeight:700, marginTop:'4px', color:'var(--text)' }}>{infoA.name}</div>
            </div>
            <div style={{ fontFamily:'Share Tech Mono', color:'var(--red)', fontSize:'24px', fontWeight:700, textAlign:'center' }}>VS</div>
            <div className="card" style={{ textAlign:'center', borderColor: winner === 'B' ? (infoB.primary_color || '#60a5fa') : 'var(--border)' }}>
              <div style={{ fontFamily:'Share Tech Mono', fontSize:'48px', color: infoB.primary_color || '#60a5fa' }}>{winsB}</div>
              <div style={{ fontSize:'12px', color:'var(--muted)' }}>Categories Won</div>
              <div style={{ fontSize:'13px', fontWeight:700, marginTop:'4px', color:'var(--text)' }}>{infoB.name}</div>
            </div>
          </div>

          {/* Compare again */}
          <button className="btn btn-ghost" style={{ alignSelf:'center', fontSize:'13px' }} onClick={() => { setStatsA(null); setStatsB(null); setFactionB('') }}>
            ↩ Compare different factions
          </button>
        </>
      )}

      {!statsA && !loading && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
          <div style={{ fontSize:'48px', marginBottom:'16px' }}>⚔️</div>
          <p>Select two factions above and click Compare to see the head to head breakdown.</p>
          {allFactions.length < 2 && (
            <p style={{ marginTop:'12px', fontSize:'13px' }}>More factions need to join the platform before you can compare.</p>
          )}
        </div>
      )}
    </div>
  )
}