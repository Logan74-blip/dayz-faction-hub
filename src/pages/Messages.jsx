import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Send, Inbox, Trash2, X, Reply } from 'lucide-react'

export default function Messages({ session }) {
  const { role, faction } = useRole(session.user.id)
  const [inbox, setInbox] = useState([])
  const [sent, setSent] = useState([])
  const [allFactions, setAllFactions] = useState([])
  const [tab, setTab] = useState('inbox')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ to:'', subject:'', body:'' })
  const [selected, setSelected] = useState(null)
  const [sending, setSending] = useState(false)
  const userId = session.user.id
  const canMessage = role === 'leader' || role === 'co-leader'

  useEffect(() => { if (faction?.id) loadData() }, [faction?.id])

  async function loadData() {
    const [inc, snt, facs] = await Promise.all([
      supabase.from('faction_messages')
        .select('*, from_faction:factions!faction_messages_from_faction_id_fkey(name, tag, primary_color), sender:profiles!faction_messages_sent_by_fkey(discord_username, discord_avatar)')
        .eq('to_faction_id', faction.id)
        .order('created_at', { ascending: false }),
      supabase.from('faction_messages')
        .select('*, to_faction:factions!faction_messages_to_faction_id_fkey(name, tag, primary_color)')
        .eq('from_faction_id', faction.id)
        .order('created_at', { ascending: false }),
      supabase.from('factions').select('id, name, tag').neq('id', faction.id).order('name')
    ])
    setInbox(inc.data || [])
    setSent(snt.data || [])
    setAllFactions(facs.data || [])
  }

  async function send() {
    if (!form.to || !form.subject.trim() || !form.body.trim() || !faction) return
    setSending(true)
    const { error } = await supabase.from('faction_messages').insert({
      from_faction_id: faction.id,
      to_faction_id: form.to,
      sent_by: userId,
      subject: form.subject,
      body: form.body
    })
    if (!error) {
      const { data: leaders } = await supabase
        .from('faction_members')
        .select('user_id')
        .eq('faction_id', form.to)
        .in('role', ['leader', 'co-leader'])
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
    } else {
      alert('Failed to send: ' + error.message)
    }
    setSending(false)
  }

  async function markRead(id) {
    await supabase.from('faction_messages').update({ read: true }).eq('id', id)
    setInbox(i => i.map(x => x.id === id ? {...x, read: true} : x))
  }

  async function deleteMessage(id) {
    await supabase.from('faction_messages').delete().eq('id', id)
    setInbox(i => i.filter(x => x.id !== id))
    setSent(s => s.filter(x => x.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  function reply(msg) {
    const toId = msg.from_faction_id
    setForm({
      to: toId,
      subject: msg.subject.startsWith('Re: ') ? msg.subject : `Re: ${msg.subject}`,
      body: ''
    })
    setShowForm(true)
    setSelected(null)
    setTab('inbox')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const messages = tab === 'inbox' ? inbox : sent
  const unreadCount = inbox.filter(m => !m.read).length

  if (!faction) return (
    <div style={{ padding:'80px', textAlign:'center', color:'var(--muted)' }}>
      Join or create a faction to access Messages.
    </div>
  )

  return (
    <div style={{ maxWidth:900, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>MESSAGES</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>Cross-faction diplomatic communications</p>
        </div>
        {canMessage && (
          <button className="btn btn-green" style={{ display:'flex', alignItems:'center', gap:'8px' }} onClick={() => { setShowForm(f => !f); setSelected(null) }}>
            <Send size={14} /> Compose
          </button>
        )}
      </div>

      {!canMessage && (
        <div className="card" style={{ background:'#1a1a0d', borderColor:'var(--yellow)', fontSize:'13px', color:'var(--muted)' }}>
          🔒 Only <strong style={{ color:'var(--yellow)' }}>Leaders</strong> and <strong style={{ color:'var(--yellow)' }}>Co-Leaders</strong> can send messages. You can view incoming messages below.
        </div>
      )}

      {showForm && canMessage && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px', borderColor:'var(--green-dim)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px' }}>NEW MESSAGE</h3>
            <button onClick={() => setShowForm(false)} className="btn btn-ghost" style={{ padding:'4px 8px' }}><X size={14} /></button>
          </div>
          <select value={form.to} onChange={e => setForm(f => ({...f, to:e.target.value}))}>
            <option value="">Select recipient faction...</option>
            {allFactions.map(f => <option key={f.id} value={f.id}>{f.tag ? `${f.tag} ` : ''}{f.name}</option>)}
          </select>
          <input placeholder="Subject..." value={form.subject} onChange={e => setForm(f => ({...f, subject:e.target.value}))} />
          <textarea placeholder="Message body..." value={form.body} onChange={e => setForm(f => ({...f, body:e.target.value}))} rows={5} />
          <div style={{ display:'flex', gap:'8px' }}>
            <button className="btn btn-green" onClick={send} disabled={sending} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <Send size={13} /> {sending ? 'Sending...' : 'Send Message'}
            </button>
            <button className="btn btn-ghost" onClick={() => { setShowForm(false); setForm({ to:'', subject:'', body:'' }) }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)' }}>
        {[
          { key:'inbox', label:'Inbox', icon:<Inbox size={13} />, badge: unreadCount },
          { key:'sent', label:'Sent', icon:<Send size={13} /> }
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelected(null) }} style={{
            background:'transparent', border:'none', padding:'8px 20px', cursor:'pointer',
            fontSize:'13px', fontWeight:600, fontFamily:'Rajdhani',
            color: tab===t.key ? 'var(--green)' : 'var(--muted)',
            borderBottom: tab===t.key ? '2px solid var(--green)' : '2px solid transparent',
            display:'flex', alignItems:'center', gap:'6px'
          }}>
            {t.icon} {t.label}
            {t.badge > 0 && (
              <span style={{ background:'var(--red)', color:'#fff', borderRadius:'999px', fontSize:'10px', padding:'1px 6px', fontWeight:700 }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Message list + detail */}
      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap:'16px', alignItems:'start' }}>

        {/* Message list */}
        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
          {messages.length === 0 && (
            <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
              {tab === 'inbox' ? 'No messages received yet.' : 'No messages sent yet.'}
            </div>
          )}
          {messages.map(m => {
            const isUnread = !m.read && tab === 'inbox'
            const isSelected = selected?.id === m.id
            return (
              <div key={m.id}
                onClick={() => { setSelected(m); if (tab==='inbox' && !m.read) markRead(m.id) }}
                className="card"
                style={{
                  cursor:'pointer', padding:'12px 16px',
                  borderLeft:`3px solid ${isUnread ? 'var(--green)' : isSelected ? 'var(--green-dim)' : 'var(--border)'}`,
                  background: isUnread ? '#14532d11' : isSelected ? '#14532d08' : 'var(--surface)',
                  transition:'all 0.15s'
                }}
              >
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight: isUnread ? 700 : 600, fontSize:'14px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {isUnread && <span style={{ color:'var(--green)', marginRight:'6px' }}>●</span>}
                      {m.subject}
                    </div>
                    <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'3px', display:'flex', alignItems:'center', gap:'6px' }}>
                      {tab === 'inbox' ? (
                        <>
                          <span style={{ color: m.from_faction?.primary_color || 'var(--muted)', fontWeight:600 }}>
                            {m.from_faction?.tag ? `${m.from_faction.tag} ` : ''}{m.from_faction?.name}
                          </span>
                          {m.sender?.discord_avatar && <img src={m.sender.discord_avatar} style={{ width:14, height:14, borderRadius:'50%' }} />}
                          <span>{m.sender?.discord_username}</span>
                        </>
                      ) : (
                        <span style={{ color: m.to_faction?.primary_color || 'var(--muted)', fontWeight:600 }}>
                          To: {m.to_faction?.tag ? `${m.to_faction.tag} ` : ''}{m.to_faction?.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
                    <span style={{ fontSize:'11px', color:'var(--muted)' }}>
                      {new Date(m.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); deleteMessage(m.id) }}
                      className="btn btn-ghost"
                      style={{ padding:'3px 5px', opacity:0.4 }}
                      onMouseEnter={e => e.currentTarget.style.opacity='1'}
                      onMouseLeave={e => e.currentTarget.style.opacity='0.4'}
                    >
                      <Trash2 size={11} color="var(--red)" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Message detail */}
        {selected && (
          <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px', position:'sticky', top:'72px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
              <h3 style={{ fontWeight:700, fontSize:'16px', flex:1, lineHeight:1.3 }}>{selected.subject}</h3>
              <button onClick={() => setSelected(null)} className="btn btn-ghost" style={{ padding:'4px 6px', flexShrink:0 }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ fontSize:'13px', color:'var(--muted)', display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
              {selected.sender?.discord_avatar && <img src={selected.sender.discord_avatar} style={{ width:20, height:20, borderRadius:'50%' }} />}
              <span>
                {tab === 'inbox'
                  ? `From ${selected.from_faction?.name}`
                  : `To ${selected.to_faction?.name}`}
              </span>
              <span>•</span>
              <span>{new Date(selected.created_at).toLocaleString()}</span>
            </div>
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:'14px', fontSize:'14px', lineHeight:1.8, whiteSpace:'pre-wrap', color:'var(--text)', minHeight:'100px' }}>
              {selected.body}
            </div>
            {canMessage && tab === 'inbox' && (
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:'12px', display:'flex', gap:'8px' }}>
                <button className="btn btn-green" style={{ fontSize:'13px', display:'flex', alignItems:'center', gap:'6px' }} onClick={() => reply(selected)}>
                  <Reply size={13} /> Reply
                </button>
                <button className="btn btn-ghost" style={{ fontSize:'13px', color:'var(--red)' }} onClick={() => deleteMessage(selected.id)}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}