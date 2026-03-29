import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Plus, Pin, Trash2, AlertTriangle } from 'lucide-react'
import { sendWebhookNotification } from './Settings'
import { useToast } from '../hooks/useToast'

export default function Announcements({ session }) {
  const { role, faction } = useRole(session.user.id)
  const [announcements, setAnnouncements] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)
  const [form, setForm] = useState({ title:'', body:'', pinned:false })
  const [loading, setLoading] = useState(true)
  const userId = session.user.id
  const canPost = role === 'leader' || role === 'co-leader'
  const { success, error, ToastContainer } = useToast()

  useEffect(() => { if (faction?.id) load() }, [faction?.id])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('announcements')
      .select('*, profile:profiles!announcements_created_by_fkey(discord_username, discord_avatar)')
      .eq('faction_id', faction.id)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    if (!error) setAnnouncements(data || [])
    setLoading(false)
  }

  async function post() {
    if (!form.title.trim() || !form.body.trim() || !faction) return
    const { data, error } = await supabase.from('announcements').insert({
      faction_id: faction.id,
      created_by: userId,
      title: form.title,
      body: form.body,
      pinned: form.pinned
    }).select('*, profile:profiles!announcements_created_by_fkey(discord_username, discord_avatar)').single()
    if (!error) {
      success('Announcement posted!')
      setAnnouncements(a => form.pinned
        ? [data, ...a]
        : [...a.filter(x => x.pinned), data, ...a.filter(x => !x.pinned)]
      )
      setForm({ title:'', body:'', pinned:false })
      setShowForm(false)
      await supabase.from('events').insert({
        faction_id: faction.id, created_by: userId,
        type: 'announcement',
        title: `📣 Announcement: ${form.title}`,
        description: form.body.slice(0, 100)
      })
      const { data: members } = await supabase
        .from('faction_members')
        .select('user_id')
        .eq('faction_id', faction.id)
        .neq('user_id', userId)
      if (members?.length) {
        await supabase.from('notifications').insert(members.map(m => ({
          faction_id: faction.id, user_id: m.user_id,
          type: 'announcement',
          title: `📣 ${form.title}`,
          body: form.body.slice(0, 80)
        })))
      }
      await sendWebhookNotification(
        faction.id, 'announcement',
        `📣 ${form.pinned ? '📌 PINNED — ' : ''}${form.title}`,
        [{ name:'Message', value:form.body.slice(0, 1024) }],
        0x4ade80
      )
    }
  }

  async function deleteAnnouncement(id) {
    if (!window.confirm('Delete this announcement?')) return
    success('Item removed.')
    await supabase.from('announcements').delete().eq('id', id)
    setAnnouncements(a => a.filter(x => x.id !== id))
  }

  async function clearAllAnnouncements() {
    if (!faction) return
    success('Announcements cleared.')
    await supabase.from('announcements').delete().eq('faction_id', faction.id)
    await supabase.from('events').insert({
      faction_id: faction.id, created_by: userId, type: 'announcement',
      title: '🗑️ All Announcements Cleared',
      description: 'Announcement history cleared by leadership'
    })
    setAnnouncements([])
    setShowClearModal(false)
  }

  async function togglePin(id, pinned) {
    await supabase.from('announcements').update({ pinned: !pinned }).eq('id', id)
    setAnnouncements(a =>
      a.map(x => x.id === id ? {...x, pinned: !pinned} : x)
       .sort((a, b) => b.pinned - a.pinned || new Date(b.created_at) - new Date(a.created_at))
    )
  }

  if (!faction) return (
    <div style={{ padding:'80px', textAlign:'center', color:'var(--muted)' }}>
      Join or create a faction to view announcements.
    </div>
  )

  if (loading) return (
    <div className="page-loading"><div className="spinner" /></div>
  )

  return (
    <div style={{ maxWidth:800, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>ANNOUNCEMENTS</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>Faction-wide messages from leadership</p>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {canPost && announcements.length > 0 && (
            <button
              className="btn btn-ghost"
              style={{ fontSize:'13px', color:'var(--red)', display:'flex', alignItems:'center', gap:'6px' }}
              onClick={() => setShowClearModal(true)}
            >
              <AlertTriangle size={13} /> Clear All
            </button>
          )}
          {canPost && (
            <button className="btn btn-green" style={{ display:'flex', alignItems:'center', gap:'8px' }} onClick={() => setShowForm(f => !f)}>
              <Plus size={15} /> Post Announcement
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
              <h3 style={{ fontWeight:700, fontSize:'18px', color:'var(--red)' }}>Clear All Announcements</h3>
            </div>
            <p style={{ color:'var(--muted)', fontSize:'14px' }}>
              This will permanently delete all <strong style={{ color:'var(--text)' }}>{announcements.length} announcements</strong>. This cannot be undone.
            </p>
            <div style={{ display:'flex', gap:'8px' }}>
              <button
                className="btn"
                style={{ flex:1, background:'#b91c1c', color:'#fff', border:'none', fontWeight:700 }}
                onClick={clearAllAnnouncements}
              >
                Yes, Clear Everything
              </button>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setShowClearModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {!canPost && (
        <div className="card" style={{ background:'#1a1a0d', borderColor:'var(--yellow)', fontSize:'13px', color:'var(--muted)' }}>
          🔒 Only <strong style={{ color:'var(--yellow)' }}>Leaders</strong> and <strong style={{ color:'var(--yellow)' }}>Co-Leaders</strong> can post announcements.
        </div>
      )}

      {showForm && canPost && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px', borderColor:'var(--green-dim)' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px' }}>NEW ANNOUNCEMENT</h3>
          <input placeholder="Title..." value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} autoFocus />
          <textarea placeholder="Message body..." value={form.body} onChange={e => setForm(f => ({...f, body:e.target.value}))} rows={4} />
          <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'14px', cursor:'pointer' }}>
            <input type="checkbox" checked={form.pinned} onChange={e => setForm(f => ({...f, pinned:e.target.checked}))} style={{ width:'auto', accentColor:'var(--green)' }} />
            📌 Pin this announcement
          </label>
          <div style={{ display:'flex', gap:'8px' }}>
            <button className="btn btn-green" onClick={post}>Post</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {announcements.length === 0 && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
          No announcements yet.{canPost ? ' Click "Post Announcement" to create one.' : ' Leadership will post updates here.'}
        </div>
      )}

      {announcements.map(a => (
        <div key={a.id} className="card" style={{
          display:'flex', flexDirection:'column', gap:'10px',
          borderLeft: a.pinned ? '3px solid var(--green)' : '3px solid var(--border)',
          background: a.pinned ? '#0d1a0d' : 'var(--surface)'
        }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', flex:1, minWidth:0 }}>
              {a.pinned && <Pin size={14} color="var(--green)" style={{ flexShrink:0 }} />}
              <h3 style={{ fontSize:'17px', fontWeight:700, color: a.pinned ? 'var(--green)' : 'var(--text)' }}>{a.title}</h3>
            </div>
            {canPost && (
              <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                <button onClick={() => togglePin(a.id, a.pinned)} className="btn btn-ghost" style={{ padding:'4px 8px', fontSize:'11px', color: a.pinned ? 'var(--green)' : 'var(--muted)' }}>
                  {a.pinned ? 'Unpin' : '📌 Pin'}
                </button>
                <button onClick={() => deleteAnnouncement(a.id)} className="btn btn-ghost" style={{ padding:'4px 8px' }}>
                  <Trash2 size={13} color="var(--red)" />
                </button>
              </div>
            )}
          </div>
          <p style={{ fontSize:'14px', color:'var(--text)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{a.body}</p>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', fontSize:'12px', color:'var(--muted)', paddingTop:'6px', borderTop:'1px solid var(--border)' }}>
            {a.profile?.discord_avatar && <img src={a.profile.discord_avatar} style={{ width:20, height:20, borderRadius:'50%' }} />}
            <span>{a.profile?.discord_username || 'Leadership'}</span>
            <span>•</span>
            <span>{new Date(a.created_at).toLocaleString()}</span>
          </div>
        </div>
      ))}
      <ToastContainer />
    </div>
  )
}