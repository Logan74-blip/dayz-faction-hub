import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Map, Package, Shield, LayoutDashboard, LogOut, Sword, Swords, Settings, Globe, Bell, Megaphone, Trophy, ShoppingBag, Target, Activity, Star, UserPlus, MessageSquare, Flame, Network, Calendar, Coins } from 'lucide-react'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/map', label: 'War Map', icon: Map },
  { to: '/raids', label: 'Raids', icon: Sword },
  { to: '/warroom', label: 'War Room', icon: Flame },
  { to: '/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/eventlog', label: 'Event Log', icon: Activity },
  { to: '/bounties', label: 'Bounties', icon: Target },
  { to: '/trading', label: 'Trading', icon: ShoppingBag },
  { to: '/treasury', label: 'Treasury', icon: Coins },
  { to: '/resources', label: 'Resources', icon: Package },
  { to: '/diplomacy', label: 'Diplomacy', icon: Shield },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/alliance-network', label: 'Alliances', icon: Network },
  { to: '/server-calendar', label: 'Server Events', icon: Calendar },
  { to: '/achievements', label: 'Achievements', icon: Star },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/versus', label: 'F vs F', icon: Swords },
  { to: '/directory', label: 'Directory', icon: Globe },
  { to: '/join-requests', label: 'Join Requests', icon: UserPlus },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Navbar({ session }) {
  const navigate = useNavigate()
  const avatar = session?.user?.user_metadata?.avatar_url
  const [notifications, setNotifications] = useState([])
  const [showBell, setShowBell] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const bellRef = useRef(null)
  const userId = session.user.id

  useEffect(() => {
    loadNotifications()
    loadUnreadMessages()
    saveProfile()
    const channel = supabase.channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        payload => setNotifications(n => [payload.new, ...n])
      ).subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => {
    function handleClick(e) { if (!bellRef.current?.contains(e.target)) setShowBell(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function saveProfile() {
    const meta = session.user.user_metadata
    await supabase.from('profiles').upsert({
      id: userId,
      discord_username: meta?.full_name || meta?.name || 'Unknown',
      discord_avatar: meta?.avatar_url || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })
  }

  async function loadNotifications() {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
    setNotifications(data || [])
  }

  async function loadUnreadMessages() {
    const { data: mem } = await supabase.from('faction_members').select('faction_id').eq('user_id', userId).maybeSingle()
    if (!mem) return
    const { count } = await supabase.from('faction_messages').select('id', { count:'exact' }).eq('to_faction_id', mem.faction_id).eq('read', false)
    setUnreadMessages(count || 0)
  }

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(n => n.map(x => x.id === id ? {...x, read: true} : x))
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
    setNotifications(n => n.map(x => ({...x, read: true})))
  }

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const unread = notifications.filter(n => !n.read).length
  const typeIcon = { raid:'⚔️', diplomacy:'🤝', member:'👤', war:'💀', general:'📢', bounty:'🎯', trade:'🛒', announcement:'📣' }

  return (
    <>
      <nav style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 16px',
        height: '56px', position: 'sticky', top: 0, zIndex: 100,
        gap: '2px', overflowX: 'auto'
      }}>
        <span style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'16px', marginRight:'8px', letterSpacing:'0.1em', whiteSpace:'nowrap', flexShrink:0 }}>
          ☢ FACTION HUB
        </span>

        <div style={{ display:'flex', gap:'1px', overflowX:'auto', flex:1 }} className="hide-scrollbar">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to==='/'} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '6px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
              color: isActive ? 'var(--green)' : 'var(--muted)',
              background: isActive ? '#14532d33' : 'transparent',
              transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0,
              textDecoration: 'none', position: 'relative'
            })}>
              <Icon size={12} />
              {label}
              {to === '/messages' && unreadMessages > 0 && (
                <span style={{ background:'var(--red)', color:'#fff', borderRadius:'999px', fontSize:'9px', padding:'1px 5px', fontWeight:700 }}>
                  {unreadMessages}
                </span>
              )}
            </NavLink>
          ))}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0, marginLeft:'8px' }}>
          <div ref={bellRef} style={{ position:'relative' }}>
            <button onClick={() => setShowBell(s => !s)} style={{
              background:'transparent', border:'none', color: unread > 0 ? 'var(--green)' : 'var(--muted)',
              cursor:'pointer', padding:'6px', position:'relative', display:'flex', alignItems:'center'
            }}>
              <Bell size={17} />
              {unread > 0 && (
                <span style={{
                  position:'absolute', top:'1px', right:'1px',
                  background:'var(--red)', color:'#fff', borderRadius:'50%',
                  width:'14px', height:'14px', fontSize:'9px', fontWeight:700,
                  display:'flex', alignItems:'center', justifyContent:'center'
                }}>{unread > 9 ? '9+' : unread}</span>
              )}
            </button>

            {showBell && (
              <div style={{
                position:'absolute', top:'calc(100% + 8px)', right:0,
                width:'300px', background:'var(--surface)', border:'1px solid var(--border)',
                borderRadius:'8px', zIndex:200, boxShadow:'0 8px 32px #00000088',
                maxHeight:'380px', display:'flex', flexDirection:'column'
              }}>
                <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'12px' }}>NOTIFICATIONS</span>
                  {unread > 0 && <button onClick={markAllRead} style={{ background:'transparent', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'11px' }}>Mark all read</button>}
                </div>
                <div style={{ overflowY:'auto', flex:1 }}>
                  {notifications.length === 0 && (
                    <p style={{ padding:'20px', textAlign:'center', color:'var(--muted)', fontSize:'13px' }}>No notifications yet</p>
                  )}
                  {notifications.map(n => (
                    <div key={n.id} onClick={() => markRead(n.id)} style={{
                      padding:'10px 14px', borderBottom:'1px solid var(--border)', cursor:'pointer',
                      background: n.read ? 'transparent' : '#14532d22',
                      display:'flex', gap:'8px', alignItems:'flex-start'
                    }}>
                      <span style={{ fontSize:'16px', flexShrink:0 }}>{typeIcon[n.type] || '📢'}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'12px', fontWeight:600, color: n.read ? 'var(--muted)' : 'var(--text)' }}>{n.title}</div>
                        {n.body && <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>{n.body}</div>}
                        <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'3px' }}>{new Date(n.created_at).toLocaleString()}</div>
                      </div>
                      {!n.read && <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:'var(--green)', flexShrink:0, marginTop:'3px' }} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {avatar && <img src={avatar} style={{ width:24, height:24, borderRadius:'50%', border:'1px solid var(--border)', flexShrink:0 }} />}
          <button onClick={logout} className="btn btn-ghost" style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', padding:'4px 8px', flexShrink:0 }}>
            <LogOut size={12} /> Out
          </button>
        </div>
      </nav>
      <style>{`.hide-scrollbar::-webkit-scrollbar{display:none}.hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
    </>
  )
}