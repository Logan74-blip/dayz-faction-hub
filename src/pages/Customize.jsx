import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'

const DAYZ_FLAGS = [
  { id:'none', label:'None', emoji:'' },
  { id:'skull', label:'Skull', emoji:'💀' },
  { id:'biohazard', label:'Biohazard', emoji:'☢️' },
  { id:'crossed_swords', label:'Crossed Swords', emoji:'⚔️' },
  { id:'shield', label:'Shield', emoji:'🛡️' },
  { id:'wolf', label:'Wolf', emoji:'🐺' },
  { id:'eagle', label:'Eagle', emoji:'🦅' },
  { id:'snake', label:'Snake', emoji:'🐍' },
  { id:'bear', label:'Bear', emoji:'🐻' },
  { id:'fire', label:'Fire', emoji:'🔥' },
  { id:'lightning', label:'Lightning', emoji:'⚡' },
  { id:'crown', label:'Crown', emoji:'👑' },
  { id:'axe', label:'Axe', emoji:'🪓' },
  { id:'knife', label:'Knife', emoji:'🔪' },
  { id:'gun', label:'Gun', emoji:'🔫' },
  { id:'grenade', label:'Grenade', emoji:'💣' },
  { id:'target', label:'Target', emoji:'🎯' },
  { id:'ghost', label:'Ghost', emoji:'👻' },
  { id:'demon', label:'Demon', emoji:'👹' },
  { id:'zombie', label:'Zombie', emoji:'🧟' },
  { id:'military', label:'Military', emoji:'🪖' },
  { id:'flag', label:'Flag', emoji:'🚩' },
  { id:'blood', label:'Blood Drop', emoji:'🩸' },
  { id:'radiation', label:'Radiation', emoji:'☢️' },
  { id:'virus', label:'Virus', emoji:'🦠' },
]

const PRESET_COLORS = [
  { label:'Survivor Green', primary:'#4ade80', secondary:'#16a34a' },
  { label:'Blood Red', primary:'#f87171', secondary:'#b91c1c' },
  { label:'Tactical Yellow', primary:'#fbbf24', secondary:'#d97706' },
  { label:'Ghost Purple', primary:'#a78bfa', secondary:'#7c3aed' },
  { label:'Ocean Blue', primary:'#60a5fa', secondary:'#2563eb' },
  { label:'Rust Orange', primary:'#fb923c', secondary:'#ea580c' },
  { label:'Arctic White', primary:'#e2e8f0', secondary:'#94a3b8' },
  { label:'Shadow Black', primary:'#6b7280', secondary:'#374151' },
]

