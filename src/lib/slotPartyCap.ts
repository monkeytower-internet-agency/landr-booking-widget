import type { Product } from '@/api/types'
import type { BookingSelection } from '@/components/booking/BookingForm'
import { maxPartySize } from '@/lib/seatHold'

/** The API's "nothing caps the day" seat count (landr-f987a.8). */
const UNLIMITED_SEATS = 9999

/**
 * landr-v56gf: the largest party a picked TIMED slot can take when its seats
 * come from a shared resource pool (`seat_limit_source === 'resources'`, e.g.
 * two tandem pilots): min(product max_party_size, pilots free in that slot).
 * null when the slot does not narrow the party (no slot, a whole-day row, a
 * product-capped slot, or no limit at all).
 */
export function slotPartyCap(
  product: Pick<Product, 'max_party_size'>,
  selection: BookingSelection | undefined,
): number | null {
  if (selection?.kind !== 'slot') return null
  const slot = selection.slot
  if (slot.seat_limit_source !== 'resources') return null
  if (!slot.start_time || !slot.end_time) return null
  const free = slot.available_seats
  if (typeof free !== 'number' || free < 1 || free >= UNLIMITED_SEATS) return null
  const own = maxPartySize(product.max_party_size)
  return free < own ? free : null
}

/**
 * The product as the participants step should see it for the picked slot:
 * `max_party_size` narrowed by {@link slotPartyCap}. Bigger groups get the
 * participants step's existing "larger group" contact line. Unchanged (same
 * reference) when the slot does not narrow it.
 */
export function withSlotPartyCap<P extends Pick<Product, 'max_party_size'>>(
  product: P,
  selection: BookingSelection | undefined,
): P {
  const cap = slotPartyCap(product, selection)
  if (cap === null) return product
  return { ...product, max_party_size: cap }
}
