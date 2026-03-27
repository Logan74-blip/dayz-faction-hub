import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'

const MAPS = [
  {
    id: 'chernarus',
    name: 'Chernarus',
    image: '/chernarus.jpg',
    fallback: null,
    width: 15360,
    height: 15360,
  },
  {
    id: 'livonia',
    name: 'Livonia',
    image: '/livonia.jpg',
    fallback: null,
    width: 8192,
    height: 8192,
  },
  {
    id: 'sakhal',
    name: 'Sakhal',
    image: null,
    fallback: null,
    width: 8192,
    height: 8192,
  },
]

const MARKER_TYPES = [
  { value: 'base', label: '🟢 Base', color: '#4ade80', bg: '#14532d' },
  { value: 'contested', label: '🔴 Contested', color: '#f87171', bg: '#7f1d1d' },
  { value: 'supply', label: '🟡 Supply Cache', color: '#fbbf24', bg: '#78350f' },
  { value: 'outpost', label: '🔵 Outpost', color: '#60a5fa', bg: '#1e3a5f' },
  { value: 'danger', label: '💀 Danger Zone', color: '#e879f9', bg: '#4a044e' },
]

function getMarkerMeta(type) {
  return MARKER_TYPES.find(m => m.value === type) || MARKER_TYPES[0]
}

