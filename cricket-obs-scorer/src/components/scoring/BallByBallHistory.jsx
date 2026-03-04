import { Pencil, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

function BallByBallHistory({
  recentDeliveries,
  paginatedRecentDeliveries,
  deliveriesPage,
  totalDeliveryPages,
  deliveryPageSize,
  playerLabel,
  deliveryEventLabel,
  startEditDelivery,
  deleteDelivery,
  isDeletingDeliveryId,
  onPreviousPage,
  onNextPage,
  editingDeliveryId,
  deliveryEditForm,
  cancelEditDelivery,
  saveEditedDelivery,
  isUpdatingDeliveryId,
  setDeliveryEditForm,
  battingPlayers,
  bowlingPlayers,
  extras,
  wickets,
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Ball by Ball History</CardTitle>
        </CardHeader>
        <CardContent>
          {recentDeliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliveries recorded yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {paginatedRecentDeliveries.map((delivery) => {
                const isDeleting = isDeletingDeliveryId === delivery.id

                return (
                  <li key={delivery.id} className="rounded-md border p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs text-muted-foreground">
                          {delivery.over_no}.{delivery.ball_no} · {playerLabel(delivery.striker)} vs {playerLabel(delivery.bowler)}
                        </p>
                        <p className="truncate text-sm font-medium">{deliveryEventLabel(delivery)}</p>
                        {delivery.commentary && (
                          <p className="truncate text-xs text-muted-foreground">{delivery.commentary}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 w-8 p-0"
                          onClick={() => startEditDelivery(delivery)}
                          title="Edit delivery"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => deleteDelivery(delivery.id)}
                          disabled={isDeleting}
                          title="Delete delivery"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {recentDeliveries.length > deliveryPageSize && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onPreviousPage}
                disabled={deliveriesPage === 1}
              >
                Previous
              </Button>
              <p className="text-xs text-muted-foreground">
                Page {deliveriesPage} of {totalDeliveryPages}
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onNextPage}
                disabled={deliveriesPage === totalDeliveryPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {editingDeliveryId && deliveryEditForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-lg border bg-card p-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">Edit Delivery</h3>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={cancelEditDelivery}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Striker (Facing Batsman)</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={deliveryEditForm.strikerId}
                    onChange={(event) => setDeliveryEditForm((current) => ({ ...current, strikerId: event.target.value }))}
                  >
                    <option value="">Select striker</option>
                    {battingPlayers.map((player) => (
                      <option key={player.id} value={player.id}>{player.display_name || player.full_name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Non-Striker</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={deliveryEditForm.nonStrikerId}
                    onChange={(event) => setDeliveryEditForm((current) => ({ ...current, nonStrikerId: event.target.value }))}
                  >
                    <option value="">Select non-striker</option>
                    {battingPlayers.map((player) => (
                      <option key={player.id} value={player.id}>{player.display_name || player.full_name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Bowler</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={deliveryEditForm.bowlerId}
                    onChange={(event) => setDeliveryEditForm((current) => ({ ...current, bowlerId: event.target.value }))}
                  >
                    <option value="">Select bowler</option>
                    {bowlingPlayers.map((player) => (
                      <option key={player.id} value={player.id}>{player.display_name || player.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Runs Off Bat</label>
                  <Input
                    type="number"
                    min={0}
                    value={deliveryEditForm.runsOffBat}
                    onChange={(event) => setDeliveryEditForm((current) => ({ ...current, runsOffBat: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Extras Type</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={deliveryEditForm.extrasType}
                    onChange={(event) => setDeliveryEditForm((current) => ({ ...current, extrasType: event.target.value }))}
                  >
                    {extras.map((extraType) => (
                      <option key={extraType} value={extraType}>{extraType}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Extras Runs</label>
                  <Input
                    type="number"
                    min={0}
                    value={deliveryEditForm.extrasRuns}
                    onChange={(event) => setDeliveryEditForm((current) => ({ ...current, extrasRuns: event.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Wicket Type</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={deliveryEditForm.wicket}
                    onChange={(event) => setDeliveryEditForm((current) => ({ ...current, wicket: event.target.value }))}
                  >
                    {wickets.map((wicketType) => (
                      <option key={wicketType} value={wicketType}>{wicketType}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Player Out</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={deliveryEditForm.playerOutId}
                    onChange={(event) => setDeliveryEditForm((current) => ({ ...current, playerOutId: event.target.value }))}
                    disabled={deliveryEditForm.wicket === 'NONE'}
                  >
                    <option value="">Select player out</option>
                    {battingPlayers.map((player) => (
                      <option key={player.id} value={player.id}>{player.display_name || player.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Commentary</label>
                <Input
                  value={deliveryEditForm.commentary}
                  onChange={(event) => setDeliveryEditForm((current) => ({ ...current, commentary: event.target.value }))}
                  placeholder="Commentary"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button type="button" onClick={() => saveEditedDelivery(editingDeliveryId)} disabled={isUpdatingDeliveryId === editingDeliveryId}>
                {isUpdatingDeliveryId === editingDeliveryId ? 'Saving...' : 'Save changes'}
              </Button>
              <Button type="button" variant="secondary" onClick={cancelEditDelivery}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default BallByBallHistory
