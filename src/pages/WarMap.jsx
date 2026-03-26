import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import { supabase } from '../supabaseClient'
import L from 'leaflet'

const icons = {
  base:      L.divIcon({ className:'', html:'<div style="background:#16a34a;width:14px;height:14px;border-radius:50%;border:2px solid #4ade80"></div>' }),
  contested: L.divIcon({ className:'', html:'<div style="background:#b91c1c;width:14px;height:14px;border-radius:50%;border:2px solid #f87171"></div>' }),
  supply:    L.divIcon({ className:'', html:'<div style="background:#d97706;width:14px;height:14px;border-radius:50%;border:2px solid #fbbf24"></div>' }),
}

function ClickHandler({ onMapClick }) {
  useMapEvents({ click: e => onMapClick(e.latlng) })
  return null
}

export default function WarMap({ session }) {
  const [markers, setMarkers] = useState([])
  const [faction, setFaction] = useState(null)
  const [pending, setPending] = useState(null)
  const [form, setForm] = useState({ label:'', type:'base', notes:'' })
  const userId = session.user.id

  useEffect(() => {
    loadFaction()
  }, [])

  async function loadFaction() {
    const { data } = await supabase.from('faction_members').select('*, factions(*)').eq('user_id', userId).maybeSingle()
    if (data?.factions) {
      setFaction(data.factions)
      loadMarkers(data.factions.id)
    }
  }

  async function loadMarkers(fid) {
    const { data } = await supabase.from('territories').select('*').eq('faction_id', fid)
    setMarkers(data || [])
  }

  function handleMapClick(latlng) {
    if (!faction) return
    setPending(latlng)
    setForm({ label:'', type:'base', notes:'' })
  }

  async function saveMarker() {
    if (!form.label.trim()) return
    const { data, error } = await supabase.from('territories').insert({
      faction_id: faction.id,
      label: form.label,
      type: form.type,
      notes: form.notes,
      lat: pending.lat,
      lng: pending.lng,
      created_by: userId
    }).select().single()
    if (!error) {
      setMarkers(m => [...m, data])
      setPending(null)
    }
  }

  async function deleteMarker(id) {
    await supabase.from('territories').delete().eq('id', id)
    setMarkers(m => m.filter(x => x.id !== id))
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 56px)' }}>
      <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'16px', background:'var(--surface)' }}>
        <h2 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'20px' }}>WAR MAP</h2>
        <div style={{ display:'flex', gap:'12px', fontSize:'13px', color:'var(--muted)' }}>
          <span>🟢 Base</span>
          <span>🔴 Contested</span>
          <span>🟡 Supply</span>
        </div>
        {!faction && <span style={{ color:'var(--red)', fontSize:'13px' }}>Join or create a faction to place markers</span>}
        {faction && <span style={{ color:'var(--muted)', fontSize:'13px' }}>Click the map to add a territory marker</span>}
      </div>

      <div style={{ flex:1, position:'relative' }}>
        <MapContainer center={[50.0, 25.3]} zoom={9} style={{ height:'100%', width:'100%', background:'#0a0c0a' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
            opacity={0.4}
          />
          <ClickHandler onMapClick={handleMapClick} />
          {markers.map(m => (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={icons[m.type] || icons.base}>
              <Popup>
                <div style={{ fontFamily:'Rajdhani', minWidth:'160px' }}>
                  <strong style={{ fontSize:'15px' }}>{m.label}</strong>
                  <div style={{ fontSize:'12px', color:'#888', marginTop:'2px' }}>{m.type}</div>
                  {m.notes && <div style={{ fontSize:'13px', marginTop:'6px' }}>{m.notes}</div>}
                  <button onClick={() => deleteMarker(m.id)} style={{ marginTop:'8px', background:'#b91c1c', color:'#fff', border:'none', padding:'4px 10px', borderRadius:'3px', cursor:'pointer', fontSize:'12px' }}>
                    Remove
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {pending && (
          <div style={{ position:'absolute', top:'16px', right:'16px', zIndex:1000, width:'260px' }} className="card">
            <h4 style={{ marginBottom:'12px', fontFamily:'Share Tech Mono', color:'var(--green)' }}>ADD MARKER</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <input placeholder="Label (e.g. North Base)" value={form.label} onChange={e => setForm(f => ({...f, label:e.target.value}))} />
              <select value={form.type} onChange={e => setForm(f => ({...f, type:e.target.value}))}>
                <option value="base">Base</option>
                <option value="contested">Contested Zone</option>
                <option value="supply">Supply Cache</option>
              </select>
              <textarea placeholder="Notes (optional)..." value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))} rows={2} />
              <div style={{ display:'flex', gap:'8px' }}>
                <button className="btn btn-green" style={{ flex:1 }} onClick={saveMarker}>Save</button>
                <button className="btn btn-ghost" onClick={() => setPending(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}