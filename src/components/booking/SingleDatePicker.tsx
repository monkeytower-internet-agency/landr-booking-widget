import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAvailability } from '@/api/client'
import type { AvailabilitySlot, Product } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StepBackButton } from '@/components/booking/StepBackButton'

interface Props {
  product: Product
  onBack: () => void
  /**
   * Commits the picked date as a one-element selected_days array, matching
   * the BookingForm contract used by the days-range and fixed-window paths.
   */
  onConfirm: (selectedDays: string[]) => void
  /**
   * Called when the user selects a date so App.tsx can feed the live
   * selection into PriceSidebar before Continue is pressed (landr-w7pi).
   */
  onLiveDaysChange?: (isoDays: string[]) => void
}

const HORIZON_DAYS = 60

const isoDate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Picker for service products with service_time_shape='single_date' (landr-y9k).
 *
 * Single click commits one date. No range concept. Past dates and dates with
 * zero availability are disabled. Reuses the same /availability endpoint the
 * MultiDayPicker uses — the only difference is one-click-only semantics.
 */
export function SingleDatePicker({ product, onBack, onConfirm, onLiveDaysChange }: Props) {
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Date | null>(null)

  const { fromIso, toIso, today } = useMemo(() => {
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date(from)
    to.setDate(to.getDate() + HORIZON_DAYS)
    return { fromIso: isoDate(from), toIso: isoDate(to), today: from }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await getAvailability(product.product_id, fromIso, toIso)
        if (!cancelled) setSlots(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [product.product_id, fromIso, toIso])

  const availableSet = useMemo(() => {
    return new Set(
      (slots ?? [])
        .filter((slot) => slot.available_seats > 0)
        .map((slot) => slot.date),
    )
  }, [slots])

  // Stable handler so Calendar doesn't re-render on every parent render.
  const handleSelect = useCallback((date: Date | undefined) => {
    const d = date ?? null
    setSelected(d)
    onLiveDaysChange?.(d ? [isoDate(d)] : [])
  }, [onLiveDaysChange])

  if (error) {
    return (
      <Card>
        <StepBackButton onBack={onBack} />
        <CardHeader>
          <CardTitle>Could not load availability.</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>Pick a date</CardTitle>
        <CardDescription>
          Showing the next {HORIZON_DAYS} days for {product.name}. Click a date
          to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Calendar
          mode="single"
          selected={selected ?? undefined}
          onSelect={handleSelect}
          disabled={(date) => date < today || !availableSet.has(isoDate(date))}
          defaultMonth={today}
        />
        {selected ? (
          <p className="text-sm text-muted-foreground" data-testid="single-date-selected">
            Selected: {isoDate(selected)}
          </p>
        ) : null}
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            disabled={selected === null}
            onClick={() => {
              if (selected) onConfirm([isoDate(selected)])
            }}
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
