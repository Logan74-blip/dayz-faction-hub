import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Pin, Edit2, Trash2, Plus, X, Check, Heart } from 'lucide-react'

// Your account ID — only this account can post/edit/delete
const CIDMAN_ID = 'fcc3b272-3d4c-480f-ab10-2474f3a0372f'

const TYPE_OPTIONS = [
  { value:'update', label:'🔧 Update', color:'#60a5fa' },
  { value:'feature', label:'✨ New Feature', color:'var(--green)' },
  { value:'maintenance', label:'⚠️ Maintenance', color:'var(--yellow)' },
  { value:'community', label:'📣 Community', color:'#a78bfa' },
  { value:'urgent', label:'🚨 Urgent', color:'var(--red)' },
]

export default function HubAnnouncements({ session }) {
  const [announcements, setAnnouncements] = useState([])
  const [likes, setLikes] = useState({})
  const [myLikes, setMyLikes] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ title:'', body:'', type:'update' })
  const [saving, setSaving] = useState(false)
  const userId = session.user.id
  const isOwner = userId === OWNER_ID

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data: posts } = await supabase
      .from('hub_announcements')
      .select('*, profile:profiles(discord_username, discord_avatar)')
      .order('pinned', { ascending:false })
      .order('created_at', { ascending:false })

    const { data: likesData } = await supabase
      .from('hub_announcement_likes')
      .select('announcement_id, user_id')

    const likeCounts = {}
    const myLikeSet = new Set()
    likesData?.forEach(l => {
      likeCounts[l.announcement_id] = (likeCounts[l.announcement_id] || 0) + 1
      if (l.user_id === userId) myLikeSet.add(l.announcement_id)
    })

    setAnnouncements(posts || [])
    setLikes(likeCounts)
    setMyLikes(myLikeSet)
    setLoading(false)
  }

  async function save() {
    if (!form.title.trim() || !form.body.trim()) return
    setSaving(true)
    if (editing) {
      await supabase.from('hub_announcements').update({
        title: form.title.trim(),
        body: form.body.trim(),
        type: form.type,
        updated_at: new Date().toISOString()
      }).eq('id', editing)
    } else {
      await supabase.from('hub_announcements').insert({
        title: form.title.trim(),
        body: form.body.trim(),
        type: form.type,
        created_by: userId
      })
    }
    setForm({ title:'', body:'', type:'update' })
    setComposing(false)
    setEditing(null)
    setSaving(false)
    await loadAll()
  }

  async function deletePost(id) {
    if (!window.confirm('Delete this announcement?')) return
    await supabase.from('hub_announcements').delete().eq('id', id)
    setAnnouncements(a => a.filter(x => x.id !== id))
  }

  async function togglePin(id, pinned) {
    await supabase.from('hub_announcements').update({ pinned: !pinned }).eq('id', id)
    setAnnouncements(a => a.map(x => x.id === id ? {...x, pinned: !pinned} : x))
  }

  async function toggleLike(id) {
    if (myLikes.has(id)) {
      await supabase.from('hub_announcement_likes').delete().eq('announcement_id', id).eq('user_id', userId)
      setMyLikes(s => { const n = new Set(s); n.delete(id); return n })
      setLikes(l => ({...l, [id]: Math.max((l[id] || 1) - 1, 0)}))
    } else {
      await supabase.from('hub_announcement_likes').insert({ announcement_id: id, user_id: userId })
      setMyLikes(s => new Set([...s, id]))
      setLikes(l => ({...l, [id]: (l[id] || 0) + 1}))
    }
  }

  function startEdit(post) {
    setEditing(post.id)
    setForm({ title: post.title, body: post.body, type: post.type || 'update' })
    setComposing(true)
    window.scrollTo({ top:0, behavior:'smooth' })
  }

  function cancelCompose() {
    setComposing(false)
    setEditing(null)
    setForm({ title:'', body:'', type:'update' })
  }

  const typeColor = (type) => TYPE_OPTIONS.find(t => t.value === type)?.color || 'var(--green)'
  const typeLabel = (type) => TYPE_OPTIONS.find(t => t.value === type)?.label || '📢 Announcement'

  return (
    <div style={{ maxWidth:800, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>
            ☢️ HUB ANNOUNCEMENTS
          </h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>
            Official updates from the Faction Hub team
          </p>
        </div>
        {isOwner && !composing && (
          <button
            className="btn btn-green"
            style={{ display:'flex', alignItems:'center', gap:'8px' }}
            onClick={() => setComposing(true)}
          >
            <Plus size={14} /> New Announcement
          </button>
        )}
      </div>

      {/* Compose / Edit form — owner only */}
      {isOwner && composing && (
        <div className="card" style={{ borderColor:'var(--green-dim)', display:'flex', flexDirection:'column', gap:'14px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <h3 style={{ fontWeight:700, fontSize:'15px', color:'var(--green)' }}>
              {editing ? '✏️ Edit Announcement' : '📝 New Announcement'}
            </h3>
            <button onClick={cancelCompose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--muted)' }}>
              <X size={16} />
            </button>
          </div>

          {/* Type selector */}
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {TYPE_OPTIONS.map(t => (
              <button key={t.value} onClick={() => setForm(f => ({...f, type:t.value}))}
                style={{
                  background: form.type === t.value ? `${t.color}22` : 'var(--surface)',
                  border: `1px solid ${form.type === t.value ? t.color : 'var(--border)'}`,
                  color: form.type === t.value ? t.color : 'var(--muted)',
                  padding:'4px 12px', borderRadius:'999px', fontSize:'12px', cursor:'pointer', fontWeight:600
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <input
            placeholder="Announcement title..."
            value={form.title}
            onChange={e => setForm(f => ({...f, title:e.target.value}))}
            style={{ fontSize:'16px', fontWeight:600 }}
          />
          <textarea
            placeholder="Write your announcement here. You can use line breaks for formatting."
            value={form.body}
            onChange={e => setForm(f => ({...f, body:e.target.value}))}
            rows={6}
            style={{ lineHeight:1.6 }}
          />
          <div style={{ display:'flex', gap:'8px' }}>
            <button
              className="btn btn-green"
              style={{ display:'flex', alignItems:'center', gap:'6px' }}
              onClick={save}
              disabled={saving || !form.title.trim() || !form.body.trim()}
            >
              <Check size={14} /> {saving ? 'Saving...' : editing ? 'Save Changes' : 'Post Announcement'}
            </button>
            <button className="btn btn-ghost" onClick={cancelCompose}>Cancel</button>
          </div>
        </div>
      )}

      {loading && <div className="page-loading"><div className="spinner" /></div>}

      {!loading && announcements.length === 0 && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'60px 24px' }}>
          <div style={{ fontSize:'48px', marginBottom:'12px' }}>☢️</div>
          <p style={{ fontSize:'15px' }}>No announcements yet.</p>
          <p style={{ fontSize:'13px', marginTop:'6px' }}>Check back for updates, new features and community news.</p>
        </div>
      )}

      {/* Announcements list */}
      {!loading && announcements.map(post => {
        const liked = myLikes.has(post.id)
        const likeCount = likes[post.id] || 0
        const color = typeColor(post.type)
        const label = typeLabel(post.type)

        return (
          <div key={post.id} className="card" style={{
            borderLeft:`4px solid ${color}`,
            display:'flex', flexDirection:'column', gap:'14px',
            background: post.pinned ? '#0d1a0d' : 'var(--surface)'
          }}>
            {/* Post header */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'6px' }}>
                  {post.pinned && (
                    <span style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', color:'var(--green)', fontWeight:700 }}>
                      <Pin size={11} /> PINNED
                    </span>
                  )}
                  <span style={{ fontSize:'12px', color:color, fontWeight:700, background:`${color}22`, padding:'2px 8px', borderRadius:'999px' }}>
                    {label}
                  </span>
                </div>
                <h2 style={{ fontFamily:'Share Tech Mono', fontSize:'18px', color:'var(--text)', margin:0, lineHeight:1.3 }}>
                  {post.title}
                </h2>
              </div>

              {/* Owner controls */}
              {isOwner && (
                <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
                  <button
                    onClick={() => togglePin(post.id, post.pinned)}
                    className="btn btn-ghost"
                    style={{ padding:'4px 8px', fontSize:'11px', color: post.pinned ? 'var(--green)' : 'var(--muted)' }}
                    title={post.pinned ? 'Unpin' : 'Pin'}
                  >
                    <Pin size={12} />
                  </button>
                  <button onClick={() => startEdit(post)} className="btn btn-ghost" style={{ padding:'4px 8px' }}>
                    <Edit2 size={12} />
                  </button>
                  <button onClick={() => deletePost(post.id)} className="btn btn-ghost" style={{ padding:'4px 8px', color:'var(--red)' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* Body */}
            <div style={{ fontSize:'14px', lineHeight:1.8, color:'var(--text)', whiteSpace:'pre-wrap' }}>
              {post.body}
            </div>

            {/* Footer */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px', paddingTop:'8px', borderTop:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                {post.profile?.discord_avatar && (
                  <img src={post.profile.discord_avatar} style={{ width:22, height:22, borderRadius:'50%', border:'1px solid var(--border)' }} />
                )}
                <span style={{ fontSize:'12px', color:'var(--muted)' }}>
                  Posted by <strong style={{ color:'var(--green)' }}>{post.profile?.discord_username || 'CIDMAN420'}</strong>
                </span>
                <span style={{ fontSize:'12px', color:'var(--muted)' }}>
                  {new Date(post.created_at).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })}
                </span>
                {post.updated_at !== post.created_at && (
                  <span style={{ fontSize:'11px', color:'var(--muted)', fontStyle:'italic' }}>edited</span>
                )}
              </div>

              {/* Like button */}
              <button
                onClick={() => toggleLike(post.id)}
                style={{
                  background: liked ? '#450a0a' : 'transparent',
                  border: `1px solid ${liked ? 'var(--red)' : 'var(--border)'}`,
                  color: liked ? 'var(--red)' : 'var(--muted)',
                  borderRadius:'999px', padding:'4px 12px', cursor:'pointer',
                  display:'flex', alignItems:'center', gap:'6px',
                  fontSize:'13px', fontWeight:600, transition:'all 0.15s'
                }}
              >
                <Heart size={13} fill={liked ? 'var(--red)' : 'none'} />
                {likeCount > 0 ? likeCount : ''} {liked ? 'Liked' : 'Like'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}