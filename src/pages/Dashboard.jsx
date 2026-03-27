import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Map, Package, Shield, Users, Sword, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function isRecent(date) {
  return new Date(date) > new Date(Date.now() - 24 * 60 * 60 * 1000)
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  return 'recently'
}

export default function Dashboard({ session }) {
  const [faction, setFaction] = useState(null)
  const [factionName, setFactionName] = useState('')
  const [stats, setStats] = useState({ territories:0, resources:0, pacts:0, raids:0, members:0, newMembers:0, wars_won:0, wars_lost:0 })
  const [members, setMembers] = useState([])
  const [history, setHistory] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const navigate = useNavigate()
  const userId = session.user.id

  useEffect(() => { loadFaction() }, [])

  async function loadFaction() {
    const { data } = await supabase
      .from('faction_members')
      .select('*, factions(*)')
      .eq('user_id', userId)
      .maybeSingle()
    if (data?.factions) {
      setFaction(data.factions)
      await Promise.all([
        loadStats(data.factions.id),
        loadMembers(data.factions.id),
        loadHistory(data.factions.id)
      ])
    }
  }

  async function loadStats(fid) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [t, r, p, raids, mems, newMems, warsWon, warsLost] = await Promise.all([
      supabase.from('territories').select('id', { count:'exact', head:true }).eq('faction_id', fid),
      supabase.from('resources').select('id', { count:'exact', head:true }).eq('faction_id', fid),
      supabase.from('diplomacy').select('id', { count:'exact', head:true }).eq('status', 'active').or(`faction_a.eq.${fid},faction_b.eq.${fid}`),
      supabase.from('raids').select('id', { count:'exact', head:true }).eq('faction_id', fid),
      supabase.from('faction_members').select('id', { count:'exact', head:true }).eq('faction_id', fid),
      supabase.from('faction_members').select('id', { count:'exact', head:true }).eq('faction_id', fid).gte('joined_at', weekAgo),
      supabase.from('diplomacy').select('id', { count:'exact', head:true }).eq('faction_b', fid).eq('type', 'war').eq('status', 'expired'),
      supabase.from('diplomacy').select('id', { count:'exact', head:true }).eq('faction_a', fid).eq('type', 'war').eq('status', 'expired'),
    ])
    setStats({
      territories: t.count || 0,
      resources: r.count || 0,
      pacts: p.count || 0,
      raids: raids.count || 0,
      members: mems.count || 0,
      newMembers: newMems.count || 0,
      wars_won: warsWon.count || 0,
      wars_lost: warsLost.count || 0
    })
  }

  async function loadMembers(fid) {
    const { data } = await supabase
      .from('faction_members')
      .select('*, profile:profiles(discord_username, discord_avatar), activity:member_activity(last_seen)')
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
    }
  }

  if (!faction) return (
    <div style={{ maxWidth:480, margin:'80px auto', padding:'0 24px' }}>
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'16px', textAlign:'center' }}>
        <h2 style={{ fontSize:'22px', fontWeight:700 }}>You're not in a faction yet</h2>
        <p style={{ color:'var(--muted)' }}>Create a new faction to get started</p>
        <input
          placeholder="Faction name..."
          value={factionName}
          onChange={e => setFactionName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createFaction()}
        />
        <button className="btn btn-green" onClick={createFaction}>Create Faction</button>
        <p style={{ color:'var(--muted)', fontSize:'13px' }}>
          Already in a faction? Ask your leader for an invite link.
        </p>
      </div>
    </div>
  )

  const joins = history.filter(h => h.action === 'joined').length
  const leaves = history.filter(h => h.action === 'left').length
  const turnoverRate = joins > 0 ? Math.round((leaves / joins) * 100) : 0

  const statCards = [
    { label:'Territories', value:stats.territories, icon:Map, color:'var(--green)', path:'/map' },
    { label:'Resources', value:stats.resources, icon:Package, color:'var(--yellow)', path:'/resources' },
    { label:'Active Pacts', value:stats.pacts, icon:Shield, color:'#818cf8', path:'/diplomacy' },
    { label:'Raids', value:stats.raids, icon:Sword, color:'var(--red)', path:'/raids' },
    { label:'Members', value:stats.members, icon:Users, color:'var(--green)', path:'/settings' },
    { label:'New This Week', value:stats.newMembers, icon:TrendingUp, color:'var(--yellow)', path:'/settings' },
  ]

  return (
    <div style={{ maxWidth:960, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'26px', color:'var(--green)' }}>
            {faction.flag ? <span style={{ marginRight:'10px' }}>{faction.flag}</span> : null}
            {faction.name}
          </h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>
            Faction Command Center
            {faction.server_name && (
              <span style={{ marginLeft:'10px', color:'var(--green)', fontSize:'13px' }}>
                📡 {faction.server_name}
              </span>
            )}
          </p>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
          {faction.tag && <span className="tag tag-green" style={{ fontSize:'14px' }}>{faction.tag}</span>}
          {faction.is_recruiting
            ? <span className="tag tag-green">✅ Recruiting</span>
            : <span className="tag tag-red">🚫 Full</span>
          }
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'4px', borderBottom:'1px solid var(--border)' }}>
        {['overview', 'members', 'turnover'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            background:'transparent', border:'none', padding:'8px 16px', cursor:'pointer',
            fontSize:'13px', fontWeight:600, fontFamily:'Rajdhani',
            color: activeTab===tab ? 'var(--green)' : 'var(--muted)',
            borderBottom: activeTab===tab ? '2px solid var(--green)' : '2px solid transparent',
            textTransform:'capitalize'
          }}>
            {tab === 'turnover' ? '📊 Turnover' : tab === 'members' ? '👥 Members' : '🏠 Overview'}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'14px' }}>
            {statCards.map(({ label, value, icon: Icon, color, path }) => (
              <div key={label} className="card" style={{ cursor:'pointer', display:'flex', gap:'14px', alignItems:'center' }} onClick={() => navigate(path)}>
                <div style={{ background:`${color}22`, borderRadius:'8px', padding:'10px', display:'flex' }}>
                  <Icon size={20} color={color} />
                </div>
                <div>
                  <div style={{ fontSize:'26px', fontWeight:700, fontFamily:'Share Tech Mono', color }}>{value}</div>
                  <div style={{ fontSize:'12px', color:'var(--muted)' }}>{label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 style={{ fontWeight:700, fontSize:'15px', marginBottom:'14px' }}>💀 War Status</h3>
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
        </>
      )}

      {/* Members */}
      {activeTab === 'members' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {members.length === 0 && (
            <p style={{ color:'var(--muted)', textAlign:'center', padding:'32px' }}>No members yet.</p>
          )}
          {members.map(m => (
            <div key={m.id} className="card" style={{ display:'flex', alignItems:'center', gap:'14px', padding:'12px 18px' }}>
              {m.profile?.discord_avatar
                ? <img src={m.profile.discord_avatar} style={{ width:36, height:36, borderRadius:'50%', border:'2px solid var(--border)' }} />
                : <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px' }}>👤</div>
              }
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:'15px' }}>
                  {m.profile?.discord_username || 'Member'}
                </div>
                <div style={{ fontSize:'12px', color:'var(--muted)' }}>
                  Joined {new Date(m.joined_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <span className={`tag ${m.role === 'leader' || m.role === 'co-leader' ? 'tag-green' : 'tag-yellow'}`}>
                  {m.role}
                </span>
                {m.activity?.[0]?.last_seen && (
                  <div style={{ fontSize:'11px', color: isRecent(m.activity[0].last_seen) ? 'var(--green)' : 'var(--muted)', marginTop:'4px' }}>
                    {isRecent(m.activity[0].last_seen) ? '🟢 Active' : `Last seen ${timeAgo(m.activity[0].last_seen)}`}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Turnover */}
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
            <h3 style={{ fontWeight:700, fontSize:'15px', marginBottom:'12px' }}>Recent Activity</h3>
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
            <p style={{ fontSize:'13px', color:'var(--muted)' }}>
              💡 <strong style={{ color:'var(--text)' }}>Turnover rate</strong> measures how many members leave relative to joins. Under 25% is healthy. Over 50% suggests retention issues.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}