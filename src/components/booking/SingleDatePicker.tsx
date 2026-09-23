import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAvailability } from '@/api/client'
import type { AvailabilitySlot, Product } from '@/api/types'
import { Calendar } from '@/components/ui/calendar'
import { isDayBookable, forceReasonsFor } from '@/components/booking/bookability'
import { availableDaysForLabel, singleDateGate, tr, type ForceReason } from '@/lib/strings'
import { browserLocale } from '@/lib/locale'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StepBackButton } from '@/components/booking/StepBackButton'
import { dateFromIso, isoDate } from '@/components/booking/dateUtils'
import {
  availabilityWindow,
  startOfToday,
  useNothingBeforeNotice,
  useStartMonth,
} from '@/components/booking/calendarStart'
import { useStaffMode } from '@/lib/staffMode'
import { OperatorOverrideBadge } from '@/components/booking/OperatorOverrideBadge'
import { NextAction } from '@/components/booking/NextAction'
import { ContinueAction } from '@/components/booking/ContinueAction'

interface Props {
  product: Product
  /** Absent → no Back affordance (landr-6eita.1: start=dates entry). */
  onBack?: () => void
  /**
   * Commits the picked date as a one-element selected_days array, matching
   * the BookingForm contract used by the days-range and fixed-window paths.
   * landr-aoak.2: in staff mode `forcedDays` carries the picked date when it
   * was force-booked past zero availability (empty otherwise).
   * landr-t869m.5: `forcedReasons` names WHICH gate(s) that override
   * bypassed (capacity and/or lead time) — empty/undefined when `forcedDays`
   * is empty/undefined.
   */
  onConfirm: (
    selectedDays: string[],
    forcedDays?: string[],
    forcedReasons?: ForceReason[],
  ) => void
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
  const locale = browserLocale()
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

  const { fromIso, toIso, today } = useMemo(() => {
    const from = startOfToday()
    return { ...availabilityWindow(from), today: from }
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

  // landr-t869m.2: gate on lead-time bookability too, folded into the same
  // availableSet a sold-out day already uses — see MultiDayPicker's
  // matching comment for why this transparently covers the staff
  // force-book path as well. isDayBookable also folds in
  // accommodation_bookable for a 'mandatory' hotel_offering — see its own
  // doc for why that combination is the widget's job, not the API's.
  const availableSet = useMemo(() => {
    return new Set(
      (slots ?? [])
        .filter(
          (slot) =>
            slot.available_seats > 0 &&
            isDayBookable(slot, product.hotel_offering),
        )
        .map((slot) => slot.date),
    )
  }, [slots, product.hotel_offering])

  // landr-l38a4: open on the restored pick, else the first bookable day.
  const [month, setMonth] = useStartMonth(
    selected ? [isoDate(selected)] : [],
    availableSet,
  )
  const nothingBefore = useNothingBeforeNotice(availableSet)

  // landr-t869m.5: date → slot lookup so a force-booked pick can name WHICH
  // gate(s) it bypassed. A date with no matching slot at all (outside the
  // fetched horizon, or the endpoint never returned a row) has no evidence
  // either way — fails open to ['capacity'], preserving this override's
  // pre-existing (capacity-flavoured) copy rather than inventing a lead-time
  // claim from missing data.
  const slotsByDate = useMemo(() => {
    return new Map((slots ?? []).map((slot) => [slot.date, slot]))
  }, [slots])

  // landr-t869m.7: DERIVED from `selected`/`slots`/`availableSet`/`canForce`
  // rather than tracked as its own useState — that used to be the bug.
  // `selected` can be RESTORED from initialSelectedDays (Back nav) before
  // `slots` has loaded, and a separately-initialized-to-[] array was never
  // recomputed once availability loaded, so Back → Continue on a
  // force-booked date silently dropped the force flag AND its reasons, and
  // the staff submit 422'd (capacity, lead time, or a closed day). Deriving
  // it — matching MultiDayPicker's `forcedDays`/`forcedReasons` and
  // FixedDateWindowPicker's `selectedForceReasons`, both already useMemo —
  // makes it self-healing: it is always in sync with the CURRENT
  // availability the moment `slots` loads, for both a live pick and a
  // restored one, with no separate effect required. Gated on `slots !==
  // null` so it reads as "not yet known" (empty) rather than prematurely
  // flashing forced=true before the fetch resolves — the other two pickers
  // get this for free because their own loading state (`windows`/
  // `availability`) starts null/[] and their derived value naturally
  // resolves to "nothing selected yet" during that window.
  const selectedForceReasons: ForceReason[] = useMemo(() => {
    if (!selected || !canForce || slots === null) return []
    const iso = isoDate(selected)
    if (availableSet.has(iso)) return []
    const slot = slotsByDate.get(iso)
    return slot
      ? forceReasonsFor(slot.available_seats > 0, slot, product.hotel_offering)
      : (['capacity'] as ForceReason[])
  }, [selected, canForce, slots, availableSet, slotsByDate, product.hotel_offering])

  // Stable handler so Calendar doesn't re-render on every parent render.
  // landr-aoak.2: in staff mode, picking a date with zero availability is the
  // operator-override path — confirm the intent (the actual forced flag +
  // reasons are read off the derived selectedForceReasons above once
  // `selected` changes, not set here). Normal customers can never reach this
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
      onLiveDaysChange?.([isoDate(d)])
      return
    }
    setSelected(d)
    onLiveDaysChange?.(d ? [isoDate(d)] : [])
  }, [availableSet, canForce, onLiveDaysChange])

  if (error) {
    return (
      <Card>
        <StepBackButton onBack={onBack} />
        <CardHeader>
          <CardTitle>{tr('couldNotLoadAvailability', locale)}</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>{tr('pickADate', locale)}</CardTitle>
        <CardDescription>{availableDaysForLabel(product.name, locale)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* landr-80ubl.2: one-next-action rule — the calendar owns the ring
            until a date is picked, then ContinueAction (active by default)
            takes over. */}
        <NextAction active={selected === null} cue={tr('singleDatePickerCue', locale)}>
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
            month={month}
            onMonthChange={setMonth}
          />
          {nothingBefore ? (
            <p
              className="text-xs text-muted-foreground"
              data-testid="calendar-nothing-before"
            >
              {nothingBefore}
            </p>
          ) : null}
          {selected ? (
            // landr-3mo4: selected date confirmed in a tinted (borderless) chip
            // so the choice reads as committed, not as muted helper text.
            <div className="flex flex-wrap items-center gap-2">
              <p
                className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-foreground"
                data-testid="single-date-selected"
              >
                {tr('selectedDateTemplate', locale).replace('{date}', isoDate(selected))}
              </p>
              {selectedForceReasons.length > 0 ? <OperatorOverrideBadge /> : null}
            </div>
          ) : null}
        </NextAction>
        <ContinueAction
          ready={selected !== null}
          reason={singleDateGate(selected !== null, locale)}
          reasonId="single-date-picker-gate"
          onContinue={() => {
            if (selected) {
              const iso = isoDate(selected)
              // landr-aoak.2: pass forcedDays ONLY when the selection was
              // force-booked, so the normal path calls onConfirm([iso]) with
              // exactly one argument (byte-identical to before).
              if (selectedForceReasons.length > 0) {
                onConfirm([iso], [iso], selectedForceReasons)
              } else {
                onConfirm([iso])
              }
            }
          }}
          data-testid="single-date-picker-submit"
        />
      </CardContent>
    </Card>
  )
}
