/**
 * Date helpers for the /pay + /offer page (landr-1zkp7). Pure and
 * presentation-only: the product line's `selected_days` are collapsed into
 * consecutive stretches and printed the way the trip page does
 * ("Sun 24 Jan – Fri 29 Jan 2027"). All arithmetic is in UTC on the ISO
 * date, so the viewer's timezone can never shift a day.
 */

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
