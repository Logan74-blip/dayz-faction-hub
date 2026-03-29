import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Archive, Calendar, Users, Sword, Package, Target } from 'lucide-react'

export default function FactionLogs({ session }) {
  const { role, faction } = useRole(session.user.id)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { if (faction?.id) loadLogs() }, [faction?.id])

  async function loadLogs() {
    setLoading(true)
    const { data } = await supabase
      .from('faction_logs')
      .select('*, profile:profiles(discord_username, discord_avatar)')
      .eq('faction_id', faction.id)
      .order('created_at', { ascending: false })
    setLogs(data || [])
    setLoading(false)
  }

  if (!faction) return (
    <div style={{ padding:'80px', textAlign:'center', color:'var(--muted)' }}>
      Join or create a faction to view logs.
    </div>
  )

  if (loading) return <div className="page-loading"><div className="spinner" /></div>

  return (
    <div style={{ maxWidth:800, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>FACTION LOGS</h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>
          Archived snapshots from each fresh start — these cannot be deleted
        </p>
      </div>

      {logs.length === 0 && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'60px 24px', display:'flex', flexDirection:'column', alignItems:'center', gap:'12px' }}>
          <Archive size={40} color="var(--border)" />
          <p style={{ fontSize:'15px' }}>No logs yet.</p>
          <p style={{ fontSize:'13px', lineHeight:1.5 }}>
            When you click <strong style={{ color:'var(--text)' }}>Start Fresh</strong> on the Dashboard,
            a snapshot of your faction's stats will be saved here permanently.
          </p>
        </div>
      )}

      {logs.map(log => {
        const snap = log.snapshot || {}
        const isOpen = expanded === log.id
        return (
          <div key={log.id} className="card" style={{ display:'flex', flexDirection:'column', gap:'0', overflow:'hidden', borderLeft:'3px solid var(--green-dim)' }}>
            {/* Header */}
            <div
              onClick={() => setExpanded(isOpen ? null : log.id)}
              style={{ display:'flex', alignItems:'center', gap:'14px', padding:'16px 20px', cursor:'pointer', background: isOpen ? '#0d1a0d' : 'transparent' }}
            >
              <Archive size={18} color="var(--green)" style={{ flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:'16px' }}>
                  {log.archive_label || 'Fresh Start'}
                </div>
                <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'3px', display:'flex', gap:'12px', flexWrap:'wrap' }}>
                  <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                    <Calendar size={11} />
                    {new Date(log.created_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}
                  </span>
                  {log.server_name && <span>📡 {log.server_name}</span>}
                  {log.profile?.discord_username && (
                    <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                      {log.profile.discord_avatar && <img src={log.profile.discord_avatar} style={{ width:14, height:14, borderRadius:'50%' }} />}
                      by {log.profile.discord_username}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ fontSize:'12px', color:'var(--muted)', flexShrink:0 }}>
                {isOpen ? '▲ Hide' : '▼ Show'}
              </span>
            </div>

            {/* Snapshot details */}
            {isOpen && (
              <div style={{ borderTop:'1px solid var(--border)', padding:'16px 20px', display:'flex', flexDirection:'column', gap:'16px' }}>
                {/* Stats grid */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:'10px' }}>
                  {[
                    { label:'Members', value:snap.members ?? '—', icon:Users, color:'var(--green)' },
                    { label:'Raids', value:snap.raids ?? '—', icon:Sword, color:'var(--red)' },
                    { label:'Resources', value:snap.resources ?? '—', icon:Package, color:'#818cf8' },
                    { label:'Bounties', value:snap.bounties ?? '—', icon:Target, color:'var(--yellow)' },
                    { label:'Territories', value:snap.territories ?? '—', icon:Archive, color:'var(--yellow)' },
                    { label:'Announcements', value:snap.announcements ?? '—', icon:Archive, color:'var(--muted)' },
                  ].map(({ label, value, icon:Icon, color }) => (
                    <div key={label} style={{ background:'var(--bg)', borderRadius:'8px', padding:'12px', textAlign:'center' }}>
                      <Icon size={14} color={color} style={{ marginBottom:'4px' }} />
                      <div style={{ fontFamily:'Share Tech Mono', fontSize:'22px', color, fontWeight:700 }}>{value}</div>
                      <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Recent events at time of archive */}
                {snap.recentEvents?.length > 0 && (
                  <div>
                    <h4 style={{ fontFamily:'Share Tech Mono', fontSize:'12px', color:'var(--muted)', letterSpacing:'0.1em', marginBottom:'8px' }}>
                      RECENT ACTIVITY AT TIME OF ARCHIVE
                    </h4>
                    <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                      {snap.recentEvents.map((e, i) => (
                        <div key={i} style={{ fontSize:'13px', padding:'6px 10px', background:'var(--bg)', borderRadius:'4px', display:'flex', gap:'8px', alignItems:'center' }}>
                          <span style={{ color:'var(--muted)', fontSize:'11px', flexShrink:0 }}>
                            {new Date(e.created_at).toLocaleDateString()}
                          </span>
                          <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p style={{ fontSize:'12px', color:'var(--muted)', fontStyle:'italic' }}>
                  🔒 This log is permanent and cannot be deleted.
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}