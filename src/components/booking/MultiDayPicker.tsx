import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Modifiers } from 'react-day-picker'
import type { AvailabilitySlot, HotelOffering } from '@/api/types'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { isDayBookable, forceReasonsFor } from '@/components/booking/bookability'
import { describeForceReasons, tr, type ForceReason } from '@/lib/strings'
import { browserLocale } from '@/lib/locale'
import { useStaffMode } from '@/lib/staffMode'
import { OperatorOverrideBadge } from '@/components/booking/OperatorOverrideBadge'
import { dateFromIso, isoDate } from '@/components/booking/dateUtils'
import { computeDayDiff } from '@/components/booking/daySetDiff'
import {
  useNothingBeforeNotice,
  useStartMonth,
} from '@/components/booking/calendarStart'
import { HelpDisclosure } from '@/components/booking/HelpDisclosure'

type Mode = 'individual' | 'range'

interface MultiDayPickerProps {
  availability: AvailabilitySlot[]
  value: Date[]
  onChange: (days: Date[]) => void
  helpText?: string
  /**
   * Initial visible month; tests rely on this. When omitted (landr-l38a4) the
   * calendar opens on the earliest selected day's month, else the first
   * bookable day's month, else today's.
   */
  defaultMonth?: Date
  /**
   * When true (product.is_contiguous, landr-y9k): selection MUST be a single
   * contiguous run of available days. Clicks that would break contiguity
   * (toggle middle days, shift-click far dates) are coerced into a fresh
   * single-day selection, so the user always ends up with a valid range.
   * When false (default): mode-aware toggle/range behaviour.
   */
  isContiguous?: boolean
  /**
   * landr-t869m.2: the product's hotel_offering, so a day can be gated on
   * BOTH activity_bookable and accommodation_bookable when it's
   * 'mandatory' — see isDayBookable's doc for why the API does NOT already
   * combine these for this endpoint. Undefined (product predates the
   * field, or an older mock) behaves like 'none'/'optional' — activity
   * bookability alone gates the day, matching the pre-landr-t869m.2
   * behaviour.
   */
  hotelOffering?: HotelOffering
  /**
   * landr-aoak.2 [S3]: called when the set of force-booked (zero-availability)
   * days inside the current selection changes. Only ever fires non-empty in
   * staff mode; the normal customer path never selects an unavailable day so
   * this stays []. Lets the parent step thread the forced days into the submit
   * adapter's capacity-override flag.
   * landr-t869m.5: `forcedReasons` is the UNION of gate(s) bypassed across
   * every forced day in the current selection (canonical order — see
   * forceReasonsFor's doc), so the parent can pass it straight through to
   * BookingForm's review-forced banner.
   */
  onForcedDaysChange?: (
    forcedIsoDays: string[],
    forcedReasons: ForceReason[],
  ) => void
  /**
   * landr-otml0.3 — invite-mode diff baseline (originalValue mode, ported
   * from the dashboard's MultiDayPicker — landr-fxza.5 Section C). When
   * provided, the calendar renders a tri-colour diff (unchanged / added /
   * removed) against it, plus a change-summary line and a "Reset to
   * <hostLabel>'s dates" button. Omit for the plain picker (no diff chrome) —
   * every non-invite booking.
   */
  originalValue?: Date[]
  /**
   * The host's display name, interpolated into the summary line and the
   * reset button. Required whenever `originalValue` is set; ignored
   * otherwise.
   */
  originalValueLabel?: string
}


