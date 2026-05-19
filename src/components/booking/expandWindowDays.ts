import type { FixedDateWindow } from '@/api/types'

/**
 * Expand a window's [start_date, end_date] inclusive into per-day ISO strings
 * for the booking submit payload's selected_days.
 */
export function expandWindowDays(window: FixedDateWindow): string[] {
  const out: string[] = []
  const start = new Date(`${window.start_date}T00:00:00Z`)
  const end = new Date(`${window.end_date}T00:00:00Z`)
  for (let d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}
