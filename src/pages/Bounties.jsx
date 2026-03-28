import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Target, Plus, Check, X } from 'lucide-react'
import { sendWebhookNotification } from './Settings'

export default function Bounties({ session }) {
  const { role, faction } = useRole(session.user.id)
  const [bounties, setBounties] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ target_name:'', reward:'', description:'' })
  const userId = session.user.id
  const canApprove = role === 'leader' || role === 'co-leader'

  useEffect(() => { if (faction?.id) load() }, [faction?.id])

  async function load() {
    const { data } = await supabase.from('bounties')
      .select('*, profile:profiles!bounties_created_by_fkey(discord_username, discord_avatar)')
      .eq('faction_id', faction.id)
      .order('created_at', { ascending: false })
    setBounties(data || [])
  }

  async function post() {
    if (!form.target_name.trim() || !form.reward.trim()) return
    const { data, error } = await supabase.from('bounties').insert({
      faction_id: faction.id,
      created_by: userId,
      target_name: form.target_name,
      reward: form.reward,
      description: form.description,
      status: canApprove ? 'active' : 'pending'
    }).select('*, profile:profiles!bounties_created_by_fkey(discord_username, discord_avatar)').single()
    if (!error) {
      setBounties(b => [data, ...b])
      setForm({ target_name:'', reward:'', description:'' })
      setShowForm(false)
      if (canApprove) {
        await sendWebhookNotification(
          faction.id, 'bounty',
          `🎯 New Bounty Posted — ${faction.name}`,
          [
            { name: 'Target', value: form.target_name, inline: true },
            { name: 'Reward', value: form.reward, inline: true },
            ...(form.description ? [{ name: 'Details', value: form.description }] : [])
          ],
          0xf87171
        )
      }
    }
  }

  async function approve(id) {
    const bounty = bounties.find(x => x.id === id)
    await supabase.from('bounties').update({ status:'active', approved_by: userId }).eq('id', id)
    setBounties(b => b.map(x => x.id === id ? {...x, status:'active'} : x))
    if (bounty) {
      await sendWebhookNotification(
        faction.id, 'bounty',
        `🎯 Bounty Approved — ${faction.name}`,
        [
          { name: 'Target', value: bounty.target_name, inline: true },
          { name: 'Reward', value: bounty.reward, inline: true },
        ],
        0xf87171
      )
    }
  }

  async function complete(id) {
    const bounty = bounties.find(x => x.id === id)
    await supabase.from('bounties').update({ status:'completed' }).eq('id', id)
    setBounties(b => b.map(x => x.id === id ? {...x, status:'completed'} : x))
    if (bounty) {
      await supabase.from('events').insert({
        faction_id: faction.id, created_by: userId, type: 'bounty',
        title: `Bounty Completed: ${bounty.target_name}`,
        description: `Reward: ${bounty.reward}`
      })
      await sendWebhookNotification(
        faction.id, 'bounty',
        `✅ Bounty Collected — ${faction.name}`,
        [
          { name: 'Target', value: bounty.target_name, inline: true },
          { name: 'Reward', value: bounty.reward, inline: true },
        ],
        0x4ade80
      )
    }
  }

  async function deleteBounty(id) {
    await supabase.from('bounties').delete().eq('id', id)
    setBounties(b => b.filter(x => x.id !== id))
  }

  const pending = bounties.filter(b => b.status === 'pending')
  const active = bounties.filter(b => b.status === 'active')
  const completed = bounties.filter(b => b.status === 'completed')

  if (!faction) return (
    <div style={{ padding:'80px', textAlign:'center', color:'var(--muted)' }}>
      Join or create a faction to view bounties.
    </div>
  )

  return (
    <div style={{ maxWidth:800, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>BOUNTY BOARD</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>Post and track bounties on enemy players</p>
        </div>
        <button className="btn btn-green" style={{ display:'flex', alignItems:'center', gap:'8px' }} onClick={() => setShowForm(f => !f)}>
          <Plus size={15} /> Post Bounty
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px', borderColor:'var(--red)' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--red)', fontSize:'14px' }}>NEW BOUNTY</h3>
          {!canApprove && (
            <p style={{ fontSize:'12px', color:'var(--yellow)', background:'#451a0322', padding:'8px 12px', borderRadius:'4px' }}>
              ⚠️ Your bounty will need approval from leadership before going live.
            </p>
          )}
          <input placeholder="Target player name..." value={form.target_name} onChange={e => setForm(f => ({...f, target_name:e.target.value}))} autoFocus />
          <input placeholder="Reward (e.g. KA-74 + 2 mags)" value={form.reward} onChange={e => setForm(f => ({...f, reward:e.target.value}))} />
          <textarea placeholder="Additional details (last seen location, description...)" value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} rows={2} />
          <div style={{ display:'flex', gap:'8px' }}>
            <button className="btn" style={{ background:'var(--red)', color:'#fff', border:'none' }} onClick={post}>Post Bounty</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {canApprove && pending.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--yellow)', fontSize:'13px', letterSpacing:'0.1em' }}>⏳ AWAITING APPROVAL ({pending.length})</h3>
          {pending.map(b => (
            <div key={b.id} className="card" style={{ borderLeft:'3px solid var(--yellow)', display:'flex', gap:'12px', alignItems:'center' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700 }}>🎯 {b.target_name}</div>
                <div style={{ fontSize:'13px', color:'var(--yellow)' }}>Reward: {b.reward}</div>
                {b.description && <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'4px' }}>{b.description}</div>}
                <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'4px' }}>Posted by {b.profile?.discord_username}</div>
              </div>
              <div style={{ display:'flex', gap:'6px' }}>
                <button onClick={() => approve(b.id)} className="btn btn-green" style={{ padding:'5px 12px', fontSize:'12px', display:'flex', alignItems:'center', gap:'4px' }}>
                  <Check size={12} /> Approve
                </button>
                <button onClick={() => deleteBounty(b.id)} className="btn btn-ghost" style={{ padding:'5px 10px' }}>
                  <X size={12} color="var(--red)" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {active.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--red)', fontSize:'13px', letterSpacing:'0.1em' }}>🔴 ACTIVE BOUNTIES ({active.length})</h3>
          {active.map(b => (
            <div key={b.id} className="card" style={{ borderLeft:'3px solid var(--red)', display:'flex', gap:'12px', alignItems:'center' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:'16px' }}>🎯 {b.target_name}</div>
                <div style={{ fontSize:'14px', color:'var(--yellow)', marginTop:'2px' }}>💰 Reward: {b.reward}</div>
                {b.description && <div style={{ fontSize:'13px', color:'var(--muted)', marginTop:'6px' }}>{b.description}</div>}
                <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'6px' }}>
                  Posted by {b.profile?.discord_username} • {new Date(b.created_at).toLocaleDateString()}
                </div>
              </div>
              {canApprove && (
                <div style={{ display:'flex', gap:'6px', flexDirection:'column' }}>
                  <button onClick={() => complete(b.id)} className="btn btn-green" style={{ padding:'5px 12px', fontSize:'12px' }}>✓ Complete</button>
                  <button onClick={() => deleteBounty(b.id)} className="btn btn-ghost" style={{ padding:'5px 12px', fontSize:'12px', color:'var(--red)' }}>Remove</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--muted)', fontSize:'13px', letterSpacing:'0.1em' }}>✅ COMPLETED ({completed.length})</h3>
          {completed.map(b => (
            <div key={b.id} className="card" style={{ borderLeft:'3px solid var(--border)', opacity:0.6, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px' }}>
              <div>
                <span style={{ fontWeight:700 }}>🎯 {b.target_name}</span>
                <span style={{ color:'var(--muted)', fontSize:'13px', marginLeft:'10px' }}>💰 {b.reward}</span>
              </div>
              <span style={{ fontSize:'12px', color:'var(--green)' }}>✓ Collected</span>
            </div>
          ))}
        </div>
      )}

      {bounties.length === 0 && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
          No bounties posted yet. Post one to put a target on someone's head.
        </div>
      )}
    </div>
  )
}