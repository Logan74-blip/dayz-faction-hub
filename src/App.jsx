import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
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
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--green)', fontFamily:'Share Tech Mono' }}>
      LOADING FACTION HUB...
    </div>
  )

  return (
    <>
      {session && <Navbar session={session} />}
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/invite/:code" element={<Invite session={session} />} />
        <Route path="/" element={<ProtectedRoute session={session}><Dashboard session={session} /></ProtectedRoute>} />
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
      </Routes>
    </>
  )
}