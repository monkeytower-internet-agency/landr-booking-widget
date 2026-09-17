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
import {
  joinLanguageNames,
  languageFlag,
  productDisplayLanguages,
} from '@/components/booking/participantLanguages'

/** landr-pv2r1: flags shown on the catalogue chip before collapsing to "+N". */
export const LANGUAGE_CHIP_MAX_FLAGS = 5

/**
 * landr-pv2r1 (epic decision E4): the compact languages chip on the
 * catalogue card / row — flag emojis only (phone-width rows cannot fit
 * names), with the full English names in `label` for `title` +
 * `aria-label`. `flags` is capped at LANGUAGE_CHIP_MAX_FLAGS; `codes` is the
 * full list so the caller can render the "+N" overflow. null for an "any
 * language" product (`[]`), NULL or absent guide_languages — the DEFAULT
 * fallback set is never advertised.
 */
export function productLanguagesChip(
  product: Product,
): { flags: string[]; codes: string[]; label: string } | null {
  const codes = productDisplayLanguages(product.guide_languages)
  if (codes.length === 0) return null
  return {
    flags: codes.slice(0, LANGUAGE_CHIP_MAX_FLAGS).map(languageFlag),
    codes,
    label: `Offered in ${joinLanguageNames(codes)}`,
  }
}

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
 * landr-821d6.7: the operator's own category name, localized — or null
 * when the product carries no category yet (rolling deploy). Shared by
 * productMetaChip/productKindBadge below so both chips prefer the
 * operator's own wording, service categories included (e.g. a "Classroom"
 * category on a service/time_slot product), over the raw kind/time-shape
 * text.
 */
function categoryLabel(product: Product, locale: string): string | null {
  if (!product.category_name) return null
  return pickLocalized(product.category_name, product.category_name_localized, locale)
}

/**
 * The primary "meta" chip text shown on a card, or null when there is
 * nothing meaningful to show.
 *
 * Rules (preserved from the pre-d8rg.6 ProductList exactly so the existing
 * landr-7jgo chip tests stay green, EXCEPT the operator-category override
 * added by landr-821d6.7):
 *   - duration_minutes present  → "{n} min" (category doesn't override
 *                                 this — duration is independent scheduling
 *                                 info, not a type label)
 *   - else category_name present → the operator's own category name,
 *                                 localized (service categories included —
 *                                 this is what replaces the "service"/
 *                                 date-model-shape branch below once the
 *                                 product has a category)
 *   - else service kind         → the date-model shape ("days range") ONLY when
 *                                 showDateModel is true (dev/staging); otherwise
 *                                 the generic "service" label (production)
 *   - else (shop kinds)         → the humanised product_kind ("digital good")
 *
 * `showDateModel` is passed in (not read here) so this stays a pure function —
 * the caller wires showDateModelDetail() from @/lib/tier.
 */
export function productMetaChip(
  product: Product,
  showDateModel: boolean,
  locale: string,
): string | null {
  if (product.duration_minutes) return `${product.duration_minutes} min`
  const category = categoryLabel(product, locale)
  if (category) return category
  if (product.product_kind === 'service') {
    return showDateModel
      ? (product.service_time_shape ?? 'service').replace('_', ' ')
      : 'service'
  }
  return product.product_kind.replace('_', ' ')
}

/**
 * A SECONDARY badge shown ONLY when duration_minutes already took the meta
 * chip slot above (otherwise the meta chip itself already shows the
 * category/kind and a second identical badge would be redundant).
 *
 * landr-821d6.7: when the product carries a category, this badge shows it
 * — service categories INCLUDED (a service product with both a duration
 * and a category, e.g. a 90-minute "Classroom" session, needs the badge to
 * surface "Classroom" since the meta chip is busy with "90 min"). Falls
 * back to the pre-821d6.7 rule (raw kind, non-service only) when no
 * category is set yet.
 */
export function productKindBadge(product: Product, locale: string): string | null {
  if (!product.duration_minutes) return null
  const category = categoryLabel(product, locale)
  if (category) return category
  if (product.product_kind === 'service') return null
  return product.product_kind.replace('_', ' ')
}
