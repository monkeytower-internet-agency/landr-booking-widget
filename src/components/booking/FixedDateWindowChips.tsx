/**
 * landr-4a5j: full date-window chips for a fixed_window product's card in
 * the expanded catalog — the same window data + Available/Full/seats-left
 * status as the "Dates" tab (FixedDateWindowPicker), just read-only (the
 * card itself is the click target; onSelect navigates to product detail).
 *
 * Fetches getFixedDateWindows(productId) itself so ExpandedCatalog's own
 * catalogue fetch stays a single unscoped listProducts call — this is a
 * bounded per-product fetch, gated by the caller on next_window_start/end
 * being present (i.e. only for products that actually have an upcoming
 * fixed-date window to show).
 */
import { useEffect, useState } from 'react'
import { getFixedDateWindows } from '@/api/client'
import type { FixedDateWindow } from '@/api/types'
import { formatWindowRangeLabel } from '@/components/booking/dateLabel'
import { cn } from '@/lib/utils'

interface Props {
  productId: string
  slug: string
  /** Operator's expose_seats_to_customer flag — mirrors FixedDateWindowPicker. */
  exposeSeats?: boolean
}

export function FixedDateWindowChips({
  productId,
  slug,
  exposeSeats = true,
}: Props) {
  const [windows, setWindows] = useState<FixedDateWindow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await getFixedDateWindows(productId)
        if (!cancelled) setWindows(data)
      } catch {
        // Informational chips on a catalogue card — a failed fetch just
        // means no chips render, the product card itself still works.
        if (!cancelled) setWindows([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [productId])

  if (windows === null) {
    return (
      <div
        aria-hidden="true"
        data-testid={`product-date-chips-loading-${slug}`}
        className="flex flex-wrap gap-1.5 px-1"
      >
        <div className="h-6 w-36 animate-pulse rounded-full bg-muted" />
        <div className="h-6 w-36 animate-pulse rounded-full bg-muted" />
      </div>
    )
  }

  if (windows.length === 0) return null

  return (
    <div
      className="flex flex-wrap gap-1.5 px-1"
      data-testid={`product-date-chips-${slug}`}
    >
      {windows.map((window) => {
        const available = Math.max(0, window.capacity - window.capacity_reserved)
        const isFull = available === 0
        return (
          <span
            key={window.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-2.5 py-1 text-xs"
          >
            <span className="font-medium tabular-nums">
              {formatWindowRangeLabel(window.start_date, window.end_date)}
            </span>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                isFull
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
              )}
            >
              {isFull
                ? 'Full'
                : exposeSeats
                  ? `${available} seat${available === 1 ? '' : 's'} left`
                  : 'Available'}
            </span>
          </span>
        )
      })}
    </div>
  )
}
