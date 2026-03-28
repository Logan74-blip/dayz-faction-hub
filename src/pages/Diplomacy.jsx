import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Shield, Swords, Package } from 'lucide-react'

const TYPES = [
  { value:'nap', label:'Non-Aggression Pact', icon:Shield, color:'var(--green)' },
  { value:'war', label:'War Declaration', icon:Swords, color:'var(--red)' },
  { value:'trade', label:'Trade Offer', icon:Package, color:'var(--yellow)' },
]

export default function Diplomacy({ session }) {
  const { role, faction } = useRole(session.user.id)
  const [allFactions, setAllFactions] = useState([])
  const [records, setRecords] = useState([])
  const [form, setForm] = useState({ target:'', type:'nap', terms:'' })
  const userId = session.user.id
  const canManage = role === 'leader' || role === 'co-leader'

  useEffect(() => { if (faction?.id) loadData() }, [faction?.id])

  async function loadData() {
    const { data: facs } = await supabase
      .from('factions')
      .select('id, name, tag')
      .neq('id', faction.id)
      .order('name')
    setAllFactions(facs || [])

    const { data: recs } = await supabase
      .from('diplomacy')
      .select(`
        *,
        faction_a_info:factions!diplomacy_faction_a_fkey(id, name, tag),
        faction_b_info:factions!diplomacy_faction_b_fkey(id, name, tag)
      `)
      .or(`faction_a.eq.${faction.id},faction_b.eq.${faction.id}`)
      .order('created_at', { ascending: false })
    setRecords(recs || [])
  }

  async function submitDiplomacy() {
    if (!form.target || !faction || !canManage) return
    const { data, error } = await supabase.from('diplomacy').insert({
      faction_a: faction.id,
      faction_b: form.target,
      type: form.type,
      terms: form.terms,
      status: 'pending',
      created_by: userId
    }).select().single()
    if (!error) {
      setForm({ target:'', type:'nap', terms:'' })
      loadData()
      const targetFaction = allFactions.find(f => f.id === form.target)
      const typeLabel = form.type === 'nap' ? 'Non-Aggression Pact' : form.type === 'war' ? 'War Declaration' : 'Trade Offer'
      await supabase.from('events').insert({
        faction_id: faction.id, created_by: userId, type: 'diplomacy',
        title: `${typeLabel} sent to ${targetFaction?.name}`,
        description: form.terms || 'No terms specified'
      })
      const { data: leaders } = await supabase.from('faction_members').select('user_id').eq('faction_id', form.target).in('role', ['leader', 'co-leader'])
      if (leaders?.length) {
        await supabase.from('notifications').insert(leaders.map(l => ({
          faction_id: form.target, user_id: l.user_id,
          type: form.type === 'war' ? 'war' : 'diplomacy',
          title: `${form.type === 'war' ? '💀 War Declared' : form.type === 'nap' ? '🤝 NAP Proposed' : '🛒 Trade Offer'} by ${faction.name}`,
          body: form.terms || 'No terms specified'
        })))
      }
    }
  }

  async function updateStatus(id, status) {
    if (!canManage) return
    await supabase.from('diplomacy').update({ status }).eq('id', id)
    loadData()
  }

  function getTypeMeta(type) { return TYPES.find(t => t.value === type) || TYPES[0] }
  const statusTag = { pending:'tag-yellow', active:'tag-green', rejected:'tag-red', expired:'tag-red' }

  if (!faction) return (
    <div style={{ padding:'80px', textAlign:'center', color:'var(--muted)' }}>
      Join or create a faction to access Diplomacy.
    </div>
  )

  return (
    <div style={{ maxWidth:900, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>DIPLOMACY BOARD</h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>Negotiate pacts, declare war, or offer trades with other factions</p>
      </div>

      {!canManage && (
        <div className="card" style={{ background:'#1a1a0d', borderColor:'var(--yellow)', fontSize:'13px', color:'var(--muted)' }}>
          🔒 Only <strong style={{ color:'var(--yellow)' }}>Leaders</strong> and <strong style={{ color:'var(--yellow)' }}>Co-Leaders</strong> can send diplomacy proposals or accept/reject them.
        </div>
      )}

      {canManage && allFactions.length > 0 && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <h3 style={{ fontWeight:700, fontSize:'16px' }}>Send Diplomacy</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <select value={form.target} onChange={e => setForm(f => ({...f, target:e.target.value}))}>
              <option value="">Select target faction...</option>
              {allFactions.map(f => <option key={f.id} value={f.id}>{f.name}{f.tag ? ` ${f.tag}` : ''}</option>)}
            </select>
            <select value={form.type} onChange={e => setForm(f => ({...f, type:e.target.value}))}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <textarea placeholder="Terms or message (optional)..." value={form.terms} onChange={e => setForm(f => ({...f, terms:e.target.value}))} rows={2} />
          <button className="btn btn-green" style={{ alignSelf:'flex-start' }} onClick={submitDiplomacy}>Send Proposal</button>
        </div>
      )}

      {canManage && allFactions.length === 0 && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'32px' }}>
          No other factions on this server yet. Diplomacy opens up once more factions join.
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {records.length === 0 && (
          <p style={{ color:'var(--muted)', textAlign:'center', padding:'40px' }}>No diplomacy records yet.</p>
        )}
        {records.map(rec => {
          const meta = getTypeMeta(rec.type)
          const Icon = meta.icon
          const isReceiver = rec.faction_b === faction?.id
          const isPending = rec.status === 'pending'
          return (
            <div key={rec.id} className="card" style={{ display:'flex', gap:'16px', alignItems:'flex-start', borderLeft:`3px solid ${meta.color}` }}>
              <Icon size={20} color={meta.color} style={{ marginTop:'2px', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap', marginBottom:'4px' }}>
                  <strong>{rec.faction_a_info?.name}</strong>
                  <span style={{ color:'var(--muted)', fontSize:'13px' }}>→</span>
                  <strong>{rec.faction_b_info?.name}</strong>
                  <span className={`tag ${statusTag[rec.status] || 'tag-yellow'}`}>{rec.status}</span>
                  <span style={{ color:meta.color, fontSize:'13px' }}>{meta.label}</span>
                </div>
                {rec.terms && <p style={{ color:'var(--muted)', fontSize:'14px', marginTop:'4px' }}>{rec.terms}</p>}
                {isPending && isReceiver && canManage && (
                  <div style={{ display:'flex', gap:'8px', marginTop:'10px' }}>
                    <button className="btn btn-green" style={{ fontSize:'13px', padding:'5px 14px' }} onClick={() => updateStatus(rec.id, 'active')}>Accept</button>
                    <button className="btn btn-ghost" style={{ fontSize:'13px', padding:'5px 14px', color:'var(--red)' }} onClick={() => updateStatus(rec.id, 'rejected')}>Reject</button>
                  </div>
                )}
                {isPending && isReceiver && !canManage && (
                  <p style={{ fontSize:'12px', color:'var(--muted)', marginTop:'8px' }}>⏳ Awaiting leader response</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}