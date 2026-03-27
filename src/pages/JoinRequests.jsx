import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'
import { UserPlus, Check, X } from 'lucide-react'

export default function JoinRequests({ session }) {
  const { role, faction, perms } = useRole(session.user.id)
  const [requests, setRequests] = useState([])
  const [allFactions, setAllFactions] = useState([])
  const [myRequest, setMyRequest] = useState(null)
  const [selectedFaction, setSelectedFaction] = useState('')
  const [message, setMessage] = useState('')
  const [inFaction, setInFaction] = useState(false)
  const userId = session.user.id

  useEffect(() => { loadData() }, [faction])

  async function loadData() {
    // Check if already in a faction
    const { data: mem } = await supabase.from('faction_members').select('id').eq('user_id', userId).maybeSingle()
    setInFaction(!!mem)

    // Load all factions for browsing
    const { data: facs } = await supabase.from('factions').select('id, name, tag, server_name, is_recruiting')
    setAllFactions(facs || [])

    // Load my pending request
    const { data: req } = await supabase.from('join_requests').select('*, factions(name)').eq('user_id', userId).eq('status', 'pending').maybeSingle()
    setMyRequest(req)

    // Load incoming requests for my faction
    if (faction) {
      const { data: incoming } = await supabase.from('join_requests')
        .select('*, profile:profiles!join_requests_user_id_fkey(discord_username, discord_avatar)')
        .eq('faction_id', faction.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      setRequests(incoming || [])
    }
  }

  async function sendRequest() {
    if (!selectedFaction || !userId) return
    const { error } = await supabase.from('join_requests').insert({
      faction_id: selectedFaction,
      user_id: userId,
      message: message.trim(),
      status: 'pending'
    })
    if (!error) {
      // Notify faction leaders
      const { data: leaders } = await supabase.from('faction_members')
        .select('user_id')
        .eq('faction_id', selectedFaction)
        .in('role', ['leader', 'co-leader'])
      if (leaders?.length) {
        await supabase.from('notifications').insert(leaders.map(l => ({
          faction_id: selectedFaction,
          user_id: l.user_id,
          type: 'member',
          title: '👤 New Join Request',
          body: `Someone wants to join your faction`
        })))
      }
      loadData()
    }
  }

  async function reviewRequest(requestId, requestUserId, approve) {
    if (approve) {
      // Add to faction
      await supabase.from('faction_members').insert({ faction_id: faction.id, user_id: requestUserId, role: 'member' })
      await supabase.from('member_history').insert({ faction_id: faction.id, user_id: requestUserId, action: 'joined' })
      await supabase.from('join_requests').update({ status:'approved', reviewed_by: userId }).eq('id', requestId)
      // Notify applicant
      await supabase.from('notifications').insert({
        faction_id: faction.id, user_id: requestUserId,
        type: 'member', title: '✅ Join Request Approved',
        body: `Welcome to ${faction.name}!`
      })
      // Check achievements
      await checkMemberAchievements(faction.id)
    } else {
      await supabase.from('join_requests').update({ status:'rejected', reviewed_by: userId }).eq('id', requestId)
      await supabase.from('notifications').insert({
        faction_id: faction.id, user_id: requestUserId,
        type: 'general', title: '❌ Join Request Declined',
        body: `Your request to join ${faction.name} was declined.`
      })
    }
    setRequests(r => r.filter(x => x.id !== requestId))
  }

  async function checkMemberAchievements(factionId) {
    const { count } = await supabase.from('faction_members').select('id', { count:'exact' }).eq('faction_id', factionId)
    const { data: existing } = await supabase.from('achievements').select('key').eq('faction_id', factionId)
    const keys = existing?.map(a => a.key) || []
    const toUnlock = []
    if (count >= 10 && !keys.includes('members_10')) toUnlock.push({ faction_id: factionId, key:'members_10', title:'Growing Force', description:'Reach 10 faction members', icon:'👥' })
    if (count >= 25 && !keys.includes('members_25')) toUnlock.push({ faction_id: factionId, key:'members_25', title:'Small Army', description:'Reach 25 faction members', icon:'🪖' })
    if (count >= 50 && !keys.includes('members_50')) toUnlock.push({ faction_id: factionId, key:'members_50', title:'Major Force', description:'Reach 50 faction members', icon:'⚡' })
    if (toUnlock.length > 0) await supabase.from('achievements').insert(toUnlock)
  }

  async function cancelRequest() {
    if (!myRequest) return
    await supabase.from('join_requests').delete().eq('id', myRequest.id)
    setMyRequest(null)
  }

  const canReview = role === 'leader' || role === 'co-leader' || role === 'recruiter'

  return (
    <div style={{ maxWidth:800, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>JOIN REQUESTS</h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>
          {inFaction ? 'Review applications to your faction' : 'Apply to join a faction'}
        </p>
      </div>

      {/* Not in a faction — show apply form */}
      {!inFaction && (
        <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
          {myRequest ? (
            <div className="card" style={{ borderColor:'var(--yellow)', display:'flex', flexDirection:'column', gap:'12px' }}>
              <h3 style={{ fontWeight:700, fontSize:'16px' }}>⏳ Request Pending</h3>
              <p style={{ color:'var(--muted)', fontSize:'14px' }}>
                Your request to join <strong style={{ color:'var(--text)' }}>{myRequest.factions?.name}</strong> is being reviewed.
              </p>
              {myRequest.message && <p style={{ fontSize:'13px', color:'var(--muted)', fontStyle:'italic' }}>"{myRequest.message}"</p>}
              <button className="btn btn-ghost" style={{ alignSelf:'flex-start', color:'var(--red)', fontSize:'13px' }} onClick={cancelRequest}>
                Cancel Request
              </button>
            </div>
          ) : (
            <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <h3 style={{ fontWeight:700, fontSize:'16px', display:'flex', alignItems:'center', gap:'8px' }}>
                <UserPlus size={16} color="var(--green)" /> Apply to a Faction
              </h3>
              <select value={selectedFaction} onChange={e => setSelectedFaction(e.target.value)}>
                <option value="">Select a faction...</option>
                {allFactions.filter(f => f.is_recruiting).map(f => (
                  <option key={f.id} value={f.id}>{f.tag ? `${f.tag} ` : ''}{f.name}{f.server_name ? ` — ${f.server_name}` : ''}</option>
                ))}
              </select>
              <textarea placeholder="Introduce yourself — playstyle, experience, timezone..." value={message} onChange={e => setMessage(e.target.value)} rows={3} />
              <button className="btn btn-green" style={{ alignSelf:'flex-start' }} onClick={sendRequest} disabled={!selectedFaction}>
                Send Application
              </button>
            </div>
          )}

          {/* Browse recruiting factions */}
          <div>
            <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px', marginBottom:'12px', letterSpacing:'0.1em' }}>
              RECRUITING FACTIONS ({allFactions.filter(f => f.is_recruiting).length})
            </h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {allFactions.filter(f => f.is_recruiting).map(f => (
                <div key={f.id} className="card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      {f.tag && <span style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'12px' }}>{f.tag}</span>}
                      <span style={{ fontWeight:700 }}>{f.name}</span>
                      <span className="tag tag-green" style={{ fontSize:'11px' }}>Recruiting</span>
                    </div>
                    {f.server_name && <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'2px' }}>📡 {f.server_name}</div>}
                  </div>
                  <button className="btn btn-green" style={{ fontSize:'12px', padding:'5px 14px' }} onClick={() => setSelectedFaction(f.id)}>
                    Apply
                  </button>
                </div>
              ))}
              {allFactions.filter(f => f.is_recruiting).length === 0 && (
                <p style={{ color:'var(--muted)', fontSize:'14px', padding:'20px', textAlign:'center' }}>No factions currently recruiting.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* In a faction — show incoming requests */}
      {inFaction && canReview && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <h3 style={{ fontFamily:'Share Tech Mono', color:'var(--green)', fontSize:'14px', letterSpacing:'0.1em' }}>
            INCOMING APPLICATIONS ({requests.length})
          </h3>
          {requests.length === 0 && (
            <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
              No pending applications. Make sure your faction is set to Recruiting in Settings.
            </div>
          )}
          {requests.map(req => (
            <div key={req.id} className="card" style={{ display:'flex', gap:'14px', alignItems:'flex-start', borderLeft:'3px solid var(--green)' }}>
              {req.profile?.discord_avatar
                ? <img src={req.profile.discord_avatar} style={{ width:40, height:40, borderRadius:'50%', border:'1px solid var(--border)', flexShrink:0 }} />
                : <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>👤</div>
              }
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:'15px' }}>{req.profile?.discord_username || 'Unknown'}</div>
                {req.message && (
                  <p style={{ fontSize:'13px', color:'var(--muted)', marginTop:'6px', fontStyle:'italic', lineHeight:1.5 }}>
                    "{req.message}"
                  </p>
                )}
                <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'6px' }}>
                  Applied {new Date(req.created_at).toLocaleString()}
                </div>
              </div>
              <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                <button onClick={() => reviewRequest(req.id, req.user_id, true)} className="btn btn-green" style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'13px', padding:'6px 14px' }}>
                  <Check size={13} /> Accept
                </button>
                <button onClick={() => reviewRequest(req.id, req.user_id, false)} className="btn btn-red" style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'13px', padding:'6px 12px' }}>
                  <X size={13} /> Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {inFaction && !canReview && (
        <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:'48px' }}>
          Only faction leadership and recruiters can review applications.
        </div>
      )}
    </div>
  )
}