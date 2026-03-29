import { supabase } from '../supabaseClient'

const FEATURES = [
  { icon:'⚔️', title:'Raid Planner', desc:'Schedule operations, track RSVPs and log debriefs with outcome ratings' },
  { icon:'🗺️', title:'War Map', desc:'Drop markers on Chernarus, Livonia and Sakhal with satellite and topo views' },
  { icon:'💀', title:'War Room', desc:'Track active wars, log engagements and declare victory or defeat' },
  { icon:'🎯', title:'Bounty Board', desc:'Post bounties on enemies with rewards. Members claim and complete them' },
  { icon:'📦', title:'Resource Stockpile', desc:'Track your gear with auto-stacking and an OCR screenshot scanner' },
  { icon:'🤝', title:'Diplomacy Board', desc:'Send NAPs, declare war and form trade agreements with other factions' },
  { icon:'💰', title:'Treasury', desc:'Log deposits and withdrawals to track your faction wealth' },
  { icon:'🛒', title:'Trading Post', desc:'Post gear offers and requests. Other factions send counter-offers' },
  { icon:'📣', title:'Announcements', desc:'Leadership posts faction-wide updates with pinning and notifications' },
  { icon:'🏆', title:'Leaderboard', desc:'Compete across all factions in members, territories, raids and bounties' },
  { icon:'🌐', title:'Server Directory', desc:'Browse all factions grouped by server. Apply to recruiting factions' },
  { icon:'🤖', title:'Discord Bot', desc:'7 slash commands to check your faction stats without leaving Discord' },
]

const STATS = [
  { value:'24+', label:'Features' },
  { value:'3', label:'DayZ Maps' },
  { value:'7', label:'Bot Commands' },
  { value:'Free', label:'Always' },
]