export default function Customize({ session }) {
  const { role, faction } = useRole(session.user.id)
  const [customization, setCustomization] = useState({ primary_color:'#4ade80', secondary_color:'#16a34a', flag:'none' })
  const [saved, setSaved] = useState(false)
  const [apiKeys, setApiKeys] = useState([])
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [pushEnabled, setPushEnabled] = useState(false)
  const userId = session.user.id
  const canEdit = role === 'leader' || role === 'co-leader'

  useEffect(() => {
    if (faction) {
      loadCustomization()
      loadApiKeys()
      checkPush()
    }
  }, [faction?.id])

  async function loadCustomization() {
    const { data } = await supabase
      .from('faction_customization')
      .select('*')
      .eq('faction_id', faction.id)
      .maybeSingle()
    if (data) setCustomization(data)
    else {
      // Load from factions table directly
      setCustomization(c => ({
        ...c,
        primary_color: faction.primary_color || '#4ade80',
        flag: faction.flag || 'none'
      }))
    }
  }

  async function loadApiKeys() {
    const { data } = await supabase
      .from('api_keys')
      .select('*')
      .eq('faction_id', faction.id)
      .order('created_at', { ascending: false })
    setApiKeys(data || [])
  }

  function checkPush() {
    setPushEnabled('Notification' in window && Notification.permission === 'granted')
  }

  async function saveCustomization() {
    // Get the actual emoji to store
    const selectedFlag = DAYZ_FLAGS.find(f => f.id === (customization.flag || 'none'))
    const flagEmoji = selectedFlag?.emoji || ''

    const { data: existing } = await supabase
      .from('faction_customization')
      .select('id')
      .eq('faction_id', faction.id)
      .maybeSingle()

    if (existing) {
      await supabase.from('faction_customization').update({
        ...customization,
        updated_at: new Date().toISOString()
      }).eq('faction_id', faction.id)
    } else {
      await supabase.from('faction_customization').insert({
        ...customization,
        faction_id: faction.id
      })
    }

    // Store EMOJI in factions table, not the ID
    await supabase.from('factions').update({
      primary_color: customization.primary_color,
      flag: flagEmoji
    }).eq('id', faction.id)

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function enablePushNotifications() {
    if (!('Notification' in window)) {
      alert('Push notifications not supported in this browser.')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      setPushEnabled(true)
      new Notification('☢️ Faction Hub', {
        body: 'Push notifications enabled!',
        icon: '/favicon.svg'
      })
      await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        subscription: { enabled: true, granted_at: new Date().toISOString() }
      }, { onConflict: 'user_id' })
    }
  }

  async function generateApiKey() {
    if (!faction) return
    const label = newKeyLabel.trim() || 'API Key'
    const { data, error } = await supabase
      .from('api_keys')
      .insert({ faction_id: faction.id, created_by: userId, label })
      .select()
      .single()
    if (!error) {
      setApiKeys(k => [data, ...k])
      setNewKeyLabel('')
    }
  }

  async function deleteApiKey(id) {
    await supabase.from('api_keys').delete().eq('id', id)
    setApiKeys(k => k.filter(x => x.id !== id))
  }

  async function copyKey(key) {
    try {
      await navigator.clipboard.writeText(key)
      alert('API key copied!')
    } catch {
      alert('Key: ' + key)
    }
  }

  // Find selected flag — check both by ID and by emoji value
  const selectedFlag = DAYZ_FLAGS.find(f =>
    f.id === (customization.flag || 'none') ||
    f.emoji === customization.flag
  ) || DAYZ_FLAGS[0]

  if (!faction) return (
    <div style={{ padding:'80px', textAlign:'center', color:'var(--muted)' }}>
      Join or create a faction to access customization.
    </div>
  )

  return (
    <div style={{ maxWidth:800, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>CUSTOMIZE</h1>
        <p style={{ color:'var(--muted)', marginTop:'4px' }}>Faction colors, flags, notifications and API access</p>
      </div>

      {/* Preview */}
      <div className="card" style={{ display:'flex', alignItems:'center', gap:'20px', borderColor:customization.primary_color, borderWidth:'2px' }}>
        <div style={{ fontSize:'52px' }}>{selectedFlag.emoji || '☢️'}</div>
        <div>
          <div style={{ fontFamily:'Share Tech Mono', fontSize:'22px', color:customization.primary_color }}>
            {faction?.name || 'YOUR FACTION'}
          </div>
          <div style={{ fontSize:'13px', color:'var(--muted)', marginTop:'4px' }}>Preview of your faction's appearance</div>
          <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
            <div style={{ width:'24px', height:'24px', borderRadius:'4px', background:customization.primary_color }} />
            <div style={{ width:'24px', height:'24px', borderRadius:'4px', background:customization.secondary_color }} />
          </div>
        </div>
      </div>

      {canEdit && (
        <>
          {/* Color presets */}
          <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <h3 style={{ fontWeight:700, fontSize:'15px' }}>🎨 Faction Colors</h3>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:'8px' }}>
              {PRESET_COLORS.map(p => (
                <button key={p.label}
                  onClick={() => setCustomization(c => ({...c, primary_color:p.primary, secondary_color:p.secondary}))}
                  style={{
                    background:'var(--surface)',
                    border:`2px solid ${customization.primary_color === p.primary ? p.primary : 'var(--border)'}`,
                    borderRadius:'6px', padding:'10px', cursor:'pointer',
                    display:'flex', alignItems:'center', gap:'10px'
                  }}
                >
                  <div style={{ display:'flex', gap:'4px' }}>
                    <div style={{ width:'16px', height:'16px', borderRadius:'3px', background:p.primary }} />
                    <div style={{ width:'16px', height:'16px', borderRadius:'3px', background:p.secondary }} />
                  </div>
                  <span style={{ fontSize:'12px', color:'var(--text)', fontWeight:600 }}>{p.label}</span>
                </button>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              <div>
                <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>PRIMARY COLOR</label>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  <input type="color" value={customization.primary_color} onChange={e => setCustomization(c => ({...c, primary_color:e.target.value}))} style={{ width:'48px', height:'36px', padding:'2px', border:'1px solid var(--border)', borderRadius:'4px', background:'var(--surface)', cursor:'pointer' }} />
                  <input value={customization.primary_color} onChange={e => setCustomization(c => ({...c, primary_color:e.target.value}))} style={{ flex:1, fontFamily:'Share Tech Mono', fontSize:'13px' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>SECONDARY COLOR</label>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  <input type="color" value={customization.secondary_color} onChange={e => setCustomization(c => ({...c, secondary_color:e.target.value}))} style={{ width:'48px', height:'36px', padding:'2px', border:'1px solid var(--border)', borderRadius:'4px', background:'var(--surface)', cursor:'pointer' }} />
                  <input value={customization.secondary_color} onChange={e => setCustomization(c => ({...c, secondary_color:e.target.value}))} style={{ flex:1, fontFamily:'Share Tech Mono', fontSize:'13px' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Faction Flag */}
          <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <h3 style={{ fontWeight:700, fontSize:'15px' }}>🚩 Faction Flag</h3>
            <p style={{ fontSize:'13px', color:'var(--muted)' }}>Choose an emblem that represents your faction</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(80px, 1fr))', gap:'8px' }}>
              {DAYZ_FLAGS.map(flag => (
                <button key={flag.id}
                  onClick={() => setCustomization(c => ({...c, flag:flag.id}))}
                  style={{
                    background:'var(--surface)',
                    border:`2px solid ${(customization.flag === flag.id || customization.flag === flag.emoji) ? customization.primary_color : 'var(--border)'}`,
                    borderRadius:'8px', padding:'10px 6px', cursor:'pointer',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:'4px',
                    transition:'border-color 0.15s'
                  }}
                >
                  <span style={{ fontSize:'24px' }}>{flag.emoji || '○'}</span>
                  <span style={{ fontSize:'10px', color:'var(--muted)' }}>{flag.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn btn-green"
            style={{ alignSelf:'flex-start', fontSize:'15px', padding:'10px 24px' }}
            onClick={saveCustomization}
          >
            {saved ? '✓ Saved!' : 'Save Customization'}
          </button>
        </>
      )}

      {/* Push Notifications */}
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
        <h3 style={{ fontWeight:700, fontSize:'15px' }}>🔔 Push Notifications</h3>
        <p style={{ fontSize:'13px', color:'var(--muted)' }}>
          Get browser alerts for raids, messages, bounties and announcements even when the tab is in the background.
        </p>
        {pushEnabled ? (
          <span style={{ color:'var(--green)', fontSize:'14px' }}>✅ Push notifications are enabled</span>
        ) : (
          <button className="btn btn-green" style={{ alignSelf:'flex-start' }} onClick={enablePushNotifications}>
            Enable Push Notifications
          </button>
        )}
      </div>

      {/* API Keys */}
      {canEdit && (
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <h3 style={{ fontWeight:700, fontSize:'15px' }}>🔑 API Access</h3>
          <p style={{ fontSize:'13px', color:'var(--muted)' }}>
            Use these keys to access your faction data from external tools and scripts.
          </p>
          <div style={{ display:'flex', gap:'8px' }}>
            <input
              placeholder="Key label (e.g. Discord Bot)"
              value={newKeyLabel}
              onChange={e => setNewKeyLabel(e.target.value)}
            />
            <button className="btn btn-green" style={{ whiteSpace:'nowrap' }} onClick={generateApiKey}>
              Generate Key
            </button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {apiKeys.length === 0 && <p style={{ fontSize:'13px', color:'var(--muted)' }}>No API keys yet.</p>}
            {apiKeys.map(k => (
              <div key={k.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px', background:'#0d1a0d', borderRadius:'6px', border:'1px solid var(--border)' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'13px', fontWeight:600 }}>{k.label}</div>
                  <div style={{ fontFamily:'Share Tech Mono', fontSize:'12px', color:'var(--green)', marginTop:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {k.key}
                  </div>
                  <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>
                    Created {new Date(k.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                  <button className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px' }} onClick={() => copyKey(k.key)}>Copy</button>
                  <button className="btn btn-ghost" style={{ fontSize:'12px', padding:'4px 10px', color:'var(--red)' }} onClick={() => deleteApiKey(k.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}