import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabaseClient'

function TeamsPage() {
  const [teams, setTeams] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [form, setForm] = useState({ name: '', shortName: '' })

  const loadTeams = async () => {
    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }

    setIsLoading(true)

    const { data, error: loadError } = await supabase
      .from('teams')
      .select('id, name, short_name, created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    if (loadError) {
      setError(loadError.message)
      setIsLoading(false)
      return
    }

    setTeams(data ?? [])
    setIsLoading(false)
  }

  useEffect(() => {
    loadTeams()
  }, [])

  const handleAddTeam = async (event) => {
    event.preventDefault()

    if (!supabase || !form.name.trim()) {
      return
    }

    setIsSaving(true)
    setError('')
    setSuccessMessage('')

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
    setSuccessMessage('Team added successfully.')
    setIsSaving(false)
    loadTeams()
  }

  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle>Teams</CardTitle>
          <CardDescription>Add and view teams used when creating fixtures.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {successMessage && (
            <p className="rounded-md border border-emerald-300/60 bg-emerald-50 p-3 text-sm text-emerald-700">
              {successMessage}
            </p>
          )}

          {error && (
            <p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <form className="grid gap-3 md:grid-cols-3" onSubmit={handleAddTeam}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="teamName">Team name</label>
              <Input
                id="teamName"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Sydney Cricket Club"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="shortName">Short name</label>
              <Input
                id="shortName"
                value={form.shortName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, shortName: event.target.value }))
                }
                placeholder="SCC"
                maxLength={12}
              />
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Add team'}
              </Button>
              <Button type="button" variant="secondary" onClick={loadTeams} disabled={isLoading}>
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </form>

          <ul className="overflow-hidden rounded-md border">
            {teams.length === 0 && <li className="p-3 text-sm text-muted-foreground">No teams found yet.</li>}
            {teams.map((team) => (
              <li key={team.id} className="flex items-center justify-between border-b p-3 last:border-b-0">
                <span>{team.name}</span>
                <strong>{team.short_name || '—'}</strong>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}

export default TeamsPage
