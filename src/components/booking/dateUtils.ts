/**
 * Canonical ISO ⇄ Date helpers for the calendar-facing date pickers
 * (AvailabilityPicker, SingleDatePicker, MultiDayPicker, MultiDayStep).
 *
 * BOTH directions use LOCAL date components on purpose. react-day-picker hands
 * back Date objects at LOCAL midnight, and availability slots arrive from the
 * API as plain `YYYY-MM-DD` strings. Formatting via local getters (NOT
 * `toISOString`, which converts to UTC) keeps the round-trip stable in every
 * timezone.
 *
 * The previous AvailabilityPicker copy formatted with
 * `d.toISOString().slice(0, 10)` while parsing locally — so in UTC+ zones
 * (e.g. mainland Europe) a calendar date for 2026-06-10 stringified to
 * 2026-06-09: a restored selection jumped back a day AND day-availability
 * matching (`availableDates.has(isoDate(date))`) compared against the wrong
 * key, disabling the right day / enabling the wrong one (landr-cnk9 #1).
 *
 * For UTC-based accommodation date *arithmetic* see accommodationCalc's
 * `isoToUtcDate` — a deliberately different (UTC-internal) idiom that never
 * touches react-day-picker's local dates.
 */

/** Format a (local) Date as a `YYYY-MM-DD` string using local components. */
export const isoDate = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a `YYYY-MM-DD` string into a Date at LOCAL midnight. */
export const dateFromIso = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
}
