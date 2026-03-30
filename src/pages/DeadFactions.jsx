import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { Users, AlertTriangle } from 'lucide-react'

export default function DeadFactions() {
  const [factions, setFactions] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { loadDeadFactions() }, [])

  async function loadDeadFactions() {
    setLoading(true)
    // Get all factions
    const { data: allFactions } = await supabase
      .from('factions')
      .select('*, faction_customization(primary_color)')
      .order('name')

    if (!allFactions?.length) { setLoading(false); return }

    // Get member counts
    const ids = allFactions.map(f => f.id)
    const { data: members } = await supabase
      .from('faction_members')
      .select('faction_id')
      .in('faction_id', ids)

    // Filter factions with 0 members
    const memberCounts = {}
    members?.forEach(m => {
      memberCounts[m.faction_id] = (memberCounts[m.faction_id] || 0) + 1
    })

    const dead = allFactions
      .filter(f => !memberCounts[f.id])
      .map(f => ({
        ...f,
        primary_color: f.faction_customization?.[0]?.primary_color || f.primary_color || 'var(--muted)'
      }))

    setFactions(dead)
    setLoading(false)
  }

  return (
    <div style={{ maxWidth:800, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--red)' }}>
          💀 DEAD FACTIONS
        </h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>
          Factions with no remaining members — their logs are preserved forever
        </p>
      </div>

      {loading && <div className="page-loading"><div className="spinner" /></div>}

      {!loading && factions.length === 0 && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'60px 24px', display:'flex', flexDirection:'column', alignItems:'center', gap:'12px' }}>
          <Users size={40} color="var(--border)" />
          <p style={{ fontSize:'15px' }}>No dead factions yet.</p>
          <p style={{ fontSize:'13px' }}>When all members leave a faction it will appear here.</p>
        </div>
      )}

      {!loading && factions.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <p style={{ fontSize:'13px', color:'var(--muted)' }}>
            {factions.length} dead faction{factions.length !== 1 ? 's' : ''} — click to view their archived profile
          </p>
          {factions.map(f => (
            <div
              key={f.id}
              className="card"
              onClick={() => navigate(`/faction/${f.id}`)}
              style={{ display:'flex', alignItems:'center', gap:'16px', cursor:'pointer', borderLeft:`3px solid ${f.primary_color}`, opacity:0.75, transition:'opacity 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.75'}
            >
              <span style={{ fontSize:'32px', flexShrink:0 }}>{f.flag || '💀'}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                  {f.tag && <span style={{ fontFamily:'Share Tech Mono', color:f.primary_color, fontSize:'12px' }}>{f.tag}</span>}
                  <span style={{ fontWeight:700, fontSize:'15px', color:f.primary_color }}>{f.name}</span>
                  <span style={{ background:'#450a0a', color:'var(--red)', padding:'2px 8px', borderRadius:'999px', fontSize:'11px', fontWeight:700 }}>
                    💀 Disbanded
                  </span>
                </div>
                {f.server_name && <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'3px' }}>📡 {f.server_name}</div>}
                {f.description && <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.description}</div>}
                <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'4px' }}>
                  Created {new Date(f.created_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}
                </div>
              </div>
              <AlertTriangle size={20} color="var(--red)" style={{ flexShrink:0, opacity:0.5 }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}