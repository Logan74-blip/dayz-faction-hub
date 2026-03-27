import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Swords, Users, Map, Shield, Target, Trophy } from 'lucide-react'

export default function FactionVsFaction({ session }) {
  const { faction: myFaction } = useRole(session.user.id)
  const [allFactions, setAllFactions] = useState([])
  const [factionA, setFactionA] = useState('')
  const [factionB, setFactionB] = useState('')
  const [statsA, setStatsA] = useState(null)
  const [statsB, setStatsB] = useState(null)
  const [diplomacy, setDiplomacy] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('factions').select('id, name, tag, server_name').then(({ data }) => setAllFactions(data || []))
  }, [])

  useEffect(() => {
    if (myFaction) setFactionA(myFaction.id)
  }, [myFaction])

  async function loadStats(fid) {
    const [members, territories, raids, bounties, pacts, wins, losses] = await Promise.all([
      supabase.from('faction_members').select('id', { count:'exact' }).eq('faction_id', fid),
      supabase.from('territories').select('id', { count:'exact' }).eq('faction_id', fid),
      supabase.from('raids').select('id', { count:'exact' }).eq('faction_id', fid),
      supabase.from('bounties').select('id', { count:'exact' }).eq('faction_id', fid).eq('status', 'completed'),
      supabase.from('diplomacy').select('id', { count:'exact' }).eq('status', 'active').or(`faction_a.eq.${fid},faction_b.eq.${fid}`),
      supabase.from('raids').select('id', { count:'exact' }).eq('faction_id', fid).eq('outcome', 'success'),
      supabase.from('raids').select('id', { count:'exact' }).eq('faction_id', fid).eq('outcome', 'fail'),
    ])
    return {
      members: members.count || 0,
      territories: territories.count || 0,
      raids: raids.count || 0,
      bounties: bounties.count || 0,
      pacts: pacts.count || 0,
      wins: wins.count || 0,
      losses: losses.count || 0,
      winRate: wins.count > 0 ? Math.round((wins.count / Math.max((wins.count + losses.count), 1)) * 100) : 0
    }
  }

  async function compare() {
    if (!factionA || !factionB || factionA === factionB) return
    setLoading(true)
    setStatsA(null)
    setStatsB(null)
    const [a, b] = await Promise.all([loadStats(factionA), loadStats(factionB)])
    setStatsA(a)
    setStatsB(b)

    // Check diplomacy between them
    const { data: diplo } = await supabase.from('diplomacy')
      .select('*')
      .or(`and(faction_a.eq.${factionA},faction_b.eq.${factionB}),and(faction_a.eq.${factionB},faction_b.eq.${factionA})`)
      .eq('status', 'active')
      .maybeSingle()
    setDiplomacy(diplo)
    setLoading(false)
  }

  const fA = allFactions.find(f => f.id === factionA)
  const fB = allFactions.find(f => f.id === factionB)

  const STATS = [
    { key:'members', label:'Members', icon:Users, color:'var(--green)' },
    { key:'territories', label:'Territories', icon:Map, color:'var(--yellow)' },
    { key:'raids', label:'Total Raids', icon:Swords, color:'var(--red)' },
    { key:'wins', label:'Raid Wins', icon:Trophy, color:'var(--green)' },
    { key:'winRate', label:'Win Rate %', icon:Trophy, color:'var(--green)', suffix:'%' },
    { key:'bounties', label:'Bounties Collected', icon:Target, color:'var(--yellow)' },
    { key:'pacts', label:'Active Alliances', icon:Shield, color:'#818cf8' },
  ]

  const diploLabel = diplomacy?.type === 'nap' ? '🤝 Non-Aggression Pact' : diplomacy?.type === 'war' ? '💀 At War' : diplomacy?.type === 'trade' ? '🛒 Trade Agreement' : '— No Active Agreement'
  const diploColor = diplomacy?.type === 'nap' ? 'var(--green)' : diplomacy?.type === 'war' ? 'var(--red)' : diplomacy?.type === 'trade' ? 'var(--yellow)' : 'var(--muted)'

  return (
    <div style={{ maxWidth:900, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>FACTION VS FACTION</h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>Head to head comparison between two factions</p>
      </div>

      {/* Selector */}
      <div className="card" style={{ display:'flex', gap:'16px', alignItems:'center', flexWrap:'wrap' }}>
        <select value={factionA} onChange={e => setFactionA(e.target.value)} style={{ flex:1, minWidth:'160px' }}>
          <option value="">Select Faction A...</option>
          {allFactions.map(f => <option key={f.id} value={f.id}>{f.tag ? `${f.tag} ` : ''}{f.name}</option>)}
        </select>
        <span style={{ fontFamily:'Share Tech Mono', color:'var(--red)', fontSize:'20px', flexShrink:0 }}>VS</span>
        <select value={factionB} onChange={e => setFactionB(e.target.value)} style={{ flex:1, minWidth:'160px' }}>
          <option value="">Select Faction B...</option>
          {allFactions.filter(f => f.id !== factionA).map(f => <option key={f.id} value={f.id}>{f.tag ? `${f.tag} ` : ''}{f.name}</option>)}
        </select>
        <button className="btn btn-green" onClick={compare} disabled={!factionA || !factionB || factionA === factionB} style={{ flexShrink:0 }}>
          Compare
        </button>
      </div>

      {loading && (
        <div style={{ textAlign:'center', color:'var(--green)', fontFamily:'Share Tech Mono', padding:'40px' }}>
          LOADING INTEL...
        </div>
      )}

      {statsA && statsB && fA && fB && (
        <>
          {/* Diplomacy status */}
          <div className="card" style={{ textAlign:'center', padding:'14px', borderColor:diploColor }}>
            <span style={{ fontSize:'15px', fontWeight:700, color:diploColor }}>{diploLabel}</span>
          </div>

          {/* Faction names header */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:'16px', alignItems:'center' }}>
            <div className="card" style={{ textAlign:'center', padding:'16px', borderColor:'var(--green)' }}>
              <div style={{ fontFamily:'Share Tech Mono', fontSize:'20px', color:'var(--green)' }}>{fA.tag || ''}</div>
              <div style={{ fontWeight:700, fontSize:'18px' }}>{fA.name}</div>
              {fA.server_name && <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'4px' }}>📡 {fA.server_name}</div>}
            </div>
            <div style={{ fontFamily:'Share Tech Mono', color:'var(--red)', fontSize:'28px', textAlign:'center' }}>⚔️</div>
            <div className="card" style={{ textAlign:'center', padding:'16px', borderColor:'var(--red)' }}>
              <div style={{ fontFamily:'Share Tech Mono', fontSize:'20px', color:'var(--red)' }}>{fB.tag || ''}</div>
              <div style={{ fontWeight:700, fontSize:'18px' }}>{fB.name}</div>
              {fB.server_name && <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'4px' }}>📡 {fB.server_name}</div>}
            </div>
          </div>

          {/* Stat rows */}
          {STATS.map(({ key, label, icon: Icon, color, suffix }) => {
            const a = statsA[key]
            const b = statsB[key]
            const aWins = a > b
            const bWins = b > a
            const total = a + b || 1
            const aWidth = Math.round((a / total) * 100)
            const bWidth = Math.round((b / total) * 100)

            return (
              <div key={key} className="card" style={{ padding:'16px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                  <span style={{ fontFamily:'Share Tech Mono', fontSize:'22px', fontWeight:700, color: aWins ? 'var(--green)' : 'var(--muted)' }}>
                    {a}{suffix || ''}
                    {aWins && <span style={{ fontSize:'14px', marginLeft:'6px' }}>▲</span>}
                  </span>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <Icon size={13} color={color} />
                    <span style={{ fontSize:'13px', color:'var(--muted)', fontWeight:600 }}>{label}</span>
                  </div>
                  <span style={{ fontFamily:'Share Tech Mono', fontSize:'22px', fontWeight:700, color: bWins ? 'var(--red)' : 'var(--muted)' }}>
                    {bWins && <span style={{ fontSize:'14px', marginRight:'6px' }}>▲</span>}
                    {b}{suffix || ''}
                  </span>
                </div>
                {/* Bar */}
                <div style={{ height:'6px', borderRadius:'999px', background:'var(--border)', overflow:'hidden', display:'flex' }}>
                  <div style={{ width:`${aWidth}%`, background: aWins ? 'var(--green)' : 'var(--border)', transition:'width 0.5s' }} />
                  <div style={{ flex:1, background: bWins ? 'var(--red)' : 'var(--border)', transition:'width 0.5s' }} />
                </div>
              </div>
            )
          })}

          {/* Overall winner */}
          {(() => {
            let aScore = 0; let bScore = 0
            STATS.forEach(({ key }) => { if (statsA[key] > statsB[key]) aScore++; else if (statsB[key] > statsA[key]) bScore++ })
            const winner = aScore > bScore ? fA : bScore > aScore ? fB : null
            const winnerColor = aScore > bScore ? 'var(--green)' : 'var(--red)'
            return (
              <div className="card" style={{ textAlign:'center', padding:'20px', borderColor: winner ? winnerColor : 'var(--border)' }}>
                {winner ? (
                  <>
                    <div style={{ fontSize:'32px', marginBottom:'8px' }}>🏆</div>
                    <div style={{ fontFamily:'Share Tech Mono', fontSize:'18px', color:winnerColor }}>{winner.name} WINS</div>
                    <div style={{ color:'var(--muted)', fontSize:'13px', marginTop:'4px' }}>{aScore} vs {bScore} categories</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize:'32px', marginBottom:'8px' }}>🤝</div>
                    <div style={{ fontFamily:'Share Tech Mono', fontSize:'18px', color:'var(--muted)' }}>PERFECTLY MATCHED</div>
                  </>
                )}
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}