import { useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function ActivityTracker({ session }) {
  useEffect(() => {
    trackActivity()
    const interval = setInterval(trackActivity, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  async function trackActivity() {
    const userId = session.user.id
    const { data: mem } = await supabase
      .from('faction_members')
      .select('faction_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!mem) return

    await supabase.from('member_activity').upsert({
      user_id: userId,
      faction_id: mem.faction_id,
      last_seen: new Date().toISOString(),
      page_visits: 1
    }, {
      onConflict: 'user_id,faction_id',
      ignoreDuplicates: false
    })
  }

  return null
}