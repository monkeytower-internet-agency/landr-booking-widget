import type { AvailabilitySlot, HotelOffering, Product, ProductGroup } from '@/api/types'

/**
 * landr-7jgo: a product is "bookable" when the customer can actually pick a
 * future date with capacity remaining. The flag is computed server-side
 * (see public_get_operator_products.bookable); the widget just reads it.
 *
 * FAIL-OPEN on an ABSENT flag: an API response that predates the field (or
 * any unexpected omission) is treated as bookable so an older API can never
 * accidentally hide an operator's entire catalogue. The "sold out" behaviour
 * only kicks in when the API explicitly says bookable === false.
 */
export function isBookable(product: Pick<Product, 'bookable'>): boolean {
  return product.bookable !== false
}

/**
 * landr-872c: a category is FULLY SOLD OUT when it has listable products
 * (product_count > 0) but NONE of them are currently bookable
 * (bookable_count === 0). This is the state that must render as a
 * disabled/"Fully booked" tile+section in both widget layouts, never hidden
 * and never a dead end — see the contract table in ExpandedCatalog.tsx.
 *
 * FAIL-OPEN on an ABSENT bookable_count (an API response that predates the
 * field, mirroring isBookable()'s contract): treated as "every listed
 * product is bookable", i.e. NEVER fully sold out, so an older API can never
 * accidentally grey out a whole catalogue. A genuinely EMPTY category
 * (product_count === 0) is never "fully sold out" either — that stays
 * hidden entirely, unchanged, per the SCOPE GUARD in landr-872c.
 */
export function isCategoryFullySoldOut(
  group: Pick<ProductGroup, 'product_count' | 'bookable_count'>,
): boolean {
  return group.product_count > 0 && group.bookable_count === 0
}

/**
 * landr-t869m.2: does this availability row still satisfy the product's
 * preparation window (`lead_time_minutes`)? The widget reads this flag
 * straight off `public_get_product_availability` — it never re-derives the
 * lead-time rule itself (that logic lives once, server-side, in
 * app/services/lead_time.py and the twin SQL functions).
 *
 * FAIL-OPEN on an ABSENT flag, exactly like `isBookable()` above: an older
 * API (or a mocked/test slot) that predates the field must never
 * accidentally grey out a whole calendar. Only an explicit `false` excludes
 * the day.
 */
export function isActivityBookable(
  slot: Pick<AvailabilitySlot, 'activity_bookable'>,
): boolean {
  return slot.activity_bookable !== false
}

/**
 * landr-t869m.2: can a stay derived from this activity day still be booked?
 * Three-way, unlike isActivityBookable — this mirrors the API's own
 * NULL/true/false contract:
 *   - `true`  — the stay is bookable.
 *   - `false` — the activity is still bookable but the derived check-in day
 *     no longer satisfies the stay's own lead time ("hotel too late").
 *   - `null`/absent — not evaluated at all (product's hotel_offering is
 *     'none', or an older API). Callers must not treat this as "false".
 *
 * Returns the raw tri-state rather than collapsing to a boolean because
 * AccommodationStep needs to distinguish "no hotel step" from "hotel step,
 * but too late" to decide whether to render the optional-hotel warning at
 * all.
 */
export function accommodationBookability(
  slot: Pick<AvailabilitySlot, 'accommodation_bookable'> | undefined,
): boolean | null {
  const value = slot?.accommodation_bookable
  return value === undefined ? null : value
}

/**
 * landr-t869m.2 (review fix): should a day picker OFFER this day at all,
 * given the product's hotel_offering?
 *
 * CORRECTED PREMISE — the original ticket text asserted "mandatory → the
 * day is simply not offered (the API flag already reflects this)". That is
 * wrong: in migration 20260918013000, the
 * `hotel_offering <> 'mandatory' OR _accommodation_lead_time_ok(...)` clause
 * lives ONLY inside `_product_is_bookable` (the catalogue-level "is this
 * product bookable at all" flag). `public_get_product_availability`'s
 * `activity_bookable` is a bare `_lead_time_ok(...)` with NO accommodation
 * term, and `accommodation_bookable` is a separate column the migration's
 * own header says is "NOT filtered out when a flag is false" — i.e. days
 * are never dropped server-side. Combining the two flags for a mandatory
 * product is the WIDGET's job, not something the API already does.
 *
 * Rule:
 *   - `hotel_offering !== 'mandatory'` (optional/none) — activity_bookable
 *     alone gates the day. The accommodation half never blocks the
 *     activity for these — that is the whole point of 'optional' (see
 *     AccommodationStep's "hotel too late" banner), and 'none' never
 *     evaluates accommodation at all.
 *   - `hotel_offering === 'mandatory'` — the day is only offered when BOTH
 *     activity_bookable AND accommodation_bookable hold. A mandatory
 *     product cannot book the activity without the stay, so a day whose
 *     stay has run out of lead time must not be selectable — leaving it
 *     selectable would let the customer walk the whole flow into a
 *     guaranteed `accommodation_lead_time_not_met` 422 at Confirm.
 *
 * FAIL-OPEN throughout: an absent/null accommodation_bookable (older API,
 * or a mock) never blocks a mandatory day — only an explicit `false` does.
 */
export function isDayBookable(
  slot: Pick<AvailabilitySlot, 'activity_bookable' | 'accommodation_bookable'>,
  hotelOffering: HotelOffering | undefined,
): boolean {
  if (!isActivityBookable(slot)) return false
  if (hotelOffering === 'mandatory') {
    return slot.accommodation_bookable !== false
  }
  return true
}
