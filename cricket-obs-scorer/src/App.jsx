import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import DashboardPage from './pages/DashboardPage'
import FixturesListPage from './pages/FixturesListPage'
import LoginPage from './pages/LoginPage'
import PlayersPage from './pages/PlayersPage'
import ScoringPage from './pages/ScoringPage'
import TeamsPage from './pages/TeamsPage'
import { hasSupabaseConfig, supabase } from './lib/supabaseClient'

function ProtectedRoute({ session, children }) {
  if (!session) {
    return <Navigate to="/login" replace />
  }

  return children
}

function App() {
  const [session, setSession] = useState(null)
  const [isLoadingSession, setIsLoadingSession] = useState(hasSupabaseConfig)

  useEffect(() => {
    if (!supabase) {
      setIsLoadingSession(false)
      return
    }

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session ?? null)
      setIsLoadingSession(false)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (!hasSupabaseConfig) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Supabase setup required</CardTitle>
            <CardDescription>Login is disabled until Supabase env variables are configured.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file and restart the dev server.
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (isLoadingSession) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center p-4 md:p-8">
        <p className="text-sm text-muted-foreground">Checking session...</p>
      </main>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage session={session} />} />
        <Route
          element={(
            <ProtectedRoute session={session}>
              <AppLayout />
            </ProtectedRoute>
          )}
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/fixtures" element={<FixturesListPage />} />
          <Route path="/scoring" element={<ScoringPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/teams" element={<TeamsPage />} />
        </Route>
        <Route path="*" element={<Navigate to={session ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