export default function Login() {
  async function loginWithDiscord() {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.origin }
    })
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', overflowX:'hidden' }}>

      {/* Hero */}
      <div style={{
        minHeight:'100vh', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', gap:'40px',
        background:'radial-gradient(ellipse at 50% 0%, #0d3320 0%, #0a0c0a 60%)',
        padding:'40px 24px', position:'relative', overflow:'hidden'
      }}>
        {/* Background grid effect */}
        <div style={{
          position:'absolute', inset:0, opacity:0.03,
          backgroundImage:'linear-gradient(var(--green) 1px, transparent 1px), linear-gradient(90deg, var(--green) 1px, transparent 1px)',
          backgroundSize:'40px 40px'
        }} />

        {/* Logo */}
        <div style={{ textAlign:'center', position:'relative', zIndex:1 }}>
          <div style={{ fontFamily:'Share Tech Mono', fontSize:'72px', color:'var(--green)', lineHeight:1, marginBottom:'8px', filter:'drop-shadow(0 0 30px #4ade8044)' }}>
            ☢️
          </div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'clamp(32px, 8vw, 56px)', color:'var(--green)', letterSpacing:'0.15em', lineHeight:1.1, filter:'drop-shadow(0 0 20px #4ade8033)' }}>
            FACTION HUB
          </h1>
          <p style={{ color:'var(--muted)', marginTop:'12px', fontSize:'clamp(14px, 3vw, 18px)', letterSpacing:'0.05em' }}>
            THE COMPLETE DAYZ FACTION MANAGEMENT PLATFORM
          </p>
        </div>

        {/* CTA */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'16px', position:'relative', zIndex:1 }}>
          <button
            onClick={loginWithDiscord}
            style={{
              background:'#5865F2', color:'#fff', border:'none', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:'12px',
              padding:'16px 40px', fontSize:'18px', fontWeight:700, borderRadius:'8px',
              fontFamily:'Rajdhani', letterSpacing:'0.05em',
              boxShadow:'0 0 40px #5865F244', transition:'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <svg width="22" height="22" viewBox="0 0 127.14 96.36" fill="#fff">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
            </svg>
            Get Started Free with Discord
          </button>
          <p style={{ fontSize:'13px', color:'var(--muted)' }}>
            No signup required — just log in with Discord and create your faction
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display:'flex', gap:'clamp(16px, 4vw, 48px)', position:'relative', zIndex:1, flexWrap:'wrap', justifyContent:'center' }}>
          {STATS.map(s => (
            <div key={s.label} style={{ textAlign:'center' }}>
              <div style={{ fontFamily:'Share Tech Mono', fontSize:'clamp(24px, 5vw, 36px)', color:'var(--green)' }}>{s.value}</div>
              <div style={{ fontSize:'12px', color:'var(--muted)', letterSpacing:'0.1em', marginTop:'2px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Scroll indicator */}
        <div style={{ position:'absolute', bottom:'32px', left:'50%', transform:'translateX(-50%)', color:'var(--muted)', fontSize:'12px', display:'flex', flexDirection:'column', alignItems:'center', gap:'6px', animation:'bounce 2s infinite' }}>
          <span style={{ letterSpacing:'0.1em', fontFamily:'Share Tech Mono' }}>SCROLL</span>
          <span style={{ fontSize:'18px' }}>↓</span>
        </div>
      </div>

      {/* Features grid */}
      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'80px 24px' }}>
        <div style={{ textAlign:'center', marginBottom:'48px' }}>
          <h2 style={{ fontFamily:'Share Tech Mono', fontSize:'clamp(20px, 4vw, 28px)', color:'var(--green)', letterSpacing:'0.1em' }}>
            EVERYTHING YOUR FACTION NEEDS
          </h2>
          <p style={{ color:'var(--muted)', marginTop:'8px', fontSize:'15px' }}>
            Built by a DayZ player for DayZ factions
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'16px' }}>
          {FEATURES.map(f => (
            <div key={f.title} className="card" style={{ display:'flex', gap:'14px', alignItems:'flex-start', transition:'border-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--green-dim)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <span style={{ fontSize:'28px', flexShrink:0 }}>{f.icon}</span>
              <div>
                <div style={{ fontWeight:700, fontSize:'15px', marginBottom:'4px' }}>{f.title}</div>
                <div style={{ fontSize:'13px', color:'var(--muted)', lineHeight:1.5 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div style={{ background:'var(--surface)', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)', padding:'80px 24px' }}>
        <div style={{ maxWidth:'800px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'48px' }}>
          <div style={{ textAlign:'center' }}>
            <h2 style={{ fontFamily:'Share Tech Mono', fontSize:'clamp(20px, 4vw, 28px)', color:'var(--green)', letterSpacing:'0.1em' }}>
              HOW IT WORKS
            </h2>
            <p style={{ color:'var(--muted)', marginTop:'8px', fontSize:'15px' }}>Up and running in under 2 minutes</p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'24px' }}>
            {[
              { step:'01', title:'Login with Discord', desc:'No forms or passwords. Just click login and authorise with your Discord account.' },
              { step:'02', title:'Create Your Faction', desc:'Name it, set your tag, pick a color and flag. Takes 30 seconds.' },
              { step:'03', title:'Invite Your Crew', desc:'Generate an invite link and share it in your Discord. Members join instantly.' },
              { step:'04', title:'Start Managing', desc:'Plan raids, track resources, send diplomacy and monitor your faction from one place.' },
            ].map(s => (
              <div key={s.step} style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                <div style={{ fontFamily:'Share Tech Mono', fontSize:'36px', color:'var(--green-dim)', opacity:0.5 }}>{s.step}</div>
                <div style={{ fontWeight:700, fontSize:'16px' }}>{s.title}</div>
                <div style={{ fontSize:'13px', color:'var(--muted)', lineHeight:1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Discord bot section */}
      <div style={{ maxWidth:'800px', margin:'0 auto', padding:'80px 24px' }}>
        <div className="card" style={{ borderColor:'var(--green-dim)', padding:'40px', display:'flex', flexDirection:'column', gap:'20px', alignItems:'center', textAlign:'center' }}>
          <div style={{ fontSize:'48px' }}>🤖</div>
          <h2 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>DISCORD BOT INCLUDED</h2>
          <p style={{ color:'var(--muted)', fontSize:'15px', maxWidth:'500px', lineHeight:1.6 }}>
            Add the Faction Hub bot to your Discord server. Use slash commands to check your faction stats, raids, bounties and more without ever leaving Discord.
          </p>
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', justifyContent:'center' }}>
            {['/faction', '/raids', '/bounties', '/treasury', '/diplomacy', '/members', '/war'].map(cmd => (
              <code key={cmd} style={{ background:'#0d1a0d', border:'1px solid var(--border)', padding:'6px 12px', borderRadius:'4px', fontSize:'14px', color:'var(--green)', fontFamily:'Share Tech Mono' }}>
                {cmd}
              </code>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div style={{
        background:'radial-gradient(ellipse at 50% 100%, #0d3320 0%, #0a0c0a 60%)',
        padding:'80px 24px', textAlign:'center',
        borderTop:'1px solid var(--border)',
        display:'flex', flexDirection:'column', alignItems:'center', gap:'24px'
      }}>
        <h2 style={{ fontFamily:'Share Tech Mono', fontSize:'clamp(24px, 5vw, 36px)', color:'var(--green)', letterSpacing:'0.1em' }}>
          READY TO TAKE COMMAND?
        </h2>
        <p style={{ color:'var(--muted)', fontSize:'15px', maxWidth:'400px', lineHeight:1.6 }}>
          Join the platform built specifically for DayZ faction leaders who take their game seriously.
        </p>
        <button
          onClick={loginWithDiscord}
          style={{
            background:'#5865F2', color:'#fff', border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', gap:'12px',
            padding:'16px 40px', fontSize:'18px', fontWeight:700, borderRadius:'8px',
            fontFamily:'Rajdhani', letterSpacing:'0.05em',
            boxShadow:'0 0 40px #5865F244', transition:'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <svg width="22" height="22" viewBox="0 0 127.14 96.36" fill="#fff">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
          </svg>
          Login with Discord — It's Free
        </button>
        <p style={{ fontSize:'12px', color:'var(--muted)' }}>
          ☢️ Faction Hub is free and always will be
        </p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(8px); }
        }
      `}</style>
    </div>
  )
}