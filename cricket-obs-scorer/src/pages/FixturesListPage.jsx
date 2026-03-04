import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabaseClient'

const MATCH_FORMATS = ['TWO_DAY', 'TEST', 'ODI', 'T20', 'CUSTOM']
const MATCH_STATUSES = ['SCHEDULED', 'LIVE', 'COMPLETE', 'ABANDONED']
const emptyPlayerForm = { fullName: '', displayName: '', shirtNumber: '' }

function FixturesListPage() {
  const [fixtures, setFixtures] = useState([])
  const [teams, setTeams] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingTeams, setIsLoadingTeams] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [editingFixtureId, setEditingFixtureId] = useState('')
  const [editForm, setEditForm] = useState(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeletingById, setIsDeletingById] = useState({})
  const [playersByTeam, setPlayersByTeam] = useState({})
  const [isLoadingPlayersByTeam, setIsLoadingPlayersByTeam] = useState({})
  const [newPlayerFormsByTeam, setNewPlayerFormsByTeam] = useState({})
  const [editingPlayers, setEditingPlayers] = useState({})
  const [isSavingPlayerByTeam, setIsSavingPlayerByTeam] = useState({})
  const [playerSelection, setPlayerSelection] = useState({})

  const selectedFixtureTeamIds = [...new Set([editForm?.homeTeamId, editForm?.awayTeamId].filter(Boolean))]

  const teamNameById = teams.reduce((acc, team) => {
    acc[team.id] = team.name
    return acc
  }, {})

  const toDateTimeLocalValue = (value) => {
    if (!value) {
      return ''
    }

    const dateValue = new Date(value)
    if (Number.isNaN(dateValue.getTime())) {
      return ''
    }

    const timezoneOffsetMs = dateValue.getTimezoneOffset() * 60 * 1000
    return new Date(dateValue.getTime() - timezoneOffsetMs).toISOString().slice(0, 16)
  }

  const loadFixtures = async () => {
    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }

    setIsLoading(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('matches')
      .select(`
        id,
        format,
        venue,
        start_time,
        balls_per_over,
        status,
        home_team_id,
        away_team_id,
        created_at,
        home_team:teams!matches_home_team_id_fkey(name, short_name),
        away_team:teams!matches_away_team_id_fkey(name, short_name)
      `)
      .order('start_time', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (loadError) {
      setError(loadError.message)
      setIsLoading(false)
      return
    }

    setFixtures(data ?? [])
    setIsLoading(false)
  }

  const loadPlayersForTeam = async (teamId) => {
    if (!supabase || !teamId) {
      return
    }

    setIsLoadingPlayersByTeam((current) => ({ ...current, [teamId]: true }))

    const { data, error: loadError } = await supabase
      .from('players')
      .select('id, team_id, full_name, display_name, shirt_number, is_active')
      .eq('team_id', teamId)
      .order('full_name', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setIsLoadingPlayersByTeam((current) => ({ ...current, [teamId]: false }))
      return
    }

    setPlayersByTeam((current) => ({ ...current, [teamId]: data ?? [] }))
    setNewPlayerFormsByTeam((current) => ({
      ...current,
      [teamId]: current[teamId] ?? emptyPlayerForm,
    }))
    setIsLoadingPlayersByTeam((current) => ({ ...current, [teamId]: false }))
  }

  const loadFixturePlayersSelection = async (fixtureId) => {
    if (!supabase || !fixtureId) {
      return
    }

    const { data, error: loadError } = await supabase
      .from('match_players')
      .select('player_id, is_playing_xi')
      .eq('match_id', fixtureId)

    if (loadError) {
      setError(loadError.message)
      return
    }

    const nextSelection = (data ?? []).reduce((acc, row) => {
      acc[row.player_id] = {
        selected: true,
        playingXI: Boolean(row.is_playing_xi),
      }
      return acc
    }, {})

    setPlayerSelection(nextSelection)
  }

  const loadTeams = async () => {
    if (!supabase) {
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

    setTeams(data ?? [])
    setIsLoadingTeams(false)
  }

  useEffect(() => {
    loadFixtures()
    loadTeams()
  }, [])

  useEffect(() => {
    selectedFixtureTeamIds.forEach((teamId) => {
      if (!playersByTeam[teamId]) {
        loadPlayersForTeam(teamId)
      }
    })
  }, [editForm?.homeTeamId, editForm?.awayTeamId])

  const formatDateTime = (value) => {
    if (!value) {
      return 'Not set'
    }

    const dateValue = new Date(value)
    if (Number.isNaN(dateValue.getTime())) {
      return 'Not set'
    }

    return dateValue.toLocaleString()
  }

  const startEditingFixture = async (fixture) => {
    setError('')
    setSuccessMessage('')
    setEditingFixtureId(fixture.id)
    setEditingPlayers({})
    setEditForm({
      format: fixture.format,
      venue: fixture.venue ?? '',
      startTime: toDateTimeLocalValue(fixture.start_time),
      ballsPerOver: String(fixture.balls_per_over ?? 6),
      status: fixture.status,
      homeTeamId: fixture.home_team_id ?? '',
      awayTeamId: fixture.away_team_id ?? '',
    })

    await Promise.all([
      loadPlayersForTeam(fixture.home_team_id),
      loadPlayersForTeam(fixture.away_team_id),
      loadFixturePlayersSelection(fixture.id),
    ])
  }

  const cancelEditingFixture = () => {
    setEditingFixtureId('')
    setEditForm(null)
    setEditingPlayers({})
    setPlayerSelection({})
  }

  const handleAddPlayer = async (teamId) => {
    if (!supabase || !teamId) {
      return
    }

    const playerForm = newPlayerFormsByTeam[teamId] ?? emptyPlayerForm
    if (!playerForm.fullName?.trim()) {
      return
    }

    setIsSavingPlayerByTeam((current) => ({ ...current, [teamId]: true }))
    setError('')
    setSuccessMessage('')

    const { error: insertError } = await supabase.from('players').insert({
      team_id: teamId,
      full_name: playerForm.fullName.trim(),
      display_name: playerForm.displayName.trim() || null,
      shirt_number: playerForm.shirtNumber ? Number(playerForm.shirtNumber) : null,
      is_active: true,
    })

    if (insertError) {
      setError(insertError.message)
      setIsSavingPlayerByTeam((current) => ({ ...current, [teamId]: false }))
      return
    }

    setNewPlayerFormsByTeam((current) => ({
      ...current,
      [teamId]: emptyPlayerForm,
    }))
    setIsSavingPlayerByTeam((current) => ({ ...current, [teamId]: false }))
    await loadPlayersForTeam(teamId)
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

  const savePlayerEdit = async (teamId, playerId) => {
    if (!supabase || !editingPlayers[playerId]) {
      return
    }

    const draft = editingPlayers[playerId]
    if (!draft.fullName.trim()) {
      return
    }

    setIsSavingPlayerByTeam((current) => ({ ...current, [teamId]: true }))
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
      setIsSavingPlayerByTeam((current) => ({ ...current, [teamId]: false }))
      return
    }

    cancelEditPlayer(playerId)
    setIsSavingPlayerByTeam((current) => ({ ...current, [teamId]: false }))
    await loadPlayersForTeam(teamId)
  }

  const removePlayer = async (teamId, playerId) => {
    if (!supabase) {
      return
    }

    const confirmed = window.confirm('Remove this player? This removes them from all fixture rosters.')
    if (!confirmed) {
      return
    }

    setIsSavingPlayerByTeam((current) => ({ ...current, [teamId]: true }))
    setError('')
    setSuccessMessage('')

    const { error: removeMatchPlayerError } = await supabase.from('match_players').delete().eq('player_id', playerId)
    if (removeMatchPlayerError) {
      setError(removeMatchPlayerError.message)
      setIsSavingPlayerByTeam((current) => ({ ...current, [teamId]: false }))
      return
    }

    const { error: deletePlayerError } = await supabase.from('players').delete().eq('id', playerId)

    if (deletePlayerError) {
      setError(deletePlayerError.message)
      setIsSavingPlayerByTeam((current) => ({ ...current, [teamId]: false }))
      return
    }

    setPlayerSelection((current) => {
      const next = { ...current }
      delete next[playerId]
      return next
    })
    cancelEditPlayer(playerId)
    setIsSavingPlayerByTeam((current) => ({ ...current, [teamId]: false }))
    await loadPlayersForTeam(teamId)
  }

  const saveFixtureEdit = async (fixtureId) => {
    if (!supabase || !editForm) {
      return
    }

    if (!editForm.homeTeamId || !editForm.awayTeamId) {
      setError('Select both home and away teams.')
      return
    }

    if (editForm.homeTeamId === editForm.awayTeamId) {
      setError('Home and away teams must be different.')
      return
    }

    setIsSavingEdit(true)
    setError('')
    setSuccessMessage('')

    const { error: updateError } = await supabase
      .from('matches')
      .update({
        format: editForm.format,
        venue: editForm.venue.trim() || null,
        start_time: editForm.startTime ? new Date(editForm.startTime).toISOString() : null,
        balls_per_over: Number(editForm.ballsPerOver || 6),
        status: editForm.status,
        home_team_id: editForm.homeTeamId,
        away_team_id: editForm.awayTeamId,
      })
      .eq('id', fixtureId)

    if (updateError) {
      setError(updateError.message)
      setIsSavingEdit(false)
      return
    }

    const { error: deleteMatchTeamsError } = await supabase
      .from('match_teams')
      .delete()
      .eq('match_id', fixtureId)

    if (deleteMatchTeamsError) {
      setError(deleteMatchTeamsError.message)
      setIsSavingEdit(false)
      return
    }

    const { error: insertMatchTeamsError } = await supabase
      .from('match_teams')
      .insert([
        {
          match_id: fixtureId,
          team_id: editForm.homeTeamId,
          is_home: true,
          is_batting_first: null,
        },
        {
          match_id: fixtureId,
          team_id: editForm.awayTeamId,
          is_home: false,
          is_batting_first: null,
        },
      ])

    if (insertMatchTeamsError) {
      setError(insertMatchTeamsError.message)
      setIsSavingEdit(false)
      return
    }

    const { error: clearMatchPlayersError } = await supabase
      .from('match_players')
      .delete()
      .eq('match_id', fixtureId)

    if (clearMatchPlayersError) {
      setError(clearMatchPlayersError.message)
      setIsSavingEdit(false)
      return
    }

    const selectedPlayers = selectedFixtureTeamIds.flatMap((teamId) => {
      const teamPlayers = playersByTeam[teamId] ?? []
      return teamPlayers
        .filter((player) => playerSelection[player.id]?.selected)
        .map((player) => ({
          match_id: fixtureId,
          player_id: player.id,
          is_playing_xi: Boolean(playerSelection[player.id]?.playingXI),
        }))
    })

    if (selectedPlayers.length > 0) {
      const { error: insertMatchPlayersError } = await supabase
        .from('match_players')
        .insert(selectedPlayers)

      if (insertMatchPlayersError) {
        setError(insertMatchPlayersError.message)
        setIsSavingEdit(false)
        return
      }
    }

    setSuccessMessage('Fixture updated successfully.')
    setIsSavingEdit(false)
    cancelEditingFixture()
    loadFixtures()
  }

  const deleteFixture = async (fixtureId) => {
    if (!supabase) {
      return
    }

    const confirmed = window.confirm('Delete this fixture? This will also remove linked match data.')
    if (!confirmed) {
      return
    }

    setIsDeletingById((current) => ({ ...current, [fixtureId]: true }))
    setError('')
    setSuccessMessage('')

    const { error: deleteError } = await supabase.from('matches').delete().eq('id', fixtureId)

    if (deleteError) {
      setError(deleteError.message)
      setIsDeletingById((current) => ({ ...current, [fixtureId]: false }))
      return
    }

    if (editingFixtureId === fixtureId) {
      cancelEditingFixture()
    }

    setFixtures((current) => current.filter((fixture) => fixture.id !== fixtureId))
    setIsDeletingById((current) => ({ ...current, [fixtureId]: false }))
    setSuccessMessage('Fixture deleted.')
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-4 md:p-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Fixtures</CardTitle>
              <CardDescription>Scheduled and created matches from Supabase.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/" className={buttonVariants({ variant: 'secondary' })}>Create fixture</Link>
              <Button type="button" onClick={loadFixtures} disabled={isLoading}>
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <p className="mb-4 rounded-md border border-emerald-300/60 bg-emerald-50 p-3 text-sm text-emerald-700">
              {successMessage}
            </p>
          )}

          {error && (
            <p className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <ul className="overflow-hidden rounded-md border">
            {fixtures.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">No fixtures found yet.</li>
            )}

            {fixtures.map((fixture) => {
              const homeName = fixture.home_team?.name ?? 'Unknown'
              const awayName = fixture.away_team?.name ?? 'Unknown'
              const isEditing = editingFixtureId === fixture.id
              const isDeleting = Boolean(isDeletingById[fixture.id])

              return (
                <li key={fixture.id} className="border-b p-4 last:border-b-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{homeName} vs {awayName}</p>
                    <span className="rounded border px-2 py-0.5 text-xs">{fixture.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {fixture.format} · {fixture.balls_per_over} balls/over · {fixture.venue || 'Venue not set'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Start: {formatDateTime(fixture.start_time)}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => startEditingFixture(fixture)}
                      disabled={isDeleting}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => deleteFixture(fixture.id)}
                      disabled={isDeleting || isSavingEdit}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>

                  {isEditing && editForm && (
                    <div className="mt-3 space-y-4 rounded-md border p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-medium" htmlFor={`format-${fixture.id}`}>Format</label>
                        <select
                          id={`format-${fixture.id}`}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                          value={editForm.format}
                          onChange={(event) => setEditForm((current) => ({ ...current, format: event.target.value }))}
                        >
                          {MATCH_FORMATS.map((matchFormat) => (
                            <option key={matchFormat} value={matchFormat}>{matchFormat}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium" htmlFor={`status-${fixture.id}`}>Status</label>
                        <select
                          id={`status-${fixture.id}`}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                          value={editForm.status}
                          onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
                        >
                          {MATCH_STATUSES.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium" htmlFor={`home-${fixture.id}`}>Home team</label>
                        <select
                          id={`home-${fixture.id}`}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                          value={editForm.homeTeamId}
                          onChange={(event) => setEditForm((current) => ({ ...current, homeTeamId: event.target.value }))}
                          disabled={isLoadingTeams}
                        >
                          <option value="">Select team</option>
                          {teams.map((team) => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium" htmlFor={`away-${fixture.id}`}>Away team</label>
                        <select
                          id={`away-${fixture.id}`}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                          value={editForm.awayTeamId}
                          onChange={(event) => setEditForm((current) => ({ ...current, awayTeamId: event.target.value }))}
                          disabled={isLoadingTeams}
                        >
                          <option value="">Select team</option>
                          {teams.map((team) => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium" htmlFor={`balls-${fixture.id}`}>Balls per over</label>
                        <Input
                          id={`balls-${fixture.id}`}
                          type="number"
                          min={1}
                          value={editForm.ballsPerOver}
                          onChange={(event) => setEditForm((current) => ({ ...current, ballsPerOver: event.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium" htmlFor={`start-${fixture.id}`}>Start time</label>
                        <Input
                          id={`start-${fixture.id}`}
                          type="datetime-local"
                          value={editForm.startTime}
                          onChange={(event) => setEditForm((current) => ({ ...current, startTime: event.target.value }))}
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-medium" htmlFor={`venue-${fixture.id}`}>Venue</label>
                        <Input
                          id={`venue-${fixture.id}`}
                          value={editForm.venue}
                          onChange={(event) => setEditForm((current) => ({ ...current, venue: event.target.value }))}
                          placeholder="Venue"
                        />
                      </div>

                      <div className="flex gap-2 md:col-span-2">
                        <Button type="button" size="sm" onClick={() => saveFixtureEdit(fixture.id)} disabled={isSavingEdit}>
                          {isSavingEdit ? 'Saving...' : 'Save changes'}
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={cancelEditingFixture} disabled={isSavingEdit}>
                          Cancel
                        </Button>
                      </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        {selectedFixtureTeamIds.map((teamId) => {
                          const teamPlayers = playersByTeam[teamId] ?? []
                          const playerForm = newPlayerFormsByTeam[teamId] ?? emptyPlayerForm
                          const isLoadingPlayers = Boolean(isLoadingPlayersByTeam[teamId])
                          const isSavingPlayers = Boolean(isSavingPlayerByTeam[teamId])

                          return (
                            <div key={teamId} className="space-y-3 rounded-md border p-3">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="text-sm font-semibold">{teamNameById[teamId] ?? 'Team players'}</h4>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => loadPlayersForTeam(teamId)}
                                  disabled={isLoadingPlayers}
                                >
                                  {isLoadingPlayers ? 'Loading...' : 'Reload'}
                                </Button>
                              </div>

                              <div className="grid gap-2">
                                <Input
                                  placeholder="Full name"
                                  value={playerForm.fullName}
                                  onChange={(event) =>
                                    setNewPlayerFormsByTeam((current) => ({
                                      ...current,
                                      [teamId]: { ...playerForm, fullName: event.target.value },
                                    }))
                                  }
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  <Input
                                    placeholder="Display name"
                                    value={playerForm.displayName}
                                    onChange={(event) =>
                                      setNewPlayerFormsByTeam((current) => ({
                                        ...current,
                                        [teamId]: { ...playerForm, displayName: event.target.value },
                                      }))
                                    }
                                  />
                                  <Input
                                    type="number"
                                    placeholder="Shirt #"
                                    value={playerForm.shirtNumber}
                                    onChange={(event) =>
                                      setNewPlayerFormsByTeam((current) => ({
                                        ...current,
                                        [teamId]: { ...playerForm, shirtNumber: event.target.value },
                                      }))
                                    }
                                  />
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleAddPlayer(teamId)}
                                  disabled={isSavingPlayers}
                                >
                                  {isSavingPlayers ? 'Saving...' : 'Add player'}
                                </Button>
                              </div>

                              <ul className="max-h-80 space-y-2 overflow-auto">
                                {teamPlayers.length === 0 && (
                                  <li className="rounded border p-2 text-sm text-muted-foreground">No players yet.</li>
                                )}

                                {teamPlayers.map((player) => {
                                  const editDraft = editingPlayers[player.id]

                                  return (
                                    <li key={player.id} className="space-y-2 rounded border p-2">
                                      {editDraft ? (
                                        <div className="space-y-2">
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
                                          />
                                          <div className="grid grid-cols-2 gap-2">
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
                                          <label className="flex items-center gap-2 text-xs">
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
                                            <Button type="button" size="sm" onClick={() => savePlayerEdit(teamId, player.id)}>Save</Button>
                                            <Button type="button" size="sm" variant="secondary" onClick={() => cancelEditPlayer(player.id)}>Cancel</Button>
                                            <Button type="button" size="sm" variant="outline" onClick={() => removePlayer(teamId, player.id)}>Remove</Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <div className="flex items-center justify-between gap-2">
                                            <div>
                                              <p className="text-sm font-medium">{player.full_name}</p>
                                              <p className="text-xs text-muted-foreground">
                                                {player.display_name || 'No display name'}
                                                {' · '}
                                                #{player.shirt_number ?? '-'}
                                                {' · '}
                                                {player.is_active ? 'Active' : 'Inactive'}
                                              </p>
                                            </div>
                                            <div className="flex gap-2">
                                              <Button type="button" size="sm" variant="secondary" onClick={() => beginEditPlayer(player)}>
                                                Edit
                                              </Button>
                                              <Button type="button" size="sm" variant="outline" onClick={() => removePlayer(teamId, player.id)}>
                                                Remove
                                              </Button>
                                            </div>
                                          </div>

                                          <div className="flex flex-wrap gap-4">
                                            <label className="flex items-center gap-2 text-xs">
                                              <input
                                                type="checkbox"
                                                checked={Boolean(playerSelection[player.id]?.selected)}
                                                onChange={(event) =>
                                                  setPlayerSelection((current) => ({
                                                    ...current,
                                                    [player.id]: {
                                                      selected: event.target.checked,
                                                      playingXI: event.target.checked
                                                        ? Boolean(current[player.id]?.playingXI)
                                                        : false,
                                                    },
                                                  }))
                                                }
                                              />
                                              Include in fixture
                                            </label>
                                            <label className="flex items-center gap-2 text-xs">
                                              <input
                                                type="checkbox"
                                                checked={Boolean(playerSelection[player.id]?.playingXI)}
                                                disabled={!Boolean(playerSelection[player.id]?.selected)}
                                                onChange={(event) =>
                                                  setPlayerSelection((current) => ({
                                                    ...current,
                                                    [player.id]: {
                                                      selected: true,
                                                      playingXI: event.target.checked,
                                                    },
                                                  }))
                                                }
                                              />
                                              Playing XI
                                            </label>
                                          </div>
                                        </>
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </main>
  )
}

export default FixturesListPage
