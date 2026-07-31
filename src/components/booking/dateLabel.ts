/**
 * Intl-based weekday-aware date labels for the BookingForm summary
 * (landr-iu3s). Kept in a sibling .ts file so React Fast Refresh
 * stays happy — the widget deploy pipeline blocks
 * `react-refresh/only-export-components` (see expandWindowDays.ts +
 * accommodationCalc.ts for the same pattern).
 *
 * Output format: 'Sat 23 Nov' — weekday short + day numeric + month
 * short. Cache the formatter per locale so multi-day ranges don't
 * pay the Intl construction cost on every label.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function getFormatter(locale: string | undefined): Intl.DateTimeFormat {
  const key = locale ?? ''
  const cached = formatterCache.get(key)
  if (cached) return cached
  const fmt = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    // Pin to UTC so ISO dates like '2026-11-23' render as the same
    // calendar day regardless of the viewer's local timezone offset.
    timeZone: 'UTC',
  })
  formatterCache.set(key, fmt)
  return fmt
}

/**
 * Format a single ISO date (YYYY-MM-DD) as 'Sat 23 Nov'.
 * Returns an empty string when the input is empty or unparseable
 * so the caller can render a placeholder without throwing.
 */
export function formatDayLabel(iso: string, locale?: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return ''
  return getFormatter(locale).format(d)
}

/**
 * Format a date range as 'Sat 23 Nov → Sun 30 Nov'. Uses an arrow
 * separator (U+2192) to match the dashboard's DayChips convention.
 * When the two dates collapse to the same ISO, returns just one
 * label.
 */
export function formatDayRange(
  firstIso: string,
  lastIso: string,
  locale?: string,
): string {
  const first = formatDayLabel(firstIso, locale)
  const last = formatDayLabel(lastIso, locale)
  if (!first) return last
  if (!last || firstIso === lastIso) return first
  return `${first} → ${last}`
}

/**
 * landr-4a5j: compact numeric "DD.–DD.MM." day-range teaser for the
 * expanded-catalog first step (e.g. a fixed-window product's next upcoming
 * window: "12.–19.09."). Deliberately locale-agnostic (unlike
 * formatDayLabel/formatDayRange, which use the viewer's Intl locale) — the
 * catalogue card is a compact teaser, not a full date, so a single terse
 * numeric convention reads consistently everywhere. Parses the ISO date
 * numerically (no Date object, no timezone conversion — a fixed-window's
 * start/end are calendar dates, not instants).
 *
 * Returns '' when either input is empty/unparseable.
 */
export function formatDayRangeShort(firstIso: string, lastIso: string): string {
  const first = parseIsoDayMonth(firstIso)
  const last = parseIsoDayMonth(lastIso)
  if (!first) return ''
  if (!last || firstIso === lastIso) return `${first.day}.${first.month}.`
  if (first.month === last.month) {
    return `${first.day}.–${last.day}.${last.month}.`
  }
  return `${first.day}.${first.month}. – ${last.day}.${last.month}.`
}

function parseIsoDayMonth(iso: string): { day: string; month: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const [, , month, day] = match
  return { day, month }
}
