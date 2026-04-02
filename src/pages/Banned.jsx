// src/pages/Banned.jsx
const DISCORD_LINK = 'https://discord.gg/qcGJKnqE'

export default function Banned({ reason }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '24px', background: 'var(--bg)'
    }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>

        <div style={{ fontSize: '64px' }}>☢️</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h1 style={{
            fontFamily: 'Share Tech Mono', fontSize: '28px',
            color: 'var(--red)', letterSpacing: '0.1em'
          }}>
            ACCESS REVOKED
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '15px', lineHeight: 1.6 }}>
            Your account has been banned from Faction Hub.
          </p>
          {reason && (
            <div style={{
              background: '#450a0a33', border: '1px solid var(--red)',
              borderRadius: '8px', padding: '12px 16px', marginTop: '8px'
            }}>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Reason:</p>
              <p style={{ fontSize: '14px', color: 'var(--text)', marginTop: '4px', fontWeight: 600 }}>
                {reason}
              </p>
            </div>
          )}
        </div>

        <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
          If you believe this was a mistake, you can appeal your ban
          by joining our Discord server and opening a ticket.
        </p>

        <a
          href={DISCORD_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-green"
          style={{ textDecoration: 'none', fontSize: '14px', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          Appeal on Discord →
        </a>

        <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
          Faction Hub · dayz-faction-hub.vercel.app
        </p>
      </div>
    </div>
  )
}