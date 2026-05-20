/**
 * Pure helpers for PriceSidebar (landr-qez0). Kept in a sibling .ts
 * file so the react-refresh/only-export-components ESLint rule stays
 * happy — see accommodationCalc.ts / dateLabel.ts for the same pattern.
 */
import type { EstimateAddonLine, EstimateLineItem } from '@/api/types'
import type { RoomSelection } from './accommodationCalc'
import type { AddonSelection } from './addonsState'

/**
 * Merge the room selections (hotel_room products) and add-on selections
 * (services like Breakfast / Video Package) into the single addon_lines
 * array the estimate endpoint expects. Rooms and add-ons are equivalent
 * on the wire — both become extra booking_products rows under the
 * parent service line — so the estimate just takes a flat list with
 * `{product_id, qty}` per entry.
 *
 * Filters out qty <= 0 to avoid sending opt-outs as zero-qty rows
 * (the FastAPI request schema rejects qty < 1, and the route would
 * 400 the entire estimate if even one line had qty=0).
 */
export function buildAddonLines(
  rooms: RoomSelection[],
  addons: AddonSelection[],
): EstimateAddonLine[] {
  const lines: EstimateAddonLine[] = []
  for (const room of rooms) {
    if (room.quantity > 0) {
      lines.push({ product_id: room.productId, qty: room.quantity })
    }
  }
  for (const addon of addons) {
    if (addon.quantity > 0) {
      lines.push({ product_id: addon.productId, qty: addon.quantity })
    }
  }
  return lines
}

/**
 * Format a decimal-string amount (e.g. "180.00") as a currency string
 * (e.g. "€180.00"). The estimate endpoint returns line totals + grand
 * totals as decimal strings to avoid float precision drift; the
 * sidebar converts them for display only. Falls back to "{amount} {ccy}"
 * when Intl.NumberFormat can't handle the currency code (never throws).
 */
export function formatMoney(amount: string, currency: string): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return `${amount} ${currency}`
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `${n.toFixed(2)} ${currency}`
  }
}

/** Partition the line items into operator-paid vs hotel-paid groups. */
export function splitLineItems(items: EstimateLineItem[]): {
  operator: EstimateLineItem[]
  hotel: EstimateLineItem[]
} {
  const operator: EstimateLineItem[] = []
  const hotel: EstimateLineItem[] = []
  for (const li of items) {
    if (li.paid_to === 'hotel') hotel.push(li)
    else operator.push(li)
  }
  return { operator, hotel }
}

/** rule kinds that the sidebar surfaces as little discount tags. */
const DISCOUNT_RULE_KINDS = new Set([
  'per_total_days_tier',
  'per_streak_tier',
  'voucher_percent',
  'voucher_fixed',
])

/** True when this applied_rules entry should render as a sidebar tag. */
export function isDiscountRule(kind: string): boolean {
  return DISCOUNT_RULE_KINDS.has(kind)
}
