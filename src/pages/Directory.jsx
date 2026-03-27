import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Search, Users, Server, ChevronDown, ChevronUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function Directory({ session }) {
  const [factions, setFactions] = useState([])
  const [grouped, setGrouped] = useState({})
  const [search, setSearch] = useState('')
  const [expandedServers, setExpandedServers] = useState({})
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { loadFactions() }, [])

  async function loadFactions() {
    const { data } = await supabase
      .from('factions')
      .select('*, faction_members(count)')
      .order('name')
    setFactions(data || [])
    groupByServer(data || [])
    setLoading(false)
  }

  function groupByServer(data) {
    const groups = {}
    data.forEach(f => {
      const server = f.server_name?.trim() || 'Unknown Server'
      if (!groups[server]) groups[server] = []
      groups[server].push(f)
    })
    Object.keys(groups).forEach(s => groups[s].sort((a,b) => a.name.localeCompare(b.name)))
    setGrouped(groups)
    const expanded = {}
    Object.keys(groups).forEach(s => expanded[s] = true)
    setExpandedServers(expanded)
  }

  function toggleServer(server) {
    setExpandedServers(e => ({...e, [server]: !e[server]}))
  }

  const filtered = search.trim()
    ? factions.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.server_name?.toLowerCase().includes(search.toLowerCase()) ||
        f.tag?.toLowerCase().includes(search.toLowerCase())
      )
    : null

  const sortedServers = Object.keys(grouped).sort((a,b) => {
    if (a === 'Unknown Server') return 1
    if (b === 'Unknown Server') return -1
    return a.localeCompare(b)
  })

  return (
    <div style={{ maxWidth:900, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>FACTION DIRECTORY</h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>All factions grouped by server</p>
      </div>

      <div style={{ position:'relative' }}>
        <Search size={16} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }} />
        <input
          placeholder="Search factions, servers, tags..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft:'36px' }}
        />
      </div>

      {loading && <p style={{ color:'var(--muted)', textAlign:'center' }}>Loading factions...</p>}

      {filtered && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <p style={{ color:'var(--muted)', fontSize:'13px' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
          {filtered.map(f => <FactionCard key={f.id} faction={f} navigate={navigate} />)}
          {filtered.length === 0 && <p style={{ color:'var(--muted)', textAlign:'center', padding:'32px' }}>No factions found matching "{search}"</p>}
        </div>
      )}

      {!filtered && sortedServers.map(server => (
        <div key={server}>
          <button
            onClick={() => toggleServer(server)}
            style={{
              width:'100%', background:'var(--surface)', border:'1px solid var(--border)',
              borderRadius:'6px', padding:'12px 16px', display:'flex', alignItems:'center',
              justifyContent:'space-between', cursor:'pointer', marginBottom: expandedServers[server] ? '8px' : '0'
            }}
          >
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <Server size={15} color="var(--green)" />
              <span style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px' }}>{server}</span>
              <span style={{ background:'#14532d', color:'var(--green)', padding:'2px 8px', borderRadius:'999px', fontSize:'12px' }}>
                {grouped[server].length} faction{grouped[server].length !== 1 ? 's' : ''}
              </span>
            </div>
            {expandedServers[server] ? <ChevronUp size={16} color="var(--muted)" /> : <ChevronDown size={16} color="var(--muted)" />}
          </button>

          {expandedServers[server] && (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {grouped[server].map(f => <FactionCard key={f.id} faction={f} navigate={navigate} />)}
            </div>
          )}
        </div>
      ))}

      {!loading && factions.length === 0 && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
          No factions yet. Be the first to set your server in Settings!
        </div>
      )}
    </div>
  )
}

function FactionCard({ faction, navigate }) {
  const memberCount = faction.faction_members?.[0]?.count || 0
  return (
    <div
      className="card"
      onClick={() => navigate(`/faction/${faction.id}`)}
      style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', cursor:'pointer', transition:'border-color 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--green-dim)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {faction.tag && <span style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'13px' }}>{faction.tag}</span>}
          <span style={{ fontWeight:700, fontSize:'16px' }}>{faction.name}</span>
          {faction.is_recruiting && <span className="tag tag-green" style={{ fontSize:'11px' }}>Recruiting</span>}
        </div>
        {faction.description && <p style={{ fontSize:'13px', color:'var(--muted)', margin:0 }}>{faction.description}</p>}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'6px', color:'var(--muted)', fontSize:'13px', whiteSpace:'nowrap' }}>
        <Users size={13} />
        {memberCount} member{memberCount !== 1 ? 's' : ''}
      </div>
    </div>
  )
}