function fillRange(from: Date, to: Date, availableSet: Set<string>): string[] {
  const [start, end] = from <= to ? [from, to] : [to, from]
  const out: string[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const limit = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cursor <= limit) {
    const key = isoDate(cursor)
    if (availableSet.has(key)) out.push(key)
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

function sortedDates(isoSet: Set<string>): Date[] {
  return Array.from(isoSet)
    .sort()
    .map(dateFromIso)
}

// landr-ifcu: v1 is English-only. The German variant of this help text was
// removed; locale-suffixed names dropped in favour of plain identifiers.
export const DEFAULT_MULTI_DAY_HELP_INDIVIDUAL = 'Tap days to add or remove them.'

export const DEFAULT_MULTI_DAY_HELP_RANGE =
  'Tap a start date, then tap another to span the days between.'

// Backwards-compat alias — points to the range-mode string (default mode is range as of landr-q2l4).
export const DEFAULT_MULTI_DAY_HELP = DEFAULT_MULTI_DAY_HELP_RANGE

/**
 * Help text shown in contiguous mode (landr-y9k). The any-day-toggle copy
 * does not apply — contiguous selection rejects non-adjacent clicks.
 */
export const CONTIGUOUS_MULTI_DAY_HELP =
  'Click a start date, then click another to extend the range. Selection must be consecutive days.'

export function MultiDayPicker({
  availability,
  value,
  onChange,
  helpText,
  defaultMonth,
  isContiguous = false,
  hotelOffering,
  onForcedDaysChange,
  originalValue,
  originalValueLabel,
}: MultiDayPickerProps) {
  const staff = useStaffMode()
  const locale = browserLocale()
  // landr-aoak.2: force-book only when staff mode is active AND the session
  // carries the force_book power. Otherwise this is the normal customer picker.
  const canForce = staff.active && staff.powers.includes('force_book')

  // landr-t869m.2: a day also needs lead-time bookability (activity, plus —
  // for a 'mandatory' hotel_offering — accommodation too; see
  // isDayBookable's doc for why the API doesn't already combine these).
  // Folding this into the SAME availableSet a sold-out day already uses
  // means the existing staff force-book path (canForce →
  // disabled=undefined, see the Calendar below) transparently covers
  // lead-time overrides too — no separate override plumbing needed.
  const availableSet = useMemo(() => {
    return new Set(
      availability
        .filter(
          (slot) =>
            slot.available_seats > 0 && isDayBookable(slot, hotelOffering),
        )
        .map((slot) => slot.date),
    )
  }, [availability, hotelOffering])

  // landr-t869m.5: date → slot lookup so a force-booked day can name WHICH
  // gate(s) it bypassed (capacity and/or lead time), same fail-open-to-
  // ['capacity'] contract as SingleDatePicker's slotsByDate when a date has
  // no matching row at all.
  const slotsByDate = useMemo(
    () => new Map(availability.map((slot) => [slot.date, slot])),
    [availability],
  )

  const [anchor, setAnchor] = useState<Date | null>(null)
  const [mode, setMode] = useState<Mode>('range')
  // landr-otml0.3 review fix (CRITICAL 1): how many of the host's days
  // Reset had to drop because they're no longer available. null = no reset
  // has happened yet (or the customer has edited the selection since —
  // cleared inside applyClick below), so the notice never lingers stale.
  const [resetDroppedCount, setResetDroppedCount] = useState<number | null>(
    null,
  )

  const valueSet = useMemo(() => new Set(value.map(isoDate)), [value])

  // landr-l38a4: open on the first selected day (Back nav / invite prefill)
  // or the first bookable day (season starts later) — never a dead month.
  const [month, setMonth] = useStartMonth(
    value.map(isoDate),
    availableSet,
    defaultMonth,
  )
  const nothingBefore = useNothingBeforeNotice(availableSet)

  // landr-aoak.2: the force-booked subset of the current selection — selected
  // days that have zero availability. Empty for every normal selection.
  const forcedDays = useMemo(
    () => value.map(isoDate).filter((iso) => !availableSet.has(iso)).sort(),
    [value, availableSet],
  )

  // landr-t869m.5: the UNION of gate(s) bypassed across every forced day —
  // a range can mix a sold-out day with a lead-time-blocked one, so this
  // names every reason that applies to ANY of them rather than picking one.
  // Canonical order (see forceReasonsFor's doc) so the badge text and the
  // eventual review-forced banner never disagree on ordering.
  const forcedReasons = useMemo(() => {
    const present = new Set<ForceReason>()
    for (const iso of forcedDays) {
      const slot = slotsByDate.get(iso)
      const reasons = slot
        ? forceReasonsFor(slot.available_seats > 0, slot, hotelOffering)
        : (['capacity'] as ForceReason[])
      reasons.forEach((r) => present.add(r))
    }
    return (['capacity', 'lead_time', 'accommodation_lead_time'] as ForceReason[]).filter(
      (r) => present.has(r),
    )
  }, [forcedDays, slotsByDate, hotelOffering])

  const applyClick = useCallback(
    (day: Date, toggle: boolean) => {
      // landr-otml0.3 review fix (CRITICAL 1): any manual edit after a Reset
      // retires that Reset's "N days dropped" notice — it described THAT
      // reset, not the selection the customer is building now.
      setResetDroppedCount(null)
      const key = isoDate(day)
      // landr-aoak.2: in staff mode an unavailable day is the operator-override
      // path — confirm, then toggle it into the selection like an individual
      // day. Normal customers (canForce false) keep the original early-return,
      // so a sold-out day is never selectable for them.
      if (!availableSet.has(key)) {
        if (!canForce) return
        if (
          !window.confirm(
            'Force-book this full / blocked day on behalf of the customer?',
          )
        ) {
          return
        }
        const forcedNext = new Set(valueSet)
        if (forcedNext.has(key)) forcedNext.delete(key)
        else forcedNext.add(key)
        setAnchor(day)
        onChange(sortedDates(forcedNext))
        return
      }
      const next = new Set(valueSet)

      // Contiguous mode (landr-y9k): the selection must always be a single
      // gap-free run of available days. A click is honoured as a range
      // extension/trim if every day between the existing run and the
      // clicked date is available; otherwise the selection restarts from
      // the clicked day. Toggle gestures (shift/ctrl/modifier) are
      // suppressed — they always restart since they can't preserve the
      // contiguous invariant.
      if (isContiguous) {
        if (anchor === null || valueSet.size === 0 || toggle) {
          next.clear()
          next.add(key)
          setAnchor(day)
        } else {
          const sorted = Array.from(valueSet).sort()
          const first = dateFromIso(sorted[0]!)
          const last = dateFromIso(sorted[sorted.length - 1]!)
          let rangeFrom: Date
          let rangeTo: Date
          if (day < first) {
            rangeFrom = day
            rangeTo = last
          } else if (day > last) {
            rangeFrom = first
            rangeTo = day
          } else {
            // Click inside the existing run: trim to [anchor..day].
            rangeFrom = anchor
            rangeTo = day
          }
          const orderedFrom = rangeFrom <= rangeTo ? rangeFrom : rangeTo
          const orderedTo = rangeFrom <= rangeTo ? rangeTo : rangeFrom
          // Verify the candidate range is gap-free (no unavailable days
          // between orderedFrom and orderedTo). If any day in the span is
          // disabled the range can't be honoured contiguously, so restart.
          let gapFree = true
          const check = new Date(orderedFrom)
          while (check <= orderedTo) {
            if (!availableSet.has(isoDate(check))) {
              gapFree = false
              break
            }
            check.setDate(check.getDate() + 1)
          }
          if (!gapFree) {
            next.clear()
            next.add(key)
            setAnchor(day)
          } else {
            next.clear()
            const cursor = new Date(orderedFrom)
            while (cursor <= orderedTo) {
              next.add(isoDate(cursor))
              cursor.setDate(cursor.getDate() + 1)
            }
            setAnchor(day)
          }
        }
        onChange(sortedDates(next))
        return
      }

      if (toggle) {
        if (next.has(key)) next.delete(key)
        else next.add(key)
        setAnchor(day)
      } else if (anchor === null || valueSet.size === 0) {
        next.clear()
        next.add(key)
        setAnchor(day)
      } else {
        const sorted = Array.from(valueSet).sort()
        const first = dateFromIso(sorted[0]!)
        const last = dateFromIso(sorted[sorted.length - 1]!)
        let rangeFrom: Date
        let rangeTo: Date
        if (day < first) {
          rangeFrom = day
          rangeTo = last
        } else if (day > last) {
          rangeFrom = first
          rangeTo = day
        } else {
          rangeFrom = anchor
          rangeTo = day
        }
        next.clear()
        for (const iso of fillRange(rangeFrom, rangeTo, availableSet)) {
          next.add(iso)
        }
        setAnchor(day)
      }
      onChange(sortedDates(next))
    },
    [anchor, availableSet, canForce, isContiguous, onChange, valueSet, setResetDroppedCount],
  )

  const handleSelect = (
    _selected: Date[] | undefined,
    triggerDate: Date,
    _modifiers: Modifiers,
    event: React.MouseEvent | React.KeyboardEvent,
  ) => {
    const mouseEvent = event as Partial<React.MouseEvent>
    // Desktop modifier keys force individual-day toggle regardless of mode.
    const modifierToggle =
      mouseEvent.shiftKey === true ||
      mouseEvent.ctrlKey === true ||
      mouseEvent.metaKey === true
    // individual mode: every tap toggles; range mode: taps build a span.
    // In contiguous mode the toggle UI is not shown; only modifier keys can
    // trigger the toggle path (which restarts the selection in contiguous mode).
    const toggle = (!isContiguous && mode === 'individual') || modifierToggle
    applyClick(triggerDate, toggle)
  }

  // landr-aoak.2: keep the parent's forced-day set in sync with the selection.
  // Fires [] in the normal path (no unavailable day is ever selectable), so the
  // submit adapter receives an empty force set and behaves byte-identically.
  useEffect(() => {
    onForcedDaysChange?.(forcedDays, forcedReasons)
  }, [forcedDays, forcedReasons, onForcedDaysChange])

  // Help text: caller override wins; contiguous has fixed copy; otherwise
  // follows the active mode. landr-5aih0.9: resolved through the bundle
  // (locale-aware) rather than the English-only exported constants below —
  // those stay as the documented English defaults for any external caller
  // that still passes helpText explicitly.
  const text =
    helpText ??
    (isContiguous
      ? tr('multiDayPickerHelpContiguous', locale)
      : mode === 'individual'
        ? tr('multiDayPickerHelp', locale)
        : tr('multiDayPickerHelpRange', locale))

  // landr-otml0.3 — invite-mode diff (originalValue mode, ported from the
  // dashboard — landr-fxza.5 Section C). Purely presentational: it only
  // drives the modifiers/legend/summary below and the explicit Reset click;
  // it never feeds back into applyClick/onChange on its own.
  const diff = useMemo(
    () => computeDayDiff(valueSet, originalValue),
    [originalValue, valueSet],
  )
  const diffAddedDates = useMemo(
    () => diff?.added.map(dateFromIso) ?? [],
    [diff],
  )
  const diffRemovedDates = useMemo(
    () => diff?.removed.map(dateFromIso) ?? [],
    [diff],
  )

  // landr-otml0.3 review fix (CRITICAL 1): Reset used to call
  // onChange(originalValue) directly, bypassing every gate applyClick
  // enforces (availability, lead time) — a public customer could end up
  // with an unavailable day silently re-selected, which the API would then
  // 422 (or a staff session would force-book unintentionally) at Confirm.
  // Route it through the SAME availableSet gate applyClick uses: a normal
  // customer (canForce false) gets only the host's still-available days
  // back, with a count of how many were dropped; staff (canForce true) can
  // restore the raw baseline since they're allowed to force-book any of it
  // afterward anyway.
  const handleReset = useCallback(() => {
    if (!originalValue) return
    if (canForce) {
      setResetDroppedCount(null)
      onChange(originalValue)
      return
    }
    const restorable = originalValue.filter((d) => availableSet.has(isoDate(d)))
    setResetDroppedCount(originalValue.length - restorable.length)
    onChange(restorable)
  }, [originalValue, canForce, availableSet, onChange, setResetDroppedCount])

  return (
    <div className="flex flex-col gap-3">
      {!isContiguous && (
        <div
          role="group"
          aria-label="Selection mode"
          className="flex flex-row gap-1"
        >
          <Button
            type="button"
            size="sm"
            variant={mode === 'range' ? 'default' : 'outline'}
            aria-pressed={mode === 'range'}
            onClick={() => setMode('range')}
          >
            Date range
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'individual' ? 'default' : 'outline'}
            aria-pressed={mode === 'individual'}
            onClick={() => setMode('individual')}
          >
            Individual days
          </Button>
        </div>
      )}
      <Calendar
        mode="multiple"
        selected={value}
        onSelect={handleSelect}
        // landr-aoak.2: in staff mode every day stays selectable so the
        // operator can force-book a sold-out / blocked day. Normal customers
        // keep the original predicate (only available days are clickable).
        disabled={
          canForce ? undefined : (date) => !availableSet.has(isoDate(date))
        }
        month={month}
        onMonthChange={setMonth}
        // landr-711: do NOT pass range_start / range_middle / range_end
        // modifiers. CalendarDayButton paints range_middle with bg-accent
        // (light gray) instead of bg-primary, so mid-run selected days
        // looked unselected. Every day in `value` should fall through to
        // data-selected-single=true and render in the same primary color,
        // regardless of contiguity. The picker is multi-select; a
        // "continuous range" visual is meaningless here — the user picks
        // discrete days, even when they happen to be adjacent.
        //
        // landr-otml0.3 — diffAdded/diffRemoved are undefined (falsy) for
        // every non-invite booking, so this is a no-op split there.
        modifiers={{
          diffAdded: diffAddedDates,
          diffRemoved: diffRemovedDates,
        }}
      />
      {nothingBefore ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid="calendar-nothing-before"
        >
          {nothingBefore}
        </p>
      ) : null}
      {originalValue !== undefined ? (
        <div className="flex flex-col gap-2" data-testid="multi-day-diff">
          {diff?.hasDiff ? (
            <>
              <div
                className="flex flex-wrap items-center gap-3 text-xs"
                data-testid="multi-day-diff-legend"
              >
                <span className="inline-flex items-center gap-1.5 text-diff-added">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-4 items-center justify-center rounded bg-diff-added-soft-bg font-semibold"
                  >
                    +
                  </span>
                  Added
                </span>
                <span className="inline-flex items-center gap-1.5 text-destructive">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-4 items-center justify-center rounded bg-destructive/10 font-semibold line-through"
                  >
                    &minus;
                  </span>
                  Removed
                </span>
              </div>
              <p className="text-sm" data-testid="multi-day-diff-summary">
                {/* landr-otml0.3 ticket spec: "+N day(s) / −M day(s) vs
                    <host>" — separate added/removed counts, not a net
                    delta, so a same-count swap (+1/−1) still reads as a
                    change instead of collapsing to "+0". */}+
                {diff?.added.length ?? 0}{' '}
                {(diff?.added.length ?? 0) === 1 ? 'day' : 'days'} /
                &minus;{diff?.removed.length ?? 0}{' '}
                {(diff?.removed.length ?? 0) === 1 ? 'day' : 'days'} vs{' '}
                {originalValueLabel ?? 'the original booking'}
              </p>
            </>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={!diff?.hasDiff}
            onClick={handleReset}
            data-testid="multi-day-reset-button"
          >
            Reset to {originalValueLabel ?? 'the original'}&rsquo;s dates
          </Button>
          {resetDroppedCount !== null && resetDroppedCount > 0 ? (
            <p
              className="text-xs text-muted-foreground"
              data-testid="multi-day-reset-dropped-notice"
            >
              {resetDroppedCount}{' '}
              {resetDroppedCount === 1
                ? `of ${originalValueLabel ?? 'the host'}'s days is`
                : `of ${originalValueLabel ?? 'the host'}'s days are`}{' '}
              no longer available.
            </p>
          ) : null}
        </div>
      ) : null}
      {/* landr-aoak.2: surface the operator-override badge whenever the staff
          selection includes any force-booked (sold-out / blocked) day. */}
      {forcedDays.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <OperatorOverrideBadge />
          {/* landr-t869m.5: names the actual reason(s), not a hard-coded
              "(past capacity)" — a range can be forced for lead time alone. */}
          <span className="text-xs text-muted-foreground">
            {forcedDays.length} forced{' '}
            {forcedDays.length === 1 ? 'day' : 'days'} (
            {describeForceReasons(forcedReasons)})
          </span>
        </div>
      ) : null}
      {/* landr-80ubl.2: zen by default — the gesture instructions move
          behind the disclosure (landr-3mo4's well styling dropped along
          with it; HelpDisclosure has its own quiet toggle treatment). */}
      <HelpDisclosure>
        <p data-testid="multi-day-help">{text}</p>
      </HelpDisclosure>
    </div>
  )
}
