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
      // Store invite code and redirect to Discord OAuth
      // The redirectTo brings them back to the invite page after login
      localStorage.setItem('pendingInvite', code)
      supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: `${window.location.origin}/invite/${code}`
        }
      })
      return
    }
    processInvite()
  }, [session])

  async function processInvite() {
    // Use code from URL params first, fall back to localStorage
    const inviteCode = code || localStorage.getItem('pendingInvite')
    if (!inviteCode) { setStatus('invalid'); return }

    // Clear pending invite
    localStorage.removeItem('pendingInvite')

    const { data: invite } = await supabase
      .from('invites')
      .select('*, factions(name, id)')
      .eq('code', inviteCode)
      .maybeSingle()

    if (!invite) { setStatus('invalid'); return }
    if (new Date(invite.expires_at) < new Date()) { setStatus('expired'); return }
    if (invite.max_uses && invite.uses >= invite.max_uses) { setStatus('full'); return }

    setFactionName(invite.factions?.name || 'the faction')

    // Check if already in ANY faction
    const { data: existingMembership } = await supabase
      .from('faction_members')
      .select('id, factions(name)')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (existingMembership) {
      setStatus('infaction')
      setTimeout(() => navigate('/'), 3000)
      return
    }

    // Check if already in THIS faction
    const { data: existing } = await supabase
      .from('faction_members')
      .select('id')
      .eq('faction_id', invite.faction_id)
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (existing) {
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
      await supabase.from('invites').update({ uses: invite.uses + 1 }).eq('id', invite.id)

      // Log to events
      await supabase.from('events').insert({
        faction_id: invite.faction_id,
        created_by: session.user.id,
        type: 'member',
        title: '👤 New Member Joined',
        description: `${session.user.user_metadata?.full_name || 'A new member'} joined via invite link`
      })

      // Notify faction leaders
      const { data: leaders } = await supabase
        .from('faction_members')
        .select('user_id')
        .eq('faction_id', invite.faction_id)
        .in('role', ['leader', 'co-leader'])
      if (leaders?.length) {
        await supabase.from('notifications').insert(leaders.map(l => ({
          faction_id: invite.faction_id,
          user_id: l.user_id,
          type: 'member',
          title: '👤 New Member Joined',
          body: `${session.user.user_metadata?.full_name || 'Someone'} joined via invite link`
        })))
      }

      // Discord webhook
      await notifyDiscord(invite.faction_id, session.user.user_metadata?.full_name || 'A new member')

      setStatus('success')
      setTimeout(() => navigate('/'), 2500)
    } else {
      console.error('Join error:', error)
      setStatus('error')
    }
  }

  async function notifyDiscord(factionId, memberName) {
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('webhook_url')
      .eq('faction_id', factionId)
      .maybeSingle()
    if (!settings?.webhook_url) return
    await fetch(settings.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '👤 New Member Joined',
          description: `**${memberName}** has joined the faction via invite link!`,
          color: 0x4ade80,
          timestamp: new Date().toISOString()
        }]
      })
    }).catch(() => {})
  }

  const messages = {
    loading: { icon:'⏳', title:'Processing invite...', color:'var(--muted)' },
    success: { icon:'✅', title:`Welcome to ${factionName}!`, sub:'Redirecting to your dashboard...', color:'var(--green)' },
    already: { icon:'☑️', title:`You're already in ${factionName}`, sub:'Redirecting...', color:'var(--green)' },
    infaction: { icon:'⚠️', title:'Already in a faction', sub:'You must leave your current faction before joining another.', color:'var(--yellow)' },
    invalid: { icon:'❌', title:'Invalid invite link', sub:"This invite doesn't exist or has been revoked.", color:'var(--red)' },
    expired: { icon:'⏰', title:'Invite expired', sub:'Ask your faction leader to generate a new invite link.', color:'var(--yellow)' },
    full: { icon:'🚫', title:'Invite is full', sub:'This invite has reached its maximum uses. Ask for a new one.', color:'var(--red)' },
    error: { icon:'⚠️', title:'Something went wrong', sub:'Please try again or contact your faction leader.', color:'var(--red)' },
  }

  const msg = messages[status]

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'radial-gradient(ellipse at center, #0d1f0d 0%, #0a0c0a 70%)',
      padding:'24px'
    }}>
      <div className="card" style={{ textAlign:'center', maxWidth:'380px', width:'100%', display:'flex', flexDirection:'column', gap:'16px', alignItems:'center', padding:'40px' }}>
        <div style={{ fontSize:'52px' }}>{msg?.icon}</div>
        <h2 style={{ fontSize:'22px', fontWeight:700, color:msg?.color }}>{msg?.title}</h2>
        {msg?.sub && <p style={{ color:'var(--muted)', fontSize:'14px', lineHeight:1.5 }}>{msg.sub}</p>}
        {status === 'loading' && <div className="spinner" />}
        {(status === 'invalid' || status === 'error' || status === 'infaction') && (
          <button className="btn btn-green" onClick={() => navigate('/')}>Go to Dashboard</button>
        )}
        {status === 'expired' && (
          <button className="btn btn-ghost" onClick={() => navigate('/directory')}>Browse Factions</button>
        )}
      </div>
    </div>
  )
}
```

Press **Ctrl+S**

Now we need to add the invite URL to Supabase Auth allowed redirects. Go to **Supabase → Authentication → URL Configuration** → add this to **Redirect URLs**:
```
https://dayz-faction-hub.vercel.app/invite/*