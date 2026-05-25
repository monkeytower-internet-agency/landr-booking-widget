/**
 * Pure helpers for add-on rendering (landr-cip6 / epic landr-ie8g). Kept
 * in a sibling .ts file so the react-refresh/only-export-components
 * ESLint rule stays happy (the component files only export the React
 * component as default — adding non-component exports there would
 * trigger the rule and block CI; see landr-znl history).
 */
import type { ProductAddon } from '@/api/types'

/** Single line item: an add-on product + how many of it the customer picked. */
export interface AddonSelection {
  productId: string
  quantity: number
}

/**
 * Default add-on quantity when the customer first sees the row. Required
 * add-ons start at their min_qty so the "Continue" button is unblocked
 * by default; non-required add-ons start at 0 (opt-in).
 *
 * Per the spec "tied to parent qty" default only applies to add-ons
 * rendered UNDER a parent (the AccommodationStep case): the caller can
 * override this with the parent qty when seeding the selection map.
 */
export function defaultAddonQty(addon: ProductAddon): number {
  return addon.is_required ? Math.max(1, addon.min_qty) : 0
}

/**
 * Clamp a candidate quantity against the add-on's min_qty / max_qty
 * config. The widget never silently caps an over-the-max input (max_qty
 * != null) — we let the stepper run up to max_qty and disable the +
 * button at the ceiling. Below min_qty the stepper still allows 0 so the
 * customer can deselect a non-required add-on, but the form's "can
 * continue" gate flags required add-ons whose qty falls below min_qty.
 */
export function clampAddonQty(addon: ProductAddon, qty: number): number {
  const floor = 0
  const ceiling = addon.max_qty ?? Number.POSITIVE_INFINITY
  return Math.min(ceiling, Math.max(floor, qty))
}

/**
 * Required-min validation surface for an add-on row. Returns null when
 * the row is satisfied (not required, or required-and-met); returns a
 * short reason string when the form should block submission. Components
 * render this next to the stepper as a destructive helper line and
 * disable "Continue" when ANY add-on returns a non-null reason.
 */
export function requiredAddonError(
  addon: ProductAddon,
  qty: number,
): string | null {
  if (!addon.is_required) return null
  if (qty >= addon.min_qty && qty >= 1) return null
  return addon.min_qty > 1
    ? `Required — pick at least ${addon.min_qty}`
    : 'Required'
}

/**
 * Quantity-deviation check for an add-on row vs the expected occupancy
 * (landr-u4c7). Returns:
 *   'over'  — qty > expectedQty (bringing extras?),
 *   'under' — 0 < qty < expectedQty (one per guest?),
 *   null    — qty === expectedQty or qty === 0 (no warning).
 *
 * expectedQty is the number of people the room(s) sleep:
 *   capacity_per_unit × roomQty for per-occupant add-ons (breakfast),
 *   1 for service-flow add-ons where the caller passes no parent context.
 *
 * When expectedQty=1 (service-flow callers), the 'under' branch never
 * fires because qty is either 0 (no warning) or ≥1 (either parity or
 * 'over'), preserving the existing over-only behaviour for those callers.
 */
export function isOverbooked(
  addonQty: number,
  expectedQty: number,
): 'over' | 'under' | null {
  if (addonQty === 0) return null
  if (addonQty > expectedQty) return 'over'
  if (addonQty < expectedQty) return 'under'
  return null
}

/**
 * Convert a selection map into the line-item array shape consumed by
 * the booking submit payload. Filters out entries with qty <= 0 so the
 * caller never sends an opt-out as a zero-qty line.
 */
export function selectionToLines(
  selection: Record<string, number>,
): AddonSelection[] {
  return Object.entries(selection)
    .filter(([, qty]) => qty > 0)
    .map(([productId, quantity]) => ({ productId, quantity }))
}
