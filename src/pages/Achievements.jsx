import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useRole } from '../hooks/useRole'

const ALL_ACHIEVEMENTS = [
  { key:'first_raid', icon:'⚔️', title:'First Blood', description:'Complete your first raid', color:'var(--red)' },
  { key:'members_10', icon:'👥', title:'Growing Force', description:'Reach 10 faction members', color:'var(--green)' },
  { key:'members_25', icon:'🪖', title:'Small Army', description:'Reach 25 faction members', color:'var(--green)' },
  { key:'members_50', icon:'⚡', title:'Major Force', description:'Reach 50 faction members', color:'var(--yellow)' },
  { key:'territories_5', icon:'🗺️', title:'Territorial', description:'Claim 5 territories', color:'var(--yellow)' },
  { key:'first_alliance', icon:'🤝', title:'Diplomat', description:'Sign your first Non-Aggression Pact', color:'#818cf8' },
  { key:'first_bounty', icon:'🎯', title:'Bounty Hunter', description:'Collect your first bounty', color:'var(--yellow)' },
  { key:'first_war_won', icon:'🏆', title:'Victorious', description:'Win your first war declaration', color:'var(--yellow)' },
  { key:'raids_100', icon:'💀', title:'Century of Blood', description:'Complete 100 raids', color:'var(--red)' },
]

export default function Achievements({ session }) {
  const { faction } = useRole(session.user.id)
  const [unlocked, setUnlocked] = useState([])
  const [checking, setChecking] = useState(false)

  useEffect(() => { if (faction) { loadAchievements(); checkAndUnlock() } }, [faction])

  async function loadAchievements() {
    const { data } = await supabase.from('achievements').select('*').eq('faction_id', faction.id)
    setUnlocked(data || [])
  }

  async function checkAndUnlock() {
    setChecking(true)
    const { data: existing } = await supabase.from('achievements').select('key').eq('faction_id', faction.id)
    const unlockedKeys = existing?.map(a => a.key) || []

    const [members, territories, raids, alliances, bounties] = await Promise.all([
      supabase.from('faction_members').select('id', { count:'exact' }).eq('faction_id', faction.id),
      supabase.from('territories').select('id', { count:'exact' }).eq('faction_id', faction.id),
      supabase.from('raids').select('id', { count:'exact' }).eq('faction_id', faction.id).eq('outcome', 'success'),
      supabase.from('diplomacy').select('id', { count:'exact' }).eq('type', 'nap').eq('status', 'active').or(`faction_a.eq.${faction.id},faction_b.eq.${faction.id}`),
      supabase.from('bounties').select('id', { count:'exact' }).eq('faction_id', faction.id).eq('status', 'completed'),
    ])

    const mc = members.count || 0
    const tc = territories.count || 0
    const rc = raids.count || 0
    const ac = alliances.count || 0
    const bc = bounties.count || 0

    const toUnlock = []
    const check = (key, condition) => { if (condition && !unlockedKeys.includes(key)) { const meta = ALL_ACHIEVEMENTS.find(a => a.key === key); if (meta) toUnlock.push({ faction_id: faction.id, key, title: meta.title, description: meta.description, icon: meta.icon }) } }

    check('first_raid', rc >= 1)
    check('members_10', mc >= 10)
    check('members_25', mc >= 25)
    check('members_50', mc >= 50)
    check('territories_5', tc >= 5)
    check('first_alliance', ac >= 1)
    check('first_bounty', bc >= 1)
    check('raids_100', rc >= 100)

    if (toUnlock.length > 0) {
      await supabase.from('achievements').insert(toUnlock)
      // Notify all members
      const { data: mems } = await supabase.from('faction_members').select('user_id').eq('faction_id', faction.id)
      for (const ach of toUnlock) {
        if (mems?.length) {
          await supabase.from('notifications').insert(mems.map(m => ({
            faction_id: faction.id,
            user_id: m.user_id,
            type: 'general',
            title: `🏆 Achievement Unlocked: ${ach.title}`,
            body: ach.description
          })))
        }
        await supabase.from('events').insert({
          faction_id: faction.id,
          created_by: session.user.id,
          type: 'custom',
          title: `🏆 Achievement Unlocked: ${ach.title}`,
          description: ach.description
        })
      }
      loadAchievements()
    }
    setChecking(false)
  }

  const unlockedKeys = unlocked.map(a => a.key)

  return (
    <div style={{ maxWidth:800, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'24px', color:'var(--green)' }}>ACHIEVEMENTS</h1>
          <p style={{ color:'var(--muted)', marginTop:'4px' }}>
            {unlocked.length}/{ALL_ACHIEVEMENTS.length} unlocked
            {checking && <span style={{ marginLeft:'10px', fontSize:'12px' }}>Checking...</span>}
          </p>
        </div>
        <div style={{ fontFamily:'Share Tech Mono', fontSize:'32px', color:'var(--yellow)' }}>
          {unlocked.length > 0 ? '🏆'.repeat(Math.min(unlocked.length, 5)) : '☆'}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background:'var(--border)', borderRadius:'999px', height:'8px', overflow:'hidden' }}>
        <div style={{
          height:'100%', borderRadius:'999px',
          background:'linear-gradient(90deg, var(--green-dim), var(--yellow))',
          width:`${Math.round((unlocked.length / ALL_ACHIEVEMENTS.length) * 100)}%`,
          transition:'width 0.5s ease'
        }} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:'14px' }}>
        {ALL_ACHIEVEMENTS.map(ach => {
          const isUnlocked = unlockedKeys.includes(ach.key)
          const unlockedData = unlocked.find(u => u.key === ach.key)
          return (
            <div key={ach.key} className="card" style={{
              display:'flex', flexDirection:'column', gap:'10px', padding:'18px',
              borderLeft:`3px solid ${isUnlocked ? ach.color : 'var(--border)'}`,
              opacity: isUnlocked ? 1 : 0.5,
              transition:'all 0.2s',
              background: isUnlocked ? `${ach.color}08` : 'var(--surface)'
            }}>
              <div style={{ fontSize:'32px', filter: isUnlocked ? 'none' : 'grayscale(1)' }}>{ach.icon}</div>
              <div>
                <div style={{ fontWeight:700, fontSize:'15px', color: isUnlocked ? ach.color : 'var(--muted)' }}>{ach.title}</div>
                <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'4px' }}>{ach.description}</div>
              </div>
              {isUnlocked && unlockedData?.unlocked_at && (
                <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'auto' }}>
                  Unlocked {new Date(unlockedData.unlocked_at).toLocaleDateString()}
                </div>
              )}
              {!isUnlocked && (
                <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'auto' }}>🔒 Locked</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}