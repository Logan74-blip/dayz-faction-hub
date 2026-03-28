import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const STEPS = ['welcome', 'faction', 'server', 'done']

export default function Onboarding({ session }) {
  const [step, setStep] = useState(0)
  const [factionName, setFactionName] = useState('')
  const [serverName, setServerName] = useState('')
  const [tag, setTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [faction, setFaction] = useState(null)
  const navigate = useNavigate()
  const userId = session.user.id
  const name = session.user.user_metadata?.full_name || 'Commander'

  async function createFaction() {
    if (!factionName.trim()) return
    setLoading(true)
    const { data, error } = await supabase.from('factions').insert({
      name: factionName.trim(),
      tag: tag.trim() || null,
      server_name: serverName.trim() || null,
      created_by: userId,
      is_recruiting: true
    }).select().single()

    if (!error) {
      await supabase.from('faction_members').insert({ faction_id: data.id, user_id: userId, role: 'leader' })
      await supabase.from('member_history').insert({ faction_id: data.id, user_id: userId, action: 'joined' })
      await supabase.from('profiles').upsert({ id: userId, onboarding_done: true }, { onConflict: 'id' })
      setFaction(data)
      setStep(3)
    }
    setLoading(false)
  }

  async function skipToApp() {
    await supabase.from('profiles').upsert({ id: userId, onboarding_done: true }, { onConflict: 'id' })
    navigate('/')
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'radial-gradient(ellipse at center, #0d1f0d 0%, #0a0c0a 70%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
    }}>
      <div style={{ maxWidth: '480px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Progress */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, height: '4px', borderRadius: '999px', background: i <= step ? 'var(--green)' : 'var(--border)', transition: 'background 0.3s' }} />
          ))}
        </div>

        {/* Step 0 — Welcome */}
        {step === 0 && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center', padding: '32px' }}>
            <div style={{ fontSize: '48px' }}>☢️</div>
            <h2 style={{ fontFamily: 'Share Tech Mono', fontSize: '24px', color: 'var(--green)' }}>
              Welcome, {name}!
            </h2>
            <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              Faction Hub is your DayZ command center. Let's get you set up in about 60 seconds.
            </p>
            <button className="btn btn-green" style={{ fontSize: '16px', padding: '12px' }} onClick={() => setStep(1)}>
              Let's Get Started →
            </button>
            <button onClick={skipToApp} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px' }}>
              Skip — I'll set up later
            </button>
          </div>
        )}

        {/* Step 1 — Faction */}
        {step === 1 && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '32px' }}>
            <h2 style={{ fontFamily: 'Share Tech Mono', fontSize: '20px', color: 'var(--green)' }}>Create Your Faction</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>What is your faction called?</p>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>FACTION NAME *</label>
              <input
                placeholder="e.g. The Survivors, SLAM, Night Wolves..."
                value={factionName}
                onChange={e => setFactionName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>FACTION TAG (optional)</label>
              <input
                placeholder="e.g. [SLAM], [NW], [TSV]"
                value={tag}
                onChange={e => setTag(e.target.value)}
                maxLength={8}
              />
              <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>Shown before your faction name in the directory</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
              <button className="btn btn-green" style={{ flex: 1 }} onClick={() => factionName.trim() && setStep(2)} disabled={!factionName.trim()}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Server */}
        {step === 2 && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '32px' }}>
            <h2 style={{ fontFamily: 'Share Tech Mono', fontSize: '20px', color: 'var(--green)' }}>Which Server?</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
              This groups your faction with others on the same server so you can find each other on the leaderboard and directory.
            </p>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>SERVER NAME (optional)</label>
              <input
                placeholder="e.g. US-NY-01, Community-PvP-01..."
                value={serverName}
                onChange={e => setServerName(e.target.value)}
              />
              <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>You can change this later in Settings</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-green" style={{ flex: 1 }} onClick={createFaction} disabled={loading}>
                {loading ? 'Creating...' : 'Create Faction ✓'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Done */}
        {step === 3 && faction && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center', padding: '32px' }}>
            <div style={{ fontSize: '48px' }}>🎉</div>
            <h2 style={{ fontFamily: 'Share Tech Mono', fontSize: '22px', color: 'var(--green)' }}>
              {faction.name} is ready!
            </h2>
            <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              You're the faction leader. Here's what to do next:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
              {[
                { icon: '🔗', text: 'Go to Settings to generate an invite link for your members' },
                { icon: '🗺️', text: 'Open the War Map and mark your base location' },
                { icon: '📢', text: 'Post your first announcement to welcome the team' },
                { icon: '⚔️', text: 'Schedule your first raid in the Raids section' },
              ].map(item => (
                <div key={item.text} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px', background: '#0d1a0d', borderRadius: '6px' }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text)' }}>{item.text}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-green" style={{ fontSize: '16px', padding: '12px' }} onClick={() => navigate('/')}>
              Enter Faction Hub →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}