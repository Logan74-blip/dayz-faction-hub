import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export function useRole(userId) {
  const [role, setRole] = useState(null)
  const [faction, setFaction] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) load()
  }, [userId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('faction_members')
      .select('role, factions(*)')
      .eq('user_id', userId)
      .maybeSingle()
    if (data) {
      setRole(data.role)
      setFaction(data.factions)
    }
    setLoading(false)
  }

  const perms = {
    canManage: role === 'leader' || role === 'co-leader',
    canInvite: role === 'leader' || role === 'co-leader' || role === 'recruiter',
    canKick: role === 'leader' || role === 'co-leader',
  }

  return { role, faction, loading, perms, reload: load }
}