import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { Megaphone, Pin, Trash2, Plus } from 'lucide-react'

export default function Announcements({ session }) {
  const { role, faction, perms } = useRole(session.user.id)
  const [announcements, setAnnouncements] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title:'', body:'', pinned:false })
  const userId = session.user.id

  useEffect(() => { if (faction) load() }, [faction])

  async function load() {
    const { data } = await supabase.from('announcements').select('*, profile:profiles!announcements_created_by_fkey(discord_username, discord_avatar)').eq('faction_id', faction.id).order('pinned', { ascending:false }).order('created_at', { ascending:false })
    setAnnouncements(data || [])
  }

  async function post() {
    if (!form.title.trim() || !form.body.trim()) return
    const { data, error } = await supabase.from('announcements').insert({
      faction_id: faction.id,
      created_by: userId,
      title: form.title,
      body: form.body,
      pinned: form.pinned
    }).select().single()
    if (!error) {
      setAnnouncements(a => [data, ...a])
      setForm({ title:'', body:'', pinned:false })
      setShowForm(false)
      // Notify all members
      const { data: members } = await supabase.from('faction_members').select('user_id').eq('faction_id', faction.id).neq('user_id', userId)
      if (members?.length) {
        await supabase.from('notifications').insert(members.map(m => ({
          faction_id: faction.id,
          user_id: m.user_id,
          type: 'announcement',
          title: `📣 New Announcement: ${form.title}`,
          body: form.body.slice(0, 80) + (form.body.length > 80 ? '...' : '')
        })))
      }
    }
  }

  async function deleteAnnouncement(id) {
    await supabase.from('announcements').delete().eq('id', id)
    setAnnouncements(a => a.filter(x => x.id !== id))
  }

  async function togglePin(id, pinned) {
    await supabase.from('announcements').update({ pinned: !pinned }).eq('id', id)
    setAnnouncements(a => a.map(x => x.id === id ? {...x, pinned: !pinned} : x).sort((a,b) => b.pinned - a.pinned))
  }

  const canPost = role === 'leader' || role === 'co-leader'

  return (
    <div style={{ maxWidth:800, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>ANNOUNCEMENTS</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>Faction-wide messages from leadership</p>
        </div>
        {canPost && (
          <button className="btn btn-green" style={{ display:'flex', alignItems:'center', gap:'8px' }} onClick={() => setShowForm(f => !f)}>
            <Plus size={15} /> Post Announcement
          </button>
        )}
      </div>

      {showForm && canPost && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px', borderColor:'var(--green-dim)' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px' }}>NEW ANNOUNCEMENT</h3>
          <input placeholder="Title..." value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} />
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
          No announcements yet. Leadership will post updates here.
        </div>
      )}

      {announcements.map(a => (
        <div key={a.id} className="card" style={{ display:'flex', flexDirection:'column', gap:'10px', borderLeft: a.pinned ? '3px solid var(--green)' : '3px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', flex:1 }}>
              {a.pinned && <Pin size={14} color="var(--green)" />}
              <h3 style={{ fontSize:'17px', fontWeight:700, color: a.pinned ? 'var(--green)' : 'var(--text)' }}>{a.title}</h3>
            </div>
            {canPost && (
              <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                <button onClick={() => togglePin(a.id, a.pinned)} className="btn btn-ghost" style={{ padding:'4px 8px', fontSize:'11px' }}>
                  {a.pinned ? 'Unpin' : '📌 Pin'}
                </button>
                <button onClick={() => deleteAnnouncement(a.id)} className="btn btn-ghost" style={{ padding:'4px 8px' }}>
                  <Trash2 size={13} color="var(--red)" />
                </button>
              </div>
            )}
          </div>
          <p style={{ fontSize:'14px', color:'var(--text)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{a.body}</p>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', fontSize:'12px', color:'var(--muted)' }}>
            {a.profile?.discord_avatar && <img src={a.profile.discord_avatar} style={{ width:20, height:20, borderRadius:'50%' }} />}
            <span>{a.profile?.discord_username || 'Leadership'}</span>
            <span>•</span>
            <span>{new Date(a.created_at).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  )
}