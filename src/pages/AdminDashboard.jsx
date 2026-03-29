import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { useNavigate } from 'react-router-dom'
import { Users, Shield, Map, Sword, AlertTriangle, Trophy, Activity, RefreshCw } from 'lucide-react'

export default function AdminDashboard({ session }) {
  const { role, faction } = useRole(session.user.id)
  const navigate = useNavigate()
  const [serverFactions, setServerFactions] = useState([])
  const [serverStats, setServerStats] = useState({})
  const [wars, setWars] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [lastUpdated, setLastUpdated] = useState(null)
  const isAdmin = role === 'leader' || role === 'co-leader'

  useEffect(() => { if (faction?.id && isAdmin) loadData() }, [faction?.id, isAdmin])

  async function loadData() {
    setLoading(true)
    const serverName = faction?.server_name

    const { data: facs } = await supabase
      .from('factions')
      .select('id, name, tag, flag, primary_color, description, is_recruiting, server_name')
      .eq('server_name', serverName)
      .order('name')

    if (!facs?.length) { setLoading(false); return }

    const ids = facs.map(f => f.id)

    // Load all counts in parallel
    const [membersRes, territoriesRes, raidsRes, bountiesRes, warsRes] = await Promise.all([
      supabase.from('faction_members').select('faction_id').in('faction_id', ids),
      supabase.from('territories').select('faction_id').in('faction_id', ids),
      supabase.from('raids').select('faction_id').in('faction_id', ids),
      supabase.from('bounties').select('faction_id').in('faction_id', ids).eq('status', 'completed'),
      supabase.from('diplomacy').select('*, faction_a_info:factions!diplomacy_faction_a_fkey(name,tag,primary_color), faction_b_info:factions!diplomacy_faction_b_fkey(name,tag,primary_color)').in('faction_a', ids).eq('type', 'war').eq('status', 'active'),
    ])

    // Build per-faction stats
    const statsMap = {}
    ids.forEach(id => {
      statsMap[id] = { members:0, territories:0, raids:0, bounties:0 }
    })
    membersRes.data?.forEach(r => { if (statsMap[r.faction_id]) statsMap[r.faction_id].members++ })
    territoriesRes.data?.forEach(r => { if (statsMap[r.faction_id]) statsMap[r.faction_id].territories++ })
    raidsRes.data?.forEach(r => { if (statsMap[r.faction_id]) statsMap[r.faction_id].raids++ })
    bountiesRes.data?.forEach(r => { if (statsMap[r.faction_id]) statsMap[r.faction_id].bounties++ })

    const enriched = facs.map(f => ({ ...f, ...statsMap[f.id] }))
    setServerFactions(enriched)
    setWars(warsRes.data || [])
    setServerStats({
      factions: facs.length,
      totalMembers: membersRes.data?.length || 0,
      totalTerritories: territoriesRes.data?.length || 0,
      totalRaids: raidsRes.data?.length || 0,
      totalBounties: bountiesRes.data?.length || 0,
      activeWars: warsRes.data?.length || 0,
      recruiting: facs.filter(f => f.is_recruiting).length,
    })
    setLastUpdated(new Date())
    setLoading(false)
  }

  if (!isAdmin) return (
    <div style={{ maxWidth:600, margin:'80px auto', padding:'0 24px', textAlign:'center' }}>
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px', alignItems:'center', padding:'40px' }}>
        <AlertTriangle size={32} color="var(--yellow)" />
        <h2 style={{ fontSize:'20px', fontWeight:700 }}>Access Restricted</h2>
        <p style={{ color:'var(--muted)' }}>Only faction leaders and co-leaders can access the Admin Dashboard.</p>
        <button className="btn btn-green" onClick={() => navigate('/')}>Go to Dashboard</button>
      </div>
    </div>
  )

  if (!faction?.server_name) return (
    <div style={{ maxWidth:600, margin:'80px auto', padding:'0 24px', textAlign:'center' }}>
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px', alignItems:'center', padding:'40px' }}>
        <AlertTriangle size={32} color="var(--yellow)" />
        <h2 style={{ fontSize:'20px', fontWeight:700 }}>No Server Set</h2>
        <p style={{ color:'var(--muted)' }}>Set your server name in Settings to access the Admin Dashboard.</p>
        <button className="btn btn-green" onClick={() => navigate('/settings')}>Go to Settings</button>
      </div>
    </div>
  )

  // Sort factions by total score for leaderboard tab
  const ranked = [...serverFactions].sort((a, b) =>
    (b.members + b.territories + b.raids + b.bounties) -
    (a.members + a.territories + a.raids + a.bounties)
  )

  return (
    <div style={{ maxWidth:960, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>ADMIN DASHBOARD</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>📡 {faction.server_name} — Server Overview</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {lastUpdated && <span style={{ fontSize:'11px', color:'var(--muted)' }}>Updated {lastUpdated.toLocaleTimeString()}</span>}
          <button className="btn btn-ghost" style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px' }} onClick={loadData} disabled={loading}>
            <RefreshCw size={12} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'4px', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
        {[
          { key:'overview', label:'📊 Overview' },
          { key:'factions', label:'🛡️ Factions' },
          { key:'leaderboard', label:'🏆 Leaderboard' },
          { key:'wars', label:'💀 Wars' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background:'transparent', border:'none', padding:'8px 16px', cursor:'pointer',
            fontSize:'13px', fontWeight:600, fontFamily:'Rajdhani',
            color: tab===t.key ? 'var(--green)' : 'var(--muted)',
            borderBottom: tab===t.key ? '2px solid var(--green)' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {loading && (
        <div className="page-loading"><div className="spinner" /></div>
      )}

      {/* Overview */}
      {!loading && tab === 'overview' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
          {/* Stats grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:'12px' }}>
            {[
              { label:'Factions', value:serverStats.factions, icon:Shield, color:'var(--green)' },
              { label:'Total Members', value:serverStats.totalMembers, icon:Users, color:'var(--green)' },
              { label:'Territories', value:serverStats.totalTerritories, icon:Map, color:'var(--yellow)' },
              { label:'Total Raids', value:serverStats.totalRaids, icon:Sword, color:'var(--red)' },
              { label:'Bounties Collected', value:serverStats.totalBounties, icon:Trophy, color:'var(--yellow)' },
              { label:'Active Wars', value:serverStats.activeWars, icon:AlertTriangle, color:serverStats.activeWars > 0 ? 'var(--red)' : 'var(--muted)' },
              { label:'Recruiting', value:serverStats.recruiting, icon:Activity, color:'var(--green)' },
            ].map(({ label, value, icon:Icon, color }) => (
              <div key={label} className="card" style={{ textAlign:'center', padding:'16px' }}>
                <Icon size={18} color={color} style={{ marginBottom:'8px' }} />
                <div style={{ fontFamily:'Share Tech Mono', fontSize:'28px', color, fontWeight:700 }}>{value ?? 0}</div>
                <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'4px' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Active wars summary */}
          {wars.length > 0 && (
            <div className="card" style={{ borderColor:'var(--red)' }}>
              <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--red)', fontSize:'13px', marginBottom:'12px', letterSpacing:'0.1em' }}>
                💀 ACTIVE CONFLICTS ({wars.length})
              </h3>
              {wars.map(w => (
                <div key={w.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:'14px', flexWrap:'wrap' }}>
                  <span style={{ fontWeight:700, color: w.faction_a_info?.primary_color || 'var(--text)' }}>
                    {w.faction_a_info?.tag ? `${w.faction_a_info.tag} ` : ''}{w.faction_a_info?.name}
                  </span>
                  <span style={{ color:'var(--red)', fontFamily:'Share Tech Mono', fontSize:'12px' }}>VS</span>
                  <span style={{ fontWeight:700, color: w.faction_b_info?.primary_color || 'var(--text)' }}>
                    {w.faction_b_info?.tag ? `${w.faction_b_info.tag} ` : ''}{w.faction_b_info?.name}
                  </span>
                  <span style={{ fontSize:'11px', color:'var(--muted)', marginLeft:'auto' }}>
                    Day {Math.floor((Date.now() - new Date(w.created_at)) / (1000*60*60*24)) + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Quick faction overview */}
          <div className="card">
            <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'13px', marginBottom:'12px', letterSpacing:'0.1em' }}>
              FACTION OVERVIEW
            </h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {serverFactions.map(f => (
                <div key={f.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px', borderRadius:'6px', cursor:'pointer', transition:'background 0.1s' }}
                  onClick={() => navigate(`/faction/${f.id}`)}
                  onMouseEnter={e => e.currentTarget.style.background = '#1a2e1a'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize:'20px', flexShrink:0 }}>{f.flag || '☢️'}</span>
                  <span style={{ fontWeight:600, flex:1, fontSize:'14px', color: f.primary_color || 'var(--text)' }}>
                    {f.tag ? `${f.tag} ` : ''}{f.name}
                  </span>
                  {f.is_recruiting && <span className="tag tag-green" style={{ fontSize:'10px' }}>Recruiting</span>}
                  <div style={{ display:'flex', gap:'14px', fontSize:'12px', color:'var(--muted)', flexShrink:0 }}>
                    <span>👥 {f.members}</span>
                    <span>🗺️ {f.territories}</span>
                    <span>⚔️ {f.raids}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Factions detail */}
      {!loading && tab === 'factions' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <p style={{ fontSize:'13px', color:'var(--muted)' }}>
            {serverFactions.length} faction{serverFactions.length !== 1 ? 's' : ''} on {faction.server_name}
          </p>
          {serverFactions.map(f => (
            <div key={f.id} className="card"
              onClick={() => navigate(`/faction/${f.id}`)}
              style={{ display:'flex', alignItems:'center', gap:'16px', cursor:'pointer', borderLeft:`3px solid ${f.primary_color || 'var(--border)'}` }}
              onMouseEnter={e => e.currentTarget.style.borderColor = f.primary_color || 'var(--green-dim)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = f.primary_color || 'var(--border)'}
            >
              <span style={{ fontSize:'32px', flexShrink:0 }}>{f.flag || '☢️'}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                  {f.tag && <span style={{ fontFamily:'Share Tech Mono', color: f.primary_color || 'var(--green)', fontSize:'12px' }}>{f.tag}</span>}
                  <span style={{ fontWeight:700, fontSize:'15px' }}>{f.name}</span>
                  {f.is_recruiting && <span className="tag tag-green" style={{ fontSize:'10px' }}>Recruiting</span>}
                </div>
                {f.description && <p style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.description}</p>}
              </div>
              <div style={{ display:'flex', gap:'16px', fontSize:'13px', color:'var(--muted)', flexShrink:0, flexWrap:'wrap' }}>
                <span style={{ display:'flex', alignItems:'center', gap:'4px' }}><Users size={12} /> {f.members}</span>
                <span style={{ display:'flex', alignItems:'center', gap:'4px' }}><Map size={12} /> {f.territories}</span>
                <span style={{ display:'flex', alignItems:'center', gap:'4px' }}><Sword size={12} /> {f.raids}</span>
                <span style={{ display:'flex', alignItems:'center', gap:'4px' }}><Trophy size={12} /> {f.bounties}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard */}
      {!loading && tab === 'leaderboard' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <p style={{ fontSize:'13px', color:'var(--muted)' }}>Ranked by combined score across members, territories, raids and bounties</p>
          {ranked.map((f, i) => {
            const score = f.members + f.territories + f.raids + f.bounties
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`
            return (
              <div key={f.id} className="card"
                onClick={() => navigate(`/faction/${f.id}`)}
                style={{ display:'flex', alignItems:'center', gap:'14px', cursor:'pointer', borderLeft:`3px solid ${i === 0 ? 'var(--yellow)' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--border)'}` }}
              >
                <span style={{ fontFamily:'Share Tech Mono', fontSize:'20px', minWidth:'36px', textAlign:'center', flexShrink:0 }}>{medal}</span>
                <span style={{ fontSize:'24px', flexShrink:0 }}>{f.flag || '☢️'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:'15px', color: f.primary_color || 'var(--text)' }}>
                    {f.tag ? `${f.tag} ` : ''}{f.name}
                  </div>
                </div>
                <div style={{ display:'flex', gap:'12px', fontSize:'12px', color:'var(--muted)', flexShrink:0, flexWrap:'wrap' }}>
                  <span>👥 {f.members}</span>
                  <span>🗺️ {f.territories}</span>
                  <span>⚔️ {f.raids}</span>
                  <span>🎯 {f.bounties}</span>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontFamily:'Share Tech Mono', fontSize:'20px', color: i === 0 ? 'var(--yellow)' : 'var(--green)' }}>{score}</div>
                  <div style={{ fontSize:'10px', color:'var(--muted)' }}>pts</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Wars */}
      {!loading && tab === 'wars' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {wars.length === 0 && (
            <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
              ☮️ No active wars on {faction.server_name}. It's peaceful out there.
            </div>
          )}
          {wars.map(w => (
            <div key={w.id} className="card" style={{ borderLeft:'3px solid var(--red)', display:'flex', gap:'16px', alignItems:'center', flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:'200px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap', fontSize:'16px' }}>
                  <span style={{ fontWeight:700, color: w.faction_a_info?.primary_color || 'var(--text)' }}>
                    {w.faction_a_info?.tag ? `${w.faction_a_info.tag} ` : ''}{w.faction_a_info?.name}
                  </span>
                  <span style={{ color:'var(--red)', fontFamily:'Share Tech Mono', fontSize:'13px' }}>VS</span>
                  <span style={{ fontWeight:700, color: w.faction_b_info?.primary_color || 'var(--text)' }}>
                    {w.faction_b_info?.tag ? `${w.faction_b_info.tag} ` : ''}{w.faction_b_info?.name}
                  </span>
                </div>
                {w.terms && <p style={{ fontSize:'13px', color:'var(--muted)', marginTop:'6px' }}>{w.terms}</p>}
                <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'4px', display:'flex', gap:'12px' }}>
                  <span>Declared {new Date(w.created_at).toLocaleDateString()}</span>
                  <span>Day {Math.floor((Date.now() - new Date(w.created_at)) / (1000*60*60*24)) + 1} of conflict</span>
                </div>
              </div>
              <span className="tag tag-red">⚔️ Active</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}