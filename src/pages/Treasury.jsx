import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Plus, TrendingUp, TrendingDown, Package, AlertTriangle, ArrowLeft, X } from 'lucide-react'
import { useToast } from '../hooks/useToast'

const CATEGORIES = ['Weapons', 'Ammo', 'Medical', 'Food & Water', 'Vehicles', 'Base Materials', 'Currency', 'Other']
const SORT_OPTIONS = [
  { value:'newest', label:'Newest First' },
  { value:'oldest', label:'Oldest First' },
  { value:'qty_high', label:'Quantity: High to Low' },
  { value:'qty_low', label:'Quantity: Low to High' },
]

export default function Treasury({ session }) {
  const { faction, role } = useRole(session.user.id)
  const [transactions, setTransactions] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)
  const [clearReason, setClearReason] = useState('')
  const [form, setForm] = useState({ item_name:'', quantity:1, category:'Weapons', transaction_type:'deposit', notes:'' })
  const [filter, setFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('All')
  const [sort, setSort] = useState('newest')
  const [drilldown, setDrilldown] = useState(null) // 'deposits' | 'withdrawals' | 'stock' | 'transactions'
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const userId = session.user.id
  const canManage = role === 'leader' || role === 'co-leader'
  const { success, ToastContainer } = useToast()

  useEffect(() => { if (faction) load() }, [faction?.id])

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
    const { data, err } = await supabase.from('treasury').insert({
      faction_id: faction.id,
      created_by: userId,
      item_name: form.item_name,
      quantity: Number(form.quantity),
      category: form.category,
      transaction_type: form.transaction_type,
      notes: form.notes
    }).select('*, profile:profiles!treasury_created_by_fkey(discord_username, discord_avatar)').single()
    if (!err) {
      setTransactions(t => [data, ...t])
      success('Transaction logged!')
      setForm({ item_name:'', quantity:1, category:'Weapons', transaction_type:'deposit', notes:'' })
      setShowForm(false)
      await supabase.from('activity_log').insert({
        faction_id: faction.id, user_id: userId,
        action_type: form.transaction_type === 'deposit' ? 'treasury_deposit' : 'treasury_withdrawal',
        description: `${form.transaction_type === 'deposit' ? 'Deposited' : 'Withdrew'} ×${form.quantity} ${form.item_name}${form.notes ? ` (${form.notes})` : ''}`,
        metadata: { item: form.item_name, quantity: Number(form.quantity), type: form.transaction_type }
      })
    }
  }

  async function saveEdit(id) {
    const { data, error } = await supabase.from('treasury').update({
      item_name: editForm.item_name,
      quantity: Number(editForm.quantity),
      category: editForm.category,
      notes: editForm.notes,
      transaction_type: editForm.transaction_type,
    }).eq('id', id).select('*, profile:profiles!treasury_created_by_fkey(discord_username, discord_avatar)').single()
    if (!error) {
      setTransactions(t => t.map(x => x.id === id ? data : x))
      success('Transaction updated!')
      setEditingId(null)
    }
  }

  async function deleteTransaction(id) {
    if (!window.confirm('Delete this transaction?')) return
    await supabase.from('treasury').delete().eq('id', id)
    setTransactions(t => t.filter(x => x.id !== id))
    success('Transaction deleted.')
  }

  async function clearTreasury() {
    if (!faction) return
    await supabase.from('treasury').delete().eq('faction_id', faction.id)
    await supabase.from('activity_log').insert({
      faction_id: faction.id, user_id: userId,
      action_type: 'treasury_clear',
      description: `Treasury cleared${clearReason.trim() ? `: ${clearReason.trim()}` : ''}`,
      metadata: { reason: clearReason.trim(), count: transactions.length }
    })
    await supabase.from('events').insert({
      faction_id: faction.id, created_by: userId, type: 'custom',
      title: '🗑️ Treasury Cleared',
      description: clearReason.trim() || 'Treasury was cleared by leadership'
    })
    setTransactions([])
    success('Treasury cleared.')
    setShowClearModal(false)
    setClearReason('')
    setDrilldown(null)
  }

  // Computed values
  const stockMap = {}
  transactions.forEach(t => {
    const key = `${t.item_name}__${t.category}`
    if (!stockMap[key]) stockMap[key] = { item_name: t.item_name, category: t.category, quantity: 0, deposits: 0, withdrawals: 0 }
    if (t.transaction_type === 'deposit') { stockMap[key].quantity += t.quantity; stockMap[key].deposits += t.quantity }
    else { stockMap[key].quantity -= t.quantity; stockMap[key].withdrawals += t.quantity }
  })
  const stock = Object.values(stockMap).filter(s => s.quantity > 0)
  const deposits = transactions.filter(t => t.transaction_type === 'deposit')
  const withdrawals = transactions.filter(t => t.transaction_type === 'withdrawal')
  const totalDeposits = deposits.reduce((sum, t) => sum + t.quantity, 0)
  const totalWithdrawals = withdrawals.reduce((sum, t) => sum + t.quantity, 0)

  // Sort function
  function applySortAndFilter(list) {
    let result = [...list]
    if (catFilter !== 'All') result = result.filter(t => t.category === catFilter)
    switch (sort) {
      case 'oldest': result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); break
      case 'qty_high': result.sort((a, b) => b.quantity - a.quantity); break
      case 'qty_low': result.sort((a, b) => a.quantity - b.quantity); break
      default: result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
    return result
  }

  // Drilldown view
  if (drilldown) {
    let title, list, color
    if (drilldown === 'deposits') { title = '↑ Total Deposits'; list = deposits; color = 'var(--green)' }
    else if (drilldown === 'withdrawals') { title = '↓ Total Withdrawals'; list = withdrawals; color = 'var(--red)' }
    else if (drilldown === 'transactions') { title = '📋 All Transactions'; list = transactions; color = 'var(--green)' }
    else if (drilldown === 'stock') {
      // Stock drilldown — different layout
      let stockList = [...stock]
      if (catFilter !== 'All') stockList = stockList.filter(s => s.category === catFilter)
      switch (sort) {
        case 'qty_high': stockList.sort((a, b) => b.quantity - a.quantity); break
        case 'qty_low': stockList.sort((a, b) => a.quantity - b.quantity); break
        case 'oldest': stockList.sort((a, b) => a.item_name.localeCompare(b.item_name)); break
        default: stockList.sort((a, b) => b.quantity - a.quantity)
      }
      return (
        <div style={{ maxWidth:960, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <button className="btn btn-ghost" style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px' }} onClick={() => setDrilldown(null)}>
              <ArrowLeft size={14} /> Back to Treasury
            </button>
            <h2 style={{ fontFamily:'Share Tech Mono', fontSize:'20px', color:'var(--yellow)' }}>
              📦 Unique Items in Stock ({stockList.length})
            </h2>
          </div>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            <select value={sort} onChange={e => setSort(e.target.value)} style={{ width:'auto', fontSize:'13px' }}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {['All', ...CATEGORIES].map(c => (
              <button key={c} onClick={() => setCatFilter(c)} className="btn" style={{ fontSize:'12px', padding:'4px 10px', background: catFilter===c ? '#1a2e1a' : 'var(--surface)', color: catFilter===c ? 'var(--green)' : 'var(--muted)', border:'1px solid var(--border)' }}>{c}</button>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:'10px' }}>
            {stockList.map(s => (
              <div key={`${s.item_name}__${s.category}`} className="card" style={{ display:'flex', flexDirection:'column', gap:'8px', borderLeft:'3px solid var(--yellow)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'15px' }}>{s.item_name}</div>
                    <div style={{ fontSize:'12px', color:'var(--muted)' }}>{s.category}</div>
                  </div>
                  <div style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--yellow)', fontWeight:700 }}>×{s.quantity}</div>
                </div>
                <div style={{ display:'flex', gap:'12px', fontSize:'12px' }}>
                  <span style={{ color:'var(--green)' }}>↑ {s.deposits} deposited</span>
                  <span style={{ color:'var(--red)' }}>↓ {s.withdrawals} withdrawn</span>
                </div>
              </div>
            ))}
          </div>
          {stockList.length === 0 && <p style={{ color:'var(--muted)', textAlign:'center', padding:'40px' }}>No items match this filter.</p>}
          <ToastContainer />
        </div>
      )
    }

    const displayList = applySortAndFilter(list)
    return (
      <div style={{ maxWidth:960, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
          <button className="btn btn-ghost" style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px' }} onClick={() => setDrilldown(null)}>
            <ArrowLeft size={14} /> Back to Treasury
          </button>
          <h2 style={{ fontFamily:'Share Tech Mono', fontSize:'20px', color }}>
            {title} ({displayList.length} transactions)
          </h2>
        </div>

        {/* Filters + Sort */}
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ width:'auto', fontSize:'13px' }}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {['All', ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setCatFilter(c)} className="btn" style={{ fontSize:'12px', padding:'4px 10px', background: catFilter===c ? '#1a2e1a' : 'var(--surface)', color: catFilter===c ? 'var(--green)' : 'var(--muted)', border:'1px solid var(--border)' }}>{c}</button>
          ))}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
          {displayList.length === 0 && <p style={{ color:'var(--muted)', textAlign:'center', padding:'40px' }}>No transactions found.</p>}
          {displayList.map(t => (
            <div key={t.id} style={{ display:'flex', gap:'10px', alignItems:'flex-start', padding:'10px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderLeft:`3px solid ${t.transaction_type === 'deposit' ? 'var(--green)' : 'var(--red)'}`, borderRadius:'6px' }}>
              {editingId === t.id ? (
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'8px' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 80px', gap:'8px' }}>
                    <input value={editForm.item_name} onChange={e => setEditForm(f => ({...f, item_name:e.target.value}))} placeholder="Item name" />
                    <input type="number" min={1} value={editForm.quantity} onChange={e => setEditForm(f => ({...f, quantity:e.target.value}))} />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                    <select value={editForm.category} onChange={e => setEditForm(f => ({...f, category:e.target.value}))}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <div style={{ display:'flex', gap:'6px' }}>
                      <button onClick={() => setEditForm(f => ({...f, transaction_type:'deposit'}))} className="btn" style={{ flex:1, fontSize:'12px', background: editForm.transaction_type==='deposit' ? 'var(--green-dim)' : 'var(--surface)', color: editForm.transaction_type==='deposit' ? '#fff' : 'var(--muted)', border:'1px solid var(--border)' }}>+ Dep</button>
                      <button onClick={() => setEditForm(f => ({...f, transaction_type:'withdrawal'}))} className="btn" style={{ flex:1, fontSize:'12px', background: editForm.transaction_type==='withdrawal' ? '#b91c1c' : 'var(--surface)', color: editForm.transaction_type==='withdrawal' ? '#fff' : 'var(--muted)', border:'1px solid var(--border)' }}>- With</button>
                    </div>
                  </div>
                  <input value={editForm.notes || ''} onChange={e => setEditForm(f => ({...f, notes:e.target.value}))} placeholder="Notes..." />
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button className="btn btn-green" style={{ fontSize:'12px', padding:'4px 10px' }} onClick={() => saveEdit(t.id)}>Save</button>
                    <button className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px' }} onClick={() => setEditingId(null)}>Cancel</button>
                    <button className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px', color:'var(--red)', marginLeft:'auto' }} onClick={() => deleteTransaction(t.id)}>Delete</button>
                  </div>
                </div>
              ) : (
                <>
                  <span style={{ fontSize:'16px', flexShrink:0 }}>{t.transaction_type === 'deposit' ? '↑' : '↓'}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:'8px' }}>
                      <span style={{ fontWeight:600, fontSize:'14px' }}>{t.item_name}</span>
                      <span style={{ fontFamily:'Share Tech Mono', fontSize:'15px', color: t.transaction_type === 'deposit' ? 'var(--green)' : 'var(--red)', flexShrink:0 }}>
                        {t.transaction_type === 'deposit' ? '+' : '-'}{t.quantity}
                      </span>
                    </div>
                    <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px' }}>{t.category}</div>
                    {t.notes && <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px', fontStyle:'italic' }}>{t.notes}</div>}
                    <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'4px', display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                      {t.profile?.discord_avatar && <img src={t.profile.discord_avatar} style={{ width:14, height:14, borderRadius:'50%' }} />}
                      <span>{t.profile?.discord_username || 'Unknown'}</span>
                      <span>•</span>
                      <span>{new Date(t.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => { setEditingId(t.id); setEditForm({ item_name:t.item_name, quantity:t.quantity, category:t.category, notes:t.notes||'', transaction_type:t.transaction_type }) }}
                      className="btn btn-ghost"
                      style={{ padding:'4px 8px', fontSize:'11px', flexShrink:0 }}
                    >
                      Edit
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        <ToastContainer />
      </div>
    )
  }

  // Main treasury view
  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.transaction_type === filter)

  return (
    <div style={{ maxWidth:960, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>FACTION TREASURY</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>Track faction wealth — click any stat to drill in</p>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {canManage && transactions.length > 0 && (
            <button className="btn btn-ghost" style={{ fontSize:'13px', color:'var(--red)', display:'flex', alignItems:'center', gap:'6px' }} onClick={() => setShowClearModal(true)}>
              <AlertTriangle size={13} /> Clear Treasury
            </button>
          )}
          {faction && (
            <button className="btn btn-green" style={{ display:'flex', alignItems:'center', gap:'8px' }} onClick={() => setShowForm(f => !f)}>
              <Plus size={14} /> Log Transaction
            </button>
          )}
        </div>
      </div>

      {/* Clear Modal */}
      {showClearModal && (
        <div style={{ position:'fixed', inset:0, background:'#00000088', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }} onClick={() => setShowClearModal(false)}>
          <div className="card" style={{ maxWidth:'420px', width:'100%', display:'flex', flexDirection:'column', gap:'16px', borderColor:'var(--red)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <AlertTriangle size={20} color="var(--red)" />
              <h3 style={{ fontWeight:700, fontSize:'18px', color:'var(--red)' }}>Clear Treasury</h3>
            </div>
            <p style={{ color:'var(--muted)', fontSize:'14px' }}>
              This will permanently delete all <strong style={{ color:'var(--text)' }}>{transactions.length} transactions</strong>. This cannot be undone.
            </p>
            <div>
              <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'6px' }}>REASON (optional)</label>
              <input placeholder="e.g. Server wipe, Starting fresh..." value={clearReason} onChange={e => setClearReason(e.target.value)} autoFocus />
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button className="btn" style={{ flex:1, background:'#b91c1c', color:'#fff', border:'none', fontWeight:700 }} onClick={clearTreasury}>Yes, Clear Everything</button>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setShowClearModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Clickable stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'12px' }}>
        {[
          { label:'Total Items Deposited', value:totalDeposits, color:'var(--green)', key:'deposits', hint:'Click to view' },
          { label:'Total Items Withdrawn', value:totalWithdrawals, color:'var(--red)', key:'withdrawals', hint:'Click to view' },
          { label:'Unique Items in Stock', value:stock.length, color:'var(--yellow)', key:'stock', hint:'Click to view' },
          { label:'Total Transactions', value:transactions.length, color:'var(--green)', key:'transactions', hint:'Click to view' },
        ].map(s => (
          <div
            key={s.key}
            className="card"
            onClick={() => { setDrilldown(s.key); setCatFilter('All'); setSort('newest') }}
            style={{ textAlign:'center', cursor:'pointer', transition:'border-color 0.15s, transform 0.1s', position:'relative' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = s.color; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <div style={{ fontSize:'32px', fontWeight:700, fontFamily:'Share Tech Mono', color:s.color }}>{s.value}</div>
            <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'4px' }}>{s.label}</div>
            <div style={{ fontSize:'10px', color:s.color, marginTop:'4px', opacity:0.7 }}>→ {s.hint}</div>
          </div>
        ))}
      </div>

      {/* Add form */}
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
          <input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))} />
          <div style={{ display:'flex', gap:'8px' }}>
            <button className="btn btn-green" onClick={addTransaction}>Log Transaction</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'20px' }}>
        {/* Current Stock */}
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px', letterSpacing:'0.05em', display:'flex', alignItems:'center', gap:'8px' }}>
            <Package size={14} /> CURRENT STOCK ({stock.length} items)
          </h3>
          {stock.length === 0 && <p style={{ color:'var(--muted)', fontSize:'13px' }}>No items in treasury yet.</p>}
          <div style={{ maxHeight:'400px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'6px' }}>
            {[...stock].sort((a, b) => b.quantity - a.quantity).map(s => (
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
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
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
                  <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'3px', display:'flex', alignItems:'center', gap:'5px', flexWrap:'wrap' }}>
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
      <ToastContainer />
    </div>
  )
}