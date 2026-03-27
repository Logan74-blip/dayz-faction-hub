import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Trophy, Users, Map, Sword, Shield } from 'lucide-react'

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
  const [myFactionId, setMyFactionId] = useState(null)

  useEffect(() => {
    loadMyFaction()
    loadLeaderboard()
  }, [])

  async function loadMyFaction() {
    const { data } = await supabase.from('faction_members').select('faction_id').eq('user_id', session.user.id).maybeSingle()
    if (data) setMyFactionId(data.faction_id)
  }

  async function loadLeaderboard() {
    setLoading(true)
    const { data: factions } = await supabase.from('factions').select('id, name, tag, server_name')

    if (!factions) { setLoading(false); return }

    const enriched = await Promise.all(factions.map(async f => {
      const [members, territories, raids, pacts] = await Promise.all([
        supabase.from('faction_members').select('id', { count:'exact' }).eq('faction_id', f.id),
        supabase.from('territories').select('id', { count:'exact' }).eq('faction_id', f.id),
        supabase.from('raids').select('id', { count:'exact' }).eq('faction_id', f.id),
        supabase.from('diplomacy').select('id', { count:'exact' }).eq('status', 'active').or(`faction_a.eq.${f.id},faction_b.eq.${f.id}`)
      ])
      return {
        ...f,
        members: members.count || 0,
        territories: territories.count || 0,
        raids: raids.count || 0,
        pacts: pacts.count || 0,
      }
    }))

    setData(enriched)
    setLoading(false)
  }

  const sorted = [...data].sort((a,b) => b[category] - a[category])
  const medals = ['🥇','🥈','🥉']

  return (
    <div style={{ maxWidth:800, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>LEADERBOARD</h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>Top factions ranked across all servers</p>
      </div>

      {/* Category tabs */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setCategory(c.key)} className="btn" style={{
            display:'flex', alignItems:'center', gap:'6px', padding:'7px 16px', fontSize:'13px',
            background: category===c.key ? c.color : 'var(--surface)',
            color: category===c.key ? '#000' : 'var(--muted)',
            border:'1px solid var(--border)', fontWeight: category===c.key ? 700 : 400
          }}>
            <c.icon size={13} /> {c.label}
          </button>
        ))}
      </div>

      {loading && <p style={{ color:'var(--muted)', textAlign:'center', padding:'40px' }}>Loading leaderboard...</p>}

      {!loading && sorted.length === 0 && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
          No factions yet. Be the first on the leaderboard!
        </div>
      )}

      {!loading && sorted.map((f, i) => {
        const isMe = f.id === myFactionId
        const catMeta = CATEGORIES.find(c => c.key === category)
        return (
          <div key={f.id} className="card" style={{
            display:'flex', alignItems:'center', gap:'16px', padding:'16px 20px',
            borderLeft: isMe ? '3px solid var(--green)' : i < 3 ? `3px solid ${catMeta.color}` : '3px solid var(--border)',
            background: isMe ? '#14532d11' : 'var(--surface)'
          }}>
            <span style={{ fontSize:'24px', minWidth:'40px', textAlign:'center' }}>
              {medals[i] || `#${i+1}`}
            </span>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                {f.tag && <span style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'12px' }}>{f.tag}</span>}
                <span style={{ fontWeight:700, fontSize:'16px' }}>{f.name}</span>
                {isMe && <span className="tag tag-green" style={{ fontSize:'11px' }}>You</span>}
              </div>
              {f.server_name && <span style={{ fontSize:'12px', color:'var(--muted)' }}>📡 {f.server_name}</span>}
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily:'Share Tech Mono', fontSize:'28px', color:catMeta.color, fontWeight:700 }}>{f[category]}</div>
              <div style={{ fontSize:'11px', color:'var(--muted)' }}>{catMeta.label}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}