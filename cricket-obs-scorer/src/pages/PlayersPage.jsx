import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabaseClient'

function PlayersPage() {
  const [teams, setTeams] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [players, setPlayers] = useState([])
  const [isLoadingTeams, setIsLoadingTeams] = useState(false)
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false)
  const [isSavingPlayer, setIsSavingPlayer] = useState(false)
  const [isUpdatingPlayerId, setIsUpdatingPlayerId] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [form, setForm] = useState({ fullName: '', displayName: '', shirtNumber: '' })
  const [editingPlayers, setEditingPlayers] = useState({})

  const loadTeams = async () => {
    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }

    setIsLoadingTeams(true)

    const { data, error: loadError } = await supabase
      .from('teams')
      .select('id, name')
      .order('name', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setIsLoadingTeams(false)
      return
    }

    const nextTeams = data ?? []
    setTeams(nextTeams)
    setSelectedTeamId((current) => current || nextTeams[0]?.id || '')
    setIsLoadingTeams(false)
  }

  const loadPlayers = async (teamId) => {
    if (!supabase || !teamId) {
      setPlayers([])
      return
    }

    setIsLoadingPlayers(true)

    const { data, error: loadError } = await supabase
      .from('players')
      .select('id, full_name, display_name, shirt_number, is_active')
      .eq('team_id', teamId)
      .order('full_name', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setIsLoadingPlayers(false)
      return
    }

    setPlayers(data ?? [])
    setIsLoadingPlayers(false)
  }

  useEffect(() => {
    loadTeams()
  }, [])

  useEffect(() => {
    loadPlayers(selectedTeamId)
  }, [selectedTeamId])

  const handleAddPlayer = async (event) => {
    event.preventDefault()

    if (!supabase || !selectedTeamId || !form.fullName.trim()) {
      return
    }

    setIsSavingPlayer(true)
    setError('')
    setSuccessMessage('')

    const { error: insertError } = await supabase.from('players').insert({
      team_id: selectedTeamId,
      full_name: form.fullName.trim(),
      display_name: form.displayName.trim() || null,
      shirt_number: form.shirtNumber ? Number(form.shirtNumber) : null,
      is_active: true,
    })

    if (insertError) {
      setError(insertError.message)
      setIsSavingPlayer(false)
      return
    }

    setForm({ fullName: '', displayName: '', shirtNumber: '' })
    setSuccessMessage('Player added successfully.')
    setIsSavingPlayer(false)
    loadPlayers(selectedTeamId)
  }

  const beginEditPlayer = (player) => {
    setEditingPlayers((current) => ({
      ...current,
      [player.id]: {
        fullName: player.full_name,
        displayName: player.display_name ?? '',
        shirtNumber: player.shirt_number ?? '',
        isActive: player.is_active,
      },
    }))
  }

  const cancelEditPlayer = (playerId) => {
    setEditingPlayers((current) => {
      const next = { ...current }
      delete next[playerId]
      return next
    })
  }

  const savePlayerEdit = async (playerId) => {
    if (!supabase || !selectedTeamId || !editingPlayers[playerId]) {
      return
    }

    const draft = editingPlayers[playerId]
    if (!draft.fullName.trim()) {
      return
    }

    setIsUpdatingPlayerId(playerId)
    setError('')
    setSuccessMessage('')

    const { error: updateError } = await supabase
      .from('players')
      .update({
        full_name: draft.fullName.trim(),
        display_name: draft.displayName.trim() || null,
        shirt_number: draft.shirtNumber ? Number(draft.shirtNumber) : null,
        is_active: draft.isActive,
      })
      .eq('id', playerId)

    if (updateError) {
      setError(updateError.message)
      setIsUpdatingPlayerId('')
      return
    }

    cancelEditPlayer(playerId)
    setSuccessMessage('Player updated successfully.')
    setIsUpdatingPlayerId('')
    loadPlayers(selectedTeamId)
  }

  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle>Players</CardTitle>
          <CardDescription>Add and view players by team.</CardDescription>
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

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="playersTeam">Team</label>
            <select
              id="playersTeam"
              className="flex h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={selectedTeamId}
              onChange={(event) => setSelectedTeamId(event.target.value)}
              disabled={isLoadingTeams}
            >
              {!selectedTeamId && <option value="">Select team</option>}
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>

          <form className="grid gap-3 md:grid-cols-4" onSubmit={handleAddPlayer}>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium" htmlFor="fullName">Full name</label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                placeholder="John Smith"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="displayName">Display name</label>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="J Smith"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="shirtNumber">Shirt #</label>
              <Input
                id="shirtNumber"
                type="number"
                value={form.shirtNumber}
                onChange={(event) => setForm((current) => ({ ...current, shirtNumber: event.target.value }))}
                placeholder="12"
              />
            </div>

            <div className="md:col-span-4 flex gap-2">
              <Button type="submit" disabled={!selectedTeamId || isSavingPlayer}>
                {isSavingPlayer ? 'Saving...' : 'Add player'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => loadPlayers(selectedTeamId)} disabled={!selectedTeamId || isLoadingPlayers}>
                {isLoadingPlayers ? 'Refreshing...' : 'Refresh players'}
              </Button>
            </div>
          </form>

          <ul className="overflow-hidden rounded-md border">
            {!selectedTeamId && (
              <li className="p-3 text-sm text-muted-foreground">Select a team to view players.</li>
            )}
            {selectedTeamId && players.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">No players found for this team.</li>
            )}
            {players.map((player) => {
              const editDraft = editingPlayers[player.id]
              const isUpdating = isUpdatingPlayerId === player.id

              return (
                <li key={player.id} className="border-b p-3 last:border-b-0">
                  {editDraft ? (
                    <div className="space-y-3">
                      <div className="grid gap-2 md:grid-cols-3">
                        <Input
                          value={editDraft.fullName}
                          onChange={(event) =>
                            setEditingPlayers((current) => ({
                              ...current,
                              [player.id]: {
                                ...editDraft,
                                fullName: event.target.value,
                              },
                            }))
                          }
                          placeholder="Full name"
                        />
                        <Input
                          value={editDraft.displayName}
                          onChange={(event) =>
                            setEditingPlayers((current) => ({
                              ...current,
                              [player.id]: {
                                ...editDraft,
                                displayName: event.target.value,
                              },
                            }))
                          }
                          placeholder="Display name"
                        />
                        <Input
                          type="number"
                          value={editDraft.shirtNumber}
                          onChange={(event) =>
                            setEditingPlayers((current) => ({
                              ...current,
                              [player.id]: {
                                ...editDraft,
                                shirtNumber: event.target.value,
                              },
                            }))
                          }
                          placeholder="Shirt #"
                        />
                      </div>

                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editDraft.isActive}
                          onChange={(event) =>
                            setEditingPlayers((current) => ({
                              ...current,
                              [player.id]: {
                                ...editDraft,
                                isActive: event.target.checked,
                              },
                            }))
                          }
                        />
                        Active player
                      </label>

                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={() => savePlayerEdit(player.id)} disabled={isUpdating}>
                          {isUpdating ? 'Saving...' : 'Save'}
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => cancelEditPlayer(player.id)} disabled={isUpdating}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{player.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {player.display_name || 'No display name'} · #{player.shirt_number ?? '-'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{player.is_active ? 'Active' : 'Inactive'}</span>
                        <Button type="button" size="sm" variant="secondary" onClick={() => beginEditPlayer(player)}>
                          Edit
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}

export default PlayersPage
