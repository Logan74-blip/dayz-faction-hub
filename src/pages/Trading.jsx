import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { ShoppingBag, Plus, MessageSquare, Check, X } from 'lucide-react'

const CATEGORIES = ['Weapons', 'Ammo', 'Medical', 'Food & Water', 'Vehicles', 'Base Materials', 'Territory', 'Services', 'Other']
const TYPES = [
  { value:'offer', label:'Offering', color:'var(--green)', bg:'#14532d' },
  { value:'want', label:'Looking For', color:'var(--yellow)', bg:'#78350f' },
]

export default function Trading({ session }) {
  const [faction, setFaction] = useState(null)
  const [trades, setTrades] = useState([])
  const [offers, setOffers] = useState({})
  const [filter, setFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [expandedTrade, setExpandedTrade] = useState(null)
  const [offerText, setOfferText] = useState('')
  const [form, setForm] = useState({ title:'', description:'', category:'Weapons', trade_type:'offer' })
  const userId = session.user.id

  useEffect(() => { loadFaction() }, [])

  async function loadFaction() {
    const { data } = await supabase.from('faction_members').select('*, factions(*)').eq('user_id', userId).maybeSingle()
    if (data?.factions) { setFaction(data.factions); load() }
    else load()
  }

  async function load() {
    const { data } = await supabase.from('trades')
      .select('*, factions(name, tag), profile:profiles!trades_created_by_fkey(discord_username, discord_avatar)')
      .eq('status', 'open')
      .order('created_at', { ascending:false })
    setTrades(data || [])
  }

  async function loadOffers(tradeId) {
    const { data } = await supabase.from('trade_offers')
      .select('*, profile:profiles!trade_offers_created_by_fkey(discord_username, discord_avatar), from_faction:factions!trade_offers_from_faction_id_fkey(name,tag)')
      .eq('trade_id', tradeId)
      .order('created_at', { ascending: true })
    setOffers(o => ({...o, [tradeId]: data || []}))
  }

  async function post() {
  if (!form.title.trim() || !faction) return
  const { data, error } = await supabase.from('trades').insert({
    faction_id: faction.id, created_by: userId,
    title: form.title, description: form.description,
    category: form.category, trade_type: form.trade_type, status: 'open'
  }).select('*, factions(name, tag), profile:profiles!trades_created_by_fkey(discord_username, discord_avatar)').single()
  if (!error) {
    setTrades(t => [data, ...t])
    setForm({ title:'', description:'', category:'Weapons', trade_type:'offer' })
    setShowForm(false)
    // Log to activity
    await supabase.from('activity_log').insert({
      faction_id: faction.id,
      user_id: userId,
      action_type: 'trade_post',
      description: `Posted trade listing: ${form.title} (${form.trade_type === 'offer' ? 'Offering' : 'Looking For'})`,
      metadata: { title: form.title, type: form.trade_type, category: form.category }
    })
  }
}

  async function closeTrade(id) {
    await supabase.from('trades').update({ status:'closed' }).eq('id', id)
    setTrades(t => t.filter(x => x.id !== id))
  }

  async function sendOffer(tradeId, ownerId) {
    if (!offerText.trim() || !faction) return
    const { data, error } = await supabase.from('trade_offers').insert({
      trade_id: tradeId,
      from_faction_id: faction.id,
      offer_text: offerText.trim(),
      created_by: userId,
      status: 'pending'
    }).select('*, profile:profiles!trade_offers_created_by_fkey(discord_username, discord_avatar), from_faction:factions!trade_offers_from_faction_id_fkey(name,tag)').single()

    if (!error) {
      setOffers(o => ({...o, [tradeId]: [...(o[tradeId] || []), data]}))
      setOfferText('')
      // Notify trade owner
      const trade = trades.find(t => t.id === tradeId)
      if (trade) {
        await supabase.from('notifications').insert({
          faction_id: trade.faction_id,
          user_id: ownerId,
          type: 'trade',
          title: `🛒 New offer on: ${trade.title}`,
          body: `${faction.name}: ${offerText.slice(0, 60)}`
        })
      }
    }
  }

  async function respondToOffer(offerId, tradeId, accept) {
    await supabase.from('trade_offers').update({ status: accept ? 'accepted' : 'declined' }).eq('id', offerId)
    setOffers(o => ({
      ...o,
      [tradeId]: o[tradeId].map(x => x.id === offerId ? {...x, status: accept ? 'accepted' : 'declined'} : x)
    }))
    if (accept) {
      await supabase.from('trades').update({ status:'closed' }).eq('id', tradeId)
      setTrades(t => t.filter(x => x.id !== tradeId))
    }
  }

  function toggleExpand(tradeId) {
    if (expandedTrade === tradeId) {
      setExpandedTrade(null)
    } else {
      setExpandedTrade(tradeId)
      loadOffers(tradeId)
    }
    setOfferText('')
  }

  const filtered = trades.filter(t => {
    if (filter !== 'all' && t.trade_type !== filter) return false
    if (catFilter !== 'All' && t.category !== catFilter) return false
    return true
  })

  return (
    <div style={{ maxWidth:900, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>TRADING POST</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>Cross-faction gear trading and requests</p>
        </div>
        {faction && (
          <button className="btn btn-green" style={{ display:'flex', alignItems:'center', gap:'8px' }} onClick={() => setShowForm(f => !f)}>
            <Plus size={15} /> Post Listing
          </button>
        )}
      </div>

      {showForm && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px', borderColor:'var(--green-dim)' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px' }}>NEW LISTING</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <select value={form.trade_type} onChange={e => setForm(f => ({...f, trade_type:e.target.value}))}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={form.category} onChange={e => setForm(f => ({...f, category:e.target.value}))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <input placeholder="What are you offering or looking for?" value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} />
          <textarea placeholder="Details, quantity, what you want in return..." value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} rows={2} />
          <div style={{ display:'flex', gap:'8px' }}>
            <button className="btn btn-green" onClick={post}>Post</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
        {['all', 'offer', 'want'].map(t => (
          <button key={t} onClick={() => setFilter(t)} className="btn" style={{
            padding:'5px 14px', fontSize:'13px',
            background: filter===t ? 'var(--green-dim)' : 'var(--surface)',
            color: filter===t ? '#fff' : 'var(--muted)', border:'1px solid var(--border)'
          }}>{t === 'all' ? 'All' : t === 'offer' ? '✅ Offering' : '🔍 Looking For'}</button>
        ))}
        <div style={{ width:'1px', background:'var(--border)', margin:'0 4px' }} />
        {['All', ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setCatFilter(c)} className="btn" style={{
            padding:'5px 12px', fontSize:'12px',
            background: catFilter===c ? '#1a2e1a' : 'var(--surface)',
            color: catFilter===c ? 'var(--green)' : 'var(--muted)', border:'1px solid var(--border)'
          }}>{c}</button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
          No listings yet. Be the first to post a trade!
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {filtered.map(t => {
          const typeMeta = TYPES.find(x => x.value === t.trade_type) || TYPES[0]
          const isOwn = t.faction_id === faction?.id
          const isExpanded = expandedTrade === t.id
          const tradeOffers = offers[t.id] || []
          return (
            <div key={t.id} className="card" style={{ display:'flex', flexDirection:'column', gap:'0', borderLeft:`3px solid ${typeMeta.color}` }}>
              <div style={{ display:'flex', gap:'14px', padding:'2px 0 10px' }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'4px' }}>
                    <span style={{ background:typeMeta.bg, color:typeMeta.color, padding:'2px 8px', borderRadius:'999px', fontSize:'11px', fontWeight:700 }}>
                      {typeMeta.label}
                    </span>
                    <span className="tag tag-yellow" style={{ fontSize:'11px' }}>{t.category}</span>
                    <span style={{ fontWeight:700, fontSize:'15px' }}>{t.title}</span>
                  </div>
                  {t.description && <p style={{ fontSize:'13px', color:'var(--muted)', margin:'4px 0 8px' }}>{t.description}</p>}
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'var(--muted)' }}>
                    {t.profile?.discord_avatar && <img src={t.profile.discord_avatar} style={{ width:18, height:18, borderRadius:'50%' }} />}
                    <span>{t.factions?.tag ? `${t.factions.tag} ` : ''}{t.factions?.name}</span>
                    <span>•</span>
                    <span>{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'6px', alignItems:'flex-start', flexShrink:0 }}>
                  {!isOwn && faction && (
                    <button onClick={() => toggleExpand(t.id)} className="btn btn-ghost" style={{ fontSize:'12px', padding:'5px 10px', display:'flex', alignItems:'center', gap:'4px' }}>
                      <MessageSquare size={12} /> {tradeOffers.length > 0 ? `${tradeOffers.length} offers` : 'Make Offer'}
                    </button>
                  )}
                  {isOwn && (
                    <button onClick={() => toggleExpand(t.id)} className="btn btn-ghost" style={{ fontSize:'12px', padding:'5px 10px', display:'flex', alignItems:'center', gap:'4px' }}>
                      <MessageSquare size={12} /> {tradeOffers.length} offers
                    </button>
                  )}
                  {isOwn && (
                    <button onClick={() => closeTrade(t.id)} className="btn btn-ghost" style={{ fontSize:'12px', padding:'5px 10px', color:'var(--red)' }}>
                      Close
                    </button>
                  )}
                </div>
              </div>

              {/* Negotiation panel */}
              {isExpanded && (
                <div style={{ borderTop:'1px solid var(--border)', paddingTop:'12px', display:'flex', flexDirection:'column', gap:'10px' }}>
                  {tradeOffers.length === 0 && <p style={{ fontSize:'13px', color:'var(--muted)', textAlign:'center', padding:'10px' }}>No offers yet. Be the first!</p>}

                  {tradeOffers.map(offer => (
                    <div key={offer.id} style={{
                      padding:'10px 12px', background:'#0d1a0d', borderRadius:'6px',
                      border:`1px solid ${offer.status === 'accepted' ? 'var(--green)' : offer.status === 'declined' ? 'var(--red)' : 'var(--border)'}`
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                            {offer.profile?.discord_avatar && <img src={offer.profile.discord_avatar} style={{ width:18, height:18, borderRadius:'50%' }} />}
                            <span style={{ fontSize:'12px', fontWeight:600 }}>{offer.from_faction?.tag || ''} {offer.from_faction?.name}</span>
                            {offer.status !== 'pending' && (
                              <span style={{ fontSize:'11px', color: offer.status === 'accepted' ? 'var(--green)' : 'var(--red)', fontWeight:700 }}>
                                {offer.status === 'accepted' ? '✅ Accepted' : '❌ Declined'}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize:'13px', color:'var(--text)', margin:0 }}>{offer.offer_text}</p>
                          <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'4px' }}>{new Date(offer.created_at).toLocaleString()}</div>
                        </div>
                        {isOwn && offer.status === 'pending' && (
                          <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                            <button onClick={() => respondToOffer(offer.id, t.id, true)} className="btn btn-green" style={{ padding:'4px 10px', fontSize:'12px', display:'flex', alignItems:'center', gap:'4px' }}>
                              <Check size={12} /> Accept
                            </button>
                            <button onClick={() => respondToOffer(offer.id, t.id, false)} className="btn btn-ghost" style={{ padding:'4px 8px', fontSize:'12px' }}>
                              <X size={12} color="var(--red)" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {!isOwn && faction && (
                    <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
                      <input
                        placeholder="Type your offer or counter-offer..."
                        value={offerText}
                        onChange={e => setOfferText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendOffer(t.id, t.created_by)}
                        style={{ flex:1 }}
                      />
                      <button className="btn btn-green" style={{ whiteSpace:'nowrap', fontSize:'13px' }} onClick={() => sendOffer(t.id, t.created_by)}>
                        Send Offer
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}