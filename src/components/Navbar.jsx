import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { LayoutDashboard, Map, Sword, ShoppingBag, Shield, Globe, Settings, Bell, LogOut, ChevronDown, Flame, MessageSquare, Network, Calendar, Trophy, Swords, UserPlus, Star, Coins, Package, Target, Megaphone, Activity, Palette, Menu, X, Archive } from 'lucide-react'
import { LayoutDashboard, Map, Sword, ShoppingBag, Shield, Globe, Settings, Bell, LogOut, ChevronDown, Flame, MessageSquare, Network, Calendar, Trophy, Swords, UserPlus, Star, Coins, Package, Target, Megaphone, Activity, Palette, Menu, X, Archive, HelpCircle } from 'lucide-react'

const NAV_GROUPS = [
  { label:'Home', icon:LayoutDashboard, to:'/', single:true },
  { label:'Hub', icon:Megaphone, to:'/hub', single:true },
{ label:'Help', icon:HelpCircle, to:'/help', single:true },
  {
    label:'Operations', icon:Sword,
    children:[
      { to:'/raids', label:'Raids', icon:Sword },
      { to:'/warroom', label:'War Room', icon:Flame },
      { to:'/bounties', label:'Bounties', icon:Target },
      { to:'/map', label:'War Map', icon:Map },
      { to:'/versus', label:'F vs F', icon:Swords },
    ]
  },
  {
    label:'Economy', icon:ShoppingBag,
    children:[
      { to:'/trading', label:'Trading Post', icon:ShoppingBag },
      { to:'/treasury', label:'Treasury', icon:Coins },
      { to:'/resources', label:'Resources', icon:Package },
    ]
  },
  {
    label:'Diplomacy', icon:Shield,
    children:[
      { to:'/diplomacy', label:'Diplomacy Board', icon:Shield },
      { to:'/messages', label:'Messages', icon:MessageSquare },
      { to:'/alliance-network', label:'Alliance Network', icon:Network },
    ]
  },
  {
  label:'Intel', icon:Activity,
  children:[
    { to:'/announcements', label:'Announcements', icon:Megaphone },
    { to:'/eventlog', label:'Event Log', icon:Activity },
    { to:'/server-calendar', label:'Server Events', icon:Calendar },
    { to:'/faction-logs', label:'Faction Logs', icon:Archive },
  ]
},
  {
  label:'Community', icon:Globe,
  children:[
    { to:'/directory', label:'Directory', icon:Globe },
    { to:'/leaderboard', label:'Leaderboard', icon:Trophy },
    { to:'/join-requests', label:'Join Requests', icon:UserPlus },
    { to:'/achievements', label:'Achievements', icon:Star },
    { to:'/dead-factions', label:'Dead Factions', icon:Archive },
  ]
},
  {
    label:'Settings', icon:Settings,
    children:[
      { to:'/settings', label:'Faction Settings', icon:Settings },
      { to:'/customize', label:'Customize', icon:Palette },
      { to:'/admin', label:'Admin Dashboard', icon:Shield },
    ]
  },
]

