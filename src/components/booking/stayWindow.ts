/**
 * The stay check-in -> check-out window on the confirmation
 * screen. The API marks a STAY by putting `check_in_time` / `check_out_time`
 * into the arrival / departure period `meta` (a hotel-room-only booking never
 * has them, so it keeps its Arrival / Departure rows). The two rows fold into
 * ONE `stay` row whose date cell reads the same line the confirmation email
 * prints: "Check-in 14.09. 14:00 – Check-out 16.09. 10:30 (2 nights)".
 *
 * Sibling .ts file (react-refresh/only-export-components), like dateLabel.ts.
 */
import type { BookingPeriod } from '@/api/types'
import { fmt, nightsWord, pickBundle } from '@/lib/strings'

/** A wire period, or the folded `stay` row built from an arrival + departure. */
export type DisplayPeriod = Omit<BookingPeriod, 'kind'> & {
  kind: BookingPeriod['kind'] | 'stay'
}

function hhmm(raw: unknown): string {
  return typeof raw === 'string' && /^\d{2}:\d{2}/.test(raw) ? raw.slice(0, 5) : ''
}

/** 'YYYY-MM-DD' -> 'DD.MM.' (same on every locale, as in the email). */
function ddmm(iso: string): string {
  const [, m, d] = iso.split('-')
  return m && d ? `${d}.${m}.` : iso
}

/** Fold a stay's arrival + departure into one `stay` row; else passthrough. */
export function foldStayPeriods(periods: BookingPeriod[]): DisplayPeriod[] {
  const arrival = periods.find((p) => p.kind === 'arrival')
  const departure = periods.find((p) => p.kind === 'departure')
  if (!arrival || !departure) return periods
  if (!hhmm(arrival.meta?.check_in_time) || !hhmm(departure.meta?.check_out_time)) {
    return periods
  }
  const stay: DisplayPeriod = {
    ...arrival,
    kind: 'stay',
    end_date: departure.start_date,
    meta: { ...arrival.meta, check_out_time: departure.meta.check_out_time },
  }
  return periods
    .filter((p) => p !== departure)
    .map((p) => (p === arrival ? stay : p))
}

/** "Check-in 14.09. 14:00 – Check-out 16.09. 10:30 (2 nights)". */
export function stayWindowLabel(
  period: DisplayPeriod,
  locale?: string,
  opts: { withNights?: boolean } = {},
): string {
  const nightsRaw = period.meta?.nights
  const nights =
    typeof nightsRaw === 'number' && nightsRaw > 0
      ? nightsRaw
      : Math.max(
          1,
          Math.round(
            (Date.parse(period.end_date) - Date.parse(period.start_date)) / 86_400_000,
          ) || 1,
        )
  const label = fmt(pickBundle(locale).stayWindowTemplate, {
    checkIn: `${ddmm(period.start_date)} ${hhmm(period.meta?.check_in_time)}`.trim(),
    checkOut: `${ddmm(period.end_date)} ${hhmm(period.meta?.check_out_time)}`.trim(),
    nights: String(nights),
    nightWord: nightsWord(nights, locale),
  })
  // The offer table has its own Length column: drop the trailing "(2 nights)".
  return opts.withNights === false ? label.replace(/\s*\([^()]*\)\s*$/, '') : label
}
