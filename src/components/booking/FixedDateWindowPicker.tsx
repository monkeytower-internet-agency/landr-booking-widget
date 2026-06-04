import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, Check } from 'lucide-react'
import { getFixedDateWindows } from '@/api/client'
import type { AvailabilitySlot, FixedDateWindow, Product } from '@/api/types'
import { expandWindowDays } from './expandWindowDays'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StepBackButton } from '@/components/booking/StepBackButton'
import { useVariant } from '@/lib/variant'
import { cn } from '@/lib/utils'

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
  /**
   * Called when the user selects a window so App.tsx can feed the live
   * expanded days into PriceSidebar before Continue is pressed (landr-w7pi).
   */
  onLiveDaysChange?: (isoDays: string[]) => void
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
  onLiveDaysChange,
}: Props) {
  const { tokens } = useVariant()
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
        <StepBackButton onBack={onBack} />
        <CardHeader>
          <CardTitle>Could not load course windows.</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <StepBackButton onBack={onBack} />
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
          <ul className="flex flex-col gap-2.5">
            {windows.map((window) => {
              const available = Math.max(
                0,
                window.capacity - window.capacity_reserved,
              )
              const isFull = available === 0
              const isSelected = selectedId === window.id
              return (
                <li key={window.id}>
                  {/* landr-3mo4: window rows are now proper OPTION-CARDS —
                      a leading calendar-range icon in a tinted tile, the date
                      range as the label, a borderless seat-state chip, and a
                      brand-tinted selected state with a check. The card is a
                      raised surface that lifts off the step card; selection
                      adds the shared brand well + ring. ≥44px tap target. */}
                  <button
                    type="button"
                    disabled={isFull}
                    onClick={() => {
                      setSelectedId(window.id)
                      onLiveDaysChange?.(expandWindowDays(window))
                    }}
                    aria-pressed={isSelected}
                    className={cn(
                      'tap-44 flex w-full items-center gap-3 border p-3 text-left transition-[background-color,border-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-60',
                      tokens.optionCardRadius,
                      tokens.focusRing,
                      isSelected
                        ? tokens.optionSelected
                        : cn(
                            'border-border bg-surface-raised hover:border-primary/40',
                            !isFull && tokens.optionCardShadow,
                          ),
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-lg',
                        isSelected
                          ? 'bg-primary/15 text-foreground'
                          : 'bg-surface-well text-muted-foreground',
                      )}
                      aria-hidden
                    >
                      {isSelected ? (
                        <Check className="size-4" />
                      ) : (
                        <CalendarRange className="size-4" />
                      )}
                    </span>
                    <span className="flex flex-1 items-center justify-between gap-3">
                      <span className="font-medium tabular-nums">
                        {rangeLabel(window)}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          isFull
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
                        )}
                      >
                        {isFull
                          ? 'Full'
                          : exposeSeats
                            ? `${available} seat${available === 1 ? '' : 's'} left`
                            : 'Available'}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex justify-end pt-2">
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