export default function Navbar({ session }) {
  const navigate = useNavigate()
  const location = useLocation()
  const avatar = session?.user?.user_metadata?.avatar_url
  const name = session?.user?.user_metadata?.full_name || session?.user?.email
  const [notifications, setNotifications] = useState([])
  const [showBell, setShowBell] = useState(false)
  const [openGroup, setOpenGroup] = useState(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const bellRef = useRef(null)
  const navRef = useRef(null)
  const userId = session.user.id

  useEffect(() => {
    loadNotifications()
    loadUnreadMessages()
    saveProfile()
    const channel = supabase.channel('notif_' + userId)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'notifications', filter:`user_id=eq.${userId}` },
        payload => setNotifications(n => [payload.new, ...n])
      ).subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth <= 768) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    function handleClick(e) {
      if (!bellRef.current?.contains(e.target) && !navRef.current?.contains(e.target)) {
        setShowBell(false)
        setOpenGroup(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    setOpenGroup(null)
    setMobileOpen(false)
  }, [location])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  async function saveProfile() {
    const meta = session.user.user_metadata
    await supabase.from('profiles').upsert({
      id: userId,
      discord_username: meta?.full_name || meta?.name || meta?.user_name || 'Unknown',
      discord_avatar: meta?.avatar_url || null,
      updated_at: new Date().toISOString()
    }, { onConflict:'id' })
  }

  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending:false })
      .limit(20)
    setNotifications(data || [])
  }

  async function loadUnreadMessages() {
    const { data: mem } = await supabase
      .from('faction_members')
      .select('faction_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (!mem) return
    const { count } = await supabase
      .from('faction_messages')
      .select('id', { count:'exact' })
      .eq('to_faction_id', mem.faction_id)
      .eq('read', false)
    setUnreadMessages(count || 0)
  }

  async function markRead(id) {
    await supabase.from('notifications').update({ read:true }).eq('id', id)
    setNotifications(n => n.map(x => x.id === id ? {...x, read:true} : x))
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read:true }).eq('user_id', userId).eq('read', false)
    setNotifications(n => n.map(x => ({...x, read:true})))
  }

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const unread = notifications.filter(n => !n.read).length
  const typeIcon = { raid:'⚔️', diplomacy:'🤝', member:'👤', war:'💀', general:'📢', bounty:'🎯', trade:'🛒', announcement:'📣' }

  function isGroupActive(group) {
    if (group.single) return location.pathname === group.to
    return group.children?.some(c => location.pathname === c.to)
  }

  return (
    <>
      <nav ref={navRef} style={{
        background:'var(--surface)', borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', padding:'0 16px',
        height:'56px', position:'sticky', top:0, zIndex:100, gap:'2px'
      }}>
        {/* Logo */}
        <span onClick={() => navigate('/')} style={{
          fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'15px',
          marginRight:'12px', letterSpacing:'0.1em', whiteSpace:'nowrap',
          cursor:'pointer', flexShrink:0
        }}>
          ☢️ FACTION HUB
        </span>

        {/* Desktop nav */}
        {!isMobile && (
          <div style={{ display:'flex', gap:'2px', flex:1 }}>
            {NAV_GROUPS.map(group => {
              const active = isGroupActive(group)
              const Icon = group.icon
              const isOpen = openGroup === group.label

              if (group.single) {
                return (
                  <NavLink key={group.to} to={group.to} end style={({ isActive }) => ({
                    display:'flex', alignItems:'center', gap:'5px', padding:'6px 10px',
                    borderRadius:'4px', fontSize:'12px', fontWeight:600, textDecoration:'none',
                    color: isActive ? 'var(--green)' : 'var(--muted)',
                    background: isActive ? '#14532d33' : 'transparent', whiteSpace:'nowrap'
                  })}>
                    <Icon size={13} /> {group.label}
                  </NavLink>
                )
              }

              return (
                <div key={group.label} style={{ position:'relative' }}>
                  <button
                    onClick={() => setOpenGroup(isOpen ? null : group.label)}
                    style={{
                      display:'flex', alignItems:'center', gap:'5px', padding:'6px 10px',
                      borderRadius:'4px', fontSize:'12px', fontWeight:600, cursor:'pointer',
                      color: active || isOpen ? 'var(--green)' : 'var(--muted)',
                      background: active || isOpen ? '#14532d33' : 'transparent',
                      border:'none', whiteSpace:'nowrap', transition:'all 0.15s'
                    }}
                  >
                    <Icon size={13} />
                    {group.label}
                    {group.label === 'Diplomacy' && unreadMessages > 0 && (
                      <span style={{ background:'var(--red)', color:'#fff', borderRadius:'999px', fontSize:'9px', padding:'1px 5px', fontWeight:700 }}>
                        {unreadMessages}
                      </span>
                    )}
                    <ChevronDown size={11} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }} />
                  </button>

                  {isOpen && (
                    <div style={{
                      position:'absolute', top:'calc(100% + 4px)', left:0,
                      background:'var(--surface)', border:'1px solid var(--border)',
                      borderRadius:'8px', zIndex:200, minWidth:'180px',
                      boxShadow:'0 8px 32px #00000088', padding:'6px',
                      display:'flex', flexDirection:'column', gap:'2px'
                    }}>
                      {group.children.map(({ to, label, icon: CIcon }) => (
                        <NavLink key={to} to={to} style={({ isActive }) => ({
                          display:'flex', alignItems:'center', gap:'8px', padding:'8px 12px',
                          borderRadius:'6px', fontSize:'13px', fontWeight:600, textDecoration:'none',
                          color: isActive ? 'var(--green)' : 'var(--text)',
                          background: isActive ? '#14532d33' : 'transparent',
                        })}
                          onMouseEnter={e => e.currentTarget.style.background = '#1a2e1a'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}
                        >
                          <CIcon size={14} />
                          {label}
                          {label === 'Messages' && unreadMessages > 0 && (
                            <span style={{ background:'var(--red)', color:'#fff', borderRadius:'999px', fontSize:'9px', padding:'1px 5px', marginLeft:'auto' }}>
                              {unreadMessages}
                            </span>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Spacer on mobile */}
        {isMobile && <div style={{ flex:1 }} />}

        {/* Right side */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>

          {/* Bell */}
          <div ref={bellRef} style={{ position:'relative' }}>
            <button
              onClick={() => { setShowBell(s => !s); setOpenGroup(null); setMobileOpen(false) }}
              style={{
                background:'transparent', border:'none',
                color: unread > 0 ? 'var(--green)' : 'var(--muted)',
                cursor:'pointer', padding:'6px', position:'relative', display:'flex', alignItems:'center'
              }}
            >
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
                  {unread > 0 && (
                    <button onClick={markAllRead} style={{ background:'transparent', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'11px' }}>
                      Mark all read
                    </button>
                  )}
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

          {/* Desktop user info */}
          {!isMobile && (
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              {avatar && (
                <img src={avatar} style={{ width:26, height:26, borderRadius:'50%', border:'1px solid var(--border)', flexShrink:0 }} />
              )}
              <span style={{ fontSize:'11px', color:'var(--muted)', whiteSpace:'nowrap', maxWidth:'80px', overflow:'hidden', textOverflow:'ellipsis' }}>
                {name}
              </span>
              <button onClick={logout} className="btn btn-ghost" style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', padding:'4px 8px', flexShrink:0 }}>
                <LogOut size={12} /> Out
              </button>
            </div>
          )}

          {/* Mobile hamburger */}
          {isMobile && (
            <button
              onClick={() => { setMobileOpen(o => !o); setShowBell(false); setOpenGroup(null) }}
              style={{ background:'transparent', border:'none', color:'var(--text)', padding:'6px', display:'flex', alignItems:'center', cursor:'pointer' }}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMobile && mobileOpen && (
        <div style={{
          position:'fixed', top:'56px', left:0, right:0, bottom:0,
          background:'var(--surface)', zIndex:99, overflowY:'auto',
          padding:'16px', display:'flex', flexDirection:'column', gap:'4px',
          borderTop:'1px solid var(--border)'
        }}>
          {/* User info + logout */}
          <div style={{ display:'flex', flexDirection:'column', gap:'8px', padding:'12px', background:'var(--bg)', borderRadius:'8px', marginBottom:'8px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              {avatar
                ? <img src={avatar} style={{ width:40, height:40, borderRadius:'50%', border:'1px solid var(--border)', flexShrink:0 }} />
                : <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--border)', flexShrink:0 }} />
              }
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:'15px' }}>{name}</div>
                <div style={{ fontSize:'12px', color:'var(--muted)' }}>Discord Account</div>
              </div>
            </div>
            <button onClick={logout} className="btn btn-ghost" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', fontSize:'13px', padding:'8px', color:'var(--red)', borderColor:'#b91c1c44', width:'100%' }}>
              <LogOut size={14} /> Sign Out
            </button>
          </div>

          {/* Nav links */}
          {NAV_GROUPS.map(group => {
            if (group.single) {
              return (
                <NavLink key={group.to} to={group.to} end style={({ isActive }) => ({
                  display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px',
                  borderRadius:'6px', color: isActive ? 'var(--green)' : 'var(--text)',
                  background: isActive ? '#14532d33' : 'transparent',
                  fontSize:'15px', fontWeight:600, textDecoration:'none'
                })}>
                  <group.icon size={16} /> {group.label}
                </NavLink>
              )
            }
            return (
              <div key={group.label}>
                <div style={{ fontFamily:'Share Tech Mono', fontSize:'11px', color:'var(--muted)', letterSpacing:'0.1em', padding:'10px 8px 4px', borderTop:'1px solid var(--border)', marginTop:'6px' }}>
                  {group.label}
                </div>
                {group.children.map(({ to, label, icon: CIcon }) => (
                  <NavLink key={to} to={to} style={({ isActive }) => ({
                    display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px',
                    borderRadius:'6px', color: isActive ? 'var(--green)' : 'var(--text)',
                    background: isActive ? '#14532d33' : 'transparent',
                    fontSize:'15px', fontWeight:600, textDecoration:'none'
                  })}>
                    <CIcon size={16} />
                    {label}
                    {label === 'Messages' && unreadMessages > 0 && (
                      <span style={{ background:'var(--red)', color:'#fff', borderRadius:'999px', fontSize:'10px', padding:'1px 6px', marginLeft:'auto' }}>
                        {unreadMessages}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}