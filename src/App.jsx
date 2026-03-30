import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Welcome from './pages/Welcome'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import WarMap from './pages/WarMap'
import Resources from './pages/Resources'
import Diplomacy from './pages/Diplomacy'
import Raids from './pages/Raids'
import Invite from './pages/Invite'
import Settings from './pages/Settings'
import Directory from './pages/Directory'
import Announcements from './pages/Announcements'
import Leaderboard from './pages/Leaderboard'
import Trading from './pages/Trading'
import Bounties from './pages/Bounties'
import EventLog from './pages/EventLog'
import FactionProfile from './pages/FactionProfile'
import FactionVsFaction from './pages/FactionVsFaction'
import Achievements from './pages/Achievements'
import JoinRequests from './pages/JoinRequests'
import ServerPage from './pages/ServerPage'
import Messages from './pages/Messages'
import WarRoom from './pages/WarRoom'
import AllianceNetwork from './pages/AllianceNetwork'
import ServerCalendar from './pages/ServerCalendar'
import Treasury from './pages/Treasury'
import AdminDashboard from './pages/AdminDashboard'
import Customize from './pages/Customize'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import ActivityTracker from './components/ActivityTracker'
import HubAnnouncements from './pages/HubAnnouncements'
import FactionLogs from './pages/FactionLogs'
import DeadFactions from './pages/DeadFactions'
import Help from './pages/Help'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [checkingProfile, setCheckingProfile] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) loadProfile(s.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    setCheckingProfile(true)
    const { data } = await supabase.from('profiles').select('onboarding_done').eq('id', userId).maybeSingle()
    setProfile(data)
    setCheckingProfile(false)
  }

  if (session === undefined || (session && checkingProfile)) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--green)', fontFamily:'Share Tech Mono', flexDirection:'column', gap:'16px' }}>
      <div style={{ fontSize:'32px' }}>☢️</div>
      <div>LOADING FACTION HUB...</div>
    </div>
  )

  // New user who hasn't done onboarding
  const needsOnboarding = session && profile && !profile.onboarding_done

  return (
    <>
      {session && !needsOnboarding && <Navbar session={session} />}
      {session && !needsOnboarding && <ActivityTracker session={session} />}
      <Routes>
        {/* Public routes */}
        <Route path="/welcome" element={!session ? <Welcome /> : <Navigate to="/" />} />
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/invite/:code" element={<Invite session={session} />} />

        {/* Onboarding */}
        <Route path="/onboarding" element={session ? <Onboarding session={session} /> : <Navigate to="/welcome" />} />

        {/* Redirect to welcome if not logged in */}
        <Route path="/" element={
          !session ? <Navigate to="/welcome" /> :
          needsOnboarding ? <Navigate to="/onboarding" /> :
          <ProtectedRoute session={session}><Dashboard session={session} /></ProtectedRoute>
        } />

        {/* Protected routes */}
        <Route path="/map" element={<ProtectedRoute session={session}><WarMap session={session} /></ProtectedRoute>} />
        <Route path="/resources" element={<ProtectedRoute session={session}><Resources session={session} /></ProtectedRoute>} />
        <Route path="/diplomacy" element={<ProtectedRoute session={session}><Diplomacy session={session} /></ProtectedRoute>} />
        <Route path="/raids" element={<ProtectedRoute session={session}><Raids session={session} /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute session={session}><Settings session={session} /></ProtectedRoute>} />
        <Route path="/directory" element={<ProtectedRoute session={session}><Directory session={session} /></ProtectedRoute>} />
        <Route path="/announcements" element={<ProtectedRoute session={session}><Announcements session={session} /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute session={session}><Leaderboard session={session} /></ProtectedRoute>} />
        <Route path="/trading" element={<ProtectedRoute session={session}><Trading session={session} /></ProtectedRoute>} />
        <Route path="/bounties" element={<ProtectedRoute session={session}><Bounties session={session} /></ProtectedRoute>} />
        <Route path="/eventlog" element={<ProtectedRoute session={session}><EventLog session={session} /></ProtectedRoute>} />
        <Route path="/faction/:id" element={<ProtectedRoute session={session}><FactionProfile session={session} /></ProtectedRoute>} />
        <Route path="/versus" element={<ProtectedRoute session={session}><FactionVsFaction session={session} /></ProtectedRoute>} />
        <Route path="/achievements" element={<ProtectedRoute session={session}><Achievements session={session} /></ProtectedRoute>} />
        <Route path="/join-requests" element={<ProtectedRoute session={session}><JoinRequests session={session} /></ProtectedRoute>} />
        <Route path="/server/:name" element={<ProtectedRoute session={session}><ServerPage session={session} /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute session={session}><Messages session={session} /></ProtectedRoute>} />
        <Route path="/warroom" element={<ProtectedRoute session={session}><WarRoom session={session} /></ProtectedRoute>} />
        <Route path="/alliance-network" element={<ProtectedRoute session={session}><AllianceNetwork session={session} /></ProtectedRoute>} />
        <Route path="/server-calendar" element={<ProtectedRoute session={session}><ServerCalendar session={session} /></ProtectedRoute>} />
        <Route path="/treasury" element={<ProtectedRoute session={session}><Treasury session={session} /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute session={session}><AdminDashboard session={session} /></ProtectedRoute>} />
        <Route path="/customize" element={<ProtectedRoute session={session}><Customize session={session} /></ProtectedRoute>} />
        <Route path="/hub" element={<ProtectedRoute session={session}><HubAnnouncements session={session} /></ProtectedRoute>} />
        <Route path="/faction-logs" element={<ProtectedRoute session={session}><FactionLogs session={session} /></ProtectedRoute>} />
        <Route path="/dead-factions" element={<ProtectedRoute session={session}><DeadFactions /></ProtectedRoute>} />
        <Route path="/help" element={<ProtectedRoute session={session}><Help /></ProtectedRoute>} />
      </Routes>
    </>
  )
}