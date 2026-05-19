import { useEffect, useMemo, useState } from 'react'
import { getFixedDateWindows } from '@/api/client'
import type { AvailabilitySlot, FixedDateWindow, Product } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface Props {
  product: Product
  onBack: () => void
  /**
   * The widget pipeline downstream of this picker (BookingForm + pickup) only
   * knows AvailabilitySlot. We synthesise a slot from the picked window where
   * `date` = start_date and capacity figures mirror the window. The booking
   * submit path then expands selected_days across the full window range.
   */
  onConfirm: (slot: AvailabilitySlot, window: FixedDateWindow) => void
  /** Operator's expose_seats_to_customer flag (landr-e10.9). When false the
   * picker hides exact seat counts and just shows Available / Full. */
  exposeSeats?: boolean
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function rangeLabel(window: FixedDateWindow): string {
  if (window.start_date === window.end_date) return fmtDate(window.start_date)
  return `${fmtDate(window.start_date)} – ${fmtDate(window.end_date)}`
}

function windowToSlot(window: FixedDateWindow): AvailabilitySlot {
  const available = Math.max(0, window.capacity - window.capacity_reserved)
  return {
    availability_id: window.id,
    date: window.start_date,
    start_time: null,
    end_time: null,
    capacity: window.capacity,
    capacity_reserved: window.capacity_reserved,
    available_seats: available,
    status: available > 0 ? 'open' : 'fully_booked',
  }
}

export function FixedDateWindowPicker({
  product,
  onBack,
  onConfirm,
  exposeSeats = true,
}: Props) {
  const [windows, setWindows] = useState<FixedDateWindow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await getFixedDateWindows(product.product_id)
        if (!cancelled) setWindows(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [product.product_id])

  const selectedWindow = useMemo(
    () => windows?.find((w) => w.id === selectedId) ?? null,
    [windows, selectedId],
  )

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Could not load course windows.</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pick a course window</CardTitle>
        <CardDescription>
          Upcoming {product.name} windows. Pick one to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {windows === null ? (
          <p className="text-sm text-muted-foreground">Loading windows…</p>
        ) : windows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No upcoming windows for this course. Please check back later.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {windows.map((window) => {
              const available = Math.max(
                0,
                window.capacity - window.capacity_reserved,
              )
              const isFull = available === 0
              const isSelected = selectedId === window.id
              return (
                <li key={window.id}>
                  <button
                    type="button"
                    disabled={isFull}
                    onClick={() => setSelectedId(window.id)}
                    aria-pressed={isSelected}
                    className={`w-full rounded-md border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{rangeLabel(window)}</div>
                      <div className="text-xs text-muted-foreground">
                        {isFull
                          ? 'Full'
                          : exposeSeats
                            ? `${available} seat${available === 1 ? '' : 's'} left`
                            : 'Available'}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" type="button" onClick={onBack}>
            Back
          </Button>
          <Button
            type="button"
            disabled={!selectedWindow}
            onClick={() => {
              if (selectedWindow) {
                onConfirm(windowToSlot(selectedWindow), selectedWindow)
              }
            }}
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Expand a window's [start_date, end_date] inclusive into per-day ISO strings
 * for the booking submit payload's selected_days.
 */
export function expandWindowDays(window: FixedDateWindow): string[] {
  const out: string[] = []
  const start = new Date(`${window.start_date}T00:00:00Z`)
  const end = new Date(`${window.end_date}T00:00:00Z`)
  for (let d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}
