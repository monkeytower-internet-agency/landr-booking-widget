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
import { useStaffMode } from '@/lib/staffMode'
import { OperatorOverrideBadge } from '@/components/booking/OperatorOverrideBadge'

interface Props {
  product: Product
  onBack: () => void
  /**
   * Commits the picked date as a one-element selected_days array, matching
   * the BookingForm contract used by the days-range and fixed-window paths.
   * landr-aoak.2: in staff mode `forcedDays` carries the picked date when it
   * was force-booked past zero availability (empty otherwise).
   */
  onConfirm: (selectedDays: string[], forcedDays?: string[]) => void
  /**
   * Called when the user selects a date so App.tsx can feed the live
   * selection into PriceSidebar before Continue is pressed (landr-w7pi).
   */
  onLiveDaysChange?: (isoDays: string[]) => void
  /**
   * landr (breadcrumb): previously-committed ISO day (single-element array),
   * restored when the customer navigates BACK so the prior pick is pre-selected
   * instead of empty. Empty/undefined on the first visit.
   */
  initialSelectedDays?: string[]
}

const HORIZON_DAYS = 60

const isoDate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const dateFromIso = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
}

/**
 * Picker for service products with service_time_shape='single_date' (landr-y9k).
 *
 * Single click commits one date. No range concept. Past dates and dates with
 * zero availability are disabled. Reuses the same /availability endpoint the
 * MultiDayPicker uses — the only difference is one-click-only semantics.
 */
export function SingleDatePicker({
  product,
  onBack,
  onConfirm,
  onLiveDaysChange,
  initialSelectedDays,
}: Props) {
  const staff = useStaffMode()
  // landr-aoak.2: force-book is only offered when staff mode is active AND the
  // session carries the force_book power. Otherwise this is the normal picker.
  const canForce = staff.active && staff.powers.includes('force_book')
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // landr (breadcrumb): seed from the restored ISO day on back-nav re-entry.
  const [selected, setSelected] = useState<Date | null>(() =>
    initialSelectedDays && initialSelectedDays[0]
      ? dateFromIso(initialSelectedDays[0])
      : null,
  )
  // True when the currently-selected date had zero availability and was picked
  // via the operator-override path (drives the badge + the forced submit flag).
  const [selectedForced, setSelectedForced] = useState(false)

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

  // landr (breadcrumb): surface a restored selection in the live sidebar once
  // on mount, so the price preview reflects the prior pick immediately.
  useEffect(() => {
    if (selected) onLiveDaysChange?.([isoDate(selected)])
    // Fire once for the initial restored value only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const availableSet = useMemo(() => {
    return new Set(
      (slots ?? [])
        .filter((slot) => slot.available_seats > 0)
        .map((slot) => slot.date),
    )
  }, [slots])

  // Stable handler so Calendar doesn't re-render on every parent render.
  // landr-aoak.2: in staff mode, picking a date with zero availability is the
  // operator-override path — confirm the intent, then mark the selection forced
  // so the submit carries the force flag. Normal customers can never reach this
  // (the day stays disabled when canForce is false).
  const handleSelect = useCallback((date: Date | undefined) => {
    const d = date ?? null
    if (d && canForce && !availableSet.has(isoDate(d))) {
      if (
        !window.confirm(
          'Force-book this full / blocked day on behalf of the customer?',
        )
      ) {
        return
      }
      setSelected(d)
      setSelectedForced(true)
      onLiveDaysChange?.([isoDate(d)])
      return
    }
    setSelected(d)
    setSelectedForced(false)
    onLiveDaysChange?.(d ? [isoDate(d)] : [])
  }, [availableSet, canForce, onLiveDaysChange])

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
          // landr-aoak.2: in staff mode, zero-availability (sold-out / blocked)
          // days stay SELECTABLE so the operator can force-book them. Past dates
          // remain disabled for everyone. Normal customers keep today's exact
          // behaviour (both predicates apply).
          disabled={(date) =>
            date < today || (!canForce && !availableSet.has(isoDate(date)))
          }
          defaultMonth={today}
        />
        {selected ? (
          // landr-3mo4: selected date confirmed in a tinted (borderless) chip
          // so the choice reads as committed, not as muted helper text.
          <div className="flex flex-wrap items-center gap-2">
            <p
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-foreground"
              data-testid="single-date-selected"
            >
              Selected: {isoDate(selected)}
            </p>
            {selectedForced ? <OperatorOverrideBadge /> : null}
          </div>
        ) : null}
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            disabled={selected === null}
            onClick={() => {
              if (selected) {
                const iso = isoDate(selected)
                // landr-aoak.2: pass forcedDays ONLY when the selection was
                // force-booked, so the normal path calls onConfirm([iso]) with
                // exactly one argument (byte-identical to before).
                if (selectedForced) onConfirm([iso], [iso])
                else onConfirm([iso])
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
