import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Modifiers } from 'react-day-picker'
import type { AvailabilitySlot } from '@/api/types'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { useStaffMode } from '@/lib/staffMode'
import { OperatorOverrideBadge } from '@/components/booking/OperatorOverrideBadge'
import { dateFromIso, isoDate } from '@/components/booking/dateUtils'

type Mode = 'individual' | 'range'

interface MultiDayPickerProps {
  availability: AvailabilitySlot[]
  value: Date[]
  onChange: (days: Date[]) => void
  helpText?: string
  /** Initial visible month. Forwarded to react-day-picker; tests rely on this. */
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
   * landr-aoak.2 [S3]: called when the set of force-booked (zero-availability)
   * days inside the current selection changes. Only ever fires non-empty in
   * staff mode; the normal customer path never selects an unavailable day so
   * this stays []. Lets the parent step thread the forced days into the submit
   * adapter's capacity-override flag.
   */
  onForcedDaysChange?: (forcedIsoDays: string[]) => void
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
  onForcedDaysChange,
}: MultiDayPickerProps) {
  const staff = useStaffMode()
  // landr-aoak.2: force-book only when staff mode is active AND the session
  // carries the force_book power. Otherwise this is the normal customer picker.
  const canForce = staff.active && staff.powers.includes('force_book')

  const availableSet = useMemo(() => {
    return new Set(
      availability
        .filter((slot) => slot.available_seats > 0)
        .map((slot) => slot.date),
    )
  }, [availability])

  const [anchor, setAnchor] = useState<Date | null>(null)
  const [mode, setMode] = useState<Mode>('range')

  const valueSet = useMemo(() => new Set(value.map(isoDate)), [value])

  // landr-aoak.2: the force-booked subset of the current selection — selected
  // days that have zero availability. Empty for every normal selection.
  const forcedDays = useMemo(
    () => value.map(isoDate).filter((iso) => !availableSet.has(iso)).sort(),
    [value, availableSet],
  )

  const applyClick = useCallback(
    (day: Date, toggle: boolean) => {
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
    [anchor, availableSet, canForce, isContiguous, onChange, valueSet],
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
    onForcedDaysChange?.(forcedDays)
  }, [forcedDays, onForcedDaysChange])

  // Help text: caller override wins; contiguous has fixed copy; otherwise
  // follows the active mode.
  const text =
    helpText ??
    (isContiguous
      ? CONTIGUOUS_MULTI_DAY_HELP
      : mode === 'individual'
        ? DEFAULT_MULTI_DAY_HELP_INDIVIDUAL
        : DEFAULT_MULTI_DAY_HELP_RANGE)

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
        defaultMonth={defaultMonth}
        // landr-711: do NOT pass range_start / range_middle / range_end
        // modifiers. CalendarDayButton paints range_middle with bg-accent
        // (light gray) instead of bg-primary, so mid-run selected days
        // looked unselected. Every day in `value` should fall through to
        // data-selected-single=true and render in the same primary color,
        // regardless of contiguity. The picker is multi-select; a
        // "continuous range" visual is meaningless here — the user picks
        // discrete days, even when they happen to be adjacent.
      />
      {/* landr-aoak.2: surface the operator-override badge whenever the staff
          selection includes any force-booked (sold-out / blocked) day. */}
      {forcedDays.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <OperatorOverrideBadge />
          <span className="text-xs text-muted-foreground">
            {forcedDays.length} forced{' '}
            {forcedDays.length === 1 ? 'day' : 'days'} (past capacity)
          </span>
        </div>
      ) : null}
      {/* landr-3mo4: help text recessed into a faint well so it reads as a
          quiet hint beneath the calendar rather than floating loose copy. */}
      <p
        className="rounded-lg bg-surface-well px-3 py-2 text-xs text-muted-foreground shadow-well"
        data-testid="multi-day-help"
      >
        {text}
      </p>
    </div>
  )
}
