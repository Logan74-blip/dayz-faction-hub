import { supabase } from '../supabaseClient'

export default function Login() {
  async function loginWithDiscord() {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.origin }
    })
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '32px',
      background: 'radial-gradient(ellipse at center, #0d1f0d 0%, #0a0c0a 70%)'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily:'Share Tech Mono', fontSize:'48px', color:'var(--green)', letterSpacing:'0.15em' }}>☢</div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'32px', color:'var(--green)', letterSpacing:'0.1em', marginTop:'8px' }}>
          FACTION HUB
        </h1>
        <p style={{ color:'var(--muted)', marginTop:'8px', fontSize:'15px' }}>DayZ Faction Management System</p>
      </div>

      <div className="card" style={{ width:'360px', textAlign:'center', display:'flex', flexDirection:'column', gap:'20px' }}>
        <div>
          <h2 style={{ fontSize:'20px', fontWeight:700 }}>Sign In</h2>
          <p style={{ color:'var(--muted)', fontSize:'14px', marginTop:'4px' }}>Use your Discord account to access your faction</p>
        </div>
        <button
          onClick={loginWithDiscord}
          className="btn"
          style={{ background:'#5865F2', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', padding:'12px', fontSize:'16px' }}
        >
          <svg width="20" height="20" viewBox="0 0 127.14 96.36" fill="#fff">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
          </svg>
          Login with Discord
        </button>
        <p style={{ fontSize:'12px', color:'var(--muted)' }}>Your Discord identity is used only for authentication</p>
      </div>
    </div>
  )
}