import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Users, Map, Sword, Shield } from 'lucide-react'

export default function ServerPage({ session }) {
  const { name } = useParams()
  const navigate = useNavigate()
  const [factions, setFactions] = useState([])
  const [wars, setWars] = useState([])
  const [pacts, setPacts] = useState([])
  const [loading, setLoading] = useState(true)
  const serverName = decodeURIComponent(name)

  useEffect(() => { loadData() }, [name])

  async function loadData() {
    setLoading(true)
    const { data: facs } = await supabase
      .from('factions')
      .select('*, faction_members(count), territories(count)')
      .eq('server_name', serverName)
      .order('name')

    setFactions(facs || [])

    if (facs?.length) {
      const ids = facs.map(f => f.id)
      const { data: diplomacy } = await supabase
        .from('diplomacy')
        .select('*, faction_a_info:factions!diplomacy_faction_a_fkey(name,tag), faction_b_info:factions!diplomacy_faction_b_fkey(name,tag)')
        .in('faction_a', ids)
        .eq('status', 'active')

      setWars(diplomacy?.filter(d => d.type === 'war') || [])
      setPacts(diplomacy?.filter(d => d.type === 'nap') || [])
    }
    setLoading(false)
  }

  if (loading) return (
    <div style={{ padding:'80px', textAlign:'center', color:'var(--green)', fontFamily:'Share Tech Mono' }}>
      LOADING SERVER DATA...
    </div>
  )

  return (
    <div style={{ maxWidth:960, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>📡 {serverName}</h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>{factions.length} factions active on this server</p>
      </div>

      {/* Server stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'12px' }}>
        {[
          { label:'Factions', value:factions.length, color:'var(--green)' },
          { label:'Active Wars', value:wars.length, color:'var(--red)' },
          { label:'Alliances', value:pacts.length, color:'#818cf8' },
          { label:'Recruiting', value:factions.filter(f => f.is_recruiting).length, color:'var(--yellow)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ textAlign:'center', padding:'16px' }}>
            <div style={{ fontFamily:'Share Tech Mono', fontSize:'32px', color, fontWeight:700 }}>{value}</div>
            <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'4px' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Active Wars */}
      {wars.length > 0 && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--red)', fontSize:'14px', letterSpacing:'0.1em' }}>💀 ACTIVE WARS ({wars.length})</h3>
          {wars.map(w => (
            <div key={w.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontWeight:700, color:'var(--red)' }}>{w.faction_a_info?.tag || ''} {w.faction_a_info?.name}</span>
              <span style={{ color:'var(--muted)', fontSize:'12px' }}>⚔️ vs ⚔️</span>
              <span style={{ fontWeight:700, color:'var(--red)' }}>{w.faction_b_info?.tag || ''} {w.faction_b_info?.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Alliances */}
      {pacts.length > 0 && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'#818cf8', fontSize:'14px', letterSpacing:'0.1em' }}>🤝 ACTIVE ALLIANCES ({pacts.length})</h3>
          {pacts.map(p => (
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontWeight:700 }}>{p.faction_a_info?.name}</span>
              <span style={{ color:'#818cf8' }}>🤝</span>
              <span style={{ fontWeight:700 }}>{p.faction_b_info?.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Factions list */}
      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px', letterSpacing:'0.1em' }}>ALL FACTIONS</h3>
        {factions.map(f => (
          <div key={f.id} className="card" onClick={() => navigate(`/faction/${f.id}`)} style={{ display:'flex', alignItems:'center', gap:'16px', cursor:'pointer', padding:'14px 18px' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--green-dim)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                {f.tag && <span style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'13px' }}>{f.tag}</span>}
                <span style={{ fontWeight:700, fontSize:'16px' }}>{f.name}</span>
                {f.is_recruiting && <span className="tag tag-green" style={{ fontSize:'11px' }}>Recruiting</span>}
                {wars.some(w => w.faction_a === f.id || w.faction_b === f.id) && <span className="tag tag-red" style={{ fontSize:'11px' }}>At War</span>}
              </div>
              {f.description && <p style={{ fontSize:'13px', color:'var(--muted)', marginTop:'4px', margin:0 }}>{f.description}</p>}
            </div>
            <div style={{ display:'flex', gap:'16px', fontSize:'13px', color:'var(--muted)' }}>
              <span style={{ display:'flex', alignItems:'center', gap:'4px' }}><Users size={12} /> {f.faction_members?.[0]?.count || 0}</span>
              <span style={{ display:'flex', alignItems:'center', gap:'4px' }}><Map size={12} /> {f.territories?.[0]?.count || 0}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}