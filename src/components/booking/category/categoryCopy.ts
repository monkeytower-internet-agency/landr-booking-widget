/**
 * landr-d8rg.5: Pure copy helpers for the category entrance.
 *
 * The widget is English-only in v1 (see lib/strings.ts, landr-ifcu) and its
 * chrome copy is inline English — group *content* (name/description) is
 * operator-supplied and localized via pickLocalized, but the structural
 * labels (the offer-count chip, the section heading) are widget copy and
 * therefore live here as plain English strings.
 *
 * Kept in a non-component module so CategoryTile.tsx / CategoryStep.tsx stay
 * component-only for the react-refresh/only-export-components CI gate.
 */

import type { ProductGroup } from '@/api/types'
import { isCategoryFullySoldOut } from '@/components/booking/bookability'
import { FULLY_BOOKED_LABEL } from '@/components/booking/FullyBookedNotice'

/**
 * Label for the category count chip. Reads "1 offer" / "4 offers" for a
 * normal or MIXED category. landr-872c: for a FULLY SOLD-OUT category
 * (isCategoryFullySoldOut — product_count > 0, bookable_count === 0), reads
 * "Fully booked" instead — reusing FullyBookedNotice's exact copy rather
 * than inventing a second string for the same concept. Callers only render
 * this for groups with product_count > 0 (empty groups are hidden), but the
 * helper stays total for safety and testability.
 */
export function offerCountLabel(
  group: Pick<ProductGroup, 'product_count' | 'bookable_count'>,
): string {
  if (isCategoryFullySoldOut(group)) return FULLY_BOOKED_LABEL
  const count = group.product_count
  return `${count} ${count === 1 ? 'offer' : 'offers'}`
}
