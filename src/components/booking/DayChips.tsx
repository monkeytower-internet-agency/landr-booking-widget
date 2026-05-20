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
 * Sibling .tsx file convention: only a single React component export so
 * `react-refresh/only-export-components` stays happy (see PriceSidebar
 * + AccommodationStep for the same pattern).
 */
import { formatDayLabel } from './dateLabel'

interface Props {
  /** ISO YYYY-MM-DD date strings. Empty list renders nothing. */
  dates: string[]
  /** Optional locale (defaults to browser locale via formatDayLabel). */
  locale?: string
}

export function DayChips({ dates, locale }: Props) {
  if (dates.length === 0) return null
  // Sort defensively so the chips render in chronological order even
  // when the parent passes an unsorted array (e.g. when the customer
  // toggled days out of order in the picker).
  const sorted = [...dates].sort()
  return (
    <ul
      className="mt-1 flex flex-wrap gap-1"
      data-testid="day-chips"
    >
      {sorted.map((iso) => (
        <li
          key={iso}
          className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
        >
          {formatDayLabel(iso, locale)}
        </li>
      ))}
    </ul>
  )
}

export default DayChips
