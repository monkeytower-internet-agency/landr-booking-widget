/**
 * landr-d8rg.6: pure presentation helpers for the product catalogue cards /
 * rows. Kept in a sibling .ts file (no component export) so the
 * react-refresh/only-export-components ESLint gate stays happy — same
 * convention as priceSidebarHelpers.ts / accommodationCalc.ts.
 *
 * Both the grid card and the list row read their display strings from here
 * so the two layouts stay byte-for-byte consistent (price formatting,
 * localized name/description pick, the duration/kind chip rule, the image
 * source choice). The orchestrating ProductList only fetches + lays out.
 */
import type { Product } from '@/api/types'
import { pickLocalized } from '@/lib/locale'
import { formatMoney } from '@/components/booking/priceSidebarHelpers'

/** Localized product name, falling back to the base `name` field. */
export function productName(product: Product, locale: string): string {
  return pickLocalized(product.name, product.name_localized, locale)
}

/**
 * Localized short description (the catalogue blurb). Returns '' when the
 * operator supplied none — callers gate rendering on a truthy result.
 */
export function productShortDescription(
  product: Product,
  locale: string,
): string {
  return pickLocalized(
    product.short_description,
    product.short_description_localized,
    locale,
  )
}

/**
 * The "from €X" price label, or null when no base rate can be derived
 * (price_from null/undefined during the rolling API deploy, or tier-only
 * schemes the API can't reduce to a single rate). NEVER renders for a
 * 0 / empty / non-finite value — "from €0.00" would be misleading.
 *
 * Reuses PriceSidebar's formatMoney so the symbol + decimals match every
 * other figure in the widget. Currency falls back to EUR (the only
 * currency the platform bills in today) when the product omits it.
 */
export function productPriceLabel(product: Product): string | null {
  const raw = product.price_from
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return `from ${formatMoney(raw, product.currency ?? 'EUR')}`
}

/**
 * Whether this product carries a usable thumbnail. thumb_url is optional
 * during the rolling API deploy (treated as null) and an empty string is
 * treated as "no image" so the designed ProductArt fallback shows instead
 * of a broken <img>.
 */
export function hasThumb(product: Product): boolean {
  return typeof product.thumb_url === 'string' && product.thumb_url.length > 0
}

/**
 * Alt text for a product thumbnail: the first uploaded image's alt when set,
 * else the product name (never empty so the <img> is always labelled).
 */
export function thumbAlt(product: Product, name: string): string {
  const firstAlt = product.images?.[0]?.alt
  return firstAlt && firstAlt.length > 0 ? firstAlt : name
}

/**
 * The primary "meta" chip text shown on a card, or null when there is
 * nothing meaningful to show.
 *
 * Rules (preserved from the pre-d8rg.6 ProductList exactly so the existing
 * landr-7jgo chip tests stay green):
 *   - duration_minutes present → "{n} min"
 *   - else service kind        → the date-model shape ("days range") ONLY when
 *                                showDateModel is true (dev/staging); otherwise
 *                                the generic "service" label (production)
 *   - else (shop kinds)        → the humanised product_kind ("digital good")
 *
 * `showDateModel` is passed in (not read here) so this stays a pure function —
 * the caller wires showDateModelDetail() from @/lib/tier.
 */
export function productMetaChip(
  product: Product,
  showDateModel: boolean,
): string | null {
  if (product.duration_minutes) return `${product.duration_minutes} min`
  if (product.product_kind === 'service') {
    return showDateModel
      ? (product.service_time_shape ?? 'service').replace('_', ' ')
      : 'service'
  }
  return product.product_kind.replace('_', ' ')
}

/**
 * A SECONDARY kind badge for non-service products that ALSO carry a duration
 * (so the duration chip is the meta chip and the kind would otherwise be
 * lost). Returns null for service products (the meta chip already conveys
 * "service") and for non-service products WITHOUT a duration (the meta chip
 * is already the kind, so a second identical badge would be redundant).
 */
export function productKindBadge(product: Product): string | null {
  if (product.product_kind === 'service') return null
  if (!product.duration_minutes) return null
  return product.product_kind.replace('_', ' ')
}
