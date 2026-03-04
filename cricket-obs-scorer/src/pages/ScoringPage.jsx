import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import BallByBallHistory from '@/components/scoring/BallByBallHistory'
import { supabase } from '@/lib/supabaseClient'

const EXTRAS = ['NONE', 'WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY']
const WICKETS = ['NONE', 'BOWLED', 'CAUGHT', 'LBW', 'RUN_OUT', 'STUMPED', 'HIT_WICKET', 'OBSTRUCTING', 'HIT_BALL_TWICE', 'TIMED_OUT', 'RETIRED']
const DELIVERY_PAGE_SIZE = 10

function ScoringPage() {
  const [fixtures, setFixtures] = useState([])
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [match, setMatch] = useState(null)
  const [liveInnings, setLiveInnings] = useState(null)
  const [players, setPlayers] = useState([])
  const [liveState, setLiveState] = useState(null)
  const [recentDeliveries, setRecentDeliveries] = useState([])
  const [deliveriesPage, setDeliveriesPage] = useState(1)

  const [isLoadingFixtures, setIsLoadingFixtures] = useState(false)
  const [isLoadingMatch, setIsLoadingMatch] = useState(false)
  const [isStartingMatch, setIsStartingMatch] = useState(false)
  const [isSavingDelivery, setIsSavingDelivery] = useState(false)
  const [isUpdatingDeliveryId, setIsUpdatingDeliveryId] = useState('')
  const [isDeletingDeliveryId, setIsDeletingDeliveryId] = useState('')

  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [editingDeliveryId, setEditingDeliveryId] = useState('')
  const [deliveryEditForm, setDeliveryEditForm] = useState(null)

  const [startForm, setStartForm] = useState({ battingFirstTeamId: '' })
  const [deliveryForm, setDeliveryForm] = useState({
    strikerId: '',
    nonStrikerId: '',
    bowlerId: '',
    runsOffBat: '0',
    extrasType: 'NONE',
    extrasRuns: '0',
    wicket: 'NONE',
    playerOutId: '',
    commentary: '',
  })

  const loadFixtures = async () => {
    if (!supabase) {
      return
    }

    setIsLoadingFixtures(true)

    const { data, error: loadError } = await supabase
      .from('matches')
      .select(`
        id,
        format,
        status,
        balls_per_over,
        start_time,
        home_team_id,
        away_team_id,
        home_team:teams!matches_home_team_id_fkey(name),
        away_team:teams!matches_away_team_id_fkey(name)
      `)
      .in('status', ['SCHEDULED', 'LIVE'])
      .order('created_at', { ascending: false })

    if (loadError) {
      setError(loadError.message)
      setIsLoadingFixtures(false)
      return
    }

    const nextFixtures = data ?? []
    setFixtures(nextFixtures)
    setSelectedMatchId((current) => current || nextFixtures[0]?.id || '')
    setIsLoadingFixtures(false)
  }

  const playerLabel = (player) => {
    if (!player) {
      return 'Unknown'
    }
    return player.display_name || player.full_name || 'Unknown'
  }

  const deliveryEventLabel = (delivery) => {
    const runsOffBat = Number(delivery.runs_off_bat || 0)
    const extrasRuns = Number(delivery.extras_runs || 0)
    const totalRuns = runsOffBat + extrasRuns

    if (delivery.wicket && delivery.wicket !== 'NONE') {
      const outLabel = delivery.player_out
        ? ` (${playerLabel(delivery.player_out)} out)`
        : ''
      return `WICKET ${delivery.wicket}${outLabel}`
    }

    if (delivery.extras_type && delivery.extras_type !== 'NONE') {
      return `${delivery.extras_type} +${extrasRuns} (Total ${totalRuns})`
    }

    return `Runs ${totalRuns}`
  }

  const loadRecentDeliveries = async (inningsId) => {
    if (!supabase || !inningsId) {
      setRecentDeliveries([])
      return
    }

    const { data, error: loadError } = await supabase
      .from('deliveries')
      .select(`
        id,
        over_no,
        ball_no,
        runs_off_bat,
        extras_type,
        extras_runs,
        wicket,
        commentary,
        created_at,
        bowler:players!deliveries_bowler_id_fkey(id, display_name, full_name),
        striker:players!deliveries_striker_id_fkey(id, display_name, full_name),
        non_striker:players!deliveries_non_striker_id_fkey(id, display_name, full_name),
        player_out:players!deliveries_player_out_id_fkey(id, display_name, full_name)
      `)
      .eq('innings_id', inningsId)
      .order('seq_in_innings', { ascending: false })
      .limit(240)

    if (loadError) {
      setError(loadError.message)
      return
    }

    const allRows = data ?? []
    if (allRows.length === 0) {
      setRecentDeliveries([])
      setDeliveriesPage(1)
      return
    }

    const latestOverNo = Number(allRows[0].over_no || 0)
    const minOverNo = Math.max(0, latestOverNo - 2)
    const lastThreeOvers = allRows.filter((delivery) => Number(delivery.over_no || 0) >= minOverNo)

    setRecentDeliveries(lastThreeOvers)
    setDeliveriesPage(1)
  }

  const loadMatchContext = async (matchId) => {
    if (!supabase || !matchId) {
      setMatch(null)
      setPlayers([])
      setLiveInnings(null)
      setLiveState(null)
      setRecentDeliveries([])
      return
    }

    setIsLoadingMatch(true)

    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('id, format, status, balls_per_over, home_team_id, away_team_id, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)')
      .eq('id', matchId)
      .single()

    if (matchError) {
      setError(matchError.message)
      setIsLoadingMatch(false)
      return
    }

    setMatch(matchData)
    setStartForm((current) => ({
      ...current,
      battingFirstTeamId: current.battingFirstTeamId || matchData.home_team_id || '',
    }))

    const { data: inningsData, error: inningsError } = await supabase
      .from('innings')
      .select('id, match_id, innings_no, batting_team_id, bowling_team_id, status')
      .eq('match_id', matchId)
      .eq('status', 'LIVE')
      .order('innings_no', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (inningsError) {
      setError(inningsError.message)
      setIsLoadingMatch(false)
      return
    }

    setLiveInnings(inningsData ?? null)

    if (inningsData?.id) {
      const { data: stateData } = await supabase
        .from('live_innings_state')
        .select('runs, wickets, legal_balls, striker_id, non_striker_id, current_bowler_id')
        .eq('innings_id', inningsData.id)
        .maybeSingle()
      setLiveState(stateData ?? { runs: 0, wickets: 0, legal_balls: 0, striker_id: null, non_striker_id: null, current_bowler_id: null })
      await loadRecentDeliveries(inningsData.id)
    } else {
      setLiveState(null)
      setRecentDeliveries([])
    }

    const { data: matchPlayerRows, error: matchPlayerError } = await supabase
      .from('match_players')
      .select('player_id, is_playing_xi')
      .eq('match_id', matchId)

    if (matchPlayerError) {
      setError(matchPlayerError.message)
      setIsLoadingMatch(false)
      return
    }

    const hasPlayingXI = (matchPlayerRows ?? []).some((row) => row.is_playing_xi)
    const selectedPlayerIds = (matchPlayerRows ?? [])
      .filter((row) => (hasPlayingXI ? row.is_playing_xi : true))
      .map((row) => row.player_id)

    if (selectedPlayerIds.length === 0) {
      setPlayers([])
      setIsLoadingMatch(false)
      return
    }

    const { data: playerRows, error: playerError } = await supabase
      .from('players')
      .select('id, team_id, full_name, display_name, is_active')
      .in('id', selectedPlayerIds)
      .order('full_name', { ascending: true })

    if (playerError) {
      setError(playerError.message)
      setIsLoadingMatch(false)
      return
    }

    const nextPlayers = (playerRows ?? []).filter((player) => player.is_active)
    setPlayers(nextPlayers)

    const battingTeamPlayers = inningsData
      ? nextPlayers.filter((player) => player.team_id === inningsData.batting_team_id)
      : []
    const bowlingTeamPlayers = inningsData
      ? nextPlayers.filter((player) => player.team_id === inningsData.bowling_team_id)
      : []

    const defaultStrikerId = stateData?.striker_id || battingTeamPlayers[0]?.id || ''
    const defaultNonStrikerId = stateData?.non_striker_id || battingTeamPlayers[1]?.id || ''
    const defaultBowlerId = stateData?.current_bowler_id || bowlingTeamPlayers[0]?.id || ''

    setDeliveryForm((current) => ({
      ...current,
      strikerId: defaultStrikerId,
      nonStrikerId: defaultNonStrikerId,
      bowlerId: defaultBowlerId,
      runsOffBat: '0',
      extrasType: 'NONE',
      extrasRuns: '0',
      wicket: 'NONE',
      playerOutId: '',
      commentary: '',
    }))

    setIsLoadingMatch(false)
  }

  useEffect(() => {
    loadFixtures()
  }, [])

  useEffect(() => {
    loadMatchContext(selectedMatchId)
  }, [selectedMatchId])

  const battingPlayers = useMemo(() => {
    if (!liveInnings) {
      return []
    }
    return players.filter((player) => player.team_id === liveInnings.batting_team_id)
  }, [players, liveInnings])

  const bowlingPlayers = useMemo(() => {
    if (!liveInnings) {
      return []
    }
    return players.filter((player) => player.team_id === liveInnings.bowling_team_id)
  }, [players, liveInnings])

  const mustChangeBowlerForNextBall = useMemo(() => {
    if (!match || !liveState) {
      return false
    }

    const ballsPerOver = match.balls_per_over || 6
    const legalBalls = Number(liveState.legal_balls || 0)
    return legalBalls > 0 && legalBalls % ballsPerOver === 0
  }, [match, liveState])

  const eligibleBowlers = useMemo(() => {
    if (!mustChangeBowlerForNextBall || !liveState?.current_bowler_id) {
      return bowlingPlayers
    }

    return bowlingPlayers.filter((player) => player.id !== liveState.current_bowler_id)
  }, [bowlingPlayers, mustChangeBowlerForNextBall, liveState?.current_bowler_id])

  const oversDisplay = useMemo(() => {
    const legalBalls = Number(liveState?.legal_balls || 0)
    const ballsPerOver = Number(match?.balls_per_over || 6)

    if (ballsPerOver <= 0) {
      return '0.0'
    }

    const completedOvers = Math.floor(legalBalls / ballsPerOver)
    const ballsThisOver = legalBalls % ballsPerOver
    return `${completedOvers}.${ballsThisOver}`
  }, [liveState?.legal_balls, match?.balls_per_over])

  const totalDeliveryPages = useMemo(
    () => Math.max(1, Math.ceil(recentDeliveries.length / DELIVERY_PAGE_SIZE)),
    [recentDeliveries.length],
  )

  const paginatedRecentDeliveries = useMemo(() => {
    const start = (deliveriesPage - 1) * DELIVERY_PAGE_SIZE
    const end = start + DELIVERY_PAGE_SIZE
    return recentDeliveries.slice(start, end)
  }, [recentDeliveries, deliveriesPage])

  useEffect(() => {
    if (deliveriesPage > totalDeliveryPages) {
      setDeliveriesPage(totalDeliveryPages)
    }
  }, [deliveriesPage, totalDeliveryPages])

  useEffect(() => {
    if (!liveInnings) {
      return
    }

    if (!mustChangeBowlerForNextBall) {
      return
    }

    if (deliveryForm.bowlerId && deliveryForm.bowlerId !== liveState?.current_bowler_id) {
      return
    }

    setDeliveryForm((current) => ({
      ...current,
      bowlerId: eligibleBowlers[0]?.id || '',
    }))
  }, [mustChangeBowlerForNextBall, liveState?.current_bowler_id, eligibleBowlers, liveInnings?.id])

  const startScoring = async () => {
    if (!supabase || !match || !startForm.battingFirstTeamId) {
      return
    }

    const bowlingTeamId = startForm.battingFirstTeamId === match.home_team_id
      ? match.away_team_id
      : match.home_team_id

    setIsStartingMatch(true)
    setError('')
    setSuccessMessage('')

    const { error: matchUpdateError } = await supabase
      .from('matches')
      .update({ status: 'LIVE' })
      .eq('id', match.id)

    if (matchUpdateError) {
      setError(matchUpdateError.message)
      setIsStartingMatch(false)
      return
    }

    const { error: clearTeamsError } = await supabase.from('match_teams').delete().eq('match_id', match.id)
    if (clearTeamsError) {
      setError(clearTeamsError.message)
      setIsStartingMatch(false)
      return
    }

    const { error: insertTeamsError } = await supabase.from('match_teams').insert([
      {
        match_id: match.id,
        team_id: match.home_team_id,
        is_home: true,
        is_batting_first: startForm.battingFirstTeamId === match.home_team_id,
      },
      {
        match_id: match.id,
        team_id: match.away_team_id,
        is_home: false,
        is_batting_first: startForm.battingFirstTeamId === match.away_team_id,
      },
    ])

    if (insertTeamsError) {
      setError(insertTeamsError.message)
      setIsStartingMatch(false)
      return
    }

    const { data: newInnings, error: inningsError } = await supabase
      .from('innings')
      .insert({
        match_id: match.id,
        innings_no: 1,
        batting_team_id: startForm.battingFirstTeamId,
        bowling_team_id: bowlingTeamId,
        status: 'LIVE',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (inningsError) {
      setError(inningsError.message)
      setIsStartingMatch(false)
      return
    }

    setSuccessMessage('Scoring started. Innings 1 is now live.')
    setIsStartingMatch(false)
    await loadMatchContext(match.id)

    if (!newInnings?.id) {
      return
    }
  }

  const addDelivery = async (event) => {
    event.preventDefault()

    if (!supabase || !match || !liveInnings) {
      return
    }

    if (!deliveryForm.strikerId || !deliveryForm.nonStrikerId || !deliveryForm.bowlerId) {
      setError('Select striker, non-striker, and bowler.')
      return
    }

    if (mustChangeBowlerForNextBall && deliveryForm.bowlerId === liveState?.current_bowler_id) {
      setError('New over: select a different bowler.')
      return
    }

    if (deliveryForm.strikerId === deliveryForm.nonStrikerId) {
      setError('Striker and non-striker must be different players.')
      return
    }

    if (deliveryForm.wicket !== 'NONE' && !deliveryForm.playerOutId) {
      setError('Select player out when wicket is not NONE.')
      return
    }

    setIsSavingDelivery(true)
    setError('')
    setSuccessMessage('')

    const extrasType = deliveryForm.extrasType
    const isLegal = !(extrasType === 'WIDE' || extrasType === 'NO_BALL')
    const runsOffBat = Number(deliveryForm.runsOffBat || 0)
    const extrasRuns = Number(deliveryForm.extrasRuns || 0)
    const totalRuns = runsOffBat + extrasRuns

    const { data: lastDelivery } = await supabase
      .from('deliveries')
      .select('seq_in_innings')
      .eq('innings_id', liveInnings.id)
      .order('seq_in_innings', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextSeq = (lastDelivery?.seq_in_innings ?? 0) + 1

    let legalBalls = liveState?.legal_balls ?? 0
    if (!liveState) {
      const { data: legalRows } = await supabase
        .from('deliveries')
        .select('id', { count: 'exact' })
        .eq('innings_id', liveInnings.id)
        .eq('is_legal', true)
      legalBalls = legalRows?.length ?? 0
    }

    const ballsPerOver = match.balls_per_over || 6
    const overNo = Math.floor(legalBalls / ballsPerOver)
    const ballNo = (legalBalls % ballsPerOver) + 1

    const legalBallsAfterThis = legalBalls + (isLegal ? 1 : 0)
    const overCompleted = isLegal && legalBallsAfterThis % ballsPerOver === 0
    const oddRunsScored = totalRuns % 2 === 1
    const shouldSwapEnds = oddRunsScored !== overCompleted

    const nextStrikerId = shouldSwapEnds ? deliveryForm.nonStrikerId : deliveryForm.strikerId
    const nextNonStrikerId = shouldSwapEnds ? deliveryForm.strikerId : deliveryForm.nonStrikerId

    const { error: insertError } = await supabase.from('deliveries').insert({
      innings_id: liveInnings.id,
      seq_in_innings: nextSeq,
      over_no: overNo,
      ball_no: ballNo,
      striker_id: deliveryForm.strikerId,
      non_striker_id: deliveryForm.nonStrikerId,
      bowler_id: deliveryForm.bowlerId,
      runs_off_bat: runsOffBat,
      extras_type: extrasType,
      extras_runs: extrasRuns,
      is_legal: isLegal,
      wicket: deliveryForm.wicket,
      player_out_id: deliveryForm.wicket === 'NONE' ? null : deliveryForm.playerOutId,
      next_striker_id: nextStrikerId,
      next_non_striker_id: nextNonStrikerId,
      commentary: deliveryForm.commentary.trim() || null,
    })

    if (insertError) {
      setError(insertError.message)
      setIsSavingDelivery(false)
      return
    }

    setDeliveryForm((current) => ({
      ...current,
      strikerId: nextStrikerId,
      nonStrikerId: nextNonStrikerId,
      runsOffBat: '0',
      extrasType: 'NONE',
      extrasRuns: '0',
      wicket: 'NONE',
      playerOutId: '',
      commentary: '',
    }))

    setSuccessMessage('Delivery added.')
    setIsSavingDelivery(false)
    await loadMatchContext(match.id)
  }

  const startEditDelivery = (delivery) => {
    setEditingDeliveryId(delivery.id)
    setDeliveryEditForm({
      strikerId: delivery.striker?.id || '',
      bowlerId: delivery.bowler?.id || '',
      nonStrikerId: delivery.non_striker?.id || '',
      runsOffBat: String(delivery.runs_off_bat ?? 0),
      extrasType: delivery.extras_type ?? 'NONE',
      extrasRuns: String(delivery.extras_runs ?? 0),
      wicket: delivery.wicket ?? 'NONE',
      playerOutId: delivery.player_out?.id || '',
      commentary: delivery.commentary || '',
    })
  }

  const cancelEditDelivery = () => {
    setEditingDeliveryId('')
    setDeliveryEditForm(null)
  }

  const saveEditedDelivery = async (deliveryId) => {
    if (!supabase || !match || !deliveryEditForm) {
      return
    }

    if (!deliveryEditForm.strikerId || !deliveryEditForm.bowlerId) {
      setError('Select both striker and bowler.')
      return
    }

    if (deliveryEditForm.strikerId === deliveryEditForm.nonStrikerId) {
      setError('Striker and non-striker must be different players.')
      return
    }

    if (deliveryEditForm.wicket !== 'NONE' && !deliveryEditForm.playerOutId) {
      setError('Select player out when wicket is not NONE.')
      return
    }

    const extrasType = deliveryEditForm.extrasType
    const isLegal = !(extrasType === 'WIDE' || extrasType === 'NO_BALL')

    setIsUpdatingDeliveryId(deliveryId)
    setError('')
    setSuccessMessage('')

    const { error: updateError } = await supabase
      .from('deliveries')
      .update({
        striker_id: deliveryEditForm.strikerId,
        non_striker_id: deliveryEditForm.nonStrikerId,
        bowler_id: deliveryEditForm.bowlerId,
        runs_off_bat: Number(deliveryEditForm.runsOffBat || 0),
        extras_type: extrasType,
        extras_runs: Number(deliveryEditForm.extrasRuns || 0),
        is_legal: isLegal,
        wicket: deliveryEditForm.wicket,
        player_out_id: deliveryEditForm.wicket === 'NONE' ? null : deliveryEditForm.playerOutId,
        commentary: deliveryEditForm.commentary.trim() || null,
      })
      .eq('id', deliveryId)

    if (updateError) {
      setError(updateError.message)
      setIsUpdatingDeliveryId('')
      return
    }

    setSuccessMessage('Delivery updated.')
    setIsUpdatingDeliveryId('')
    cancelEditDelivery()
    await loadMatchContext(match.id)
  }

  const deleteDelivery = async (deliveryId) => {
    if (!supabase || !match) {
      return
    }

    const confirmed = window.confirm('Delete this delivery event?')
    if (!confirmed) {
      return
    }

    setIsDeletingDeliveryId(deliveryId)
    setError('')
    setSuccessMessage('')

    const { error: deleteError } = await supabase
      .from('deliveries')
      .delete()
      .eq('id', deliveryId)

    if (deleteError) {
      setError(deleteError.message)
      setIsDeletingDeliveryId('')
      return
    }

    if (editingDeliveryId === deliveryId) {
      cancelEditDelivery()
    }

    setSuccessMessage('Delivery deleted.')
    setIsDeletingDeliveryId('')
    await loadMatchContext(match.id)
  }

  const selectedFixture = fixtures.find((fixture) => fixture.id === selectedMatchId)

  return (
    <section>
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Scoring</CardTitle>
            <CardDescription>Start a fixture and record deliveries ball-by-ball.</CardDescription>
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
              <label className="text-sm font-medium" htmlFor="scoreFixture">Fixture</label>
              <div className="flex gap-2">
                <select
                  id="scoreFixture"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={selectedMatchId}
                  onChange={(event) => setSelectedMatchId(event.target.value)}
                >
                  {!selectedMatchId && <option value="">Select fixture</option>}
                  {fixtures.map((fixture) => (
                    <option key={fixture.id} value={fixture.id}>
                      {(fixture.home_team?.name ?? 'Home')} vs {(fixture.away_team?.name ?? 'Away')} ({fixture.status})
                    </option>
                  ))}
                </select>
                <Button type="button" variant="secondary" onClick={loadFixtures} disabled={isLoadingFixtures}>
                  {isLoadingFixtures ? 'Refreshing...' : 'Refresh'}
                </Button>
              </div>
            </div>

            {isLoadingMatch && <p className="text-sm text-muted-foreground">Loading match context...</p>}

            {selectedFixture && !liveInnings && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">Start scoring</p>
                <p className="text-xs text-muted-foreground">
                  {selectedFixture.home_team?.name ?? 'Home'} vs {selectedFixture.away_team?.name ?? 'Away'} · {selectedFixture.format}
                </p>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="battingFirst">Batting first</label>
                  <select
                    id="battingFirst"
                    className="flex h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={startForm.battingFirstTeamId}
                    onChange={(event) => setStartForm((current) => ({ ...current, battingFirstTeamId: event.target.value }))}
                  >
                    <option value={selectedFixture.home_team_id}>{selectedFixture.home_team?.name ?? 'Home'}</option>
                    <option value={selectedFixture.away_team_id}>{selectedFixture.away_team?.name ?? 'Away'}</option>
                  </select>
                </div>

                <Button type="button" onClick={startScoring} disabled={isStartingMatch}>
                  {isStartingMatch ? 'Starting...' : 'Start scoring'}
                </Button>
              </div>
            )}

            {liveInnings && (
              <div className="space-y-4">
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium">
                    Live innings: #{liveInnings.innings_no} · {match?.format}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Batting: {selectedFixture?.home_team_id === liveInnings.batting_team_id ? selectedFixture?.home_team?.name : selectedFixture?.away_team?.name}
                    {' · '}
                    Bowling: {selectedFixture?.home_team_id === liveInnings.bowling_team_id ? selectedFixture?.home_team?.name : selectedFixture?.away_team?.name}
                  </p>
                  <p className="mt-1 text-sm">
                    Score: {liveState?.runs ?? 0}/{liveState?.wickets ?? 0} ({oversDisplay} ov)
                  </p>
                </div>

                <form className="grid gap-3 md:grid-cols-3" onSubmit={addDelivery}>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="striker">Striker</label>
                  <select
                    id="striker"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={deliveryForm.strikerId}
                    onChange={(event) => setDeliveryForm((current) => ({ ...current, strikerId: event.target.value }))}
                  >
                    <option value="">Select striker</option>
                    {battingPlayers.map((player) => (
                      <option key={player.id} value={player.id}>{player.display_name || player.full_name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="nonStriker">Non-striker</label>
                  <select
                    id="nonStriker"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={deliveryForm.nonStrikerId}
                    onChange={(event) => setDeliveryForm((current) => ({ ...current, nonStrikerId: event.target.value }))}
                  >
                    <option value="">Select non-striker</option>
                    {battingPlayers.map((player) => (
                      <option key={player.id} value={player.id}>{player.display_name || player.full_name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="bowler">Bowler</label>
                  <select
                    id="bowler"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={deliveryForm.bowlerId}
                    onChange={(event) => setDeliveryForm((current) => ({ ...current, bowlerId: event.target.value }))}
                  >
                    <option value="">Select bowler</option>
                    {eligibleBowlers.map((player) => (
                      <option key={player.id} value={player.id}>{player.display_name || player.full_name}</option>
                    ))}
                  </select>
                  {mustChangeBowlerForNextBall && (
                    <p className="text-xs text-amber-600">Over complete: choose a different bowler.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="runsOffBat">Runs off bat</label>
                  <Input
                    id="runsOffBat"
                    type="number"
                    min={0}
                    value={deliveryForm.runsOffBat}
                    onChange={(event) => setDeliveryForm((current) => ({ ...current, runsOffBat: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="extrasType">Extras type</label>
                  <select
                    id="extrasType"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={deliveryForm.extrasType}
                    onChange={(event) => setDeliveryForm((current) => ({ ...current, extrasType: event.target.value }))}
                  >
                    {EXTRAS.map((extraType) => (
                      <option key={extraType} value={extraType}>{extraType}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="extrasRuns">Extras runs</label>
                  <Input
                    id="extrasRuns"
                    type="number"
                    min={0}
                    value={deliveryForm.extrasRuns}
                    onChange={(event) => setDeliveryForm((current) => ({ ...current, extrasRuns: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="wicket">Wicket</label>
                  <select
                    id="wicket"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={deliveryForm.wicket}
                    onChange={(event) => setDeliveryForm((current) => ({ ...current, wicket: event.target.value }))}
                  >
                    {WICKETS.map((wicketType) => (
                      <option key={wicketType} value={wicketType}>{wicketType}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="playerOut">Player out</label>
                  <select
                    id="playerOut"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={deliveryForm.playerOutId}
                    onChange={(event) => setDeliveryForm((current) => ({ ...current, playerOutId: event.target.value }))}
                    disabled={deliveryForm.wicket === 'NONE'}
                  >
                    <option value="">Select player out</option>
                    {battingPlayers.map((player) => (
                      <option key={player.id} value={player.id}>{player.display_name || player.full_name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 md:col-span-3">
                  <label className="text-sm font-medium" htmlFor="commentary">Commentary (optional)</label>
                  <Input
                    id="commentary"
                    value={deliveryForm.commentary}
                    onChange={(event) => setDeliveryForm((current) => ({ ...current, commentary: event.target.value }))}
                    placeholder="Driven through covers for four"
                  />
                </div>

                <div className="md:col-span-3">
                  <Button type="submit" disabled={isSavingDelivery}>
                    {isSavingDelivery ? 'Saving delivery...' : 'Add delivery'}
                  </Button>
                </div>
              </form>
              </div>
            )}
          </CardContent>
        </Card>

        <BallByBallHistory
          recentDeliveries={recentDeliveries}
          paginatedRecentDeliveries={paginatedRecentDeliveries}
          deliveriesPage={deliveriesPage}
          totalDeliveryPages={totalDeliveryPages}
          deliveryPageSize={DELIVERY_PAGE_SIZE}
          playerLabel={playerLabel}
          deliveryEventLabel={deliveryEventLabel}
          startEditDelivery={startEditDelivery}
          deleteDelivery={deleteDelivery}
          isDeletingDeliveryId={isDeletingDeliveryId}
          onPreviousPage={() => setDeliveriesPage((current) => Math.max(1, current - 1))}
          onNextPage={() => setDeliveriesPage((current) => Math.min(totalDeliveryPages, current + 1))}
          editingDeliveryId={editingDeliveryId}
          deliveryEditForm={deliveryEditForm}
          cancelEditDelivery={cancelEditDelivery}
          saveEditedDelivery={saveEditedDelivery}
          isUpdatingDeliveryId={isUpdatingDeliveryId}
          setDeliveryEditForm={setDeliveryEditForm}
          battingPlayers={battingPlayers}
          bowlingPlayers={bowlingPlayers}
          extras={EXTRAS}
          wickets={WICKETS}
        />
      </div>
    </section>
  )
}

export default ScoringPage
