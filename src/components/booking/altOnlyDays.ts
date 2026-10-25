import { useMemo } from 'react'
import type { AvailabilitySlot, ProductAlternative } from '@/api/types'
import { dateFromIso } from '@/components/booking/dateUtils'
import { dayRowsFor, monthKey, monthKeyOfIso } from '@/components/booking/alternatives'
import { useProductAlternatives } from '@/components/booking/useProductAlternatives'

/**
 * Months the date step needs alternatives for: the one in view plus the month
 * of every picked day. One shared list so the calendar dots and the panel read
 * the same response (one request per month, never two).
 */
export function alternativesMonths(month: Date, selectedDays: string[]): string[] {
  return [...new Set([monthKey(month), ...selectedDays.map(monthKeyOfIso)])].sort()
}

/** Fetches (cached) the alternatives of the date step; null until they are in. */
export function useDateStepAlternatives(
  productId: string,
  month: Date,
  selectedDays: string[],
  party: number,
): ProductAlternative[] | null {
  const months = alternativesMonths(month, selectedDays)
  return useProductAlternatives(productId, months, party)
}

/**
 * Days the product itself cannot be booked for this party (full, no slot at all,
 * or seats left but fewer than the party) but where at least one day-shaped
 * alternative has free seats for it. Courses never count. Past days and days
 * that still have seats but are closed by lead time are left out, so they stay
 * disabled. A short day keeps its own marking next to the dot.
 */
export function altOnlyDaysFor(args: {
  slots: readonly AvailabilitySlot[] | null
  fit: ReadonlySet<string>
  short: ReadonlyMap<string, number>
  alternatives: ProductAlternative[] | null
  todayIso: string
}): Set<string> {
  const out = new Set<string>()
  const { slots, fit, short, alternatives, todayIso } = args
  if (!slots || !alternatives) return out
  const seatsLeft = new Map<string, number>()
  for (const s of slots) {
    seatsLeft.set(s.date, Math.max(seatsLeft.get(s.date) ?? 0, s.available_seats))
  }
  const candidates = new Set<string>()
  for (const alt of alternatives) {
    if (alt.service_time_shape === 'fixed_window') continue
    for (const d of alt.available_dates ?? []) candidates.add(d)
  }
  for (const iso of candidates) {
    if (iso < todayIso || fit.has(iso)) continue
    if ((seatsLeft.get(iso) ?? 0) > 0 && !short.has(iso)) continue
    if (dayRowsFor(alternatives, [iso]).length === 0) continue
    out.add(iso)
  }
  return out
}

/** Dates (for the calendar modifier) of a set of ISO days. */
export function altOnlyDates(days: ReadonlySet<string>): Date[] {
  return Array.from(days).sort().map(dateFromIso)
}

/** True when the month in view holds at least one such day. */
export function monthHasAltOnly(days: ReadonlySet<string>, month: Date): boolean {
  const key = monthKey(month)
  for (const iso of days) if (monthKeyOfIso(iso) === key) return true
  return false
}

/** Memoised ISO-day membership + Date list for the calendar modifier. */
export function useAltOnly(args: Parameters<typeof altOnlyDaysFor>[0]) {
  const { slots, fit, short, alternatives, todayIso } = args
  const days = useMemo(
    () => altOnlyDaysFor({ slots, fit, short, alternatives, todayIso }),
    [slots, fit, short, alternatives, todayIso],
  )
  const dates = useMemo(() => altOnlyDates(days), [days])
  return { days, dates }
}

