/**
 * landr-78i5e.8: renders `BookingSummary.periods` — the arrival/activity/
 * departure schedule (landr-78i5e.1) — replacing the old per-product
 * `DayChips` list AND the separate hotel stay-window line on the
 * confirmation screen (Confirmation.tsx's `BookingDetailsCard`). The SAME
 * derivation feeds the confirmation email (booking_emails.py), so the
 * screen and the inbox agree verbatim — never re-derive periods here.
 *
 * Rows arrive from the API already ordered (arrival, then activity periods
 * by start_date, then departure) — this component renders them as given,
 * no sorting/grouping of its own (unlike DayChips, which groups raw day
 * lists into runs itself).
 *
 * Visual language: a simple label/date-range row list (same shape as the
 * dashboard's resource-pool "in service" schedule rows,
 * landr-dashboard/src/components/approvals/ResourcePoolsEditor.tsx's
 * UnitServiceSection) rather than a bordered `<table>` — this already sits
 * inside BookingDetailsCard's own bordered card.
 *
 * Sibling .tsx file, single component export — same
 * `react-refresh/only-export-components` convention as DayChips.
 */
import type { BookingPeriod } from '@/api/types'
import { formatDayRange } from './dateLabel'

interface Props {
  /** Already-ordered periods. Empty list renders nothing. */
  periods: BookingPeriod[]
  /** Optional locale (defaults to browser locale via formatDayRange). */
  locale?: string
}

export function PeriodsTable({ periods, locale }: Props) {
  if (periods.length === 0) return null
  return (
    <ul data-testid="confirmation-periods" className="space-y-1">
      {periods.map((period, idx) => (
        // start_date alone isn't a stable key: a gap can split one
        // activity product into two periods sharing no other field, but
        // never the same start_date — kind+start_date is unique in
        // practice; idx as a tiebreaker costs nothing.
        <li
          key={`${period.kind}-${period.start_date}-${idx}`}
          className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm"
        >
          <span className="font-medium text-foreground">{period.label}</span>
          <span className="text-muted-foreground">
            {formatDayRange(period.start_date, period.end_date, locale)}
          </span>
        </li>
      ))}
    </ul>
  )
}

export default PeriodsTable
