import { isoDate } from '@/components/booking/dateUtils'

/** Wall-clock "today" and "now" in some zone. */
export interface WallClock {
  /** Calendar day as `YYYY-MM-DD`. */
  iso: string
  /** Minutes since local midnight (0..1439). */
  minutes: number
}

/**
 * The current wall-clock day and minute in the OPERATOR's IANA timezone.
 *
 * Start times are authored in the operator's zone, so "has this time already
 * passed today" must be answered there, not on the visitor's browser clock: an
 * operator abroad near midnight would otherwise be offered (or denied) the
 * wrong times. A missing or unrecognised zone falls back to the browser clock,
 * which is exactly the behaviour before the operator timezone was exposed.
 */
export function operatorWallClock(
  timeZone: string | null | undefined,
  now: Date = new Date(),
): WallClock {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).formatToParts(now)
      const get = (type: string): string =>
        parts.find((p) => p.type === type)?.value ?? ''
      const hour = Number(get('hour')) % 24
      const minute = Number(get('minute'))
      const iso = `${get('year')}-${get('month')}-${get('day')}`
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && Number.isFinite(hour) && Number.isFinite(minute)) {
        return { iso, minutes: hour * 60 + minute }
      }
    } catch {
      // Unknown IANA name -> RangeError; fall through to the browser clock.
    }
  }
  return { iso: isoDate(now), minutes: now.getHours() * 60 + now.getMinutes() }
}
