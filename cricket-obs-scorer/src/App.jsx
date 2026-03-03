import { useEffect, useState } from 'react'
import { hasSupabaseConfig, supabase } from './lib/supabaseClient'
import './App.css'

function App() {
  const [teams, setTeams] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', shortName: '' })

  const loadTeams = async () => {
    if (!supabase) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.')
      return
    }

    setIsLoading(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('teams')
      .select('id, name, short_name, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    if (loadError) {
      setError(loadError.message)
      setIsLoading(false)
      return
    }

    setTeams(data ?? [])
    setIsLoading(false)
  }

  useEffect(() => {
    if (hasSupabaseConfig) {
      loadTeams()
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!supabase || !form.name.trim()) {
      return
    }

    setIsSaving(true)
    setError('')

    const payload = {
      name: form.name.trim(),
      short_name: form.shortName.trim() || null,
    }

    const { error: insertError } = await supabase.from('teams').insert(payload)

    if (insertError) {
      setError(insertError.message)
      setIsSaving(false)
      return
    }

    setForm({ name: '', shortName: '' })
    setIsSaving(false)
    loadTeams()
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>Cricket OBS Scorer</h1>
        <p className="subtitle">Supabase connection and team bootstrap</p>

        {!hasSupabaseConfig && (
          <p className="alert">
            Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to connect.
          </p>
        )}

        <form className="team-form" onSubmit={handleSubmit}>
          <label>
            Team name
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Sydney Cricket Club"
              required
            />
          </label>

          <label>
            Short name
            <input
              value={form.shortName}
              onChange={(event) =>
                setForm((current) => ({ ...current, shortName: event.target.value }))
              }
              placeholder="SCC"
              maxLength={12}
            />
          </label>

          <button type="submit" disabled={!hasSupabaseConfig || isSaving}>
            {isSaving ? 'Saving...' : 'Add team'}
          </button>
        </form>

        <div className="teams-header">
          <h2>Recent teams</h2>
          <button type="button" onClick={loadTeams} disabled={!hasSupabaseConfig || isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && <p className="alert">{error}</p>}

        <ul className="teams-list">
          {teams.length === 0 && <li>No teams found yet.</li>}
          {teams.map((team) => (
            <li key={team.id}>
              <span>{team.name}</span>
              <strong>{team.short_name || '—'}</strong>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
