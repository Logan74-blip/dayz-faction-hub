import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Map, Package, Shield, LayoutDashboard, LogOut, Sword, Settings, Globe } from 'lucide-react'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/map', label: 'War Map', icon: Map },
  { to: '/raids', label: 'Raids', icon: Sword },
  { to: '/resources', label: 'Resources', icon: Package },
  { to: '/diplomacy', label: 'Diplomacy', icon: Shield },
  { to: '/directory', label: 'Directory', icon: Globe },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Navbar({ session }) {
  const navigate = useNavigate()
  const avatar = session?.user?.user_metadata?.avatar_url
  const name = session?.user?.user_metadata?.full_name || session?.user?.email

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <nav style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      height: '56px',
      gap: '2px',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <span style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'16px', marginRight:'12px', letterSpacing:'0.1em', whiteSpace:'nowrap' }}>
        ☢ FACTION HUB
      </span>
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to==='/'} style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '6px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
          color: isActive ? 'var(--green)' : 'var(--muted)',
          background: isActive ? '#14532d33' : 'transparent',
          transition: 'all 0.15s', whiteSpace: 'nowrap'
        })}>
          <Icon size={13} /> {label}
        </NavLink>
      ))}
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'10px' }}>
        {avatar && <img src={avatar} style={{ width:26, height:26, borderRadius:'50%', border:'1px solid var(--border)' }} />}
        <span style={{ fontSize:'12px', color:'var(--muted)', whiteSpace:'nowrap' }}>{name}</span>
        <button onClick={logout} className="btn btn-ghost" style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'12px', padding:'4px 10px' }}>
          <LogOut size={13} /> Logout
        </button>
      </div>
    </nav>
  )
}