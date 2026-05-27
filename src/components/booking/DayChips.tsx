/**
 * Small badge-list rendering one chip per ISO date (landr-2wyi). Used
 * inside PriceSidebar to surface the customer's selected guided days as
 * discrete chips — "Mon 25 May", "Wed 27 May" — instead of the
 * misleading "Mon 25 May → Wed 27 May (2 days)" range label, which
 * conflated non-contiguous selections (25 + 27, skipping 26) with a
 * contiguous range.
 *
 * Inputs: a list of ISO YYYY-MM-DD strings. The component sorts a copy
 * defensively (callers usually pass already-sorted arrays but the
 * estimate endpoint accepts arbitrary order). Empty list renders
 * nothing so consumers can pass through without a guard.
 *
 * Run grouping (landr-769w): after sorting, the chips are partitioned
 * into consecutive-day "runs" (two ISO dates are consecutive iff their
 * UTC day-difference is exactly 1). Within a run the chips sit tight
 * (gap-1); between runs we insert a subtle '·' separator flanked by a
 * wider gap so a non-contiguous selection like [25, 27] is visibly
 * discontinuous — the uniform flex gap of the original implementation
 * made [25, 27] read as "two adjacent days". Mirror of the dashboard
 * fix (landr-irz1) but without the month-row layout (the widget shows
 * short ranges only).
 *
 * Sibling .tsx file convention: only a single React component export so
 * `react-refresh/only-export-components` stays happy (see PriceSidebar
 * + AccommodationStep for the same pattern). The `groupIntoRuns`
 * helper is intentionally a non-exported local function for the same
 * reason — extracting it to a sibling .ts would split tiny helpers
 * across files for no payoff.
 */
import { Fragment } from 'react'
import { formatDayLabel } from './dateLabel'

interface Props {
  /** ISO YYYY-MM-DD date strings. Empty list renders nothing. */
  dates: string[]
  /** Optional locale (defaults to browser locale via formatDayLabel). */
  locale?: string
}

const MS_PER_DAY = 86_400_000

function parseDayOnly(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const [, y, mo, d] = m
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 12))
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Group an already-sorted YYYY-MM-DD array into runs of consecutive
 * calendar days. Two ISO dates are consecutive iff their UTC
 * day-difference is exactly 1. Unparseable inputs end the current run
 * (start a new one) so we never silently merge garbage. landr-769w.
 */
function groupIntoRuns(sortedDays: string[]): string[][] {
  const runs: string[][] = []
  let prevDate: Date | null = null
  for (const iso of sortedDays) {
    const d = parseDayOnly(iso)
    if (d && prevDate) {
      const diff = Math.round((d.getTime() - prevDate.getTime()) / MS_PER_DAY)
      if (diff === 1) {
        runs[runs.length - 1].push(iso)
        prevDate = d
        continue
      }
    }
    runs.push([iso])
    prevDate = d
  }
  return runs
}

export function DayChips({ dates, locale }: Props) {
  if (dates.length === 0) return null
  // Sort defensively so the chips render in chronological order even
  // when the parent passes an unsorted array (e.g. when the customer
  // toggled days out of order in the picker).
  const sorted = [...dates].sort()
  const runs = groupIntoRuns(sorted)
  return (
    <div
      role="list"
      className="mt-1 flex flex-wrap items-center gap-2"
      data-testid="day-chips"
    >
      {runs.map((run, i) => (
        <Fragment key={run[0]}>
          {i > 0 ? (
            <span
              aria-hidden="true"
              data-run-separator
              className="text-xs leading-none text-muted-foreground select-none"
            >
              ·
            </span>
          ) : null}
          <div
            data-run-start={run[0]}
            className="inline-flex flex-wrap items-center gap-1"
          >
            {run.map((iso) => (
              <span
                key={iso}
                role="listitem"
                data-day={iso}
                className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {formatDayLabel(iso, locale)}
              </span>
            ))}
          </div>
        </Fragment>
      ))}
    </div>
  )
}

export default DayChips
