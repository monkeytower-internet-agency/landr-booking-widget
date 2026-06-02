import type { Product } from '@/api/types'

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
