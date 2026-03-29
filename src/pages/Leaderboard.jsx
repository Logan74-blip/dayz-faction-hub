import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Trophy, Users, Map, Sword, Shield, RefreshCw } from 'lucide-react'

const CATEGORIES = [
  { key:'members', label:'Members', icon:Users, color:'var(--green)' },
  { key:'territories', label:'Territories', icon:Map, color:'var(--yellow)' },
  { key:'raids', label:'Raids', icon:Sword, color:'var(--red)' },
  { key:'pacts', label:'Alliances', icon:Shield, color:'#818cf8' },
]

export default function Leaderboard({ session }) {
  const [data, setData] = useState([])
  const [category, setCategory] = useState('members')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [myFactionId, setMyFactionId] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    loadMyFaction()
    loadLeaderboard()
    const interval = setInterval(() => loadLeaderboard(true), 60000)
    return () => clearInterval(interval)
  }, [])

  async function loadMyFaction() {
    const { data } = await supabase
      .from('faction_members')
      .select('faction_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (data) setMyFactionId(data.faction_id)
  }

  async function loadLeaderboard(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const { data: factions } = await supabase
      .from('factions')
      .select('id, name, tag, flag, primary_color, server_name')
      .order('name')

    if (!factions?.length) {
      setLoading(false)
      setRefreshing(false)
      return
    }

    const ids = factions.map(f => f.id)

    // Single batch query for all counts instead of N×4 queries
    const [membersRes, territoriesRes, raidsRes, pactsRes] = await Promise.all([
      supabase.from('faction_members').select('faction_id').in('faction_id', ids),
      supabase.from('territories').select('faction_id').in('faction_id', ids),
      supabase.from('raids').select('faction_id').in('faction_id', ids),
      supabase.from('diplomacy').select('faction_a, faction_b').eq('status', 'active').eq('type', 'nap'),
    ])

    const enriched = factions.map(f => {
      const members = membersRes.data?.filter(m => m.faction_id === f.id).length || 0
      const territories = territoriesRes.data?.filter(t => t.faction_id === f.id).length || 0
      const raids = raidsRes.data?.filter(r => r.faction_id === f.id).length || 0
      const pacts = pactsRes.data?.filter(p => p.faction_a === f.id || p.faction_b === f.id).length || 0
      return { ...f, members, territories, raids, pacts }
    })

    setData(enriched)
    setLastUpdated(new Date())
    setLoading(false)
    setRefreshing(false)
  }

  const sorted = [...data].sort((a, b) => b[category] - a[category])
  const medals = ['🥇', '🥈', '🥉']
  const catMeta = CATEGORIES.find(c => c.key === category)

  return (
    <div style={{ maxWidth:800, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>LEADERBOARD</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>
            Top factions ranked across all servers
            {lastUpdated && <span style={{ marginLeft:'10px', fontSize:'12px' }}>— updated {lastUpdated.toLocaleTimeString()}</span>}
          </p>
        </div>
        <button
          onClick={() => loadLeaderboard(true)}
          className="btn btn-ghost"
          style={{ fontSize:'12px', display:'flex', alignItems:'center', gap:'6px' }}
          disabled={refreshing}
        >
          <RefreshCw size={12} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Category tabs */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setCategory(c.key)} className="btn" style={{
            display:'flex', alignItems:'center', gap:'6px', padding:'7px 16px', fontSize:'13px',
            background: category===c.key ? c.color : 'var(--surface)',
            color: category===c.key ? '#000' : 'var(--muted)',
            border:'1px solid var(--border)',
            fontWeight: category===c.key ? 700 : 400
          }}>
            <c.icon size={13} /> {c.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="page-loading">
          <div className="spinner" />
          Loading leaderboard...
        </div>
      )}

      {!loading && sorted.length === 0 && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
          <Trophy size={32} color="var(--border)" style={{ marginBottom:'12px' }} />
          <p>No factions yet. Be the first on the leaderboard!</p>
        </div>
      )}

      {!loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {sorted.map((f, i) => {
            const isMe = f.id === myFactionId
            const factionColor = f.primary_color || 'var(--green)'
            return (
              <div key={f.id} className="card" style={{
                display:'flex', alignItems:'center', gap:'16px', padding:'14px 18px',
                borderLeft: isMe ? `3px solid ${factionColor}` : i < 3 ? `3px solid ${catMeta.color}` : '3px solid var(--border)',
                background: isMe ? '#14532d11' : 'var(--surface)',
                transition:'border-color 0.2s'
              }}>
                {/* Rank */}
                <span style={{ fontSize:'22px', minWidth:'36px', textAlign:'center', flexShrink:0 }}>
                  {medals[i] || <span style={{ fontFamily:'Share Tech Mono', color:'var(--muted)', fontSize:'14px' }}>#{i+1}</span>}
                </span>

                {/* Flag */}
                {f.flag && <span style={{ fontSize:'24px', flexShrink:0 }}>{f.flag}</span>}

                {/* Faction info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                    {f.tag && <span style={{ fontFamily:'Share Tech Mono', color:factionColor, fontSize:'12px' }}>{f.tag}</span>}
                    <span style={{ fontWeight:700, fontSize:'16px', color:factionColor }}>{f.name}</span>
                    {isMe && <span className="tag tag-green" style={{ fontSize:'10px' }}>You</span>}
                  </div>
                  {f.server_name && (
                    <span style={{ fontSize:'12px', color:'var(--muted)' }}>📡 {f.server_name}</span>
                  )}
                  {/* Mini stats row */}
                  <div style={{ display:'flex', gap:'12px', marginTop:'4px', fontSize:'11px', color:'var(--muted)', flexWrap:'wrap' }}>
                    {CATEGORIES.filter(c => c.key !== category).map(c => (
                      <span key={c.key} style={{ display:'flex', alignItems:'center', gap:'3px' }}>
                        <c.icon size={10} color={c.color} /> {f[c.key]}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Score */}
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontFamily:'Share Tech Mono', fontSize:'32px', color:catMeta.color, fontWeight:700, lineHeight:1 }}>
                    {f[category]}
                  </div>
                  <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>{catMeta.label}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && data.length > 0 && (
        <p style={{ textAlign:'center', fontSize:'12px', color:'var(--muted)' }}>
          Auto-refreshes every 60 seconds • {data.length} factions tracked
        </p>
      )}
    </div>
  )
}