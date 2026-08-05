import type { Product, ProductGroup } from '@/api/types'

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
