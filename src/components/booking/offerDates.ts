/**
 * Date helpers for the /pay + /offer page (landr-1zkp7). Pure and
 * presentation-only: the product line's `selected_days` are collapsed into
 * consecutive stretches and printed the way the trip page does
 * ("Sun 24 Jan – Fri 29 Jan 2027"). All arithmetic is in UTC on the ISO
 * date, so the viewer's timezone can never shift a day.
 */

import type { BookingPeriod } from '@/api/types'
import { foldStayPeriods, type DisplayPeriod } from './stayWindow'

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/

export interface DayRange {
  start: string
  end: string
  /** Inclusive number of days in the stretch. */
  days: number
}

function toUtcMs(iso: string): number | null {
  const m = ISO_DAY.exec(iso)
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

const DAY_MS = 86_400_000

/** Sorted, de-duplicated, consecutive-day stretches. Unparseable entries are dropped. */
export function collapseDays(days: readonly string[]): DayRange[] {
  const uniq = Array.from(
    new Set(days.map((d) => (ISO_DAY.test(d) ? d.slice(0, 10) : '')).filter(Boolean)),
  ).sort()
  const out: DayRange[] = []
  for (const d of uniq) {
    const ms = toUtcMs(d)
    if (ms === null) continue
    const last = out[out.length - 1]
    const lastMs = last ? toUtcMs(last.end) : null
    if (last && lastMs !== null && ms - lastMs === DAY_MS) {
      last.end = d
      last.days += 1
    } else {
      out.push({ start: d, end: d, days: 1 })
    }
  }
  return out
}

/** Inclusive day count between two ISO days (≥ 1), or null when unparseable. */
export function inclusiveDays(start: string, end: string): number | null {
  const a = toUtcMs(start)
  const b = toUtcMs(end)
  if (a === null || b === null || b < a) return null
  return Math.round((b - a) / DAY_MS) + 1
}

function baseLang(locale?: string): string {
  return (locale ?? '').trim().toLowerCase().split(/[-_]/)[0] ?? ''
}

/** "Sun 24 Jan" (en, composed so it never turns into "Sun, Jan 24") or the locale's own short form. */
function formatDay(iso: string, locale?: string): string {
  const ms = toUtcMs(iso)
  if (ms === null) return iso
  const date = new Date(ms)
  try {
    if (baseLang(locale) === 'en' || baseLang(locale) === '') {
      const parts = new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }).formatToParts(date)
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
      return `${get('weekday')} ${get('day')} ${get('month')}`.trim()
    }
    return new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(date)
  } catch {
    return iso
  }
}

/**
 * "Sun 24 Jan – Fri 29 Jan 2027". Several stretches are joined with "; ".
 * The year closes the whole string when every stretch is in the same year;
 * otherwise each stretch carries its own.
 */
/**
 * One stretch on its own: "Wed 20 Jan – Fri 22 Jan", with " 2027" appended
 * when `withYear`. Used for the per-stretch rows of a line booked on
 * non-consecutive days.
 */
export function formatRange(
  r: Pick<DayRange, 'start' | 'end'>,
  locale?: string,
  withYear = false,
): string {
  const text =
    r.start === r.end
      ? formatDay(r.start, locale)
      : `${formatDay(r.start, locale)} – ${formatDay(r.end, locale)}`
  return withYear ? `${text} ${r.end.slice(0, 4)}` : text
}

export function formatRanges(
  ranges: readonly Pick<DayRange, 'start' | 'end'>[],
  locale?: string,
): string {
  if (ranges.length === 0) return ''
  const years = new Set(ranges.map((r) => r.end.slice(0, 4)))
  const sameYear = years.size === 1
  const one = (r: Pick<DayRange, 'start' | 'end'>) =>
    r.start === r.end
      ? formatDay(r.start, locale)
      : `${formatDay(r.start, locale)} – ${formatDay(r.end, locale)}`
  const text = ranges.map((r) => (sameYear ? one(r) : `${one(r)} ${r.end.slice(0, 4)}`))
  return `${text.join('; ')}${sameYear ? ` ${ranges[0]!.end.slice(0, 4)}` : ''}`
}

/**
 * The ranges to show for one product line: its selected_days collapsed, else
 * the date_range_start/end fallback, else none.
 */
export function lineRanges(line: {
  selected_days?: string[] | null
  date_range_start?: string | null
  date_range_end?: string | null
}): DayRange[] {
  if (line.selected_days && line.selected_days.length > 0) {
    const r = collapseDays(line.selected_days)
    if (r.length > 0) return r
  }
  const start = line.date_range_start
  const end = line.date_range_end ?? line.date_range_start
  if (start && end) {
    const days = inclusiveDays(start, end)
    if (days !== null) return [{ start: start.slice(0, 10), end: end.slice(0, 10), days }]
  }
  return []
}