export default function WarMap({ session }) {
  const [faction, setFaction] = useState(null)
  const [markers, setMarkers] = useState([])
  const [selectedMap, setSelectedMap] = useState(MAPS[0])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [pending, setPending] = useState(null)
  const [form, setForm] = useState({ label: '', type: 'base', notes: '' })
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const userId = session.user.id

  useEffect(() => { loadFaction() }, [])
useEffect(() => { 
  setMapLoaded(false)
  setMapError(false)
  console.log('Map image path:', selectedMap.image)
}, [selectedMap])

  async function loadFaction() {
    const { data } = await supabase.from('faction_members').select('*, factions(*)').eq('user_id', userId).maybeSingle()
    if (data?.factions) { setFaction(data.factions); loadMarkers(data.factions.id) }
  }

  async function loadMarkers(fid) {
    const { data } = await supabase.from('territories').select('*').eq('faction_id', fid)
    setMarkers(data || [])
  }

  function handleMapClick(e) {
  if (!faction) {
    alert('You need to be in a faction to place markers.')
    return
  }
  if (!mapRef.current) return
  const rect = mapRef.current.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * 100
  const y = ((e.clientY - rect.top) / rect.height) * 100
  if (x < 0 || x > 100 || y < 0 || y > 100) return
  setPending({ x, y })
  setForm({ label:'', type:'base', notes:'' })
}

  async function saveMarker() {
  if (!form.label.trim() || !faction) return
  const { data, error } = await supabase.from('territories').insert({
    faction_id: faction.id,
    label: form.label,
    type: form.type,
    notes: form.notes,
    lat: pending.y,
    lng: pending.x,
    map_id: selectedMap.id,
    created_by: userId
  }).select().single()

  if (!error) {
    setMarkers(m => [...m, data])
    setPending(null)
    setForm({ label: '', type: 'base', notes: '' })
    // Log to event feed
    await supabase.from('events').insert({
      faction_id: faction.id,
      created_by: userId,
      type: 'territory',
      title: `Territory Claimed: ${form.label}`,
      description: `Type: ${form.type} on ${selectedMap.name}`
    })
  } else {
    console.error('Failed to save marker:', error)
    alert('Failed to save marker. Make sure you are in a faction.')
  }
}

  async function deleteMarker(id, e) {
    e.stopPropagation()
    await supabase.from('territories').delete().eq('id', id)
    setMarkers(m => m.filter(x => x.id !== id))
    setTooltip(null)
  }

  function onWheel(e) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale(s => Math.min(Math.max(s * delta, 0.5), 5))
  }

  function onMouseDown(e) {
    if (e.button !== 0) return
    setDragging(false)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y, moved: false })
  }

  function onMouseMove(e) {
    if (!dragStart) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    setOffset({ x: dx, y: dy })
    setDragging(true)
  }

  function onMouseUp(e) {
  if (!dragStart) return
  const moved = Math.abs(e.clientX - (dragStart.x + offset.x)) > 5 || Math.abs(e.clientY - (dragStart.y + offset.y)) > 5
  if (!moved) handleMapClick(e)
  setDragStart(null)
  setTimeout(() => setDragging(false), 50)
}

  const filteredMarkers = markers.filter(m => (m.map_id || 'chernarus') === selectedMap.id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', background: 'var(--bg)' }}>

      {/* Toolbar */}
      <div style={{
        padding: '10px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', display: 'flex', alignItems: 'center',
        gap: '16px', flexWrap: 'wrap'
      }}>
        <span style={{ fontFamily: 'Share Tech Mono', color: 'var(--green)', fontSize: '18px', letterSpacing: '0.1em' }}>
          ☢ WAR MAP
        </span>

        {/* Map selector */}
        <select
          value={selectedMap.id}
          onChange={e => setSelectedMap(MAPS.find(m => m.id === e.target.value))}
          style={{ background: '#1a2a1a', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 12px', borderRadius: '4px', fontFamily: 'Share Tech Mono', fontSize: '13px', width: 'auto' }}
        >
          {MAPS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {MARKER_TYPES.map(t => (
            <span key={t.value} style={{ fontSize: '12px', color: t.color, fontWeight: 600 }}>{t.label}</span>
          ))}
        </div>

        {/* Zoom controls */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={() => setScale(s => Math.min(s * 1.2, 5))} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '16px' }}>+</button>
          <span style={{ color: 'var(--muted)', fontSize: '12px', minWidth: '40px', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.max(s * 0.8, 0.5))} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '16px' }}>−</button>
          <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }) }} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '12px' }}>Reset</button>
        </div>

        {!faction && <span style={{ color: 'var(--red)', fontSize: '13px' }}>Join a faction to place markers</span>}
        {faction && !dragging && <span style={{ color: 'var(--muted)', fontSize: '12px' }}>Click map to place marker • Scroll to zoom • Drag to pan</span>}
      </div>

      {/* Map container */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflow: 'hidden', position: 'relative', cursor: dragging ? 'grabbing' : 'crosshair' }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => setDragStart(null)}
      >
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: dragging ? 'none' : 'transform 0.1s ease',
        }}>
          <div ref={mapRef} style={{ position: 'relative', display: 'inline-block' }}>

            {/* Map image */}
            {!mapError && selectedMap.image ? (
              <img
                src={selectedMap.image}
                onLoad={() => setMapLoaded(true)}
                onError={() => setMapError(true)}
                style={{
                  display: 'block',
                  width: '800px',
                  height: '800px',
                  objectFit: 'cover',
                  opacity: mapLoaded ? 1 : 0,
                  transition: 'opacity 0.3s',
                  userSelect: 'none',
                  pointerEvents: 'none',
                  border: '2px solid var(--border)',
                }}
                draggable={false}
              />
            ) : (
              <div style={{
                width: '800px', height: '800px',
                background: 'radial-gradient(ellipse at 30% 40%, #1a2e1a 0%, #0d1a0d 40%, #080e08 100%)',
                border: '2px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '12px'
              }}>
                <span style={{ fontFamily: 'Share Tech Mono', color: 'var(--green)', fontSize: '24px' }}>☢</span>
                <span style={{ fontFamily: 'Share Tech Mono', color: 'var(--green)', fontSize: '16px' }}>{selectedMap.name.toUpperCase()}</span>
                <span style={{ color: 'var(--muted)', fontSize: '12px' }}>Click anywhere to place markers</span>
              </div>
            )}

            {/* Loading overlay */}
            {selectedMap.image && !mapLoaded && !mapError && (
              <div style={{
                position: 'absolute', inset: 0, background: '#0a0c0a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '12px'
              }}>
                <span style={{ fontFamily: 'Share Tech Mono', color: 'var(--green)', fontSize: '14px' }}>LOADING {selectedMap.name.toUpperCase()} MAP...</span>
                <div style={{ width: '120px', height: '2px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--green)', animation: 'load 1.5s infinite', width: '40%' }} />
                </div>
              </div>
            )}

            {/* Pending marker */}
            {pending && (
              <div style={{
                position: 'absolute',
                left: `${pending.x}%`, top: `${pending.y}%`,
                transform: 'translate(-50%, -50%)',
                width: '16px', height: '16px', borderRadius: '50%',
                background: 'white', border: '3px solid var(--green)',
                boxShadow: '0 0 10px var(--green)',
                animation: 'pulse 1s infinite',
                zIndex: 20, pointerEvents: 'none'
              }} />
            )}

            {/* Markers */}
            {filteredMarkers.map(m => {
              const meta = getMarkerMeta(m.type)
              return (
                <div
                  key={m.id}
                  style={{
                    position: 'absolute',
                    left: `${m.lng}%`, top: `${m.lat}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10, cursor: 'pointer',
                  }}
                  onClick={e => { e.stopPropagation(); setTooltip(tooltip?.id === m.id ? null : m) }}
                >
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '50%',
                    background: meta.color, border: `2px solid ${meta.bg}`,
                    boxShadow: `0 0 6px ${meta.color}88`,
                    transition: 'transform 0.15s',
                  }} />

                  {/* Tooltip */}
                  {tooltip?.id === m.id && (
                    <div style={{
                      position: 'absolute', bottom: '20px', left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#0d1a0d', border: `1px solid ${meta.color}`,
                      borderRadius: '6px', padding: '10px 14px',
                      minWidth: '160px', zIndex: 30,
                      boxShadow: `0 4px 20px ${meta.color}44`
                    }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: meta.color }}>{m.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{meta.label}</div>
                      {m.notes && <div style={{ fontSize: '12px', color: 'var(--text)', marginTop: '6px', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>{m.notes}</div>}
                      <button
                        onClick={e => deleteMarker(m.id, e)}
                        style={{ marginTop: '8px', background: '#7f1d1d', color: '#fca5a5', border: 'none', padding: '3px 10px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', width: '100%' }}
                      >
                        Remove Marker
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Marker count badge */}
        <div style={{
          position: 'absolute', bottom: '16px', left: '16px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '6px', padding: '8px 14px', fontSize: '13px',
          color: 'var(--muted)', fontFamily: 'Share Tech Mono'
        }}>
          {filteredMarkers.length} MARKERS ON {selectedMap.name.toUpperCase()}
        </div>
      </div>

      {/* Add marker panel */}
      {pending && (
        <div style={{
          position: 'fixed', top: '80px', right: '20px', zIndex: 1000,
          width: '280px'
        }} className="card">
          <h4 style={{ marginBottom: '14px', fontFamily: 'Share Tech Mono', color: 'var(--green)', fontSize: '14px' }}>
            📍 PLACE MARKER
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              placeholder="Label (e.g. North Airfield Base)"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && saveMarker()}
              autoFocus
            />
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {MARKER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <textarea
              placeholder="Notes (optional)..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-green" style={{ flex: 1 }} onClick={saveMarker}>Save</button>
              <button className="btn btn-ghost" onClick={() => setPending(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes load { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }
      `}</style>
    </div>
  )
}