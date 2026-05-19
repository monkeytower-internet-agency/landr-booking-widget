import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Modifiers } from 'react-day-picker'
import type { AvailabilitySlot } from '@/api/types'
import { Calendar } from '@/components/ui/calendar'

interface MultiDayPickerProps {
  availability: AvailabilitySlot[]
  value: Date[]
  onChange: (days: Date[]) => void
  helpText?: string
  /** Long-press duration in ms; exposed so tests can shrink it. */
  longPressMs?: number
  /** Initial visible month. Forwarded to react-day-picker; tests rely on this. */
  defaultMonth?: Date
  /**
   * When true (product.is_contiguous, landr-y9k): selection MUST be a single
   * contiguous run of available days. Clicks that would break contiguity
   * (toggle middle days, shift-click far dates) are coerced into a fresh
   * single-day selection, so the user always ends up with a valid range.
   * When false (default): legacy any-day-toggle behaviour.
   */
  isContiguous?: boolean
}

const LONG_PRESS_MS = 500

const isoDate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const fromIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
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
    .map(fromIso)
}

export const DEFAULT_MULTI_DAY_HELP_EN =
  'Click to pick a date. Click another to make a range. Hold Shift (or Cmd/Ctrl) to toggle individual days.'

export const DEFAULT_MULTI_DAY_HELP_DE =
  'Klicke ein Datum an, klicke ein zweites für einen Zeitraum. Halte Umschalt (oder Cmd/Strg), um einzelne Tage an- oder abzuwählen.'

/**
 * Help text shown in contiguous mode (landr-y9k). The any-day-toggle copy
 * does not apply — contiguous selection rejects non-adjacent clicks.
 */
export const CONTIGUOUS_MULTI_DAY_HELP_EN =
  'Click a start date, then click another to extend the range. Selection must be consecutive days.'

export function MultiDayPicker({
  availability,
  value,
  onChange,
  helpText,
  longPressMs = LONG_PRESS_MS,
  defaultMonth,
  isContiguous = false,
}: MultiDayPickerProps) {
  const availableSet = useMemo(() => {
    return new Set(
      availability
        .filter((slot) => slot.available_seats > 0)
        .map((slot) => slot.date),
    )
  }, [availability])

  const [anchor, setAnchor] = useState<Date | null>(null)
  const longPressFiredRef = useRef<Set<string>>(new Set())
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const valueSet = useMemo(() => new Set(value.map(isoDate)), [value])

  const contiguousModifiers = useMemo(() => {
    const sorted = Array.from(valueSet).sort()
    const runs: Array<[string, string]> = []
    let runStart: string | null = null
    let prev: string | null = null
    for (const iso of sorted) {
      if (runStart === null) {
        runStart = iso
        prev = iso
        continue
      }
      const expected = fromIso(prev!)
      expected.setDate(expected.getDate() + 1)
      if (isoDate(expected) === iso) {
        prev = iso
      } else {
        runs.push([runStart, prev!])
        runStart = iso
        prev = iso
      }
    }
    if (runStart && prev) runs.push([runStart, prev])

    const starts: Date[] = []
    const ends: Date[] = []
    const middles: Date[] = []
    for (const [s, e] of runs) {
      if (s === e) continue
      starts.push(fromIso(s))
      ends.push(fromIso(e))
      const cursor = fromIso(s)
      cursor.setDate(cursor.getDate() + 1)
      const end = fromIso(e)
      while (cursor < end) {
        middles.push(new Date(cursor))
        cursor.setDate(cursor.getDate() + 1)
      }
    }
    return { range_start: starts, range_end: ends, range_middle: middles }
  }, [valueSet])

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  useEffect(() => () => clearLongPressTimer(), [clearLongPressTimer])

  const findDayKey = (target: EventTarget | null): string | null => {
    if (!(target instanceof Element)) return null
    const button = target.closest('button[data-day]') as HTMLButtonElement | null
    const raw = button?.dataset.day
    if (!raw) return null
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) return null
    return isoDate(parsed)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return
    const key = findDayKey(e.target)
    if (!key || !availableSet.has(key)) return
    clearLongPressTimer()
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current.add(key)
      longPressTimerRef.current = null
    }, longPressMs)
  }

  const onPointerEndOrLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return
    clearLongPressTimer()
  }

  const applyClick = useCallback(
    (day: Date, toggle: boolean) => {
      const key = isoDate(day)
      if (!availableSet.has(key)) return
      const next = new Set(valueSet)

      // Contiguous mode (landr-y9k): the selection must always be a single
      // gap-free run of available days. A click is honoured as a range
      // extension/trim if every day between the existing run and the
      // clicked date is available; otherwise the selection restarts from
      // the clicked day. Toggle gestures (shift/ctrl/long-press) are
      // suppressed — they always restart since they can't preserve the
      // contiguous invariant.
      if (isContiguous) {
        if (anchor === null || valueSet.size === 0 || toggle) {
          next.clear()
          next.add(key)
          setAnchor(day)
        } else {
          const sorted = Array.from(valueSet).sort()
          const first = fromIso(sorted[0]!)
          const last = fromIso(sorted[sorted.length - 1]!)
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
        const first = fromIso(sorted[0]!)
        const last = fromIso(sorted[sorted.length - 1]!)
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
    [anchor, availableSet, isContiguous, onChange, valueSet],
  )

  const handleSelect = (
    _selected: Date[] | undefined,
    triggerDate: Date,
    _modifiers: Modifiers,
    event: React.MouseEvent | React.KeyboardEvent,
  ) => {
    const key = isoDate(triggerDate)
    const longPressed = longPressFiredRef.current.has(key)
    if (longPressed) longPressFiredRef.current.delete(key)
    const mouseEvent = event as Partial<React.MouseEvent>
    const toggle =
      longPressed ||
      mouseEvent.shiftKey === true ||
      mouseEvent.ctrlKey === true ||
      mouseEvent.metaKey === true
    applyClick(triggerDate, toggle)
  }

  const text =
    helpText ??
    (isContiguous ? CONTIGUOUS_MULTI_DAY_HELP_EN : DEFAULT_MULTI_DAY_HELP_EN)

  return (
    <div
      className="flex flex-col gap-3"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerEndOrLeave}
      onPointerCancel={onPointerEndOrLeave}
      onPointerLeave={onPointerEndOrLeave}
    >
      <Calendar
        mode="multiple"
        selected={value}
        onSelect={handleSelect}
        disabled={(date) => !availableSet.has(isoDate(date))}
        defaultMonth={defaultMonth}
        modifiers={{
          range_start: contiguousModifiers.range_start,
          range_end: contiguousModifiers.range_end,
          range_middle: contiguousModifiers.range_middle,
        }}
      />
      <p className="text-xs text-muted-foreground" data-testid="multi-day-help">
        {text}
      </p>
    </div>
  )
}
