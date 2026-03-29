import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { useNavigate } from 'react-router-dom'
import { Search, Users, Map, Sword, ChevronDown, ChevronUp } from 'lucide-react'

const OFFICIAL_SERVERS = [
  'Chernarus Official #1', 'Chernarus Official #2',
  'Livonia Official #1', 'Livonia Official #2',
  'Sakhal Official #1', 'Sakhal Official #2',
]

export default function Directory({ session }) {
  const { faction: myFaction } = useRole(session.user.id)
  const navigate = useNavigate()
  const [factions, setFactions] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [serverFilter, setServerFilter] = useState('all')
  const [expandedServer, setExpandedServer] = useState(null)
  const [serverStats, setServerStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [myRequests, setMyRequests] = useState([])
  const userId = session.user.id

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)

    // Load factions with leader info
    const { data: facs } = await supabase
      .from('factions')
      .select(`
        *,
        faction_members!inner(count),
        territories(count),
        raids(count),
        leader:faction_members(
          role,
          profile:profiles(discord_username, discord_avatar)
        )
      `)
      .order('name')

    // Process leader info
    const processed = (facs || []).map(f => ({
      ...f,
      memberCount: f.faction_members?.[0]?.count || 0,
      territoryCount: f.territories?.[0]?.count || 0,
      raidCount: f.raids?.[0]?.count || 0,
      leaderProfile: f.leader?.find(m => m.role === 'leader')?.profile || null
    }))

    setFactions(processed)

    // Load my pending requests
    const { data: reqs } = await supabase
      .from('join_requests')
      .select('faction_id, status')
      .eq('user_id', userId)
      .eq('status', 'pending')
    setMyRequests(reqs || [])

    // Build server stats
    if (processed.length) {
      const servers = [...new Set(processed.map(f => f.server_name).filter(Boolean))]
      const stats = {}
      for (const server of servers) {
        const serverFactions = processed.filter(f => f.server_name === server)
        const ids = serverFactions.map(f => f.id)
        const { count: warCount } = await supabase
          .from('diplomacy')
          .select('id', { count:'exact', head:true })
          .in('faction_a', ids)
          .eq('type', 'war')
          .eq('status', 'active')
        stats[server] = {
          factionCount: serverFactions.length,
          totalMembers: serverFactions.reduce((sum, f) => sum + f.memberCount, 0),
          activeWars: warCount || 0,
          recruiting: serverFactions.filter(f => f.is_recruiting).length
        }
      }
      setServerStats(stats)
    }
    setLoading(false)
  }

  async function sendJoinRequest(factionId) {
    const { error } = await supabase.from('join_requests').insert({
      faction_id: factionId,
      user_id: userId,
      message: '',
      status: 'pending'
    })
    if (!error) {
      setMyRequests(r => [...r, { faction_id: factionId, status: 'pending' }])
      const { data: leaders } = await supabase
        .from('faction_members')
        .select('user_id')
        .eq('faction_id', factionId)
        .in('role', ['leader', 'co-leader', 'recruiter'])
      if (leaders?.length) {
        await supabase.from('notifications').insert(leaders.map(l => ({
          faction_id: factionId,
          user_id: l.user_id,
          type: 'member',
          title: '👤 New Join Request',
          body: 'Someone wants to join your faction'
        })))
      }
    }
  }

  const hasRequested = (factionId) => myRequests.some(r => r.faction_id === factionId)
  const isInFaction = (factionId) => myFaction?.id === factionId

  const allServers = [...new Set(factions.map(f => f.server_name).filter(Boolean))]
  const officialServers = allServers.filter(s => OFFICIAL_SERVERS.includes(s))
  const moddedServers = allServers.filter(s => !OFFICIAL_SERVERS.includes(s))

  const filteredFactions = factions.filter(f => {
    const matchSearch = !search ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.tag?.toLowerCase().includes(search.toLowerCase()) ||
      f.server_name?.toLowerCase().includes(search.toLowerCase()) ||
      f.leaderProfile?.discord_username?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'recruiting' && f.is_recruiting)
    const matchServer = serverFilter === 'all' ||
      (serverFilter === 'official' && OFFICIAL_SERVERS.includes(f.server_name)) ||
      (serverFilter === 'modded' && !OFFICIAL_SERVERS.includes(f.server_name) && f.server_name)
    return matchSearch && matchFilter && matchServer
  })

  const grouped = {}
  filteredFactions.forEach(f => {
    const key = f.server_name || 'No Server Set'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(f)
  })

  function FactionRow({ f }) {
    const isMe = isInFaction(f.id)
    const requested = hasRequested(f.id)

    return (
      <div style={{ borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'12px', padding:'12px 18px', background: isMe ? '#14532d22' : 'transparent' }}>
        <div style={{ flex:1, minWidth:0, cursor:'pointer' }} onClick={() => navigate(`/faction/${f.id}`)}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
            {f.flag && <span style={{ fontSize:'20px' }}>{f.flag}</span>}
            {f.tag && <span style={{ fontFamily:'Share Tech Mono', color: f.primary_color || 'var(--green)', fontSize:'12px' }}>{f.tag}</span>}
            <span style={{ fontWeight:700, fontSize:'15px', color: f.primary_color || 'var(--text)' }}>{f.name}</span>
            {isMe && <span className="tag tag-green" style={{ fontSize:'10px' }}>Your Faction</span>}
            {f.is_recruiting && <span className="tag tag-green" style={{ fontSize:'10px' }}>🔎 Recruiting</span>}
          </div>
          {/* Leader discord username */}
          {f.leaderProfile && (
            <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'3px' }}>
              {f.leaderProfile.discord_avatar && (
                <img src={f.leaderProfile.discord_avatar} style={{ width:14, height:14, borderRadius:'50%' }} />
              )}
              <span style={{ fontSize:'11px', color:'var(--muted)' }}>
                👑 Led by <strong style={{ color:'var(--text)' }}>{f.leaderProfile.discord_username}</strong>
              </span>
            </div>
          )}
          {f.description && (
            <p style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'400px' }}>
              {f.description}
            </p>
          )}
        </div>

        <div style={{ display:'flex', gap:'12px', alignItems:'center', flexShrink:0, fontSize:'12px', color:'var(--muted)' }}>
          <span style={{ display:'flex', alignItems:'center', gap:'4px' }}><Users size={12} /> {f.memberCount}</span>
          <span style={{ display:'flex', alignItems:'center', gap:'4px' }}><Map size={12} /> {f.territoryCount}</span>
          <span style={{ display:'flex', alignItems:'center', gap:'4px' }}><Sword size={12} /> {f.raidCount}</span>
        </div>

        <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
          <button onClick={() => navigate(`/faction/${f.id}`)} className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px' }}>
            View
          </button>
          {!isMe && f.is_recruiting && !requested && !myFaction && (
            <button onClick={() => sendJoinRequest(f.id)} className="btn btn-green" style={{ fontSize:'12px', padding:'4px 10px' }}>
              Request
            </button>
          )}
          {!isMe && requested && (
            <span style={{ fontSize:'12px', color:'var(--yellow)', padding:'4px 10px' }}>⏳ Pending</span>
          )}
        </div>
      </div>
    )
  }

  function ServerCard({ serverName, facs }) {
    const stats = serverStats[serverName] || {}
    const isOfficial = OFFICIAL_SERVERS.includes(serverName)
    const isExpanded = expandedServer === serverName

    return (
      <div className="card" style={{ overflow:'hidden', borderLeft:`3px solid ${isOfficial ? 'var(--green)' : '#f59e0b'}`, padding:0 }}>
        <div
          onClick={() => setExpandedServer(isExpanded ? null : serverName)}
          style={{ display:'flex', alignItems:'center', gap:'14px', padding:'14px 18px', cursor:'pointer', background: isExpanded ? '#0d1a0d' : 'transparent' }}
        >
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
              <span style={{ fontFamily:'Share Tech Mono', color: isOfficial ? 'var(--green)' : '#f59e0b', fontSize:'16px', fontWeight:700 }}>
                📡 {serverName}
              </span>
              <span style={{ fontSize:'11px', padding:'2px 8px', borderRadius:'999px', border:`1px solid ${isOfficial ? 'var(--green)' : '#f59e0b'}`, color: isOfficial ? 'var(--green)' : '#f59e0b' }}>
                {isOfficial ? 'Official' : 'Community'}
              </span>
              {stats.activeWars > 0 && (
                <span style={{ fontSize:'11px', padding:'2px 8px', borderRadius:'999px', border:'1px solid var(--red)', color:'var(--red)' }}>
                  💀 {stats.activeWars} war{stats.activeWars !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div style={{ display:'flex', gap:'16px', marginTop:'6px', fontSize:'12px', color:'var(--muted)', flexWrap:'wrap' }}>
              <span>🛡️ {facs.length} faction{facs.length !== 1 ? 's' : ''}</span>
              <span>👥 {stats.totalMembers || 0} members</span>
              {stats.recruiting > 0 && <span style={{ color:'var(--green)' }}>✅ {stats.recruiting} recruiting</span>}
            </div>
          </div>
          {isExpanded ? <ChevronUp size={16} color="var(--muted)" /> : <ChevronDown size={16} color="var(--muted)" />}
        </div>

        {isExpanded && (
          <div style={{ borderTop:'1px solid var(--border)' }}>
            {facs.map(f => <FactionRow key={f.id} f={f} />)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth:960, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>SERVER DIRECTORY</h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>
          {factions.length} factions across {allServers.length} servers
        </p>
      </div>

      {/* Search and filters */}
      <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, minWidth:'200px' }}>
          <Search size={14} style={{ position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }} />
          <input
            placeholder="Search factions, servers or leaders..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft:'32px', width:'100%' }}
          />
        </div>
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
          {[
            { value:'all', label:'All' },
            { value:'recruiting', label:'✅ Recruiting' },
          ].map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)} className="btn" style={{ fontSize:'12px', padding:'5px 12px', background: filter===f.value ? 'var(--green-dim)' : 'var(--surface)', color: filter===f.value ? '#fff' : 'var(--muted)', border:'1px solid var(--border)' }}>
              {f.label}
            </button>
          ))}
          <div style={{ width:'1px', background:'var(--border)', margin:'0 2px' }} />
          {[
            { value:'all', label:'All Servers' },
            { value:'official', label:'🏢 Official' },
            { value:'modded', label:'⚡ Community' },
          ].map(f => (
            <button key={f.value} onClick={() => setServerFilter(f.value)} className="btn" style={{ fontSize:'12px', padding:'5px 12px', background: serverFilter===f.value ? '#1a2e1a' : 'var(--surface)', color: serverFilter===f.value ? 'var(--green)' : 'var(--muted)', border:'1px solid var(--border)' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="page-loading"><div className="spinner" /></div>}

      {!loading && Object.keys(grouped).length === 0 && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
          No factions found. Try a different search or filter.
        </div>
      )}

      {/* Official servers */}
      {!loading && officialServers.filter(s => grouped[s]).length > 0 && (serverFilter === 'all' || serverFilter === 'official') && (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'13px', letterSpacing:'0.1em' }}>🏢 OFFICIAL SERVERS</h3>
          {officialServers.filter(s => grouped[s]).map(server => (
            <ServerCard key={server} serverName={server} facs={grouped[server]} />
          ))}
        </div>
      )}

      {/* Community servers */}
      {!loading && moddedServers.filter(s => grouped[s]).length > 0 && (serverFilter === 'all' || serverFilter === 'modded') && (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'#f59e0b', fontSize:'13px', letterSpacing:'0.1em' }}>⚡ COMMUNITY & MODDED SERVERS</h3>
          {moddedServers.filter(s => grouped[s]).map(server => (
            <ServerCard key={server} serverName={server} facs={grouped[server]} />
          ))}
        </div>
      )}

      {/* No server set */}
      {!loading && grouped['No Server Set']?.length > 0 && !search && filter === 'all' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--muted)', fontSize:'13px', letterSpacing:'0.1em' }}>📋 NO SERVER SET</h3>
          <ServerCard serverName="No Server Set" facs={grouped['No Server Set']} />
        </div>
      )}
    </div>
  )
}