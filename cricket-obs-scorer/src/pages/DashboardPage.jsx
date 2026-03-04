import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabaseClient'

const MATCH_FORMATS = ['TWO_DAY', 'TEST', 'ODI', 'T20', 'CUSTOM']

const emptyPlayerForm = {
  fullName: '',
  displayName: '',
  shirtNumber: '',
}

function DashboardPage() {
  const [teams, setTeams] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSavingTeam, setIsSavingTeam] = useState(false)
  const [isCreatingMatch, setIsCreatingMatch] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [form, setForm] = useState({ name: '', shortName: '' })
  const [fixtureForm, setFixtureForm] = useState({
    format: 'TWO_DAY',
    ballsPerOver: '6',
    venue: '',
    startTime: '',
    homeTeamId: '',
    awayTeamId: '',
    scheduledDays: '2',
    oversPerDay: '',
    defaultMaxOversPerInnings: '',
    declarationsAllowed: true,
    allowRetiredHurt: true,
  })
  const [playersByTeam, setPlayersByTeam] = useState({})
  const [isLoadingPlayersByTeam, setIsLoadingPlayersByTeam] = useState({})
  const [newPlayerFormsByTeam, setNewPlayerFormsByTeam] = useState({})
  const [editingPlayers, setEditingPlayers] = useState({})
  const [isSavingPlayerByTeam, setIsSavingPlayerByTeam] = useState({})
  const [playerSelection, setPlayerSelection] = useState({})

  const teamNameById = teams.reduce((acc, team) => {
    acc[team.id] = team.name
    return acc
  }, {})

  const selectedFixtureTeamIds = [...new Set([fixtureForm.homeTeamId, fixtureForm.awayTeamId].filter(Boolean))]

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
    loadTeams()
  }, [])

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

  useEffect(() => {
    selectedFixtureTeamIds.forEach((teamId) => {
      if (!playersByTeam[teamId]) {
        loadPlayersForTeam(teamId)
      }
    })
  }, [fixtureForm.homeTeamId, fixtureForm.awayTeamId])

  const handleAddTeam = async (event) => {
    event.preventDefault()
    if (!supabase || !form.name.trim()) {
      return
    }

    setIsSavingTeam(true)
    setError('')
    setSuccessMessage('')

    const payload = {
      name: form.name.trim(),
      short_name: form.shortName.trim() || null,
    }

    const { error: insertError } = await supabase.from('teams').insert(payload)

    if (insertError) {
      setError(insertError.message)
      setIsSavingTeam(false)
      return
    }

    setForm({ name: '', shortName: '' })
    setIsSavingTeam(false)
    loadTeams()
  }

  const updateFixtureTeam = (field, value) => {
    setFixtureForm((current) => ({ ...current, [field]: value }))
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
    loadPlayersForTeam(teamId)
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
    loadPlayersForTeam(teamId)
  }

  const handleCreateFixture = async (event) => {
    event.preventDefault()
    if (!supabase) {
      return
    }

    if (!fixtureForm.homeTeamId || !fixtureForm.awayTeamId) {
      setError('Select both home and away teams.')
      return
    }

    if (fixtureForm.homeTeamId === fixtureForm.awayTeamId) {
      setError('Home and away teams must be different.')
      return
    }

    setIsCreatingMatch(true)
    setError('')
    setSuccessMessage('')

    let matchId = null

    const selectedPlayers = selectedFixtureTeamIds.flatMap((teamId) => {
      const teamPlayers = playersByTeam[teamId] ?? []
      return teamPlayers
        .filter((player) => playerSelection[player.id]?.selected)
        .map((player) => ({
          playerId: player.id,
          isPlayingXI: Boolean(playerSelection[player.id]?.playingXI),
        }))
    })

    const matchPayload = {
      format: fixtureForm.format,
      venue: fixtureForm.venue.trim() || null,
      start_time: fixtureForm.startTime ? new Date(fixtureForm.startTime).toISOString() : null,
      balls_per_over: Number(fixtureForm.ballsPerOver),
      home_team_id: fixtureForm.homeTeamId,
      away_team_id: fixtureForm.awayTeamId,
      status: 'SCHEDULED',
    }

    const rulesPayload = {
      scheduled_days: Number(fixtureForm.scheduledDays || 2),
      overs_per_day: fixtureForm.oversPerDay ? Number(fixtureForm.oversPerDay) : null,
      default_max_overs_per_innings: fixtureForm.defaultMaxOversPerInnings
        ? Number(fixtureForm.defaultMaxOversPerInnings)
        : null,
      declarations_allowed: fixtureForm.declarationsAllowed,
      allow_retired_hurt: fixtureForm.allowRetiredHurt,
    }

    const matchTeamsPayload = [
      { team_id: fixtureForm.homeTeamId, is_home: true, is_batting_first: null },
      { team_id: fixtureForm.awayTeamId, is_home: false, is_batting_first: null },
    ]

    try {
      const { data: createdMatch, error: matchError } = await supabase
        .from('matches')
        .insert(matchPayload)
        .select('id')
        .single()

      if (matchError) {
        throw new Error(matchError.message)
      }

      matchId = createdMatch.id

      const { error: rulesError } = await supabase
        .from('match_rules')
        .insert({ match_id: matchId, ...rulesPayload })

      if (rulesError) {
        throw new Error(rulesError.message)
      }

      const { error: matchTeamsError } = await supabase
        .from('match_teams')
        .insert(matchTeamsPayload.map((item) => ({ ...item, match_id: matchId })))

      if (matchTeamsError) {
        throw new Error(matchTeamsError.message)
      }

      if (selectedPlayers.length > 0) {
        const { error: matchPlayersError } = await supabase
          .from('match_players')
          .insert(
            selectedPlayers.map((item) => ({
              match_id: matchId,
              player_id: item.playerId,
              is_playing_xi: item.isPlayingXI,
            })),
          )

        if (matchPlayersError) {
          throw new Error(matchPlayersError.message)
        }
      }

      setSuccessMessage(`Fixture created successfully (match id: ${matchId}).`)
      setFixtureForm((current) => ({
        ...current,
        venue: '',
        startTime: '',
        oversPerDay: '',
        defaultMaxOversPerInnings: '',
      }))
    } catch (createError) {
      if (matchId) {
        await supabase.from('matches').delete().eq('id', matchId)
      }
      setError(createError instanceof Error ? createError.message : 'Failed to create fixture.')
    }

    setIsCreatingMatch(false)
  }

  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle>Create Fixture</CardTitle>
          <CardDescription>Set up match details, teams, and players.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {error && (
            <p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          {successMessage && (
            <p className="rounded-md border border-emerald-300/60 bg-emerald-50 p-3 text-sm text-emerald-700">
              {successMessage}
            </p>
          )}

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">1) Add teams</h2>
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

              <div className="flex items-end">
                <Button type="submit" disabled={isSavingTeam}>
                  {isSavingTeam ? 'Saving...' : 'Add team'}
                </Button>
              </div>
            </form>

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Available teams</h3>
              <Button type="button" variant="secondary" onClick={loadTeams} disabled={isLoading}>
                {isLoading ? 'Refreshing...' : 'Refresh teams'}
              </Button>
            </div>
            <ul className="overflow-hidden rounded-md border">
              {teams.length === 0 && <li className="p-3 text-sm text-muted-foreground">No teams found yet.</li>}
              {teams.map((team) => (
                <li key={team.id} className="flex items-center justify-between border-b p-3 last:border-b-0">
                  <span>{team.name}</span>
                  <strong>{team.short_name || '—'}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">2) Setup fixture</h2>
            <form className="space-y-4" onSubmit={handleCreateFixture}>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="matchFormat">Format</label>
                  <select
                    id="matchFormat"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={fixtureForm.format}
                    onChange={(event) => setFixtureForm((current) => ({ ...current, format: event.target.value }))}
                  >
                    {MATCH_FORMATS.map((matchFormat) => (
                      <option key={matchFormat} value={matchFormat}>{matchFormat}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="ballsPerOver">Balls per over</label>
                  <Input
                    id="ballsPerOver"
                    type="number"
                    min={1}
                    value={fixtureForm.ballsPerOver}
                    onChange={(event) => setFixtureForm((current) => ({ ...current, ballsPerOver: event.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="homeTeam">Home team</label>
                  <select
                    id="homeTeam"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={fixtureForm.homeTeamId}
                    onChange={(event) => updateFixtureTeam('homeTeamId', event.target.value)}
                    required
                  >
                    <option value="">Select home team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="awayTeam">Away team</label>
                  <select
                    id="awayTeam"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={fixtureForm.awayTeamId}
                    onChange={(event) => updateFixtureTeam('awayTeamId', event.target.value)}
                    required
                  >
                    <option value="">Select away team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="venue">Venue</label>
                  <Input
                    id="venue"
                    value={fixtureForm.venue}
                    onChange={(event) => setFixtureForm((current) => ({ ...current, venue: event.target.value }))}
                    placeholder="Main Oval"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="startTime">Start time</label>
                  <Input
                    id="startTime"
                    type="datetime-local"
                    value={fixtureForm.startTime}
                    onChange={(event) => setFixtureForm((current) => ({ ...current, startTime: event.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="scheduledDays">Scheduled days</label>
                  <Input
                    id="scheduledDays"
                    type="number"
                    min={1}
                    value={fixtureForm.scheduledDays}
                    onChange={(event) => setFixtureForm((current) => ({ ...current, scheduledDays: event.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="oversPerDay">Overs per day</label>
                  <Input
                    id="oversPerDay"
                    type="number"
                    min={1}
                    value={fixtureForm.oversPerDay}
                    onChange={(event) => setFixtureForm((current) => ({ ...current, oversPerDay: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="defaultMaxOvers">Default max overs/innings</label>
                  <Input
                    id="defaultMaxOvers"
                    type="number"
                    min={1}
                    value={fixtureForm.defaultMaxOversPerInnings}
                    onChange={(event) => setFixtureForm((current) => ({ ...current, defaultMaxOversPerInnings: event.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={fixtureForm.declarationsAllowed}
                    onChange={(event) => setFixtureForm((current) => ({ ...current, declarationsAllowed: event.target.checked }))}
                  />
                  Declarations allowed
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={fixtureForm.allowRetiredHurt}
                    onChange={(event) => setFixtureForm((current) => ({ ...current, allowRetiredHurt: event.target.checked }))}
                  />
                  Allow retired hurt
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {selectedFixtureTeamIds.length === 0 && (
                  <p className="text-sm text-muted-foreground">Select home/away teams to manage players for this fixture.</p>
                )}

                {selectedFixtureTeamIds.map((teamId) => {
                  const teamPlayers = playersByTeam[teamId] ?? []
                  const playerForm = newPlayerFormsByTeam[teamId] ?? emptyPlayerForm
                  const isLoadingPlayers = Boolean(isLoadingPlayersByTeam[teamId])
                  const isSavingPlayers = Boolean(isSavingPlayerByTeam[teamId])

                  return (
                    <div key={teamId} className="space-y-3 rounded-md border p-3">
                      <h3 className="text-sm font-semibold">{teamNameById[teamId] ?? 'Team players'}</h3>

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
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleAddPlayer(teamId)}
                            disabled={isSavingPlayers}
                          >
                            {isSavingPlayers ? 'Saving...' : 'Add player'}
                          </Button>
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
                                    <Button type="button" size="sm" onClick={() => savePlayerEdit(teamId, player.id)}>
                                      Save
                                    </Button>
                                    <Button type="button" size="sm" variant="secondary" onClick={() => cancelEditPlayer(player.id)}>
                                      Cancel
                                    </Button>
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
                                    <Button type="button" size="sm" variant="secondary" onClick={() => beginEditPlayer(player)}>
                                      Edit
                                    </Button>
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

              <Button type="submit" disabled={isCreatingMatch}>
                {isCreatingMatch ? 'Creating fixture...' : 'Create fixture'}
              </Button>
            </form>
          </section>
        </CardContent>
      </Card>
    </section>
  )
}

export default DashboardPage