/** Add `n` days to an ISO day (UTC arithmetic), returned as YYYY-MM-DD. */
export function addDays(iso: string, n: number): string {
  const ms = toUtcMs(iso)
  if (ms === null) return iso
  return new Date(ms + n * DAY_MS).toISOString().slice(0, 10)
}

/** One row of the offer page's Period / Dates / Length table. */
export interface OfferPeriodRow {
  kind: 'arrival' | 'activity' | 'departure' | 'stay'
  /** Activity: the product name(s). Arrival/departure/stay: null (caller localizes). */
  name: string | null
  start: string
  end: string
  /** Inclusive days for an activity; nights of the stay on the arrival row; 0 = no length. */
  count: number
  /** True when `count` counts hotel nights rather than days. */
  nights: boolean
  /**
   * `stay` rows only: the folded arrival + departure (check-in -> check-out
   * with the times), rendered through `stayWindowLabel` like the confirmation
   * step.
   */
  stay?: DisplayPeriod
}

/**
 * Same shape as the server's booking periods (landr-78i5e.1): an Arrival row
 * (the hotel stay's first night), one row per contiguous activity stretch
 * (products sharing identical days are merged as "A + B"), a Departure row
 * (last night + 1). Used when the public payload carries no `periods`.
 * `hotel` lines hold the NIGHT window as selected_days; without selected_days
 * their date_range_end is already the check-out day.
 */
export function derivePeriodRows(
  lines: ReadonlyArray<{
    name: string
    hotel: boolean
    selected_days?: string[] | null
    date_range_start?: string | null
    date_range_end?: string | null
  }>,
): OfferPeriodRow[] {
  const activity = new Map<string, OfferPeriodRow>()
  let arrival: string | null = null
  let departure: string | null = null
  for (const line of lines) {
    const ranges = lineRanges(line)
    if (ranges.length === 0) continue
    if (line.hotel) {
      const first = ranges[0]!.start
      const last = ranges[ranges.length - 1]!.end
      const hasDays = !!line.selected_days && line.selected_days.length > 0
      const out = hasDays ? addDays(last, 1) : last
      if (arrival === null || first < arrival) arrival = first
      if (departure === null || out > departure) departure = out
      continue
    }
    for (const r of ranges) {
      const key = `${r.start}|${r.end}`
      const have = activity.get(key)
      if (have) {
        const names = (have.name ?? '').split(' + ')
        if (!names.includes(line.name)) have.name = [...names, line.name].join(' + ')
      } else {
        activity.set(key, {
          kind: 'activity',
          name: line.name,
          start: r.start,
          end: r.end,
          count: r.days,
          nights: false,
        })
      }
    }
  }
  const rows: OfferPeriodRow[] = []
  if (arrival !== null) {
    const stay = departure !== null ? inclusiveDays(arrival, departure) : null
    rows.push({
      kind: 'arrival',
      name: null,
      start: arrival,
      end: arrival,
      count: stay !== null ? Math.max(0, stay - 1) : 0,
      nights: true,
    })
  }
  rows.push(...[...activity.values()].sort((a, b) => a.start.localeCompare(b.start)))
  if (departure !== null) {
    rows.push({ kind: 'departure', name: null, start: departure, end: departure, count: 0, nights: false })
  }
  return rows
}

/**
 * Server `periods` (BookingPeriod, landr-78i5e.1) as table rows. The arrival
 * row carries the stay's nights (departure.start - arrival.start); activity
 * rows their inclusive days; the departure row no length.
 */
export function periodRowsFromApi(
  periods: ReadonlyArray<
    Omit<BookingPeriod, 'meta'> & { meta?: BookingPeriod['meta'] }
  >,
): OfferPeriodRow[] {
  // A stay's arrival + departure fold into ONE check-in -> check-out row
  // (the same fold the confirmation step uses); a booking without times keeps
  // its Arrival / Departure rows.
  const folded = foldStayPeriods(periods.map((p) => ({ ...p, meta: p.meta ?? {} })))
  const departure = folded.find((p) => p.kind === 'departure')
  return folded.map((p): OfferPeriodRow => {
    const start = p.start_date.slice(0, 10)
    const end = p.end_date.slice(0, 10)
    if (p.kind === 'stay') {
      const stay = inclusiveDays(start, end)
      return {
        kind: 'stay',
        name: null,
        start,
        end,
        count: stay !== null ? Math.max(0, stay - 1) : 0,
        nights: true,
        stay: p,
      }
    }
    if (p.kind === 'arrival') {
      const stay = departure ? inclusiveDays(start, departure.start_date) : null
      return { kind: 'arrival', name: null, start, end, count: stay !== null ? stay - 1 : 0, nights: true }
    }
    if (p.kind === 'departure') {
      return { kind: 'departure', name: null, start, end, count: 0, nights: false }
    }
    return {
      kind: 'activity',
      name: p.product_name ?? p.label,
      start,
      end,
      count: p.days > 0 ? p.days : (inclusiveDays(start, end) ?? 0),
      nights: false,
    }
  })
}
