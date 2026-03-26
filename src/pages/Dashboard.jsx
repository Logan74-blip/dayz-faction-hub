import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Map, Package, Shield, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function Dashboard({ session }) {
  const [faction, setFaction] = useState(null)
  const [factionName, setFactionName] = useState('')
  const [stats, setStats] = useState({ territories: 0, resources: 0, pacts: 0 })
  const navigate = useNavigate()
  const userId = session.user.id

  useEffect(() => {
    loadFaction()
  }, [])

  async function loadFaction() {
    const { data } = await supabase.from('faction_members').select('*, factions(*)').eq('user_id', userId).maybeSingle()
    if (data?.factions) {
      setFaction(data.factions)
      const [t, r, p] = await Promise.all([
        supabase.from('territories').select('id', { count:'exact' }).eq('faction_id', data.factions.id),
        supabase.from('resources').select('id', { count:'exact' }).eq('faction_id', data.factions.id),
        supabase.from('diplomacy').select('id', { count:'exact' }).eq('status', 'active').or(`faction_a.eq.${data.factions.id},faction_b.eq.${data.factions.id}`)
      ])
      setStats({ territories: t.count || 0, resources: r.count || 0, pacts: p.count || 0 })
    }
  }

  async function createFaction() {
    if (!factionName.trim()) return
    const { data, error } = await supabase.from('factions').insert({ name: factionName.trim(), created_by: userId }).select().single()
    if (!error) {
      await supabase.from('faction_members').insert({ faction_id: data.id, user_id: userId, role: 'leader' })
      setFaction(data)
    }
  }

  if (!faction) return (
    <div style={{ maxWidth:480, margin:'80px auto', padding:'0 24px' }}>
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'16px', textAlign:'center' }}>
        <h2 style={{ fontSize:'22px', fontWeight:700 }}>You're not in a faction yet</h2>
        <p style={{ color:'var(--muted)' }}>Create a new faction to get started</p>
        <input placeholder="Faction name..." value={factionName} onChange={e => setFactionName(e.target.value)} onKeyDown={e => e.key==='Enter' && createFaction()} />
        <button className="btn btn-green" onClick={createFaction}>Create Faction</button>
      </div>
    </div>
  )

  const cards = [
    { label:'Territories Claimed', value:stats.territories, icon:Map, color:'var(--green)', path:'/map' },
    { label:'Resource Entries', value:stats.resources, icon:Package, color:'var(--yellow)', path:'/resources' },
    { label:'Active Pacts', value:stats.pacts, icon:Shield, color:'#818cf8', path:'/diplomacy' },
  ]

  return (
    <div style={{ maxWidth:900, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'28px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'26px', color:'var(--green)' }}>{faction.name}</h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>Faction Command Center</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'16px' }}>
        {cards.map(({ label, value, icon: Icon, color, path }) => (
          <div key={label} className="card" style={{ cursor:'pointer', borderColor:'var(--border)', display:'flex', gap:'16px', alignItems:'center' }} onClick={() => navigate(path)}>
            <div style={{ background:`${color}22`, borderRadius:'8px', padding:'12px', display:'flex' }}>
              <Icon size={22} color={color} />
            </div>
            <div>
              <div style={{ fontSize:'28px', fontWeight:700, fontFamily:'Share Tech Mono', color }}>{value}</div>
              <div style={{ fontSize:'13px', color:'var(--muted)' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
          <Users size={18} color="var(--green)" />
          <h3 style={{ fontSize:'17px', fontWeight:700 }}>Your Faction</h3>
        </div>
        <div style={{ display:'flex', gap:'12px', flexWrap:'wrap' }}>
          <span className="tag tag-green">Leader</span>
          <span style={{ color:'var(--muted)', fontSize:'14px' }}>Faction ID: {faction.id.slice(0,8)}...</span>
        </div>
      </div>
    </div>
  )
}