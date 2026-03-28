import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Plus, TrendingUp, TrendingDown, Package } from 'lucide-react'

const CATEGORIES = ['Weapons', 'Ammo', 'Medical', 'Food & Water', 'Vehicles', 'Base Materials', 'Currency', 'Other']

export default function Treasury({ session }) {
  const { faction } = useRole(session.user.id)
  const [transactions, setTransactions] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ item_name:'', quantity:1, category:'Weapons', transaction_type:'deposit', notes:'' })
  const [filter, setFilter] = useState('all')
  const userId = session.user.id

  useEffect(() => { if (faction) load() }, [faction])

  async function load() {
    const { data } = await supabase
      .from('treasury')
      .select('*, profile:profiles!treasury_created_by_fkey(discord_username, discord_avatar)')
      .eq('faction_id', faction.id)
      .order('created_at', { ascending: false })
    setTransactions(data || [])
  }

  async function addTransaction() {
  if (!form.item_name.trim()) return
  const { data, error } = await supabase.from('treasury').insert({
    faction_id: faction.id,
    created_by: userId,
    item_name: form.item_name,
    quantity: Number(form.quantity),
    category: form.category,
    transaction_type: form.transaction_type,
    notes: form.notes
  }).select('*, profile:profiles!treasury_created_by_fkey(discord_username, discord_avatar)').single()
  if (!error) {
    setTransactions(t => [data, ...t])
    setForm({ item_name:'', quantity:1, category:'Weapons', transaction_type:'deposit', notes:'' })
    setShowForm(false)
    // Log to activity
    await supabase.from('activity_log').insert({
      faction_id: faction.id,
      user_id: userId,
      action_type: form.transaction_type === 'deposit' ? 'treasury_deposit' : 'treasury_withdrawal',
      description: `${form.transaction_type === 'deposit' ? 'Deposited' : 'Withdrew'} ×${form.quantity} ${form.item_name} ${form.notes ? `(${form.notes})` : ''}`,
      metadata: { item: form.item_name, quantity: Number(form.quantity), type: form.transaction_type }
    })
  }
}

  // Calculate current stock per item
  const stockMap = {}
  transactions.forEach(t => {
    const key = `${t.item_name}__${t.category}`
    if (!stockMap[key]) stockMap[key] = { item_name: t.item_name, category: t.category, quantity: 0 }
    if (t.transaction_type === 'deposit') stockMap[key].quantity += t.quantity
    else stockMap[key].quantity -= t.quantity
  })
  const stock = Object.values(stockMap).filter(s => s.quantity > 0).sort((a,b) => a.item_name.localeCompare(b.item_name))

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.transaction_type === filter)
  const totalDeposits = transactions.filter(t => t.transaction_type === 'deposit').reduce((sum, t) => sum + t.quantity, 0)
  const totalWithdrawals = transactions.filter(t => t.transaction_type === 'withdrawal').reduce((sum, t) => sum + t.quantity, 0)

  return (
    <div style={{ maxWidth:960, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>FACTION TREASURY</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>Track faction wealth — deposits and withdrawals</p>
        </div>
        {faction && (
          <button className="btn btn-green" style={{ display:'flex', alignItems:'center', gap:'8px' }} onClick={() => setShowForm(f => !f)}>
            <Plus size={14} /> Log Transaction
          </button>
        )}
      </div>

      {/* Summary stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'12px' }}>
        <div className="card" style={{ textAlign:'center' }}>
          <div style={{ fontSize:'32px', fontWeight:700, fontFamily:'Share Tech Mono', color:'var(--green)' }}>{totalDeposits}</div>
          <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'4px' }}>Total Items Deposited</div>
        </div>
        <div className="card" style={{ textAlign:'center' }}>
          <div style={{ fontSize:'32px', fontWeight:700, fontFamily:'Share Tech Mono', color:'var(--red)' }}>{totalWithdrawals}</div>
          <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'4px' }}>Total Items Withdrawn</div>
        </div>
        <div className="card" style={{ textAlign:'center' }}>
          <div style={{ fontSize:'32px', fontWeight:700, fontFamily:'Share Tech Mono', color:'var(--yellow)' }}>{stock.length}</div>
          <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'4px' }}>Unique Items in Stock</div>
        </div>
        <div className="card" style={{ textAlign:'center' }}>
          <div style={{ fontSize:'32px', fontWeight:700, fontFamily:'Share Tech Mono', color:'var(--green)' }}>{transactions.length}</div>
          <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'4px' }}>Total Transactions</div>
        </div>
      </div>

      {/* Add transaction form */}
      {showForm && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px', borderColor:'var(--green-dim)' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px' }}>LOG TRANSACTION</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div>
              <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>TYPE</label>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={() => setForm(f => ({...f, transaction_type:'deposit'}))} className="btn" style={{ flex:1, fontSize:'13px', background: form.transaction_type==='deposit' ? 'var(--green-dim)' : 'var(--surface)', color: form.transaction_type==='deposit' ? '#fff' : 'var(--muted)', border:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'6px', justifyContent:'center' }}>
                  <TrendingUp size={13} /> Deposit
                </button>
                <button onClick={() => setForm(f => ({...f, transaction_type:'withdrawal'}))} className="btn" style={{ flex:1, fontSize:'13px', background: form.transaction_type==='withdrawal' ? '#b91c1c' : 'var(--surface)', color: form.transaction_type==='withdrawal' ? '#fff' : 'var(--muted)', border:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'6px', justifyContent:'center' }}>
                  <TrendingDown size={13} /> Withdraw
                </button>
              </div>
            </div>
            <div>
              <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>CATEGORY</label>
              <select value={form.category} onChange={e => setForm(f => ({...f, category:e.target.value}))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 80px', gap:'10px' }}>
            <input placeholder="Item name (e.g. AK-74)" value={form.item_name} onChange={e => setForm(f => ({...f, item_name:e.target.value}))} />
            <input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({...f, quantity:e.target.value}))} placeholder="Qty" />
          </div>
          <input placeholder="Notes (optional — who withdrew it, why...)" value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))} />
          <div style={{ display:'flex', gap:'8px' }}>
            <button className="btn btn-green" onClick={addTransaction}>Log Transaction</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
        {/* Current Stock */}
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px', letterSpacing:'0.05em' }}>
            <Package size={14} style={{ marginRight:'6px' }} />
            CURRENT STOCK ({stock.length} items)
          </h3>
          {stock.length === 0 && <p style={{ color:'var(--muted)', fontSize:'13px' }}>No items in treasury yet.</p>}
          <div style={{ maxHeight:'400px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'6px' }}>
            {stock.map(s => (
              <div key={`${s.item_name}__${s.category}`} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 10px', background:'#0d1a0d', borderRadius:'4px' }}>
                <div>
                  <span style={{ fontWeight:600, fontSize:'13px' }}>{s.item_name}</span>
                  <span style={{ fontSize:'11px', color:'var(--muted)', marginLeft:'8px' }}>{s.category}</span>
                </div>
                <span style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'16px', fontWeight:700 }}>×{s.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Transaction log */}
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <div style={{ display:'flex', gap:'6px' }}>
            {['all', 'deposit', 'withdrawal'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className="btn" style={{
                padding:'4px 12px', fontSize:'12px',
                background: filter===f ? (f==='withdrawal' ? '#b91c1c' : 'var(--green-dim)') : 'var(--surface)',
                color: filter===f ? '#fff' : 'var(--muted)',
                border:'1px solid var(--border)', textTransform:'capitalize'
              }}>{f === 'all' ? 'All' : f === 'deposit' ? '↑ Deposits' : '↓ Withdrawals'}</button>
            ))}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'420px', overflowY:'auto' }}>
            {filtered.length === 0 && <p style={{ color:'var(--muted)', fontSize:'13px', padding:'20px', textAlign:'center' }}>No transactions yet.</p>}
            {filtered.map(t => (
              <div key={t.id} style={{ display:'flex', gap:'10px', alignItems:'flex-start', padding:'8px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderLeft:`3px solid ${t.transaction_type === 'deposit' ? 'var(--green)' : 'var(--red)'}`, borderRadius:'4px' }}>
                <span style={{ fontSize:'16px', flexShrink:0 }}>{t.transaction_type === 'deposit' ? '↑' : '↓'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:'8px' }}>
                    <span style={{ fontWeight:600, fontSize:'13px' }}>{t.item_name}</span>
                    <span style={{ fontFamily:'Share Tech Mono', fontSize:'14px', color: t.transaction_type === 'deposit' ? 'var(--green)' : 'var(--red)', flexShrink:0 }}>
                      {t.transaction_type === 'deposit' ? '+' : '-'}{t.quantity}
                    </span>
                  </div>
                  {t.notes && <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>{t.notes}</div>}
                  <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'3px', display:'flex', alignItems:'center', gap:'5px' }}>
                    {t.profile?.discord_avatar && <img src={t.profile.discord_avatar} style={{ width:14, height:14, borderRadius:'50%' }} />}
                    <span>{t.profile?.discord_username || 'Unknown'}</span>
                    <span>•</span>
                    <span>{new Date(t.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}