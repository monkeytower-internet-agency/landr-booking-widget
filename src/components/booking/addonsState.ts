/**
 * Pure helpers for add-on rendering (landr-cip6 / epic landr-ie8g). Kept
 * in a sibling .ts file so the react-refresh/only-export-components
 * ESLint rule stays happy (the component files only export the React
 * component as default — adding non-component exports there would
 * trigger the rule and block CI; see landr-znl history).
 */
import type { ProductAddon, ProductKind } from '@/api/types'

/** Single line item: an add-on product + how many of it the customer picked. */
export interface AddonSelection {
  productId: string
  quantity: number
  /**
   * landr-fxza.4: the add-on PRODUCT's own product_kind, threaded through
   * from the ProductAddon row that produced this selection (via
   * flattenPerRoomAddons / selectionToLines). 'hotel_room' tells
   * BookingForm.onConfirm to give this line the room's NIGHT window
   * instead of the raw service-day window — see BookingForm.tsx. Optional
   * and absent means "not known to be room-tied" (the pre-existing,
   * still-correct behavior for a plain service-tied add-on).
   */
  productKind?: ProductKind
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
 *
 * landr-yybu: occupancyCap re-introduced. For occupancy-linked room
 * add-ons (breakfast under a hotel room) the caller passes occupancyCap =
 * the room's total occupancy (capacity_per_unit × roomQty) so the
 * quantity is hard-capped at the number of guests the room sleeps —
 * applied UNIFORMLY, including single-occupancy rooms (cap = 1). Generic
 * service-flow add-ons (no room context) pass occupancyCap = undefined and
 * stay uncapped, bounded only by the add-on's own max_qty. The effective
 * ceiling is min(max_qty ?? Infinity, occupancyCap ?? Infinity). The
 * per-room over/under deviation WARNING (isOverbooked) still surfaces the
 * under-case ("one per guest?").
 */
export function clampAddonQty(
  addon: ProductAddon,
  qty: number,
  occupancyCap?: number,
): number {
  const floor = 0
  const maxQtyCeiling = addon.max_qty ?? Number.POSITIVE_INFINITY
  const ceiling =
    occupancyCap !== undefined
      ? Math.min(maxQtyCeiling, occupancyCap)
      : maxQtyCeiling
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
 *
 * landr-fxza.4: `addons` (the resolved catalogue, e.g. from getProductAddons)
 * is optional and defaults to `[]` for back-compat with existing callers;
 * when supplied, each output line's `productKind` is threaded through from
 * the matching ProductAddon row so BookingForm can discriminate room-tied
 * vs service-tied add-ons at submit time (see addons/BookingForm.tsx).
 */
export function selectionToLines(
  selection: Record<string, number>,
  addons: readonly Pick<ProductAddon, 'addon_product_id' | 'product_kind'>[] = [],
): AddonSelection[] {
  const kindById = new Map(addons.map((a) => [a.addon_product_id, a.product_kind]))
  return Object.entries(selection)
    .filter(([, qty]) => qty > 0)
    .map(([productId, quantity]) => ({
      productId,
      quantity,
      ...(kindById.has(productId)
        ? { productKind: kindById.get(productId) }
        : {}),
    }))
}
