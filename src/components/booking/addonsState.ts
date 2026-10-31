/**
 * Pure helpers for add-on rendering (landr-cip6 / epic landr-ie8g). Kept
 * in a sibling .ts file so the react-refresh/only-export-components
 * ESLint rule stays happy (the component files only export the React
 * component as default — adding non-component exports there would
 * trigger the rule and block CI; see landr-znl history).
 */
import type { ProductAddon, ProductKind } from '@/api/types'
import { tr } from '@/lib/strings'

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
  /**
   * landr-a27k9.2: a day-pickable companion add-on ('parent_subset') carries
   * the days the guest picked (a non-empty subset of the parent's days /
   * nights). BookingForm.onConfirm submits exactly these instead of the
   * parent's window; absent = the add-on follows its parent's days.
   */
  selectedDays?: string[]
  /** Companion display data, so the price sidebar can show qty x days x price. */
  name?: string
  nameLocalized?: Record<string, string> | null
  unitPrice?: number | null
  currency?: string | null
}

/** landr-a27k9.2: the add-on is booked on a subset of its parent's days. */
export function isCompanion(
  addon: Partial<Pick<ProductAddon, 'day_selection'>>,
): boolean {
  return addon.day_selection === 'parent_subset'
}

/** Stock verdict of one add-on on ONE day (a single-day add-ons query). */
export interface CompanionDayVerdict {
  available: boolean
  remaining: number | null
}

/** day (ISO) -> addon_product_id -> verdict. */
export type CompanionDayStock = Record<string, Record<string, CompanionDayVerdict>>

/** The day has no unit of the add-on left. */
export function isCompanionDayFull(
  stock: CompanionDayStock | null | undefined,
  addonId: string,
  day: string,
): boolean {
  const v = stock?.[day]?.[addonId]
  if (!v) return false
  return !v.available || v.remaining === 0
}

/**
 * The days a companion pick really covers: the picked days that are still
 * among the parent's days (the stay changed). Order follows the parent's
 * days. A day that has since filled up stays picked -- the card flags it and
 * the API has the last word -- so the pick never changes under the guest.
 */
export function effectiveCompanionDays(
  picked: readonly string[] | undefined,
  parentDays: readonly string[],
): string[] {
  if (!picked || picked.length === 0) return []
  const set = new Set(picked)
  return parentDays.filter((d) => set.has(d))
}

/**
 * landr-a27k9.2: the companion with its stock judged on the PICKED days only
 * -- the lowest remaining across them. The row's own stock fields (counted
 * over every day of the stay) would sell the whole add-on out the moment one
 * night is full.
 */
export function companionView(
  addon: ProductAddon,
  chosenDays: readonly string[],
  stock: CompanionDayStock | null | undefined,
): ProductAddon {
  let lowest: number | null = null
  for (const d of chosenDays) {
    const r = stock?.[d]?.[addon.addon_product_id]?.remaining
    if (typeof r === 'number') lowest = lowest === null ? r : Math.min(lowest, r)
  }
  return {
    ...addon,
    available: true,
    unavailable_reason: null,
    stock_remaining: lowest,
  }
}

/**
 * landr-a27k9.2: the most of a companion the party may take, before stock:
 * its own rule / max, the party size (a bike per guest at most) less what
 * OTHER lists (other rooms) already hold of it.
 */
export function companionQtyCeiling(
  addon: Pick<ProductAddon, 'max_qty'> &
    Partial<
      Pick<ProductAddon, 'product_kind' | 'addon_quantity_rule' | 'addon_quantity_max'>
    >,
  participantCount?: number,
  elsewhere = 0,
): number {
  const party =
    participantCount === undefined
      ? Number.POSITIVE_INFINITY
      : Math.max(1, participantCount) - elsewhere
  return Math.max(
    0,
    Math.min(
      addon.max_qty ?? Number.POSITIVE_INFINITY,
      addonRuleCeiling(addon, participantCount),
      party,
    ),
  )
}

/**
 * A companion picked above what the party may take (a stale restore, a party
 * that shrank): Continue must stay blocked until the quantity is lowered.
 * Stock is not judged here -- the list clamps to it as it arrives.
 */
export function companionOverCap(
  addons: readonly ProductAddon[],
  selection: Record<string, number>,
  participantCount?: number,
  elsewhereById: Record<string, number> = {},
): boolean {
  return addons.some(
    (a) =>
      isCompanion(a) &&
      (selection[a.addon_product_id] ?? 0) >
        companionQtyCeiling(a, participantCount, elsewhereById[a.addon_product_id] ?? 0),
  )
}

