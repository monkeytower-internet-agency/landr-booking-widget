import type { AvailabilitySlot } from '@/api/types'

/**
 * landr-k9pji.1: a stable identity for an availability row.
 *
 * A real row is identified by its `availability_id`. A synthesised on-request
 * day (`availability_id === null`, see AvailabilitySlot) has no id, but the
 * API emits at most ONE such row per date — real rows always win over it — so
 * its date identifies it. The `day:` prefix keeps the two spaces apart.
 *
 * landr-xtkae.2: a fixed-daily-times product emits SEVERAL synthesised rows per
 * date (one per start time), all with `availability_id === null`, so the start
 * time joins the key: `day:${date}@${start_time}`.
 */
export function slotKey(
  slot: Pick<AvailabilitySlot, 'availability_id' | 'date'> &
    Partial<Pick<AvailabilitySlot, 'start_time'>>,
): string {
  if (slot.availability_id) return slot.availability_id
  return slot.start_time ? `day:${slot.date}@${slot.start_time}` : `day:${slot.date}`
}

/**
 * landr-xtkae.2: does this product offer fixed daily start times? Route on the
 * data, not on `service_time_shape` — the solo tandem flight is `single_date`.
 * An empty list is treated as "none" (the API never sends one).
 */
export function hasFixedStartTimes(
  product: { daily_start_times?: string[] | null },
): boolean {
  return Array.isArray(product.daily_start_times) && product.daily_start_times.length > 0
}

/** "11:00:00" -> "11:00": the submit contract takes HH:MM, availability returns HH:MM:SS. */
export function toHHMM(time: string | null | undefined): string | null {
  if (!time) return null
  return time.slice(0, 5)
}
