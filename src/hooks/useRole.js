import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const PERMISSIONS = {
  'leader':     { raids:true, diplomacy:true, kick:true, invites:true, recruiting:true },
  'co-leader':  { raids:true, diplomacy:true, kick:true, invites:true, recruiting:true },
  'recruiter':  { raids:false, diplomacy:false, kick:false, invites:true, recruiting:true },
  'member':     { raids:false, diplomacy:false, kick:false, invites:false, recruiting:false },
}

export function useRole(userId) {
  const [role, setRole] = useState(null)
  const [faction, setFaction] = useState(null)
  const [perms, setPerms] = useState(PERMISSIONS['member'])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    supabase.from('faction_members')
      .select('role, factions(*)')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setRole(data.role)
          setFaction(data.factions)
          setPerms(PERMISSIONS[data.role] || PERMISSIONS['member'])
        }
        setLoading(false)
      })
  }, [userId])

  return { role, faction, perms, loading }
}