/** Add or remove one day from a companion's pick. */
export function toggleCompanionDay(
  picked: readonly string[] | undefined,
  day: string,
): string[] {
  const set = new Set(picked ?? [])
  if (set.has(day)) set.delete(day)
  else set.add(day)
  return [...set].sort()
}

/**
 * Companions with a quantity but no (still valid) day: the step cannot
 * continue, and the line would be refused (companion_days_required).
 */
export function companionDaysMissing(
  addons: readonly ProductAddon[],
  selection: Record<string, number>,
  daysByAddon: Record<string, string[] | undefined>,
  parentDays: readonly string[],
): boolean {
  return addons.some(
    (a) =>
      isCompanion(a) &&
      (selection[a.addon_product_id] ?? 0) > 0 &&
      effectiveCompanionDays(daysByAddon[a.addon_product_id], parentDays).length === 0,
  )
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
  participantCount?: number,
): number {
  const floor = 0
  const maxQtyCeiling = addon.max_qty ?? Number.POSITIVE_INFINITY
  // landr-lmudr.32: never more than the stock left on the chosen days.
  const stockCeiling = addonStockCeiling(addon)
  // landr-hzovu.2: the add-on's own "how many per booking" rule.
  const ruleCeiling = addonRuleCeiling(addon, participantCount)
  const ceiling = Math.min(
    maxQtyCeiling,
    stockCeiling,
    ruleCeiling,
    occupancyCap ?? Number.POSITIVE_INFINITY,
  )
  return Math.min(ceiling, Math.max(floor, qty))
}

/**
 * landr-hzovu.2: the most of this add-on its quantity rule allows —
 * one_per_booking -> 1, one_per_participant -> the guiding participants
 * (at least 1; unbounded while the count is unknown, the API still
 * enforces it), any -> addon_quantity_max or unbounded. Room-tied add-ons
 * (hotel_room) are bounded by room occupancy instead, never by the rule.
 */
export function addonRuleCeiling(
  addon: Partial<
    Pick<ProductAddon, 'product_kind' | 'addon_quantity_rule' | 'addon_quantity_max'>
  >,
  participantCount?: number,
): number {
  if (addon.product_kind === 'hotel_room') return Number.POSITIVE_INFINITY
  switch (addon.addon_quantity_rule) {
    case 'one_per_booking':
      return 1
    case 'one_per_participant':
      return participantCount === undefined
        ? Number.POSITIVE_INFINITY
        : Math.max(1, participantCount)
    default:
      return addon.addon_quantity_max ?? Number.POSITIVE_INFINITY
  }
}

/**
 * landr-lmudr.32: the most of this add-on the stock still allows —
 * `stock_remaining` from the API's stock verdict, or no limit when the
 * add-ons were fetched without one.
 */
export function addonStockCeiling(
  addon: Pick<ProductAddon, 'stock_remaining'>,
): number {
  return typeof addon.stock_remaining === 'number'
    ? Math.max(0, addon.stock_remaining)
    : Number.POSITIVE_INFINITY
}

/**
 * landr-c88o5: how many of this add-on OTHER cart lines already claim from
 * the same stock. `others` are the add-on rows (with their picked quantity)
 * of the other stays; a row counts when it is the same add-on product and its
 * pool_ids intersect this add-on's.
 */
export function pooledQtyElsewhere(
  addon: Pick<ProductAddon, 'addon_product_id' | 'pool_ids'>,
  others: readonly {
    addon: Pick<ProductAddon, 'addon_product_id' | 'pool_ids'>
    qty: number
  }[],
  /** landr-h8n0k: count lines of OTHER add-on products sharing a pool too
   *  (a bike pool serving a room add-on and a service add-on). */
  anyProduct = false,
): number {
  const mine = new Set(addon.pool_ids ?? [])
  if (mine.size === 0) return 0
  let total = 0
  for (const o of others) {
    if (!anyProduct && o.addon.addon_product_id !== addon.addon_product_id) continue
    if ((o.addon.pool_ids ?? []).some((id) => mine.has(id))) total += o.qty
  }
  return total
}

