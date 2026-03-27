import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { useNavigate } from 'react-router-dom'
import { Users, Shield, Map, Sword, AlertTriangle, Trash2 } from 'lucide-react'

export default function AdminDashboard({ session }) {
  const { role, faction } = useRole(session.user.id)
  const navigate = useNavigate()
  const [serverFactions, setServerFactions] = useState([])
  const [serverStats, setServerStats] = useState({})
  const [wars, setWars] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const userId = session.user.id

  const isAdmin = role === 'leader' || role === 'co-leader'

  useEffect(() => { if (faction && isAdmin) loadData() }, [faction, isAdmin])

  async function loadData() {
    setLoading(true)
    const serverName = faction?.server_name || 'Unknown Server'

    const { data: facs } = await supabase
      .from('factions')
      .select('*, faction_members(count), territories(count), raids(count)')
      .eq('server_name', serverName)
      .order('name')

    setServerFactions(facs || [])

    if (facs?.length) {
      const ids = facs.map(f => f.id)
      const { data: activeWars } = await supabase
        .from('diplomacy')
        .select('*, faction_a_info:factions!diplomacy_faction_a_fkey(name,tag), faction_b_info:factions!diplomacy_faction_b_fkey(name,tag)')
        .in('faction_a', ids)
        .eq('type', 'war')
        .eq('status', 'active')
      setWars(activeWars || [])

      const { data: reportLogs } = await supabase
        .from('faction_reports')
        .select('*, factions(name)')
        .in('faction_id', ids)
        .order('sent_at', { ascending: false })
        .limit(20)
      setReports(reportLogs || [])

      const totalMembers = facs.reduce((sum, f) => sum + (f.faction_members?.[0]?.count || 0), 0)
      const totalTerritories = facs.reduce((sum, f) => sum + (f.territories?.[0]?.count || 0), 0)
      const totalRaids = facs.reduce((sum, f) => sum + (f.raids?.[0]?.count || 0), 0)
      setServerStats({ totalMembers, totalTerritories, totalRaids, factions: facs.length, wars: activeWars?.length || 0 })
    }
    setLoading(false)
  }

  if (!isAdmin) return (
    <div style={{ maxWidth:600, margin:'80px auto', padding:'0 24px', textAlign:'center' }}>
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px', alignItems:'center', padding:'40px' }}>
        <AlertTriangle size={32} color="var(--yellow)" />
        <h2 style={{ fontSize:'20px', fontWeight:700 }}>Access Restricted</h2>
        <p style={{ color:'var(--muted)' }}>The Admin Dashboard is only accessible to faction leaders and co-leaders.</p>
        <button className="btn btn-green" onClick={() => navigate('/')}>Go to Dashboard</button>
      </div>
    </div>
  )

  if (!faction?.server_name) return (
    <div style={{ maxWidth:600, margin:'80px auto', padding:'0 24px', textAlign:'center' }}>
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px', alignItems:'center', padding:'40px' }}>
        <AlertTriangle size={32} color="var(--yellow)" />
        <h2 style={{ fontSize:'20px', fontWeight:700 }}>No Server Set</h2>
        <p style={{ color:'var(--muted)' }}>Set your server name in Settings to access the admin dashboard.</p>
        <button className="btn btn-green" onClick={() => navigate('/settings')}>Go to Settings</button>
      </div>
    </div>
  )

  const tabs = ['overview', 'factions', 'wars', 'reports']

  return (
    <div style={{ maxWidth:960, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>ADMIN DASHBOARD</h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>📡 {faction.server_name} — Server Overview</p>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'4px', borderBottom:'1px solid var(--border)' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background:'transparent', border:'none', padding:'8px 16px', cursor:'pointer',
            fontSize:'13px', fontWeight:600, fontFamily:'Rajdhani',
            color: tab===t ? 'var(--green)' : 'var(--muted)',
            borderBottom: tab===t ? '2px solid var(--green)' : '2px solid transparent',
            textTransform:'capitalize'
          }}>{t}</button>
        ))}
      </div>

      {loading && <p style={{ color:'var(--muted)', textAlign:'center', padding:'40px' }}>Loading server data...</p>}

      {/* Overview */}
      {!loading && tab === 'overview' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'12px' }}>
            {[
              { label:'Total Factions', value:serverStats.factions, icon:Shield, color:'var(--green)' },
              { label:'Total Members', value:serverStats.totalMembers, icon:Users, color:'var(--green)' },
              { label:'Territories', value:serverStats.totalTerritories, icon:Map, color:'var(--yellow)' },
              { label:'Total Raids', value:serverStats.totalRaids, icon:Sword, color:'var(--red)' },
              { label:'Active Wars', value:serverStats.wars, icon:AlertTriangle, color:'var(--red)' },
            ].map(({ label, value, icon:Icon, color }) => (
              <div key={label} className="card" style={{ textAlign:'center', padding:'16px' }}>
                <Icon size={20} color={color} style={{ marginBottom:'8px' }} />
                <div style={{ fontFamily:'Share Tech Mono', fontSize:'28px', color, fontWeight:700 }}>{value}</div>
                <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'4px' }}>{label}</div>
              </div>
            ))}
          </div>

          {wars.length > 0 && (
            <div className="card" style={{ borderColor:'var(--red)' }}>
              <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--red)', fontSize:'14px', marginBottom:'12px' }}>💀 ACTIVE WARS ON SERVER</h3>
              {wars.map(w => (
                <div key={w.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:'14px' }}>
                  <span style={{ fontWeight:700 }}>{w.faction_a_info?.name}</span>
                  <span style={{ color:'var(--red)' }}>⚔️</span>
                  <span style={{ fontWeight:700 }}>{w.faction_b_info?.name}</span>
                  <span style={{ fontSize:'12px', color:'var(--muted)', marginLeft:'auto' }}>{new Date(w.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Factions */}
      {!loading && tab === 'factions' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {serverFactions.map(f => (
            <div key={f.id} className="card" onClick={() => navigate(`/faction/${f.id}`)} style={{ display:'flex', alignItems:'center', gap:'16px', cursor:'pointer' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--green-dim)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  {f.tag && <span style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'12px' }}>{f.tag}</span>}
                  <span style={{ fontWeight:700, fontSize:'15px' }}>{f.name}</span>
                  {f.is_recruiting && <span className="tag tag-green" style={{ fontSize:'11px' }}>Recruiting</span>}
                </div>
                {f.description && <p style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px', margin:0 }}>{f.description}</p>}
              </div>
              <div style={{ display:'flex', gap:'20px', fontSize:'13px', color:'var(--muted)' }}>
                <span><Users size={12} style={{ marginRight:'4px' }} />{f.faction_members?.[0]?.count || 0}</span>
                <span><Map size={12} style={{ marginRight:'4px' }} />{f.territories?.[0]?.count || 0}</span>
                <span><Sword size={12} style={{ marginRight:'4px' }} />{f.raids?.[0]?.count || 0}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Wars */}
      {!loading && tab === 'wars' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {wars.length === 0 && <p style={{ color:'var(--muted)', textAlign:'center', padding:'40px' }}>No active wars on this server.</p>}
          {wars.map(w => (
            <div key={w.id} className="card" style={{ borderLeft:'3px solid var(--red)', display:'flex', gap:'16px', alignItems:'center' }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px', fontSize:'16px' }}>
                  <span style={{ fontWeight:700 }}>{w.faction_a_info?.tag || ''} {w.faction_a_info?.name}</span>
                  <span style={{ color:'var(--red)', fontFamily:'Share Tech Mono' }}>VS</span>
                  <span style={{ fontWeight:700 }}>{w.faction_b_info?.tag || ''} {w.faction_b_info?.name}</span>
                </div>
                {w.terms && <p style={{ fontSize:'13px', color:'var(--muted)', marginTop:'6px' }}>{w.terms}</p>}
                <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'4px' }}>Declared {new Date(w.created_at).toLocaleString()}</div>
              </div>
              <span className="tag tag-red">Active</span>
            </div>
          ))}
        </div>
      )}

      {/* Reports */}
      {!loading && tab === 'reports' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <p style={{ color:'var(--muted)', fontSize:'13px' }}>Faction report history for all factions on {faction.server_name}</p>
          {reports.length === 0 && <p style={{ color:'var(--muted)', textAlign:'center', padding:'40px' }}>No reports sent yet.</p>}
          {reports.map(r => (
            <div key={r.id} className="card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px' }}>
              <div>
                <span style={{ fontWeight:600 }}>{r.factions?.name}</span>
                <span style={{ marginLeft:'10px', color:'var(--muted)', fontSize:'13px' }}>{r.type} report</span>
              </div>
              <span style={{ fontSize:'12px', color:'var(--muted)' }}>{new Date(r.sent_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}