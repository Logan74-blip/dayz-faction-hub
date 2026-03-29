import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Map, Package, Shield, Users, Sword, TrendingUp, Target, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const mins = Math.floor(diff / (1000 * 60))
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'just now'
}

const EVENT_ICONS = {
  raid:'⚔️', diplomacy:'🤝', territory:'🗺️', member:'👤',
  bounty:'🎯', custom:'📝', announcement:'📣', trade:'🛒',
  war:'💀', stockpile_add:'📦', stockpile_clear:'🧹',
  treasury_deposit:'💰', treasury_withdrawal:'💸', trade_post:'🛒'
}

export default function Dashboard({ session }) {
  const [faction, setFaction] = useState(null)
  const [memberRole, setMemberRole] = useState(null)
  const [factionName, setFactionName] = useState('')
  const [stats, setStats] = useState({ territories:0, resources:0, pacts:0, raids:0, members:0, newMembers:0, wars_won:0, wars_lost:0, bounties:0 })
  const [members, setMembers] = useState([])
  const [history, setHistory] = useState([])
  const [feed, setFeed] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [showFreshModal, setShowFreshModal] = useState(false)
  const [freshLabel, setFreshLabel] = useState('')
  const [freshLoading, setFreshLoading] = useState(false)
  const navigate = useNavigate()
  const userId = session.user.id

  useEffect(() => { loadFaction() }, [])

  async function loadFaction() {
    setLoading(true)
    const { data } = await supabase
      .from('faction_members')
      .select('*, factions(*)')
      .eq('user_id', userId)
      .maybeSingle()
    if (data?.factions) {
      setFaction(data.factions)
      setMemberRole(data.role)
      await Promise.all([
        loadStats(data.factions.id),
        loadMembers(data.factions.id),
        loadHistory(data.factions.id),
        loadFeed(data.factions.id)
      ])
    }
    setLoading(false)
  }

  async function loadStats(fid) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [t, r, p, raids, mems, newMems, warsWon, warsLost, bounties] = await Promise.all([
      supabase.from('territories').select('id', { count:'exact', head:true }).eq('faction_id', fid),
      supabase.from('resources').select('id', { count:'exact', head:true }).eq('faction_id', fid),
      supabase.from('diplomacy').select('id', { count:'exact', head:true }).eq('status', 'active').or(`faction_a.eq.${fid},faction_b.eq.${fid}`),
      supabase.from('raids').select('id', { count:'exact', head:true }).eq('faction_id', fid),
      supabase.from('faction_members').select('id', { count:'exact', head:true }).eq('faction_id', fid),
      supabase.from('faction_members').select('id', { count:'exact', head:true }).eq('faction_id', fid).gte('joined_at', weekAgo),
      supabase.from('diplomacy').select('id', { count:'exact', head:true }).eq('faction_b', fid).eq('type', 'war').eq('status', 'won'),
      supabase.from('diplomacy').select('id', { count:'exact', head:true }).eq('faction_a', fid).eq('type', 'war').eq('status', 'lost'),
      supabase.from('bounties').select('id', { count:'exact', head:true }).eq('faction_id', fid).eq('status', 'active'),
    ])
    setStats({
      territories: t.count || 0,
      resources: r.count || 0,
      pacts: p.count || 0,
      raids: raids.count || 0,
      members: mems.count || 0,
      newMembers: newMems.count || 0,
      wars_won: warsWon.count || 0,
      wars_lost: warsLost.count || 0,
      bounties: bounties.count || 0,
    })
  }

  async function loadMembers(fid) {
    const { data } = await supabase
      .from('faction_members')
      .select('*, profile:profiles(discord_username, discord_avatar)')
      .eq('faction_id', fid)
      .order('joined_at', { ascending: false })
    setMembers(data || [])
  }

  async function loadHistory(fid) {
    const { data } = await supabase
      .from('member_history')
      .select('*')
      .eq('faction_id', fid)
      .order('created_at', { ascending: false })
      .limit(30)
    setHistory(data || [])
  }

  async function loadFeed(fid) {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('faction_id', fid)
      .order('created_at', { ascending: false })
      .limit(20)
    setFeed(data || [])
  }

  async function createFaction() {
    if (!factionName.trim()) return
    const { data, error } = await supabase
      .from('factions')
      .insert({ name: factionName.trim(), created_by: userId })
      .select()
      .single()
    if (!error) {
      await supabase.from('faction_members').insert({ faction_id: data.id, user_id: userId, role: 'leader' })
      await supabase.from('member_history').insert({ faction_id: data.id, user_id: userId, action: 'joined' })
      setFaction(data)
      setMemberRole('leader')
    }
  }

  async function startFresh(label) {
    if (!faction) return
    const [mems, raids, resources, bounties, territories, announcements, recentEvents] = await Promise.all([
      supabase.from('faction_members').select('id', { count:'exact', head:true }).eq('faction_id', faction.id),
      supabase.from('raids').select('id', { count:'exact', head:true }).eq('faction_id', faction.id),
      supabase.from('resources').select('id', { count:'exact', head:true }).eq('faction_id', faction.id),
      supabase.from('bounties').select('id', { count:'exact', head:true }).eq('faction_id', faction.id),
      supabase.from('territories').select('id', { count:'exact', head:true }).eq('faction_id', faction.id),
      supabase.from('announcements').select('id', { count:'exact', head:true }).eq('faction_id', faction.id),
      supabase.from('events').select('title, created_at').eq('faction_id', faction.id).order('created_at', { ascending:false }).limit(10),
    ])
    const snapshot = {
      members: mems.count || 0,
      raids: raids.count || 0,
      resources: resources.count || 0,
      bounties: bounties.count || 0,
      territories: territories.count || 0,
      announcements: announcements.count || 0,
      recentEvents: recentEvents.data || [],
      archivedAt: new Date().toISOString(),
    }
    await supabase.from('faction_logs').insert({
      faction_id: faction.id,
      archived_by: userId,
      archive_label: label || `Fresh Start — ${new Date().toLocaleDateString('en-US', { month:'long', year:'numeric' })}`,
      server_name: faction.server_name,
      snapshot
    })
    await Promise.all([
      supabase.from('raids').delete().eq('faction_id', faction.id),
      supabase.from('resources').delete().eq('faction_id', faction.id),
      supabase.from('bounties').delete().eq('faction_id', faction.id),
      supabase.from('territories').delete().eq('faction_id', faction.id),
      supabase.from('announcements').delete().eq('faction_id', faction.id),
      supabase.from('events').delete().eq('faction_id', faction.id),
      supabase.from('treasury').delete().eq('faction_id', faction.id),
      supabase.from('diplomacy').delete().or(`faction_a.eq.${faction.id},faction_b.eq.${faction.id}`),
    ])
    await supabase.from('events').insert({
      faction_id: faction.id, created_by: userId, type: 'custom',
      title: '🔄 Fresh Start',
      description: `Faction data archived and cleared. Label: ${label || 'Fresh Start'}`
    })
    await loadFaction()
  }

  if (loading) return <div className="page-loading"><div className="spinner" /></div>

  if (!faction) return (
    <div style={{ maxWidth:480, margin:'80px auto', padding:'0 24px' }}>
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'16px', textAlign:'center', padding:'40px' }}>
        <div style={{ fontSize:'48px' }}>☢️</div>
        <h2 style={{ fontSize:'22px', fontWeight:700 }}>You're not in a faction yet</h2>
        <p style={{ color:'var(--muted)', fontSize:'14px', lineHeight:1.5 }}>
          Create a new faction to get started, or ask a faction leader for an invite link.
        </p>
        <input
          placeholder="Faction name..."
          value={factionName}
          onChange={e => setFactionName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createFaction()}
          autoFocus
        />
        <button className="btn btn-green" onClick={createFaction} disabled={!factionName.trim()}>
          Create Faction
        </button>
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:'16px' }}>
          <p style={{ color:'var(--muted)', fontSize:'13px', marginBottom:'10px' }}>Or browse recruiting factions</p>
          <button className="btn btn-ghost" style={{ fontSize:'13px' }} onClick={() => navigate('/join-requests')}>
            Browse Factions →
          </button>
        </div>
      </div>
    </div>
  )

  const joins = history.filter(h => h.action === 'joined').length
  const leaves = history.filter(h => h.action === 'left').length
  const turnoverRate = joins > 0 ? Math.round((leaves / joins) * 100) : 0
  const factionColor = faction.primary_color || 'var(--green)'
  const factionFlag = faction.flag || '☢️'

  const statCards = [
    { label:'Members', value:stats.members, icon:Users, color:'var(--green)', path:'/settings' },
    { label:'Territories', value:stats.territories, icon:Map, color:'var(--yellow)', path:'/map' },
    { label:'Resources', value:stats.resources, icon:Package, color:'#818cf8', path:'/resources' },
    { label:'Active Pacts', value:stats.pacts, icon:Shield, color:'#60a5fa', path:'/diplomacy' },
    { label:'Total Raids', value:stats.raids, icon:Sword, color:'var(--red)', path:'/raids' },
    { label:'Active Bounties', value:stats.bounties, icon:Target, color:'var(--yellow)', path:'/bounties' },
    { label:'New This Week', value:stats.newMembers, icon:TrendingUp, color:'var(--green)', path:'/settings' },
  ]

  return (
    <div style={{ maxWidth:960, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          <span style={{ fontSize:'48px', lineHeight:1 }}>{factionFlag}</span>
          <div>
            <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'26px', color:factionColor, lineHeight:1 }}>
              {faction.name}
            </h1>
            <p style={{ color:'var(--muted)', marginTop:'4px', fontSize:'13px' }}>
              Faction Command Center
              {faction.server_name && (
                <span style={{ marginLeft:'10px', color:'var(--green)' }}>📡 {faction.server_name}</span>
              )}
            </p>
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
          {faction.tag && <span className="tag tag-green" style={{ fontSize:'14px' }}>{faction.tag}</span>}
          {faction.is_recruiting
            ? <span className="tag tag-green">✅ Recruiting</span>
            : <span className="tag tag-red">🚫 Full</span>
          }
          <button className="btn btn-ghost" style={{ fontSize:'12px', display:'flex', alignItems:'center', gap:'6px' }} onClick={loadFaction}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'4px', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
        {[
          { key:'overview', label:'🏠 Overview' },
          { key:'feed', label:'📰 News Feed' },
          { key:'members', label:'👥 Members' },
          { key:'turnover', label:'📊 Turnover' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            background:'transparent', border:'none', padding:'8px 16px', cursor:'pointer',
            fontSize:'13px', fontWeight:600, fontFamily:'Rajdhani',
            color: activeTab===tab.key ? 'var(--green)' : 'var(--muted)',
            borderBottom: activeTab===tab.key ? '2px solid var(--green)' : '2px solid transparent',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'12px' }}>
            {statCards.map(({ label, value, icon:Icon, color, path }) => (
              <div key={label} className="card" style={{ cursor:'pointer', display:'flex', gap:'12px', alignItems:'center', padding:'14px', transition:'border-color 0.15s' }}
                onClick={() => navigate(path)}
                onMouseEnter={e => e.currentTarget.style.borderColor = color}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ background:`${color}22`, borderRadius:'8px', padding:'8px', display:'flex', flexShrink:0 }}>
                  <Icon size={18} color={color} />
                </div>
                <div>
                  <div style={{ fontSize:'24px', fontWeight:700, fontFamily:'Share Tech Mono', color }}>{value}</div>
                  <div style={{ fontSize:'11px', color:'var(--muted)' }}>{label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* War record */}
          <div className="card">
            <h3 style={{ fontWeight:700, fontSize:'15px', marginBottom:'14px' }}>💀 War Record</h3>
            <div style={{ display:'flex', gap:'32px', flexWrap:'wrap' }}>
              {[
                { label:'Wars Won', value:stats.wars_won, color:'var(--green)' },
                { label:'Wars Lost', value:stats.wars_lost, color:'var(--red)' },
                { label:'Win Rate', value:`${stats.wars_won + stats.wars_lost > 0 ? Math.round((stats.wars_won / (stats.wars_won + stats.wars_lost)) * 100) : 0}%`, color:'var(--yellow)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'32px', fontWeight:700, fontFamily:'Share Tech Mono', color }}>{value}</div>
                  <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="card">
            <h3 style={{ fontWeight:700, fontSize:'15px', marginBottom:'14px' }}>⚡ Quick Actions</h3>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              {[
                { label:'Schedule Raid', path:'/raids', color:'var(--red)' },
                { label:'Post Bounty', path:'/bounties', color:'var(--yellow)' },
                { label:'Add Resources', path:'/resources', color:'#818cf8' },
                { label:'Send Diplomacy', path:'/diplomacy', color:'var(--green)' },
                { label:'Post Announcement', path:'/announcements', color:'var(--green)' },
                { label:'View War Map', path:'/map', color:'var(--yellow)' },
                { label:'View Logs', path:'/faction-logs', color:'var(--muted)' },
              ].map(({ label, path, color }) => (
                <button key={label} className="btn btn-ghost" style={{ fontSize:'13px', color, borderColor:`${color}44` }} onClick={() => navigate(path)}>
                  {label}
                </button>
              ))}
            </div>
            {memberRole === 'leader' && (
              <div style={{ marginTop:'16px', paddingTop:'16px', borderTop:'1px solid var(--border)' }}>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize:'13px', color:'var(--yellow)', borderColor:'#d97706', display:'flex', alignItems:'center', gap:'8px' }}
                  onClick={() => setShowFreshModal(true)}
                >
                  🔄 Start Fresh
                </button>
                <p style={{ fontSize:'11px', color:'var(--muted)', marginTop:'6px' }}>
                  Archive all faction data and start a new chapter. Members are kept.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── NEWS FEED ── */}
      {activeTab === 'feed' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <p style={{ fontSize:'13px', color:'var(--muted)' }}>Latest faction activity — updated in real time</p>
          {feed.length === 0 && (
            <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
              No activity yet. Start by scheduling a raid or posting an announcement.
            </div>
          )}
          {feed.map(e => (
            <div key={e.id} className="card" style={{ display:'flex', gap:'12px', alignItems:'flex-start', padding:'12px 16px', borderLeft:'3px solid var(--border)' }}>
              <span style={{ fontSize:'20px', flexShrink:0 }}>{EVENT_ICONS[e.type] || '📋'}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:'14px' }}>{e.title}</div>
                {e.description && <div style={{ fontSize:'13px', color:'var(--muted)', marginTop:'2px' }}>{e.description}</div>}
                <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'4px' }}>{timeAgo(e.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MEMBERS ── */}
      {activeTab === 'members' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {members.length === 0 && (
            <p style={{ color:'var(--muted)', textAlign:'center', padding:'32px' }}>No members yet.</p>
          )}
          {members.map(m => (
            <div key={m.id} className="card" style={{ display:'flex', alignItems:'center', gap:'14px', padding:'12px 18px' }}>
              {m.profile?.discord_avatar
                ? <img src={m.profile.discord_avatar} style={{ width:36, height:36, borderRadius:'50%', border:'2px solid var(--border)', flexShrink:0 }} />
                : <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', flexShrink:0 }}>👤</div>
              }
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:'15px' }}>{m.profile?.discord_username || 'Member'}</div>
                <div style={{ fontSize:'12px', color:'var(--muted)' }}>Joined {new Date(m.joined_at).toLocaleDateString()}</div>
              </div>
              <span className={`tag ${m.role === 'leader' || m.role === 'co-leader' ? 'tag-green' : 'tag-yellow'}`}>
                {m.role}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── TURNOVER ── */}
      {activeTab === 'turnover' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'14px' }}>
            {[
              { label:'Total Joins', value:joins, color:'var(--green)' },
              { label:'Total Leaves', value:leaves, color:'var(--red)' },
              { label:'Turnover Rate', value:`${turnoverRate}%`, color: turnoverRate > 50 ? 'var(--red)' : turnoverRate > 25 ? 'var(--yellow)' : 'var(--green)' },
              { label:'New This Week', value:stats.newMembers, color:'var(--green)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card" style={{ textAlign:'center' }}>
                <div style={{ fontSize:'36px', fontWeight:700, fontFamily:'Share Tech Mono', color }}>{value}</div>
                <div style={{ fontSize:'13px', color:'var(--muted)', marginTop:'4px' }}>{label}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <h3 style={{ fontWeight:700, fontSize:'15px', marginBottom:'12px' }}>Recent Member Activity</h3>
            {history.length === 0 && <p style={{ color:'var(--muted)', fontSize:'13px' }}>No history yet.</p>}
            <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'300px', overflowY:'auto' }}>
              {history.map(h => (
                <div key={h.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' }}>
                  <span>{h.action === 'joined' ? '✅' : '❌'}</span>
                  <span style={{ color: h.action === 'joined' ? 'var(--green)' : 'var(--red)', fontWeight:600 }}>
                    {h.action === 'joined' ? 'Member joined' : 'Member left'}
                  </span>
                  <span style={{ color:'var(--muted)', marginLeft:'auto', fontSize:'12px' }}>
                    {new Date(h.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ background:'#14532d22', borderColor:'var(--green-dim)' }}>
            <p style={{ fontSize:'13px', color:'var(--muted)', lineHeight:1.6 }}>
              💡 <strong style={{ color:'var(--text)' }}>Turnover rate</strong> measures how many members leave relative to joins. Under 25% is healthy. Over 50% suggests retention issues.
            </p>
          </div>
        </div>
      )}

      {/* ── START FRESH MODAL ── */}
      {showFreshModal && (
        <div style={{ position:'fixed', inset:0, background:'#00000088', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }} onClick={() => setShowFreshModal(false)}>
          <div className="card" style={{ maxWidth:'480px', width:'100%', display:'flex', flexDirection:'column', gap:'16px', borderColor:'var(--yellow)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ fontSize:'28px' }}>🔄</span>
              <h3 style={{ fontWeight:700, fontSize:'20px', color:'var(--yellow)' }}>Start Fresh</h3>
            </div>
            <p style={{ color:'var(--muted)', fontSize:'14px', lineHeight:1.6 }}>
              This will <strong style={{ color:'var(--text)' }}>archive all faction data</strong> and clear it for a fresh start. Your members and settings are kept.
            </p>
            <div style={{ background:'#0d1a0d', border:'1px solid var(--border)', borderRadius:'6px', padding:'12px', display:'flex', flexDirection:'column', gap:'6px' }}>
              <p style={{ fontSize:'12px', color:'var(--green)', fontFamily:'Share Tech Mono' }}>CLEARED:</p>
              <p style={{ fontSize:'12px', color:'var(--muted)', lineHeight:1.6 }}>
                ⚔️ Raids • 📦 Resources • 🎯 Bounties • 🗺️ Territories • 📣 Announcements • 💰 Treasury • 🤝 Diplomacy • 📋 Events
              </p>
              <p style={{ fontSize:'12px', color:'var(--green)', fontFamily:'Share Tech Mono', marginTop:'4px' }}>KEPT:</p>
              <p style={{ fontSize:'12px', color:'var(--muted)' }}>👥 Members • ⚙️ Settings • 🎨 Customization • 📜 Faction Logs</p>
            </div>
            <div>
              <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'6px' }}>ARCHIVE LABEL (optional)</label>
              <input
                placeholder={`e.g. Server Wipe — ${new Date().toLocaleDateString('en-US', { month:'long', year:'numeric' })}`}
                value={freshLabel}
                onChange={e => setFreshLabel(e.target.value)}
                autoFocus
              />
            </div>
            <p style={{ fontSize:'12px', color:'var(--yellow)', background:'#451a0322', padding:'10px', borderRadius:'6px' }}>
              ⚠️ A permanent snapshot will be saved to Faction Logs before clearing. This cannot be undone.
            </p>
            <div style={{ display:'flex', gap:'8px' }}>
              <button
                className="btn"
                style={{ flex:1, background:'#d97706', color:'#fff', border:'none', fontWeight:700, fontSize:'14px' }}
                disabled={freshLoading}
                onClick={async () => {
                  setFreshLoading(true)
                  await startFresh(freshLabel)
                  setShowFreshModal(false)
                  setFreshLabel('')
                  setFreshLoading(false)
                }}
              >
                {freshLoading ? 'Archiving...' : '🔄 Yes, Start Fresh'}
              </button>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setShowFreshModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}