/** landr-c88o5: the add-on with `claimed` taken off its remaining stock. */
export function withClaimedStock<T extends Pick<ProductAddon, 'stock_remaining'>>(
  addon: T,
  claimed: number,
): T {
  if (claimed <= 0 || typeof addon.stock_remaining !== 'number') return addon
  return { ...addon, stock_remaining: Math.max(0, addon.stock_remaining - claimed) }
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
  locale?: string,
): string | null {
  if (!addon.is_required) return null
  if (qty >= addon.min_qty && qty >= 1) return null
  if (addon.min_qty > 1) {
    return tr('requiredPickAtLeastTemplate', locale).replace('{n}', String(addon.min_qty))
  }
  return tr('required', locale)
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
 * landr-lmudr.10: a stock-limited add-on with no room left on the booking's
 * days. landr-lmudr.32: with a quantity, sold out only when that quantity is
 * more than the stock left — a party of 5 asking for 2 vests with 3 left is
 * not sold out.
 */
export function isAddonSoldOut(
  addon: Pick<ProductAddon, 'available' | 'stock_remaining'>,
  quantity?: number,
): boolean {
  if (addon.available === false) return true
  return quantity !== undefined && quantity > addonStockCeiling(addon)
}

/**
 * landr-lmudr.19: the line under a disabled add-on — "Raft: fully reserved
 * for another group" for a whole-unit add-on, else "sold out". The unit word
 * is the operator's own, as written (no re-casing).
 */
export function addonUnavailableMessage(
  addon: Pick<ProductAddon, 'unavailable_reason' | 'stock_unit_label'>,
  locale?: string,
): string {
  if (addon.unavailable_reason === 'unit_taken') {
    const unit = addon.stock_unit_label?.trim()
    return unit
      ? tr('addonUnitTakenTemplate', locale).replace('{unit}', unit)
      : tr('addonUnitTaken', locale)
  }
  return tr('addonSoldOut', locale)
}

/**
 * landr-lmudr.10: drop sold-out add-ons from a selection (a pick restored on
 * back-navigation may have sold out since). Returns the same object when
 * nothing had to go, so callers can skip a state update.
 */
export function withoutSoldOut(
  selection: Record<string, number>,
  addons: readonly (Pick<
    ProductAddon,
    'addon_product_id' | 'available' | 'stock_remaining'
  > &
    Partial<
      Pick<
        ProductAddon,
        'product_kind' | 'addon_quantity_rule' | 'addon_quantity_max' | 'day_selection'
      >
    >)[],
  participantCount?: number,
): Record<string, number> {
  let next: Record<string, number> | null = null
  for (const a of addons) {
    const id = a.addon_product_id
    if (!(id in selection)) continue
    // landr-a27k9.2: a companion's stock is judged per picked day by its card;
    // the row's all-days verdict must not drop a pick that fits its own days.
    const companion = isCompanion(a)
    if (!companion && isAddonSoldOut(a)) {
      next ??= { ...selection }
      delete next[id]
      continue
    }
    // landr-lmudr.32: a restored pick above the stock left is trimmed to it;
    // landr-hzovu.2: likewise above what the add-on's quantity rule allows.
    const ceiling = Math.min(
      companion ? Number.POSITIVE_INFINITY : addonStockCeiling(a),
      addonRuleCeiling(a, participantCount),
    )
    if (selection[id] > ceiling) {
      next ??= { ...selection }
      if (ceiling > 0) next[id] = ceiling
      else delete next[id]
    }
  }
  return next ?? selection
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
  addons: readonly (Pick<ProductAddon, 'addon_product_id' | 'product_kind'> &
    Partial<
      Pick<
        ProductAddon,
        'day_selection' | 'name' | 'name_localized' | 'price_per_unit' | 'currency'
      >
    >)[] = [],
  /**
   * landr-a27k9.2: the picked days of each companion (already trimmed to its
   * parent's days). A companion without any day yields NO line -- it cannot
   * be booked, and the step's gate blocks Continue until a day is picked.
   */
  companionDays: Record<string, string[] | undefined> = {},
): AddonSelection[] {
  const byId = new Map(addons.map((a) => [a.addon_product_id, a]))
  return Object.entries(selection)
    .filter(([, qty]) => qty > 0)
    .flatMap(([productId, quantity]): AddonSelection[] => {
      const row = byId.get(productId)
      const base: AddonSelection = {
        productId,
        quantity,
        ...(row ? { productKind: row.product_kind } : {}),
      }
      if (row && isCompanion(row)) {
        const days = companionDays[productId] ?? []
        if (days.length === 0) return []
        return [
          {
            ...base,
            selectedDays: days,
            ...(row.name ? { name: row.name } : {}),
            ...(row.name_localized ? { nameLocalized: row.name_localized } : {}),
            unitPrice: row.price_per_unit ?? null,
            currency: row.currency ?? null,
          },
        ]
      }
      return [base]
    })
}
