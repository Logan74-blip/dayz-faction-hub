import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, Trash2 } from 'lucide-react'

const CATEGORIES = ['Weapons', 'Ammo', 'Medical', 'Food & Water', 'Vehicles', 'Base Materials', 'Other']

export default function Resources({ session }) {
  const [faction, setFaction] = useState(null)
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ name:'', category:'Weapons', quantity:1, notes:'' })
  const [filter, setFilter] = useState('All')
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

  const filtered = filter === 'All' ? items : items.filter(i => i.category === filter)

  return (
    <div style={{ maxWidth:900, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>RESOURCE STOCKPILE</h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>Track your faction's gear and supplies</p>
      </div>

      {faction && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <h3 style={{ fontSize:'16px', fontWeight:700, display:'flex', alignItems:'center', gap:'8px' }}><Plus size={16} />Add Item</h3>
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

      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {filtered.length === 0 && <p style={{ color:'var(--muted)', textAlign:'center', padding:'40px' }}>No items yet. Add your first resource above.</p>}
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