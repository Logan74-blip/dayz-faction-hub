import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'

export default function AllianceNetwork({ session }) {
  const { faction: myFaction } = useRole(session.user.id)
  const [factions, setFactions] = useState([])
  const [diplomacy, setDiplomacy] = useState([])
  const [loading, setLoading] = useState(true)
  const canvasRef = useRef(null)

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (factions.length && canvasRef.current) drawNetwork() }, [factions, diplomacy, myFaction])

  async function loadData() {
    setLoading(true)
    const [facs, diplo] = await Promise.all([
      supabase.from('factions').select('id, name, tag, server_name'),
      supabase.from('diplomacy').select('*').eq('status', 'active').in('type', ['nap', 'war', 'trade'])
    ])
    setFactions(facs.data || [])
    setDiplomacy(diplo.data || [])
    setLoading(false)
  }

  function drawNetwork() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const factionMap = {}
    const positions = {}

    // Position factions in a circle
    factions.forEach((f, i) => {
      const angle = (i / factions.length) * Math.PI * 2 - Math.PI / 2
      const radius = Math.min(W, H) * 0.35
      positions[f.id] = {
        x: W / 2 + Math.cos(angle) * radius,
        y: H / 2 + Math.sin(angle) * radius
      }
      factionMap[f.id] = f
    })

    // Draw connections
    diplomacy.forEach(d => {
      const a = positions[d.faction_a]
      const b = positions[d.faction_b]
      if (!a || !b) return
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = d.type === 'nap' ? '#818cf888' : d.type === 'war' ? '#f8717188' : '#fbbf2488'
      ctx.lineWidth = d.type === 'war' ? 2 : 1.5
      ctx.setLineDash(d.type === 'war' ? [6, 3] : [])
      ctx.stroke()
      ctx.setLineDash([])
    })

    // Draw nodes
    factions.forEach(f => {
      const pos = positions[f.id]
      const isMe = f.id === myFaction?.id
      const radius = isMe ? 28 : 22

      // Node circle
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
      ctx.fillStyle = isMe ? '#14532d' : '#111812'
      ctx.fill()
      ctx.strokeStyle = isMe ? '#4ade80' : '#1f2e1f'
      ctx.lineWidth = isMe ? 2.5 : 1.5
      ctx.stroke()

      // Label
      ctx.fillStyle = isMe ? '#4ade80' : '#d1fae5'
      ctx.font = `${isMe ? 'bold ' : ''}${isMe ? 11 : 10}px Share Tech Mono`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const label = f.tag || f.name.slice(0, 6)
      ctx.fillText(label, pos.x, pos.y)
    })
  }

  const napCount = diplomacy.filter(d => d.type === 'nap').length
  const warCount = diplomacy.filter(d => d.type === 'war').length
  const tradeCount = diplomacy.filter(d => d.type === 'trade').length

  return (
    <div style={{ maxWidth:900, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>ALLIANCE NETWORK</h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>Visual map of all faction relationships</p>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:'20px', flexWrap:'wrap' }}>
        <span style={{ fontSize:'13px', color:'#818cf8', display:'flex', alignItems:'center', gap:'6px' }}>
          <span style={{ display:'inline-block', width:'24px', height:'2px', background:'#818cf8', borderRadius:'2px' }} /> NAP ({napCount})
        </span>
        <span style={{ fontSize:'13px', color:'var(--red)', display:'flex', alignItems:'center', gap:'6px' }}>
          <span style={{ display:'inline-block', width:'24px', height:'2px', background:'var(--red)', borderRadius:'2px', borderTop:'2px dashed var(--red)' }} /> War ({warCount})
        </span>
        <span style={{ fontSize:'13px', color:'var(--yellow)', display:'flex', alignItems:'center', gap:'6px' }}>
          <span style={{ display:'inline-block', width:'24px', height:'2px', background:'var(--yellow)', borderRadius:'2px' }} /> Trade ({tradeCount})
        </span>
        <span style={{ fontSize:'13px', color:'var(--green)', display:'flex', alignItems:'center', gap:'6px' }}>
          <span style={{ display:'inline-block', width:'12px', height:'12px', background:'#14532d', border:'2px solid #4ade80', borderRadius:'50%' }} /> Your Faction
        </span>
      </div>

      {loading && <p style={{ color:'var(--muted)', textAlign:'center', padding:'40px' }}>Loading network...</p>}

      {!loading && (
        <div className="card" style={{ padding:'8px', display:'flex', justifyContent:'center' }}>
          <canvas
            ref={canvasRef}
            width={800}
            height={500}
            style={{ maxWidth:'100%', borderRadius:'4px', background:'#0a0c0a' }}
          />
        </div>
      )}

      {/* Text list of relationships */}
      {diplomacy.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
          {[
            { type:'nap', label:'🤝 Non-Aggression Pacts', color:'#818cf8', items: diplomacy.filter(d => d.type === 'nap') },
            { type:'war', label:'💀 Active Wars', color:'var(--red)', items: diplomacy.filter(d => d.type === 'war') },
            { type:'trade', label:'🛒 Trade Agreements', color:'var(--yellow)', items: diplomacy.filter(d => d.type === 'trade') },
          ].map(({ label, color, items }) => (
            <div key={label} className="card" style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              <h3 style={{ fontSize:'13px', fontWeight:700, color }}>{label} ({items.length})</h3>
              {items.length === 0 && <p style={{ fontSize:'12px', color:'var(--muted)' }}>None</p>}
              {items.map(d => {
                const a = factions.find(f => f.id === d.faction_a)
                const b = factions.find(f => f.id === d.faction_b)
                return (
                  <div key={d.id} style={{ fontSize:'12px', color:'var(--muted)', padding:'4px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ color:'var(--text)' }}>{a?.tag || a?.name?.slice(0,8)}</span>
                    <span style={{ margin:'0 4px', color }}>↔</span>
                    <span style={{ color:'var(--text)' }}>{b?.tag || b?.name?.slice(0,8)}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}