import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import {
  Users, Shield, AlertTriangle, RefreshCw, Ban, CheckCircle,
  Trash2, Crown, UserX, Eye, Bell, Megaphone, Check, X,
  BarChart2, Bug, ShieldOff, ShieldCheck, Plus
} from 'lucide-react'

const DISCORD_LINK = 'https://discord.gg/qcGJKnqE'

export default function CommandCenter({ session }) {
  const navigate = useNavigate()
  const userId = session.user.id

  const [isOwner, setIsOwner]         = useState(false)
  const [isMod, setIsMod]             = useState(false)
  const [modRole, setModRole]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState('stats')
  const [lastUpdated, setLastUpdated] = useState(null)

  // Data states
  const [stats, setStats]                       = useState({})
  const [users, setUsers]                       = useState([])
  const [factions, setFactions]                 = useState([])
  const [announcements, setAnnouncements]       = useState([])
  const [pendingAnnouncements, setPending]      = useState([])
  const [admins, setAdmins]                     = useState([])
  const [saving, setSaving]                     = useState(false)
  const [newModId, setNewModId]                 = useState('')
  const [newModName, setNewModName]             = useState('')
  const [confirmBan, setConfirmBan]             = useState(null)
  const [banReason, setBanReason]               = useState('')

  // ─── Check access level ───────────────────────────────────────────────────
  useEffect(() => {
    async function checkAccess() {
      const { data, error } = await supabase
        .from('server_admins')
        .select('id, role')
        .eq('user_id', userId)
        .maybeSingle()

      if (!error && data) {
        setModRole(data.role)
        if (data.role === 'admin') setIsOwner(true)
        if (data.role === 'moderator') setIsMod(true)
      }
      setLoading(false)
    }
    checkAccess()
  }, [userId])

  // ─── Load all data ────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([
      loadStats(),
      loadUsers(),
      loadFactions(),
      loadAnnouncements(),
      loadPending(),
      isOwner && loadAdmins(),
    ])
    setLastUpdated(new Date())
    setLoading(false)
  }, [isOwner])

  useEffect(() => {
    if (modRole) loadAll()
  }, [modRole])

  async function loadStats() {
    const [usersRes, factionsRes, reportsRes, bansRes, modsRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('factions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('bug_reports').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_banned', true),
      supabase.from('server_admins').select('id', { count: 'exact', head: true }),
    ])
    setStats({
      totalUsers:    usersRes.count    || 0,
      activeFactions: factionsRes.count || 0,
      bugReports:    reportsRes.count  || 0,
      bannedUsers:   bansRes.count     || 0,
      totalMods:     modsRes.count     || 0,
    })
  }

  async function loadUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, discord_username, discord_avatar, is_banned, ban_reason, banned_at, updated_at')
      .order('updated_at', { ascending: false })
    setUsers(data || [])
  }

  async function loadFactions() {
    const { data } = await supabase
      .from('factions')
      .select('id, name, tag, flag, primary_color, status, server_name, created_at, created_by')
      .order('created_at', { ascending: false })
    setFactions(data || [])
  }

  async function loadAnnouncements() {
    const { data } = await supabase
      .from('hub_announcements')
      .select('*, profile:profiles(discord_username)')
      .order('created_at', { ascending: false })
    setAnnouncements(data || [])
  }

  async function loadPending() {
    const { data } = await supabase
      .from('pending_announcements')
      .select('*, profile:profiles(discord_username)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setPending(data || [])
  }

  async function loadAdmins() {
    const { data } = await supabase
      .from('server_admins')
      .select('id, user_id, role, server_name, created_at, profile:profiles(discord_username, discord_avatar)')
    setAdmins(data || [])
  }

  // ─── Ban / Unban user ─────────────────────────────────────────────────────
  async function banUser(user) {
    if (!banReason.trim()) return
    setSaving(true)

    // Check if they're a faction leader
    const { data: membership } = await supabase
      .from('faction_members')
      .select('faction_id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    // If leader — ban the whole faction
    if (membership?.role === 'leader') {
      await supabase.from('factions')
        .update({ status: 'dead' })
        .eq('id', membership.faction_id)
    }

    // Ban the user
    await supabase.from('profiles').update({
      is_banned: true,
      ban_reason: banReason.trim(),
      banned_at: new Date().toISOString(),
      banned_by: userId,
    }).eq('id', user.id)

    setBanReason('')
    setConfirmBan(null)
    setSaving(false)
    await loadUsers()
    await loadFactions()
    await loadStats()
  }

  async function unbanUser(user) {
    setSaving(true)
    await supabase.from('profiles').update({
      is_banned: false,
      ban_reason: null,
      banned_at: null,
      banned_by: null,
    }).eq('id', user.id)
    setSaving(false)
    await loadUsers()
    await loadStats()
  }

  // ─── Revive / Kill faction ─────────────────────────────────────────────────
  async function toggleFactionStatus(faction) {
    const newStatus = faction.status === 'active' ? 'dead' : 'active'
    await supabase.from('factions').update({ status: newStatus }).eq('id', faction.id)
    await loadFactions()
    await loadStats()
  }

  // ─── Approve / Reject pending announcement ─────────────────────────────────
  async function approvePending(post) {
    setSaving(true)
    await supabase.from('hub_announcements').insert({
      title:      post.title,
      body:       post.body,
      type:       post.type,
      created_by: post.submitted_by,
    })
    await supabase.from('pending_announcements')
      .update({ status: 'approved' })
      .eq('id', post.id)
    setSaving(false)
    await loadPending()
    await loadAnnouncements()
  }

  async function rejectPending(post) {
    await supabase.from('pending_announcements')
      .update({ status: 'rejected' })
      .eq('id', post.id)
    await loadPending()
  }

  // ─── Delete announcement ──────────────────────────────────────────────────
  async function deleteAnnouncement(id) {
    if (!window.confirm('Delete this announcement?')) return
    await supabase.from('hub_announcements').delete().eq('id', id)
    await loadAnnouncements()
  }

  // ─── Add moderator ────────────────────────────────────────────────────────
  async function addModerator() {
    if (!newModId.trim()) return
    setSaving(true)
    await supabase.from('server_admins').insert({
      user_id:     newModId.trim(),
      server_name: newModName.trim() || 'Faction Hub',
      role:        'moderator',
    })
    setNewModId('')
    setNewModName('')
    setSaving(false)
    await loadAdmins()
    await loadStats()
  }

  async function removeModerator(id) {
    if (!window.confirm('Remove this moderator?')) return
    await supabase.from('server_admins').delete().eq('id', id)
    await loadAdmins()
    await loadStats()
  }

  // ─── Access denied ────────────────────────────────────────────────────────
  if (!loading && !isOwner && !isMod) return (
    <div style={{ maxWidth: 600, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', padding: '48px' }}>
        <ShieldOff size={40} color="var(--red)" />
        <h2 style={{ fontFamily: 'Share Tech Mono', fontSize: '22px', color: 'var(--red)' }}>ACCESS DENIED</h2>
        <p style={{ color: 'var(--muted)' }}>This area is restricted to Faction Hub staff only.</p>
        <button className="btn btn-green" onClick={() => navigate('/')}>Return to Base</button>
      </div>
    </div>
  )

  // ─── Tabs available based on role ─────────────────────────────────────────
  const tabs = [
    { key: 'stats',         label: '📊 Stats',         show: true },
    { key: 'users',         label: '👥 Users',         show: true },
    { key: 'factions',      label: '🛡️ Factions',      show: true },
    { key: 'announcements', label: '📣 Announcements', show: true },
    { key: 'pending',       label: `⏳ Pending${pendingAnnouncements.length > 0 ? ` (${pendingAnnouncements.length})` : ''}`, show: true },
    { key: 'admins',        label: '👑 Staff',         show: isOwner },
  ].filter(t => t.show)

  return (
    <div style={{ maxWidth: 1000, margin: '40px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'Share Tech Mono', fontSize: '26px', color: 'var(--green)', letterSpacing: '0.1em' }}>
            ☢️ COMMAND CENTER
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>
            {isOwner ? '👑 Owner — Full Access' : '🛡️ Moderator — Limited Access'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lastUpdated && (
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
            onClick={loadAll}
            disabled={loading}
          >
            <RefreshCw size={12} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'transparent', border: 'none', padding: '8px 16px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, fontFamily: 'Rajdhani',
            color: tab === t.key ? 'var(--green)' : 'var(--muted)',
            borderBottom: tab === t.key ? '2px solid var(--green)' : '2px solid transparent',
            whiteSpace: 'nowrap'
          }}>{t.label}</button>
        ))}
      </div>

      {loading && <div className="page-loading"><div className="spinner" /></div>}

      {/* ── STATS TAB ───────────────────────────────────────────────────────── */}
      {!loading && tab === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Total Users',      value: stats.totalUsers,      icon: Users,       color: 'var(--green)' },
              { label: 'Active Factions',  value: stats.activeFactions,  icon: Shield,      color: 'var(--green)' },
              { label: 'Banned Users',     value: stats.bannedUsers,     icon: Ban,         color: stats.bannedUsers > 0 ? 'var(--red)' : 'var(--muted)' },
              { label: 'Bug Reports',      value: stats.bugReports,      icon: Bug,         color: 'var(--yellow)' },
              { label: 'Staff Members',    value: stats.totalMods,       icon: Crown,       color: 'var(--yellow)' },
              { label: 'Pending Posts',    value: pendingAnnouncements.length, icon: Bell,  color: pendingAnnouncements.length > 0 ? 'var(--yellow)' : 'var(--muted)' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card" style={{ textAlign: 'center', padding: '20px' }}>
                <Icon size={20} color={color} style={{ marginBottom: '8px' }} />
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: '32px', color, fontWeight: 700 }}>{value ?? 0}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Bug reports Discord link */}
          <div className="card" style={{ borderColor: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontFamily: 'Share Tech Mono', color: 'var(--yellow)', fontSize: '13px', letterSpacing: '0.1em' }}>🐛 BUG REPORTS</h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
                Bug reports are handled through the Faction Hub Discord server.
              </p>
            </div>
            <a href={DISCORD_LINK} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Open Discord →
            </a>
          </div>
        </div>
      )}

      {/* ── USERS TAB ───────────────────────────────────────────────────────── */}
      {!loading && tab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            {users.length} total users — sorted by most recently active
          </p>
          {users.map(user => (
            <div key={user.id} className="card" style={{
              display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
              borderLeft: `3px solid ${user.is_banned ? 'var(--red)' : 'var(--border)'}`,
              opacity: user.is_banned ? 0.75 : 1
            }}>
              {user.discord_avatar
                ? <img src={user.discord_avatar} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)', flexShrink: 0 }} alt="avatar" />
                : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {user.discord_username || 'Unknown'}
                  {user.id === userId && <span style={{ fontSize: '10px', color: 'var(--green)', background: '#14532d33', padding: '1px 6px', borderRadius: '999px' }}>YOU</span>}
                  {user.is_banned && <span style={{ fontSize: '10px', color: 'var(--red)', background: '#450a0a33', padding: '1px 6px', borderRadius: '999px' }}>BANNED</span>}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                  ID: {user.id}
                </div>
                {user.is_banned && user.ban_reason && (
                  <div style={{ fontSize: '11px', color: 'var(--red)', marginTop: '2px' }}>
                    Reason: {user.ban_reason}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                  Last active: {user.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'Unknown'}
                </div>
              </div>

              {/* Ban / Unban controls — not on yourself */}
              {user.id !== userId && (
                <div style={{ flexShrink: 0 }}>
                  {user.is_banned ? (
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '12px', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => unbanUser(user)}
                      disabled={saving}
                    >
                      <CheckCircle size={13} /> Unban
                    </button>
                  ) : (
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '12px', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => setConfirmBan(user)}
                    >
                      <Ban size={13} /> Ban
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Ban confirmation modal */}
          {confirmBan && (
            <div style={{
              position: 'fixed', inset: 0, background: '#000000aa',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 999, padding: '24px'
            }}>
              <div className="card" style={{ maxWidth: 440, width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', borderColor: 'var(--red)' }}>
                <h3 style={{ fontFamily: 'Share Tech Mono', color: 'var(--red)', fontSize: '16px' }}>
                  ⚠️ BAN USER
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text)' }}>
                  You are about to ban <strong>{confirmBan.discord_username}</strong>.
                  If they are a faction leader, their entire faction will be marked as dead.
                </p>
                <input
                  placeholder="Reason for ban (required)..."
                  value={banReason}
                  onChange={e => setBanReason(e.target.value)}
                  style={{ fontSize: '14px' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-ghost"
                    style={{ color: 'var(--red)', flex: 1 }}
                    onClick={() => banUser(confirmBan)}
                    disabled={saving || !banReason.trim()}
                  >
                    {saving ? 'Banning...' : 'Confirm Ban'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => { setConfirmBan(null); setBanReason('') }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FACTIONS TAB ────────────────────────────────────────────────────── */}
      {!loading && tab === 'factions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            {factions.filter(f => f.status === 'active').length} active · {factions.filter(f => f.status === 'dead').length} dead
          </p>
          {factions.map(f => (
            <div key={f.id} className="card" style={{
              display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
              borderLeft: `3px solid ${f.status === 'dead' ? 'var(--red)' : f.primary_color || 'var(--border)'}`,
              opacity: f.status === 'dead' ? 0.6 : 1
            }}>
              <span style={{ fontSize: '28px', flexShrink: 0 }}>{f.flag || '☢️'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {f.tag && <span style={{ fontFamily: 'Share Tech Mono', fontSize: '12px', color: f.primary_color || 'var(--green)' }}>[{f.tag}]</span>}
                  {f.name}
                  {f.status === 'dead' && <span style={{ fontSize: '10px', color: 'var(--red)', background: '#450a0a33', padding: '1px 6px', borderRadius: '999px' }}>DEAD</span>}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                  Server: {f.server_name || 'None'} · Created {new Date(f.created_at).toLocaleDateString()}
                </div>
              </div>
              {isOwner && (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '12px', color: f.status === 'dead' ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                  onClick={() => toggleFactionStatus(f)}
                >
                  {f.status === 'dead'
                    ? <><ShieldCheck size={13} /> Revive</>
                    : <><ShieldOff size={13} /> Mark Dead</>
                  }
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── ANNOUNCEMENTS TAB ───────────────────────────────────────────────── */}
      {!loading && tab === 'announcements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            {announcements.length} published announcements
          </p>
          {announcements.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
              No announcements yet. Post one from the Hub page.
            </div>
          )}
          {announcements.map(post => (
            <div key={post.id} className="card" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>{post.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  By {post.profile?.discord_username || 'Unknown'} · {new Date(post.created_at).toLocaleDateString()}
                  {post.pinned && <span style={{ color: 'var(--green)', marginLeft: '8px' }}>📌 Pinned</span>}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text)', marginTop: '6px', whiteSpace: 'pre-wrap' }}>
                  {post.body.slice(0, 120)}{post.body.length > 120 ? '...' : ''}
                </div>
              </div>
              {isOwner && (
                <button
                  className="btn btn-ghost"
                  style={{ color: 'var(--red)', flexShrink: 0 }}
                  onClick={() => deleteAnnouncement(post.id)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── PENDING TAB ─────────────────────────────────────────────────────── */}
      {!loading && tab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {pendingAnnouncements.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
              ✅ No pending announcements. You're all caught up!
            </div>
          )}
          {pendingAnnouncements.map(post => (
            <div key={post.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderColor: 'var(--yellow)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{post.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                    Submitted by {post.profile?.discord_username || 'Unknown'} · {new Date(post.created_at).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text)', marginTop: '8px', whiteSpace: 'pre-wrap' }}>
                    {post.body}
                  </div>
                </div>
              </div>
              {isOwner && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-green"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                    onClick={() => approvePending(post)}
                    disabled={saving}
                  >
                    <Check size={13} /> Approve & Publish
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ color: 'var(--red)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => rejectPending(post)}
                  >
                    <X size={13} /> Reject
                  </button>
                </div>
              )}
              {!isOwner && (
                <p style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>
                  Awaiting owner approval
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── STAFF TAB (owner only) ───────────────────────────────────────────── */}
      {!loading && tab === 'admins' && isOwner && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Add moderator */}
          <div className="card" style={{ borderColor: 'var(--green-dim)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontFamily: 'Share Tech Mono', color: 'var(--green)', fontSize: '13px', letterSpacing: '0.1em' }}>
              ➕ ADD MODERATOR
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Enter the Supabase user ID of the person you want to make a moderator.
              They must have logged in at least once to have an ID.
            </p>
            <input
              placeholder="User ID (from profiles table)..."
              value={newModId}
              onChange={e => setNewModId(e.target.value)}
              style={{ fontSize: '13px' }}
            />
            <input
              placeholder="Their name (for your reference)..."
              value={newModName}
              onChange={e => setNewModName(e.target.value)}
              style={{ fontSize: '13px' }}
            />
            <button
              className="btn btn-green"
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
              onClick={addModerator}
              disabled={saving || !newModId.trim()}
            >
              <Plus size={13} /> Add Moderator
            </button>
          </div>

          {/* Staff list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {admins.map(admin => (
              <div key={admin.id} className="card" style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                borderLeft: `3px solid ${admin.role === 'admin' ? 'var(--yellow)' : 'var(--green)'}`
              }}>
                {admin.profile?.discord_avatar
                  ? <img src={admin.profile.discord_avatar} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)' }} alt="avatar" />
                  : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--border)' }} />
                }
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {admin.profile?.discord_username || admin.server_name || 'Unknown'}
                    <span style={{
                      fontSize: '10px',
                      color: admin.role === 'admin' ? 'var(--yellow)' : 'var(--green)',
                      background: admin.role === 'admin' ? '#713f1233' : '#14532d33',
                      padding: '1px 6px', borderRadius: '999px'
                    }}>
                      {admin.role === 'admin' ? '👑 OWNER' : '🛡️ MOD'}
                    </span>
                    {admin.user_id === userId && <span style={{ fontSize: '10px', color: 'var(--muted)' }}>(you)</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    Added {new Date(admin.created_at).toLocaleDateString()}
                  </div>
                </div>
                {admin.role !== 'admin' && (
                  <button
                    className="btn btn-ghost"
                    style={{ color: 'var(--red)', fontSize: '12px', flexShrink: 0 }}
                    onClick={() => removeModerator(admin.id)}
                  >
                    <UserX size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}