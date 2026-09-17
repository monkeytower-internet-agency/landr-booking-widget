/**
 * landr-d8rg.7: derive the product-detail "facts" chips from a Product.
 *
 * Pure data — no JSX — so the conditional rules are unit-testable in
 * isolation and the component file stays component-only (the
 * react-refresh/only-export-components CI gate). ProductFacts.tsx maps
 * each fact's `icon` key to a lucide icon.
 *
 * Rules (per slice spec):
 *   - duration_minutes → "25 min" (< 60) or "2 h" / "1.5 h" (≥ 60).
 *   - hotel_offering !== 'none' → "Hotel optional" (optional) or
 *     "Hotel included" (mandatory — the room is part of the package).
 *   - needs_pickup → "Pickup available".
 *   - category_name present → the operator's own category name
 *     (landr-821d6.7 — localized via `locale`), for ANY product_kind
 *     INCLUDING 'service' (e.g. a "Classroom" category on a
 *     service/time_slot product) — the whole point of operator-named
 *     categories is that they replace kind-based branching for display.
 *   - else product_kind !== 'service' → a humanised kind label ("Gift
 *     card", "Digital good", …) — the pre-821d6.7 fallback for a product
 *     that carries no category yet (rolling deploy). Service products
 *     with no category still carry no kind chip — their shape is
 *     conveyed by the other facts.
 *   - landr-pv2r1 (E4): guide_languages with ≥1 usable code → a languages
 *     fact, ALWAYS LAST, carrying the codes (order preserved) so the
 *     component can render flag + English name per language. An "any
 *     language" product (`[]`), NULL and absent get no fact — the DEFAULT
 *     fallback set is never advertised.
 */
import type { Product } from '@/api/types'
import { pickLocalized } from '@/lib/locale'
import { languageName, productDisplayLanguages } from '../participantLanguages'

/** Icon keys ProductFacts.tsx maps to lucide-react icons. */
export type FactIcon = 'duration' | 'hotel' | 'pickup' | 'kind' | 'languages'

export interface ProductFact {
  icon: FactIcon
  label: string
  /** landr-pv2r1: ISO 639-1 codes, set only on the `languages` fact. */
  languages?: string[]
}

/**
 * Humanise duration in minutes. Under an hour: "25 min". An hour or
 * more: hours with up to one decimal, "2 h" / "1.5 h" (trailing ".0"
 * stripped so a clean 120 min reads "2 h", not "2.0 h").
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = minutes / 60
  const rounded = Math.round(hours * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `${text} h`
}

/** Title-case a snake_case product kind, e.g. 'gift_card' → 'Gift card'. */
function humaniseKind(kind: string): string {
  const spaced = kind.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function deriveProductFacts(product: Product, locale: string): ProductFact[] {
  const facts: ProductFact[] = []

  if (product.duration_minutes != null && product.duration_minutes > 0) {
    facts.push({
      icon: 'duration',
      label: formatDuration(product.duration_minutes),
    })
  }

  const hotel = product.hotel_offering
  if (hotel && hotel !== 'none') {
    facts.push({
      icon: 'hotel',
      label: hotel === 'mandatory' ? 'Hotel included' : 'Hotel optional',
    })
  }

  if (product.needs_pickup) {
    facts.push({ icon: 'pickup', label: 'Pickup available' })
  }

  const categoryLabel = product.category_name
    ? pickLocalized(product.category_name, product.category_name_localized, locale)
    : ''
  if (categoryLabel) {
    facts.push({ icon: 'kind', label: categoryLabel })
  } else if (product.product_kind !== 'service') {
    facts.push({ icon: 'kind', label: humaniseKind(product.product_kind) })
  }

  const languages = productDisplayLanguages(product.guide_languages)
  if (languages.length > 0) {
    facts.push({
      icon: 'languages',
      label: languages.map(languageName).join(' · '),
      languages,
    })
  }

  return facts
}
