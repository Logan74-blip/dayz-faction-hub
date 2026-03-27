import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Send, Inbox } from 'lucide-react'

export default function Messages({ session }) {
  const { role, faction } = useRole(session.user.id)
  const [inbox, setInbox] = useState([])
  const [sent, setSent] = useState([])
  const [allFactions, setAllFactions] = useState([])
  const [tab, setTab] = useState('inbox')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ to:'', subject:'', body:'' })
  const [selected, setSelected] = useState(null)
  const userId = session.user.id
  const canMessage = role === 'leader' || role === 'co-leader'

  useEffect(() => { if (faction) loadData() }, [faction])

  async function loadData() {
    const [inc, snt, facs] = await Promise.all([
      supabase.from('faction_messages')
        .select('*, from_faction:factions!faction_messages_from_faction_id_fkey(name,tag), sender:profiles!faction_messages_sent_by_fkey(discord_username,discord_avatar)')
        .eq('to_faction_id', faction.id)
        .order('created_at', { ascending:false }),
      supabase.from('faction_messages')
        .select('*, to_faction:factions!faction_messages_to_faction_id_fkey(name,tag)')
        .eq('from_faction_id', faction.id)
        .order('created_at', { ascending:false }),
      supabase.from('factions').select('id,name,tag').neq('id', faction.id)
    ])
    setInbox(inc.data || [])
    setSent(snt.data || [])
    setAllFactions(facs.data || [])
  }

  async function send() {
    if (!form.to || !form.subject.trim() || !form.body.trim()) return
    const { error } = await supabase.from('faction_messages').insert({
      from_faction_id: faction.id,
      to_faction_id: form.to,
      sent_by: userId,
      subject: form.subject,
      body: form.body
    })
    if (!error) {
      // Notify target faction leaders
      const { data: leaders } = await supabase.from('faction_members').select('user_id').eq('faction_id', form.to).in('role', ['leader', 'co-leader'])
      if (leaders?.length) {
        await supabase.from('notifications').insert(leaders.map(l => ({
          faction_id: form.to,
          user_id: l.user_id,
          type: 'diplomacy',
          title: `📨 Message from ${faction.name}`,
          body: form.subject
        })))
      }
      setForm({ to:'', subject:'', body:'' })
      setShowForm(false)
      loadData()
    }
  }

  async function markRead(id) {
    await supabase.from('faction_messages').update({ read: true }).eq('id', id)
    setInbox(i => i.map(x => x.id === id ? {...x, read:true} : x))
  }

  const messages = tab === 'inbox' ? inbox : sent

  return (
    <div style={{ maxWidth:900, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>MESSAGES</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>Cross-faction diplomatic communications</p>
        </div>
        {canMessage && (
          <button className="btn btn-green" style={{ display:'flex', alignItems:'center', gap:'8px' }} onClick={() => setShowForm(f => !f)}>
            <Send size={14} /> Compose
          </button>
        )}
      </div>

      {showForm && canMessage && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px', borderColor:'var(--green-dim)' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px' }}>NEW MESSAGE</h3>
          <select value={form.to} onChange={e => setForm(f => ({...f, to:e.target.value}))}>
            <option value="">Select recipient faction...</option>
            {allFactions.map(f => <option key={f.id} value={f.id}>{f.tag ? `${f.tag} ` : ''}{f.name}</option>)}
          </select>
          <input placeholder="Subject..." value={form.subject} onChange={e => setForm(f => ({...f, subject:e.target.value}))} />
          <textarea placeholder="Message body..." value={form.body} onChange={e => setForm(f => ({...f, body:e.target.value}))} rows={4} />
          <div style={{ display:'flex', gap:'8px' }}>
            <button className="btn btn-green" onClick={send}>Send Message</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:'0', borderBottom:'1px solid var(--border)' }}>
        {['inbox', 'sent'].map(t => (
          <button key={t} onClick={() => { setTab(t); setSelected(null) }} style={{
            background:'transparent', border:'none', padding:'8px 20px', cursor:'pointer',
            fontSize:'13px', fontWeight:600, fontFamily:'Rajdhani',
            color: tab===t ? 'var(--green)' : 'var(--muted)',
            borderBottom: tab===t ? '2px solid var(--green)' : '2px solid transparent',
            textTransform:'capitalize', display:'flex', alignItems:'center', gap:'6px'
          }}>
            {t === 'inbox' ? <><Inbox size={13} /> Inbox {inbox.filter(m => !m.read).length > 0 && <span style={{ background:'var(--red)', color:'#fff', borderRadius:'999px', fontSize:'10px', padding:'1px 6px' }}>{inbox.filter(m => !m.read).length}</span>}</> : <><Send size={13} /> Sent</>}
          </button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap:'16px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {messages.length === 0 && <p style={{ color:'var(--muted)', textAlign:'center', padding:'40px' }}>No messages yet.</p>}
          {messages.map(m => (
            <div key={m.id} onClick={() => { setSelected(m); if (tab==='inbox' && !m.read) markRead(m.id) }}
              className="card" style={{
                cursor:'pointer', padding:'12px 16px',
                borderLeft: `3px solid ${!m.read && tab==='inbox' ? 'var(--green)' : 'var(--border)'}`,
                background: !m.read && tab==='inbox' ? '#14532d11' : 'var(--surface)',
                opacity: selected?.id === m.id ? 1 : 0.9
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--green-dim)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = !m.read && tab==='inbox' ? 'var(--green)' : 'var(--border)'}
            >
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight: !m.read && tab==='inbox' ? 700 : 600, fontSize:'14px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {m.subject}
                  </div>
                  <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px' }}>
                    {tab==='inbox' ? `From: ${m.from_faction?.tag || ''} ${m.from_faction?.name}` : `To: ${m.to_faction?.tag || ''} ${m.to_faction?.name}`}
                  </div>
                </div>
                <div style={{ fontSize:'11px', color:'var(--muted)', whiteSpace:'nowrap', flexShrink:0 }}>
                  {new Date(m.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px', height:'fit-content' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <h3 style={{ fontWeight:700, fontSize:'16px', flex:1 }}>{selected.subject}</h3>
              <button onClick={() => setSelected(null)} style={{ background:'transparent', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'18px' }}>×</button>
            </div>
            <div style={{ fontSize:'13px', color:'var(--muted)', display:'flex', gap:'8px', alignItems:'center' }}>
              {selected.sender?.discord_avatar && <img src={selected.sender.discord_avatar} style={{ width:20, height:20, borderRadius:'50%' }} />}
              <span>{tab==='inbox' ? `From ${selected.from_faction?.name}` : `To ${selected.to_faction?.name}`}</span>
              <span>•</span>
              <span>{new Date(selected.created_at).toLocaleString()}</span>
            </div>
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:'14px', fontSize:'14px', lineHeight:1.7, whiteSpace:'pre-wrap', color:'var(--text)' }}>
              {selected.body}
            </div>
            {canMessage && tab==='inbox' && (
              <button className="btn btn-green" style={{ alignSelf:'flex-start', fontSize:'13px' }} onClick={() => {
                setForm({ to: selected.from_faction_id, subject: `Re: ${selected.subject}`, body:'' })
                setShowForm(true)
                setSelected(null)
                setTab('inbox')
              }}>
                ↩ Reply
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}