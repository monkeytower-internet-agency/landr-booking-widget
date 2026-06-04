/**
 * landr-d8rg.7: "from €X" price label for the product-detail page.
 *
 * The public products contract (epic landr-d8rg, contract D) ships
 * `price_from` as a decimal string WITHOUT a currency symbol (e.g.
 * "59.00") and `currency` as an ISO-4217 code (e.g. "EUR"). This helper
 * turns the pair into the customer-facing "from €59.00" string.
 *
 * Formatting is delegated to PriceSidebar's `formatMoney` so the "from"
 * figure on the detail page is byte-for-byte identical to every other
 * price the widget renders (same Intl.NumberFormat locale + currency
 * rules, same graceful fallback for unknown currency codes). When the
 * product carries no currency we default to 'EUR' — the widget is
 * single-currency-per-operator and every seeded operator is EUR.
 *
 * Returns null when `price_from` is null/undefined/blank so callers can
 * omit the line entirely (the contract hides "from" when the rate is not
 * derivable). Kept in a sibling .ts file (no component export) so the
 * react-refresh/only-export-components CI gate stays happy.
 */
import { formatMoney } from '@/components/booking/priceSidebarHelpers'

export function formatPriceFrom(
  priceFrom: string | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (priceFrom == null) return null
  const trimmed = priceFrom.trim()
  if (trimmed.length === 0) return null
  return `from ${formatMoney(trimmed, currency || 'EUR')}`
}
