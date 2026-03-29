import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { UserPlus, Check, X, Clock } from 'lucide-react'

export default function JoinRequests({ session }) {
  const { role, faction } = useRole(session.user.id)
  const [requests, setRequests] = useState([])
  const [allFactions, setAllFactions] = useState([])
  const [myRequest, setMyRequest] = useState(null)
  const [selectedFaction, setSelectedFaction] = useState('')
  const [message, setMessage] = useState('')
  const [inFaction, setInFaction] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const userId = session.user.id
  const canReview = role === 'leader' || role === 'co-leader' || role === 'recruiter'

  useEffect(() => { loadData() }, [faction?.id])

  async function loadData() {
    setLoading(true)
    const { data: mem } = await supabase
      .from('faction_members')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
    setInFaction(!!mem)

    const { data: facs } = await supabase
      .from('factions')
      .select('id, name, tag, server_name, is_recruiting, primary_color, flag')
      .eq('is_recruiting', true)
      .order('name')
    setAllFactions(facs || [])

    const { data: req } = await supabase
      .from('join_requests')
      .select('*, factions(name, tag)')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle()
    setMyRequest(req)

    if (faction?.id) {
      const { data: incoming } = await supabase
        .from('join_requests')
        .select('*, profile:profiles!join_requests_user_id_fkey(discord_username, discord_avatar)')
        .eq('faction_id', faction.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      setRequests(incoming || [])
    }
    setLoading(false)
  }

  async function sendRequest() {
    if (!selectedFaction || !userId) return
    setSubmitting(true)

    // Check for existing pending request
    const { data: existing } = await supabase
      .from('join_requests')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      alert('You already have a pending request. Cancel it first before applying to another faction.')
      setSubmitting(false)
      return
    }

    const { error } = await supabase.from('join_requests').insert({
      faction_id: selectedFaction,
      user_id: userId,
      message: message.trim(),
      status: 'pending'
    })

    if (!error) {
      const { data: leaders } = await supabase
        .from('faction_members')
        .select('user_id')
        .eq('faction_id', selectedFaction)
        .in('role', ['leader', 'co-leader', 'recruiter'])
      if (leaders?.length) {
        const targetFaction = allFactions.find(f => f.id === selectedFaction)
        await supabase.from('notifications').insert(leaders.map(l => ({
          faction_id: selectedFaction,
          user_id: l.user_id,
          type: 'member',
          title: '👤 New Join Request',
          body: `Someone wants to join ${targetFaction?.name || 'your faction'}`
        })))
      }
      setMessage('')
      setSelectedFaction('')
      await loadData()
    } else {
      alert('Failed to send request: ' + error.message)
    }
    setSubmitting(false)
  }

  async function reviewRequest(requestId, requestUserId, approve) {
    if (approve) {
      const { error } = await supabase.from('faction_members').insert({
        faction_id: faction.id,
        user_id: requestUserId,
        role: 'member'
      })
      if (error) {
        alert('Failed to add member: ' + error.message)
        return
      }
      await supabase.from('member_history').insert({ faction_id: faction.id, user_id: requestUserId, action: 'joined' })
      await supabase.from('join_requests').update({ status:'approved', reviewed_by: userId }).eq('id', requestId)
      await supabase.from('notifications').insert({
        faction_id: faction.id, user_id: requestUserId,
        type: 'member',
        title: '✅ Join Request Approved!',
        body: `Welcome to ${faction.name}! You are now a member.`
      })
      await supabase.from('events').insert({
        faction_id: faction.id, created_by: userId, type: 'member',
        title: '👤 New Member Joined',
        description: 'A new member joined via join request'
      })
      await checkMemberAchievements(faction.id)
    } else {
      await supabase.from('join_requests').update({ status:'rejected', reviewed_by: userId }).eq('id', requestId)
      await supabase.from('notifications').insert({
        faction_id: faction.id, user_id: requestUserId,
        type: 'general',
        title: '❌ Join Request Declined',
        body: `Your request to join ${faction.name} was not accepted this time.`
      })
    }
    setRequests(r => r.filter(x => x.id !== requestId))
  }

  async function checkMemberAchievements(factionId) {
    const { count } = await supabase.from('faction_members').select('id', { count:'exact', head:true }).eq('faction_id', factionId)
    const { data: existing } = await supabase.from('achievements').select('type').eq('faction_id', factionId)
    const types = existing?.map(a => a.type) || []
    const toUnlock = []
    if (count >= 10 && !types.includes('members_10')) toUnlock.push({ faction_id: factionId, type:'members_10', unlocked_at: new Date().toISOString() })
    if (count >= 25 && !types.includes('members_25')) toUnlock.push({ faction_id: factionId, type:'members_25', unlocked_at: new Date().toISOString() })
    if (count >= 50 && !types.includes('members_50')) toUnlock.push({ faction_id: factionId, type:'members_50', unlocked_at: new Date().toISOString() })
    if (toUnlock.length > 0) await supabase.from('achievements').insert(toUnlock)
  }

  async function cancelRequest() {
    if (!myRequest) return
    await supabase.from('join_requests').delete().eq('id', myRequest.id)
    setMyRequest(null)
  }

  if (loading) return (
    <div style={{ padding:'80px', textAlign:'center', color:'var(--muted)', fontFamily:'Share Tech Mono' }}>
      LOADING...
    </div>
  )

  return (
    <div style={{ maxWidth:800, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>JOIN REQUESTS</h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>
          {inFaction ? 'Review applications to your faction' : 'Apply to join a faction on Faction Hub'}
        </p>
      </div>

      {/* Not in a faction — apply flow */}
      {!inFaction && (
        <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

          {/* Pending request banner */}
          {myRequest && (
            <div className="card" style={{ borderColor:'var(--yellow)', display:'flex', flexDirection:'column', gap:'12px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <Clock size={18} color="var(--yellow)" />
                <h3 style={{ fontWeight:700, fontSize:'16px', color:'var(--yellow)' }}>Application Pending</h3>
              </div>
              <p style={{ color:'var(--muted)', fontSize:'14px' }}>
                Your application to join <strong style={{ color:'var(--text)' }}>{myRequest.factions?.name}</strong> is being reviewed by their leadership.
              </p>
              {myRequest.message && (
                <p style={{ fontSize:'13px', color:'var(--muted)', fontStyle:'italic', lineHeight:1.5, background:'var(--bg)', padding:'10px 14px', borderRadius:'6px' }}>
                  "{myRequest.message}"
                </p>
              )}
              <button className="btn btn-ghost" style={{ alignSelf:'flex-start', color:'var(--red)', fontSize:'13px' }} onClick={cancelRequest}>
                Withdraw Application
              </button>
            </div>
          )}

          {/* Apply form */}
          {!myRequest && (
            <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <h3 style={{ fontWeight:700, fontSize:'16px', display:'flex', alignItems:'center', gap:'8px' }}>
                <UserPlus size={16} color="var(--green)" /> Apply to a Faction
              </h3>
              <select value={selectedFaction} onChange={e => setSelectedFaction(e.target.value)}>
                <option value="">Select a recruiting faction...</option>
                {allFactions.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.tag ? `${f.tag} ` : ''}{f.name}{f.server_name ? ` — ${f.server_name}` : ''}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="Introduce yourself — playstyle, experience, timezone, why you want to join..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
              />
              <button
                className="btn btn-green"
                style={{ alignSelf:'flex-start', display:'flex', alignItems:'center', gap:'8px' }}
                onClick={sendRequest}
                disabled={!selectedFaction || submitting}
              >
                <UserPlus size={14} /> {submitting ? 'Sending...' : 'Send Application'}
              </button>
            </div>
          )}

          {/* Recruiting factions list */}
          <div>
            <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'13px', letterSpacing:'0.1em', marginBottom:'12px' }}>
              RECRUITING FACTIONS ({allFactions.length})
            </h3>
            {allFactions.length === 0 && (
              <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'40px' }}>
                No factions are currently recruiting. Check back later.
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {allFactions.map(f => (
                <div key={f.id} className="card" style={{ display:'flex', alignItems:'center', gap:'14px', padding:'14px 16px', borderLeft:`3px solid ${f.primary_color || 'var(--green)'}` }}>
                  <span style={{ fontSize:'28px', flexShrink:0 }}>{f.flag || '☢️'}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                      {f.tag && <span style={{ fontFamily:'Share Tech Mono', color: f.primary_color || 'var(--green)', fontSize:'12px' }}>{f.tag}</span>}
                      <span style={{ fontWeight:700, fontSize:'15px' }}>{f.name}</span>
                      <span className="tag tag-green" style={{ fontSize:'11px' }}>🔎 Recruiting</span>
                    </div>
                    {f.server_name && <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'3px' }}>📡 {f.server_name}</div>}
                  </div>
                  {!myRequest && (
                    <button
                      className="btn btn-green"
                      style={{ fontSize:'12px', padding:'5px 14px', flexShrink:0 }}
                      onClick={() => { setSelectedFaction(f.id); window.scrollTo({ top:0, behavior:'smooth' }) }}
                    >
                      Apply
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* In a faction — review incoming requests */}
      {inFaction && canReview && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'13px', letterSpacing:'0.1em' }}>
              INCOMING APPLICATIONS ({requests.length})
            </h3>
            {!faction?.is_recruiting && (
              <span style={{ fontSize:'12px', color:'var(--yellow)' }}>
                ⚠️ Recruiting is off — enable it in Settings to receive applications
              </span>
            )}
          </div>

          {requests.length === 0 && (
            <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px', display:'flex', flexDirection:'column', alignItems:'center', gap:'12px' }}>
              <UserPlus size={32} color="var(--border)" />
              <p>No pending applications.</p>
              {!faction?.is_recruiting && (
                <a href="/settings" style={{ color:'var(--green)', fontSize:'13px' }}>Enable recruiting in Settings →</a>
              )}
            </div>
          )}

          {requests.map(req => (
            <div key={req.id} className="card" style={{ display:'flex', gap:'14px', alignItems:'flex-start', borderLeft:'3px solid var(--green)' }}>
              {req.profile?.discord_avatar
                ? <img src={req.profile.discord_avatar} style={{ width:44, height:44, borderRadius:'50%', border:'2px solid var(--border)', flexShrink:0 }} />
                : <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'18px' }}>👤</div>
              }
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:'16px' }}>{req.profile?.discord_username || 'Unknown'}</div>
                {req.message ? (
                  <p style={{ fontSize:'13px', color:'var(--muted)', marginTop:'8px', fontStyle:'italic', lineHeight:1.6, background:'var(--bg)', padding:'10px 14px', borderRadius:'6px' }}>
                    "{req.message}"
                  </p>
                ) : (
                  <p style={{ fontSize:'13px', color:'var(--muted)', marginTop:'4px' }}>No message included.</p>
                )}
                <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'8px' }}>
                  Applied {new Date(req.created_at).toLocaleString()}
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px', flexShrink:0 }}>
                <button
                  onClick={() => reviewRequest(req.id, req.user_id, true)}
                  className="btn btn-green"
                  style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'13px', padding:'6px 14px' }}
                >
                  <Check size={13} /> Accept
                </button>
                <button
                  onClick={() => reviewRequest(req.id, req.user_id, false)}
                  className="btn"
                  style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'13px', padding:'6px 12px', background:'#b91c1c', color:'#fff', border:'none' }}
                >
                  <X size={13} /> Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {inFaction && !canReview && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
          🔒 Only Leaders, Co-Leaders and Recruiters can review applications.
        </div>
      )}
    </div>
  )
}