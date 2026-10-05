import { useEffect, useMemo, useRef, useState } from 'react'
import { dateFromIso, isoDate } from '@/components/booking/dateUtils'

/**
 * How far ahead (days from today) the date pickers fetch availability.
 * History: 60 (landr-l38a4: hid any season starting later), then 365, then 90.
 *
 * landr-api's public_get_product_availability RPC hard-caps a single request
 * at 90 days (`(p_to - p_from) <= 90`, stable across
 * 20260512190528_public_rpcs.sql / 20260902040000_.../
 * 20260914114000_...) and returns ZERO rows — not an error — for any wider
 * window. A single wide fetch therefore silently comes back empty (it broke
 * widget-booking-smoke in landr-widget-smoke-fix), and capping the horizon at
 * 90 days left customers unable to book anything past today+90 (landr-gm2px,
 * live 2026-10-05).
 *
 * So the horizon is independent of the RPC cap: `getAvailability`
 * (src/api/client.ts) splits `[today, today + AVAILABILITY_HORIZON_DAYS]`
 * into consecutive windows of at most 90 days (`to - from <= 90`), fetches
 * them in parallel and merges the rows. 731 days = two years plus a leap
 * day, enough for any season an operator schedules in advance.
 */
export const AVAILABILITY_HORIZON_DAYS = 731

/** Local-midnight "today". */
export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/** `[from, to]` ISO window every picker fetches availability for. */
export function availabilityWindow(today: Date = startOfToday()): {
  fromIso: string
  toIso: string
} {
  const to = new Date(today)
  to.setDate(to.getDate() + AVAILABILITY_HORIZON_DAYS)
  return { fromIso: isoDate(today), toIso: isoDate(to) }
}

/** Earliest bookable ISO day on or after `today`, or null. */
export function firstBookableDay(
  bookable: Iterable<string>,
  today: Date = startOfToday(),
): string | null {
  const todayIso = isoDate(today)
  let first: string | null = null
  for (const iso of bookable) {
    if (iso >= todayIso && (first === null || iso < first)) first = iso
  }
  return first
}

/**
 * landr-l38a4: the month a date picker should open on — the month of the
 * earliest already-selected day (Back navigation, invite prefill), else the
 * month of the first bookable day (season starts later), else today's month.
 */
export function pickStartMonth(
  selectedIsos: readonly string[],
  bookable: Iterable<string>,
  today: Date = startOfToday(),
): Date {
  if (selectedIsos.length > 0) {
    const earliest = [...selectedIsos].sort()[0]!
    return firstOfMonth(dateFromIso(earliest))
  }
  const first = firstBookableDay(bookable, today)
  return firstOfMonth(first ? dateFromIso(first) : today)
}

/**
 * Controlled visible month for a picker's Calendar. react-day-picker's
 * `defaultMonth` only applies at mount — before availability has loaded — so
 * the month is held here and moved ONCE, the first time bookable days arrive,
 * unless a selection (or an explicit `initial`) already pinned it. After that
 * the customer's own month navigation is never overridden.
 */
export function useStartMonth(
  selectedIsos: readonly string[],
  bookable: ReadonlySet<string>,
  initial?: Date,
): [Date, (month: Date) => void] {
  const [month, setMonth] = useState<Date>(
    () => initial ?? pickStartMonth(selectedIsos, bookable),
  )
  const settled = useRef(
    initial !== undefined || selectedIsos.length > 0 || bookable.size > 0,
  )
  useEffect(() => {
    if (settled.current || bookable.size === 0) return
    settled.current = true
    setMonth(pickStartMonth(selectedIsos, bookable))
    // Only the arrival of availability matters; selection changes after
    // that are the customer's own clicks and must not move the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookable])
  return [month, setMonth]
}

/**
 * landr-l38a4: "Nothing is available before <D Month YYYY>." when the first
 * bookable day falls in a later month than today; null otherwise (including
 * while availability is still loading, or when nothing is bookable at all).
 */
export function useNothingBeforeNotice(
  bookable: ReadonlySet<string>,
  locale?: string,
): string | null {
  return useMemo(() => {
    const today = startOfToday()
    const first = firstBookableDay(bookable, today)
    if (!first) return null
    const firstDate = dateFromIso(first)
    if (firstOfMonth(firstDate).getTime() <= firstOfMonth(today).getTime()) {
      return null
    }
    const label = firstDate.toLocaleDateString(locale ?? 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    return `Nothing is available before ${label}.`
  }, [bookable, locale])
}
