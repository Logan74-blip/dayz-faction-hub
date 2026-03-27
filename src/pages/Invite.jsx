import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Invite({ session }) {
  const { code } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading')
  const [factionName, setFactionName] = useState('')

  useEffect(() => {
    if (!session) {
      // Save code and redirect to login
      localStorage.setItem('pendingInvite', code)
      navigate('/login')
      return
    }
    processInvite()
  }, [session])

  async function processInvite() {
    // Check for pending invite after login
    const pending = localStorage.getItem('pendingInvite')
    const inviteCode = code || pending

    if (!inviteCode) { setStatus('invalid'); return }

    const { data: invite } = await supabase
      .from('invites')
      .select('*, factions(name)')
      .eq('code', inviteCode)
      .maybeSingle()

    if (!invite) { setStatus('invalid'); return }
    if (new Date(invite.expires_at) < new Date()) { setStatus('expired'); return }
    if (invite.uses >= invite.max_uses) { setStatus('full'); return }

    setFactionName(invite.factions.name)

    // Check if already a member
    const { data: existing } = await supabase
      .from('faction_members')
      .select('id')
      .eq('faction_id', invite.faction_id)
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (existing) {
      localStorage.removeItem('pendingInvite')
      setStatus('already')
      setTimeout(() => navigate('/'), 2000)
      return
    }

    // Join faction
    const { error } = await supabase.from('faction_members').insert({
  faction_id: invite.faction_id,
  user_id: session.user.id,
  role: 'member'
})

if (!error) {
  await supabase.from('member_history').insert({
    faction_id: invite.faction_id,
    user_id: session.user.id,
    action: 'joined'
  })
}

    if (!error) {
      await supabase.from('invites').update({ uses: invite.uses + 1 }).eq('id', invite.id)
      localStorage.removeItem('pendingInvite')

      // Send Discord notification
      await notifyDiscord(invite.faction_id, session.user.user_metadata?.full_name || 'A new member')

      setStatus('success')
      setTimeout(() => navigate('/'), 2500)
    } else {
      setStatus('error')
    }
  }

  async function notifyDiscord(factionId, memberName) {
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('webhook_url, notify_members')
      .eq('faction_id', factionId)
      .maybeSingle()

    if (!settings?.webhook_url || !settings?.notify_members) return

    await fetch(settings.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '👤 New Member Joined',
          description: `**${memberName}** has joined the faction!`,
          color: 0x4ade80,
          timestamp: new Date().toISOString()
        }]
      })
    }).catch(() => {})
  }

  const messages = {
    loading: { icon: '⏳', title: 'Processing invite...', color: 'var(--muted)' },
    success: { icon: '✅', title: `Welcome to ${factionName}!`, sub: 'Redirecting to dashboard...', color: 'var(--green)' },
    already: { icon: '☑️', title: `You're already in ${factionName}`, sub: 'Redirecting...', color: 'var(--green)' },
    invalid: { icon: '❌', title: 'Invalid invite link', sub: 'This invite doesn\'t exist.', color: 'var(--red)' },
    expired: { icon: '⏰', title: 'Invite expired', sub: 'Ask your faction leader for a new link.', color: 'var(--yellow)' },
    full: { icon: '🚫', title: 'Invite is full', sub: 'Max uses reached.', color: 'var(--red)' },
    error: { icon: '⚠️', title: 'Something went wrong', sub: 'Try again later.', color: 'var(--red)' },
  }

  const msg = messages[status]

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'radial-gradient(ellipse at center, #0d1f0d 0%, #0a0c0a 70%)' }}>
      <div className="card" style={{ textAlign:'center', width:'360px', display:'flex', flexDirection:'column', gap:'16px', alignItems:'center' }}>
        <div style={{ fontSize:'48px' }}>{msg?.icon}</div>
        <h2 style={{ fontSize:'22px', fontWeight:700, color: msg?.color }}>{msg?.title}</h2>
        {msg?.sub && <p style={{ color:'var(--muted)', fontSize:'14px' }}>{msg.sub}</p>}
        {status === 'invalid' && (
          <button className="btn btn-green" onClick={() => navigate('/')}>Go to Dashboard</button>
        )}
      </div>
    </div>
  )
}