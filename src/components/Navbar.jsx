import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Map, Package, Shield, LayoutDashboard, LogOut } from 'lucide-react'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/map', label: 'War Map', icon: Map },
  { to: '/resources', label: 'Resources', icon: Package },
  { to: '/diplomacy', label: 'Diplomacy', icon: Shield },
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
      padding: '0 24px',
      height: '56px',
      gap: '8px',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <span style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'18px', marginRight:'24px', letterSpacing:'0.1em' }}>
        ☢ FACTION HUB
      </span>

      {links.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to==='/'} style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 14px', borderRadius: '4px', fontSize: '14px', fontWeight: 600,
          color: isActive ? 'var(--green)' : 'var(--muted)',
          background: isActive ? '#14532d33' : 'transparent',
          transition: 'all 0.15s'
        })}>
          <Icon size={15} /> {label}
        </NavLink>
      ))}

      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'12px' }}>
        {avatar && <img src={avatar} style={{ width:28, height:28, borderRadius:'50%', border:'1px solid var(--border)' }} />}
        <span style={{ fontSize:'13px', color:'var(--muted)' }}>{name}</span>
        <button onClick={logout} className="btn btn-ghost" style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px', padding:'5px 12px' }}>
          <LogOut size={14} /> Logout
        </button>
      </div>
    </nav>
  )
}