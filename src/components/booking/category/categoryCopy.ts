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

/**
 * Label for the product-count chip, e.g. "1 offer" / "4 offers". Callers only
 * render this for groups with count > 0 (empty groups are hidden), but the
 * helper stays total for safety and testability.
 */
export function offerCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'offer' : 'offers'}`
}
