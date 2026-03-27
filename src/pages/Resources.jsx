import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, Trash2, Camera, X, Check } from 'lucide-react'

const CATEGORIES = ['Weapons', 'Ammo', 'Medical', 'Food & Water', 'Vehicles', 'Base Materials', 'Other']

export default function Resources({ session }) {
  const [faction, setFaction] = useState(null)
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ name:'', category:'Weapons', quantity:1, notes:'' })
  const [filter, setFilter] = useState('All')
  const [ocrMode, setOcrMode] = useState(false)
  const [ocrImage, setOcrImage] = useState(null)
  const [ocrResults, setOcrResults] = useState([])
  const [ocrLoading, setOcrLoading] = useState(false)
  const [selectedOcr, setSelectedOcr] = useState([])
  const fileRef = useRef(null)
  const userId = session.user.id

  useEffect(() => { loadFaction() }, [])

  async function loadFaction() {
    const { data } = await supabase.from('faction_members').select('*, factions(*)').eq('user_id', userId).maybeSingle()
    if (data?.factions) { setFaction(data.factions); loadItems(data.factions.id) }
  }

  async function loadItems(fid) {
    const { data } = await supabase.from('resources').select('*').eq('faction_id', fid).order('category')
    setItems(data || [])
  }

  async function addItem() {
    if (!form.name.trim() || !faction) return
    const { data, error } = await supabase.from('resources').insert({
      faction_id: faction.id, created_by: userId,
      name: form.name, category: form.category,
      quantity: Number(form.quantity), notes: form.notes
    }).select().single()
    if (!error) { setItems(i => [...i, data]); setForm({ name:'', category:'Weapons', quantity:1, notes:'' }) }
  }

  async function deleteItem(id) {
    await supabase.from('resources').delete().eq('id', id)
    setItems(i => i.filter(x => x.id !== id))
  }

  function handleImageUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { setOcrImage(ev.target.result); runOcr(ev.target.result) }
    reader.readAsDataURL(file)
  }

  async function runOcr(imageData) {
    setOcrLoading(true)
    setOcrResults([])
    try {
      const Tesseract = await import('tesseract.js')
      const { data: { text } } = await Tesseract.recognize(imageData, 'eng', {
        logger: () => {}
      })
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2)
      const items = lines.map(line => {
        const qtyMatch = line.match(/x(\d+)|(\d+)x/i)
        const qty = qtyMatch ? parseInt(qtyMatch[1] || qtyMatch[2]) : 1
        const name = line.replace(/x\d+|\d+x/i, '').replace(/[^a-zA-Z\s\-]/g, '').trim()
        if (name.length < 2) return null
        return { name, quantity: qty, category: guessCategory(name), selected: true }
      }).filter(Boolean)
      setOcrResults(items)
      setSelectedOcr(items.map((_, i) => i))
    } catch (err) {
      alert('OCR failed. Try a clearer screenshot.')
    }
    setOcrLoading(false)
  }

  function guessCategory(name) {
    const n = name.toLowerCase()
    if (/ak|m4|rifle|pistol|shotgun|sniper|gun|smg|carbine/.test(n)) return 'Weapons'
    if (/ammo|mag|round|bullet|9mm|5\.56|7\.62/.test(n)) return 'Ammo'
    if (/bandage|saline|morphine|blood|medical|pill|epinephrine|defibrillator/.test(n)) return 'Medical'
    if (/can|food|water|rice|beans|drink|apple|meat/.test(n)) return 'Food & Water'
    if (/car|truck|bus|heli|boat|vehicle/.test(n)) return 'Vehicles'
    if (/wood|nail|metal|wire|fence|wall|gate|plank/.test(n)) return 'Base Materials'
    return 'Other'
  }

  async function importOcrItems() {
    if (!faction) return
    const toImport = ocrResults.filter((_, i) => selectedOcr.includes(i))
    for (const item of toImport) {
      const { data } = await supabase.from('resources').insert({
        faction_id: faction.id, created_by: userId,
        name: item.name, category: item.category, quantity: item.quantity
      }).select().single()
      if (data) setItems(prev => [...prev, data])
    }
    setOcrMode(false)
    setOcrImage(null)
    setOcrResults([])
    setSelectedOcr([])
  }

  const filtered = filter === 'All' ? items : items.filter(i => i.category === filter)

  return (
    <div style={{ maxWidth:900, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>RESOURCE STOCKPILE</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>Track your faction's gear and supplies</p>
        </div>
        {faction && (
          <button className="btn btn-ghost" style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px' }} onClick={() => { setOcrMode(o => !o); setOcrImage(null); setOcrResults([]) }}>
            <Camera size={15} /> Scan Screenshot
          </button>
        )}
      </div>

      {/* OCR Scanner */}
      {ocrMode && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px', borderColor:'var(--green-dim)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px' }}>📷 GEAR SCANNER</h3>
            <button onClick={() => { setOcrMode(false); setOcrImage(null); setOcrResults([]) }} className="btn btn-ghost" style={{ padding:'4px 8px' }}><X size={14} /></button>
          </div>
          <p style={{ fontSize:'13px', color:'var(--muted)' }}>Upload a screenshot of your inventory or stash and we'll try to detect the items automatically.</p>

          {!ocrImage && (
            <>
              <button className="btn btn-green" style={{ alignSelf:'flex-start' }} onClick={() => fileRef.current.click()}>
                Upload Screenshot
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleImageUpload} />
            </>
          )}

          {ocrImage && (
            <img src={ocrImage} alt="scan" style={{ maxWidth:'100%', maxHeight:'200px', objectFit:'contain', borderRadius:'4px', border:'1px solid var(--border)' }} />
          )}

          {ocrLoading && (
            <div style={{ color:'var(--green)', fontFamily:'Share Tech Mono', fontSize:'13px', display:'flex', alignItems:'center', gap:'8px' }}>
              <span>🔍 SCANNING...</span>
            </div>
          )}

          {ocrResults.length > 0 && (
            <>
              <p style={{ fontSize:'13px', color:'var(--muted)' }}>Found {ocrResults.length} items. Select which to import:</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'200px', overflowY:'auto' }}>
                {ocrResults.map((item, i) => (
                  <label key={i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'6px 10px', background:'#0d1a0d', borderRadius:'4px', cursor:'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedOcr.includes(i)}
                      onChange={() => setSelectedOcr(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i])}
                      style={{ width:'auto', accentColor:'var(--green)' }}
                    />
                    <span style={{ flex:1, fontSize:'14px' }}>{item.name}</span>
                    <span className="tag tag-yellow" style={{ fontSize:'11px' }}>{item.category}</span>
                    <span style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'13px' }}>×{item.quantity}</span>
                  </label>
                ))}
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button className="btn btn-green" style={{ display:'flex', alignItems:'center', gap:'6px' }} onClick={importOcrItems}>
                  <Check size={14} /> Import {selectedOcr.length} items
                </button>
                <button className="btn btn-ghost" onClick={() => fileRef.current.click()}>Try another image</button>
              </div>
            </>
          )}

          {ocrImage && !ocrLoading && ocrResults.length === 0 && (
            <p style={{ color:'var(--red)', fontSize:'13px' }}>No items detected. Try a clearer screenshot with visible item names.</p>
          )}
        </div>
      )}

      {/* Manual add */}
      {faction && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <h3 style={{ fontSize:'16px', fontWeight:700, display:'flex', alignItems:'center', gap:'8px' }}><Plus size={16} />Add Item Manually</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 80px', gap:'10px' }}>
            <input placeholder="Item name (e.g. AK-74)" value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} />
            <select value={form.category} onChange={e => setForm(f => ({...f, category:e.target.value}))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({...f, quantity:e.target.value}))} placeholder="Qty" />
          </div>
          <div style={{ display:'flex', gap:'10px' }}>
            <input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))} />
            <button className="btn btn-green" style={{ whiteSpace:'nowrap' }} onClick={addItem}>Add Item</button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
        {['All', ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setFilter(c)} className="btn" style={{
            padding:'5px 14px', fontSize:'13px',
            background: filter===c ? 'var(--green-dim)' : 'var(--surface)',
            color: filter===c ? '#fff' : 'var(--muted)',
            border:'1px solid var(--border)'
          }}>{c}</button>
        ))}
      </div>

      {/* Items list */}
      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {filtered.length === 0 && <p style={{ color:'var(--muted)', textAlign:'center', padding:'40px' }}>No items yet.</p>}
        {filtered.map(item => (
          <div key={item.id} className="card" style={{ display:'flex', alignItems:'center', gap:'16px', padding:'14px 20px' }}>
            <div style={{ flex:1 }}>
              <span style={{ fontWeight:700, fontSize:'16px' }}>{item.name}</span>
              {item.notes && <span style={{ color:'var(--muted)', fontSize:'13px', marginLeft:'10px' }}>{item.notes}</span>}
            </div>
            <span className="tag tag-yellow" style={{ minWidth:'80px', textAlign:'center' }}>{item.category}</span>
            <span style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'18px', minWidth:'50px', textAlign:'right' }}>×{item.quantity}</span>
            <button onClick={() => deleteItem(item.id)} className="btn btn-ghost" style={{ padding:'6px', border:'none' }}>
              <Trash2 size={15} color="var(--red)" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}