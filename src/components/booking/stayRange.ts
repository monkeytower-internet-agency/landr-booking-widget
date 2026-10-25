/**
 * Pure range logic behind StayRangePicker (kept out of the component file for
 * react-refresh/only-export-components). Every date is an ISO `YYYY-MM-DD`
 * string in the OPERATOR's calendar — never a Date — so the browser's
 * timezone can never shift a night.
 */
import type { AvailabilitySlot, StayConfig } from '@/api/types'
import {
  checkStayRange,
  nightsBetween,
  stayWindowOf,
  type StayViolation,
} from '@/components/booking/accommodationCalc'

export interface StayRange {
  checkIn: string | null
  checkOut: string | null
}

export interface StayNights {
  /** Nights a stay may cover: open, lead time ok, a unit left. */
  free: ReadonlySet<string>
  /** Nights closed outright (past or blocked by the owner). */
  closed: ReadonlySet<string>
  /** Nights open on the calendar but not free (no unit left, lead time). */
  taken: ReadonlySet<string>
}

/** Split the per-night availability rows of a stay. */
export function freeStayNights(slots: readonly AvailabilitySlot[]): StayNights {
  const free = new Set<string>()
  const closed = new Set<string>()
  const taken = new Set<string>()
  for (const slot of slots) {
    if (slot.status === 'closed') {
      closed.add(slot.date)
    } else if (slot.activity_bookable !== false && slot.available_seats >= 1) {
      free.add(slot.date)
    } else {
      taken.add(slot.date)
    }
  }
  return { free, closed, taken }
}

/** The range a restored night list stands for (Back navigation). */
export function initialStayRange(nights: readonly string[] | undefined): StayRange {
  const win = nights && nights.length > 0 ? stayWindowOf(nights) : null
  return win ? { checkIn: win.checkIn, checkOut: win.checkOut } : { checkIn: null, checkOut: null }
}

/**
 * The range after a click on `iso`: the first click (or any click once both
 * ends are set) picks check-in; a later day picks check-out; a day on or
 * before the check-in moves the check-in.
 */
export function stayRangeAfterClick(range: StayRange, iso: string): StayRange {
  if (range.checkIn === null || range.checkOut !== null) return { checkIn: iso, checkOut: null }
  if (iso <= range.checkIn) return { checkIn: iso, checkOut: null }
  return { checkIn: range.checkIn, checkOut: iso }
}

/** Every rule a complete range breaks (the API's codes and order). */
export function stayRangeViolations(
  range: StayRange,
  stay: StayConfig | null,
  nights: StayNights,
  todayIso: string,
): StayViolation[] {
  if (range.checkIn === null || range.checkOut === null) return []
  const inRange = new Set(nightsBetween(range.checkIn, range.checkOut))
  const notFree = [...nights.taken].filter((d) => inRange.has(d))
  // A night with no availability row at all is not sellable either.
  for (const d of inRange) {
    if (!nights.free.has(d) && !nights.closed.has(d) && !nights.taken.has(d)) notFree.push(d)
  }
  return checkStayRange({
    check_in: range.checkIn,
    check_out: range.checkOut,
    min_nights: stay?.min_nights ?? 1,
    max_nights: stay?.max_nights ?? null,
    // The party is entered on the next step; its cap is the unit's sleeps.
    guests: 1,
    capacity: null,
    today: todayIso,
    blocked: [...nights.closed].filter((d) => inRange.has(d) && d >= todayIso),
    unavailable: notFree,
  })
}
