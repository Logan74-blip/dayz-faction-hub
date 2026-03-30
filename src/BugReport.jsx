import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Bug, Send, CheckCircle, AlertTriangle, Zap, HelpCircle } from 'lucide-react'

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1488137899135467671/ByMafGqQ-yoeR5vRSk-xnLTE5k5sslz6pDLyK_F53D-MK5xJ-8ZBSzeLxpUj4_a0kLOp'

const CATEGORIES = [
  { value:'bug', label:'🐛 Bug', color:'var(--red)', description:'Something is broken or not working' },
  { value:'feature', label:'✨ Feature Request', color:'#818cf8', description:'Idea for something new' },
  { value:'ui', label:'🎨 UI/Display Issue', color:'var(--yellow)', description:'Visual or layout problem' },
  { value:'performance', label:'⚡ Performance', color:'#f87171', description:'Something is slow or laggy' },
  { value:'other', label:'💬 Other', color:'var(--muted)', description:'Anything else' },
]

const SEVERITY = [
  { value:'low', label:'Low', color:'var(--green)', desc:'Minor annoyance' },
  { value:'medium', label:'Medium', color:'var(--yellow)', desc:'Affects usability' },
  { value:'high', label:'High', color:'var(--red)', desc:'Blocks usage' },
]

export default function BugReport({ session }) {
  const [form, setForm] = useState({
    category: 'bug',
    severity: 'medium',
    title: '',
    description: '',
    steps: '',
    page: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  const userId = session.user.id
  const username = session.user.user_metadata?.full_name || session.user.user_metadata?.name || 'Unknown'
  const avatar = session.user.user_metadata?.avatar_url

  async function submit() {
    if (!form.title.trim() || !form.description.trim()) return
    setSubmitting(true)
    setError(null)

    const category = CATEGORIES.find(c => c.value === form.category)
    const severity = SEVERITY.find(s => s.value === form.severity)

    const severityEmoji = { low:'🟢', medium:'🟡', high:'🔴' }[form.severity]

    try {
      // Send to Discord
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: `${category.label} — ${form.title}`,
            color: form.severity === 'high' ? 0xf87171 : form.severity === 'medium' ? 0xfbbf24 : 0x4ade80,
            fields: [
              { name: '📋 Category', value: category.label, inline: true },
              { name: `${severityEmoji} Severity`, value: `${severity.label} — ${severity.desc}`, inline: true },
              { name: '📍 Page', value: form.page.trim() || 'Not specified', inline: true },
              { name: '📝 Description', value: form.description.trim(), inline: false },
              form.steps.trim() ? { name: '🔄 Steps to Reproduce', value: form.steps.trim(), inline: false } : null,
              { name: '👤 Reported By', value: username, inline: true },
              { name: '🆔 User ID', value: userId, inline: true },
            ].filter(Boolean),
            thumbnail: avatar ? { url: avatar } : undefined,
            footer: { text: 'Faction Hub Bug Report • ' + new Date().toLocaleString() },
            timestamp: new Date().toISOString()
          }]
        })
      })

      // Save to Supabase
      await supabase.from('bug_reports').insert({
        user_id: userId,
        category: form.category,
        severity: form.severity,
        title: form.title.trim(),
        description: form.description.trim(),
        steps: form.steps.trim() || null,
        page: form.page.trim() || null,
      }).select()

      setSubmitted(true)
      setForm({ category:'bug', severity:'medium', title:'', description:'', steps:'', page:'' })
    } catch (err) {
      setError('Failed to submit. Please try again.')
    }
    setSubmitting(false)
  }

  if (submitted) return (
    <div style={{ maxWidth:600, margin:'80px auto', padding:'0 24px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:'16px' }}>
      <CheckCircle size={52} color="var(--green)" />
      <h2 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>Report Submitted!</h2>
      <p style={{ color:'var(--muted)', fontSize:'15px', lineHeight:1.6 }}>
        Your report has been sent to CIDMAN420 on Discord. We'll look into it as soon as possible!
      </p>
      <p style={{ color:'var(--muted)', fontSize:'13px' }}>Thank you for helping make Faction Hub better ☢️</p>
      <div style={{ display:'flex', gap:'10px', marginTop:'8px' }}>
        <button className="btn btn-green" onClick={() => setSubmitted(false)}>Submit Another</button>
        <button className="btn btn-ghost" onClick={() => window.history.back()}>Go Back</button>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth:700, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
        <div style={{ background:'#450a0a', border:'1px solid var(--red)', borderRadius:'10px', padding:'10px', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Bug size={24} color="var(--red)" />
        </div>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--red)' }}>BUG REPORT</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px', fontSize:'14px' }}>
            Found something broken? Tell us and we'll fix it fast.
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="card" style={{ borderColor:'var(--green-dim)', background:'#0d1a0d', display:'flex', gap:'12px', alignItems:'flex-start', padding:'14px 18px' }}>
        <Zap size={16} color="var(--green)" style={{ flexShrink:0, marginTop:'2px' }} />
        <div>
          <p style={{ fontSize:'13px', color:'var(--green)', fontWeight:600 }}>Reports go directly to CIDMAN420 on Discord</p>
          <p style={{ fontSize:'12px', color:'var(--muted)', marginTop:'3px' }}>
            Every report is reviewed personally. High severity bugs get fixed same day.
          </p>
        </div>
      </div>

      {/* Category */}
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        <label style={{ fontFamily:'Share Tech Mono', fontSize:'13px', color:'var(--green)', letterSpacing:'0.08em' }}>REPORT TYPE</label>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:'8px' }}>
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setForm(f => ({...f, category:c.value}))}
              style={{
                background: form.category === c.value ? `${c.color}22` : 'var(--bg)',
                border: `1px solid ${form.category === c.value ? c.color : 'var(--border)'}`,
                borderRadius:'8px', padding:'10px 12px', cursor:'pointer',
                textAlign:'left', transition:'all 0.15s'
              }}
            >
              <div style={{ fontSize:'13px', fontWeight:700, color: form.category === c.value ? c.color : 'var(--text)' }}>{c.label}</div>
              <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'3px' }}>{c.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Severity */}
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        <label style={{ fontFamily:'Share Tech Mono', fontSize:'13px', color:'var(--green)', letterSpacing:'0.08em' }}>SEVERITY</label>
        <div style={{ display:'flex', gap:'8px' }}>
          {SEVERITY.map(s => (
            <button
              key={s.value}
              onClick={() => setForm(f => ({...f, severity:s.value}))}
              style={{
                flex:1, background: form.severity === s.value ? `${s.color}22` : 'var(--bg)',
                border: `1px solid ${form.severity === s.value ? s.color : 'var(--border)'}`,
                borderRadius:'8px', padding:'10px', cursor:'pointer', transition:'all 0.15s'
              }}
            >
              <div style={{ fontSize:'13px', fontWeight:700, color: form.severity === s.value ? s.color : 'var(--text)' }}>{s.label}</div>
              <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Form fields */}
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
        <label style={{ fontFamily:'Share Tech Mono', fontSize:'13px', color:'var(--green)', letterSpacing:'0.08em' }}>DETAILS</label>

        <div>
          <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'6px' }}>TITLE * <span style={{ color:'var(--muted)', fontWeight:400 }}>(short summary)</span></label>
          <input
            placeholder="e.g. Invite link shows blank page on mobile"
            value={form.title}
            onChange={e => setForm(f => ({...f, title:e.target.value}))}
          />
        </div>

        <div>
          <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'6px' }}>DESCRIPTION * <span style={{ color:'var(--muted)', fontWeight:400 }}>(what happened)</span></label>
          <textarea
            placeholder="Describe the issue in detail. What did you expect to happen vs what actually happened?"
            value={form.description}
            onChange={e => setForm(f => ({...f, description:e.target.value}))}
            rows={4}
            style={{ lineHeight:1.6 }}
          />
        </div>

        <div>
          <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'6px' }}>STEPS TO REPRODUCE <span style={{ color:'var(--muted)', fontWeight:400 }}>(optional)</span></label>
          <textarea
            placeholder="1. Go to Trading Post&#10;2. Click Post Listing&#10;3. Submit without server name&#10;4. Error appears"
            value={form.steps}
            onChange={e => setForm(f => ({...f, steps:e.target.value}))}
            rows={3}
            style={{ lineHeight:1.6 }}
          />
        </div>

        <div>
          <label style={{ fontSize:'12px', color:'var(--muted)', display:'block', marginBottom:'6px' }}>PAGE / LOCATION <span style={{ color:'var(--muted)', fontWeight:400 }}>(optional)</span></label>
          <input
            placeholder="e.g. Trading Post, Settings, Mobile Menu"
            value={form.page}
            onChange={e => setForm(f => ({...f, page:e.target.value}))}
          />
        </div>
      </div>

      {/* Submitter info */}
      <div className="card" style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px', background:'#0d1a0d', borderColor:'var(--border)' }}>
        {avatar && <img src={avatar} style={{ width:32, height:32, borderRadius:'50%', border:'1px solid var(--border)', flexShrink:0 }} />}
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'13px', fontWeight:600 }}>{username}</div>
          <div style={{ fontSize:'11px', color:'var(--muted)' }}>Submitting as your Discord account</div>
        </div>
        <HelpCircle size={14} color="var(--muted)" />
      </div>

      {error && (
        <div style={{ display:'flex', alignItems:'center', gap:'8px', color:'var(--red)', fontSize:'13px' }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <button
        className="btn btn-green"
        style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', fontSize:'15px', padding:'12px', opacity: (!form.title.trim() || !form.description.trim()) ? 0.5 : 1 }}
        onClick={submit}
        disabled={submitting || !form.title.trim() || !form.description.trim()}
      >
        <Send size={15} /> {submitting ? 'Sending...' : 'Submit Report'}
      </button>

      <p style={{ fontSize:'12px', color:'var(--muted)', textAlign:'center' }}>
        Reports are sent directly to CIDMAN420 via Discord and logged permanently. Thank you for helping improve Faction Hub ☢️
      </p>
    </div>
  )
}