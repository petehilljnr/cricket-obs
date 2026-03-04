import { NavLink, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'

function AppLayout() {
  const handleSignOut = async () => {
    if (!supabase) {
      return
    }

    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div>
            <p className="text-base font-semibold">Cricket Scorer</p>
            <p className="text-xs text-muted-foreground">Manage fixtures, squads, and scoring setup</p>
          </div>

          <nav className="flex items-center gap-2">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`
              }
              end
            >
              Create fixture
            </NavLink>
            <NavLink
              to="/fixtures"
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`
              }
            >
              Fixtures
            </NavLink>
            <NavLink
              to="/scoring"
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`
              }
            >
              Scoring
            </NavLink>
            <NavLink
              to="/teams"
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`
              }
            >
              Teams
            </NavLink>
            <NavLink
              to="/players"
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`
              }
            >
              Players
            </NavLink>
            <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
