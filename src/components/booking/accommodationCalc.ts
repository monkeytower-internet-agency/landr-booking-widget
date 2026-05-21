/**
 * Pure helpers for AccommodationStep (landr-vyaz, landr-qpab). Kept
 * separate from the component file so React Fast Refresh stays happy
 * — the widget deploy pipeline blocks
 * `react-refresh/only-export-components` (see landr-znl history in the
 * CI warning notes).
 */
import type { Product, ProductAddon } from '@/api/types'

/** ISO date helpers — UTC-only to avoid TZ drift in derived dates. */
function isoToUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function utcDateToIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function shiftDays(iso: string, delta: number): string {
  const d = isoToUtcDate(iso)
  d.setUTCDate(d.getUTCDate() + delta)
  return utcDateToIso(d)
}

/**
 * Derived check-in/check-out + nights for a stay aligned with a multi-day
 * service. Per the spec: check-in = first selected day - 1, check-out =
 * last selected day + 1, nights = (check-out - check-in).
 *
 * Nights are computed from the day span (last - first + 2), NOT from
 * selectedDays.length, because non-contiguous service selections still
 * occupy the hotel continuously across the gap. Example: selecting
 * [Mon, Wed] for the service means check-in Sun, check-out Thu, the
 * customer does not check out on Tuesday and return — that would be a
 * second booking. Pre-2026-05-21 (landr-ma5n) this used
 * `selectedDays.length + 1`, which under-counted non-contiguous spans
 * (e.g. [25, 27] returned 3 nights instead of 4).
 *
 * Returns null fields + nights=0 when selectedDays is empty so the
 * caller can render an empty-state without crashing.
 */
export interface StayWindow {
  checkInIso: string | null
  checkOutIso: string | null
  nights: number
}

export function deriveStayWindow(selectedDays: string[]): StayWindow {
  if (selectedDays.length === 0) {
    return { checkInIso: null, checkOutIso: null, nights: 0 }
  }
  const sorted = [...selectedDays].sort()
  const checkInIso = shiftDays(sorted[0]!, -1)
  const checkOutIso = shiftDays(sorted[sorted.length - 1]!, 1)
  // Span-based night count: difference (in days) between check-out and
  // check-in. Works for both contiguous and non-contiguous selections
  // because the hotel window is continuous from first-1 to last+1.
  const checkInUtc = isoToUtcDate(checkInIso)
  const checkOutUtc = isoToUtcDate(checkOutIso)
  const msPerDay = 24 * 60 * 60 * 1000
  const nights = Math.round((checkOutUtc.getTime() - checkInUtc.getTime()) / msPerDay)
  return {
    checkInIso,
    checkOutIso,
    nights,
  }
}

/**
 * Array of ISO night dates for a stay, inclusive of check-in and
 * exclusive of check-out (one entry per night the room is occupied).
 * Mirrors hotel-industry convention: a 4-night stay from Mon→Fri
 * occupies Mon, Tue, Wed, Thu (4 entries). Returned in ascending order.
 *
 * Used by BookingForm to populate `selected_days` on hotel_room
 * ProductLineIn entries (landr-piyv) so the server-side pricing engine
 * computes per-night totals against the right window. Returns [] for
 * empty input — callers should skip emitting the line item in that case.
 */
export function stayNightIsos(selectedDays: string[]): string[] {
  const win = deriveStayWindow(selectedDays)
  if (!win.checkInIso || !win.checkOutIso) return []
  const out: string[] = []
  let cursor = win.checkInIso
  // walk from check-in (inclusive) to check-out (exclusive)
  while (cursor < win.checkOutIso) {
    out.push(cursor)
    cursor = shiftDays(cursor, 1)
  }
  return out
}

/** Single line item: a hotel_room product + how many of it the customer picked. */
export interface RoomSelection {
  productId: string
  quantity: number
}

/**
 * Format a number as a currency amount. Falls back to bare number with
 * the currency suffix when Intl is unavailable or the currency code is
 * unrecognised — never throws.
 */
export function formatCurrency(amount: number, currency: string | null | undefined): string {
  const ccy = currency ?? 'EUR'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: ccy,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${ccy}`
  }
}

/**
 * Per-room subtotal: qty * pricePerUnit * nights. Returns 0 when the
 * product has no price_per_unit (the widget then shows a "—" instead
 * of a number).
 */
export function roomSubtotal(
  product: Product,
  quantity: number,
  nights: number,
): number {
  if (!product.price_per_unit || quantity <= 0 || nights <= 0) return 0
  return Number(product.price_per_unit) * quantity * nights
}

/** Sum subtotals for every selected room. */
export function totalStayCost(
  rooms: RoomSelection[],
  products: Product[],
  nights: number,
): { amount: number; currency: string | null } {
  let amount = 0
  let currency: string | null = null
  const byId = new Map(products.map((p) => [p.product_id, p]))
  for (const room of rooms) {
    const product = byId.get(room.productId)
    if (!product) continue
    amount += roomSubtotal(product, room.quantity, nights)
    if (!currency && product.currency) currency = product.currency
  }
  return { amount, currency }
}

/**
 * Total bed capacity across the selected rooms (landr-qpab). For each
 * picked room we multiply quantity × capacity_per_unit. NULL/missing
 * capacity is treated as 1 — the lenient default while landr-knm0
 * backfills seeds; once every operator sets a value this fallback
 * still keeps legacy rooms bookable rather than asserting an invariant.
 */
export function totalRoomCapacity(
  rooms: RoomSelection[],
  products: Product[],
): number {
  const byId = new Map(products.map((p) => [p.product_id, p]))
  let total = 0
  for (const room of rooms) {
    const product = byId.get(room.productId)
    if (!product) continue
    const capacity = product.capacity_per_unit ?? 1
    total += capacity * room.quantity
  }
  return total
}

/**
 * Identify the set of add-on product ids that look like "breakfast"
 * line items (landr-qpab). Today we use a case-insensitive substring
 * match on the add-on display name because ProductAddon does not carry
 * a slug or a structural flag — see TODO. The Para42 seed names the
 * row 'Breakfast' across locales, so the heuristic catches it without
 * tripping on unrelated add-ons (Video Package etc.).
 *
 * TODO(landr-qpab): replace with a structural flag once add-ons grow
 * a category/kind field; the name match is a pragmatic starter that
 * keeps the overbook warning scoped to the obvious case without
 * blocking the wider epic on a schema migration.
 */
export function findBreakfastAddonIds(addons: ProductAddon[]): Set<string> {
  const ids = new Set<string>()
  for (const addon of addons) {
    if (/breakfast/i.test(addon.name)) {
      ids.add(addon.addon_product_id)
    }
  }
  return ids
}

/**
 * Sum the picked quantity across every add-on whose addon_product_id
 * is in `breakfastIds` (landr-qpab). Callers normally build the id
 * set via findBreakfastAddonIds(addonsForRoom).
 */
export function totalBreakfastQty(
  addonSelection: Record<string, number>,
  breakfastIds: Set<string>,
): number {
  let total = 0
  for (const id of breakfastIds) {
    total += addonSelection[id] ?? 0
  }
  return total
}
