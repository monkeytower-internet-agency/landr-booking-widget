/**
 * landr-d8rg.5: Pure copy helpers for the category entrance.
 *
 * landr-5aih0.9: the widget now resolves the customer's locale (see
 * src/lib/locale.ts) for its own chrome copy — group *content*
 * (name/description) is operator-supplied and localized via pickLocalized,
 * and the structural labels here (the offer-count chip) go through
 * src/lib/strings.ts's pickBundle/tr like every other widget string.
 *
 * Kept in a non-component module so CategoryTile.tsx / CategoryStep.tsx stay
 * component-only for the react-refresh/only-export-components CI gate.
 */

import type { ProductGroup } from '@/api/types'
import { isCategoryFullySoldOut } from '@/components/booking/bookability'
import { offerCountText, tr } from '@/lib/strings'

/**
 * Label for the category count chip. Reads "1 offer" / "4 offers" for a
 * normal or MIXED category. landr-872c: for a FULLY SOLD-OUT category
 * (isCategoryFullySoldOut — product_count > 0, bookable_count === 0), reads
 * "Fully booked" instead — reusing FullyBookedNotice's exact copy (same
 * bundle key, `fullyBookedLabel`) rather than inventing a second string for
 * the same concept. Callers only render this for groups with product_count
 * > 0 (empty groups are hidden), but the helper stays total for safety and
 * testability.
 */
export function offerCountLabel(
  group: Pick<ProductGroup, 'product_count' | 'bookable_count'>,
  locale?: string,
): string {
  if (isCategoryFullySoldOut(group)) return tr('fullyBookedLabel', locale)
  return offerCountText(group.product_count, locale)
}
