import type { AvailabilitySlot } from '@/api/types'

/**
 * landr-k9pji.1: a stable identity for an availability row.
 *
 * A real row is identified by its `availability_id`. A synthesised on-request
 * day (`availability_id === null`, see AvailabilitySlot) has no id, but the
 * API emits at most ONE such row per date — real rows always win over it — so
 * its date identifies it. The `day:` prefix keeps the two spaces apart.
 */
export function slotKey(slot: Pick<AvailabilitySlot, 'availability_id' | 'date'>): string {
  return slot.availability_id ?? `day:${slot.date}`
}
