/**
 * Small pure helpers that let a standalone stay (product_kind 'stay') ride the
 * existing booking funnel: the party cap and the guest language.
 */
import type { Product } from '@/api/types'
import { browserLocale } from '@/lib/locale'

/**
 * Most guests one stay booking may carry: what the unit sleeps, never above
 * the product's own `max_party_size` when that is set. null when nothing caps
 * it (not a stay, or a stay without a sleeps count).
 */
export function stayPartyCap(product: Pick<Product, 'product_kind' | 'stay' | 'max_party_size'>): number | null {
  if (product.product_kind !== 'stay') return null
  const sleeps = product.stay?.sleeps
  if (typeof sleeps !== 'number' || sleeps < 1) return null
  const own = product.max_party_size
  return typeof own === 'number' && own >= 1 ? Math.min(sleeps, own) : sleeps
}

/**
 * The product as the participants step should see it: a stay's
 * `max_party_size` becomes min(sleeps, max_party_size). Every other product
 * comes back unchanged (same reference).
 */
export function withStayPartyCap(product: Product): Product {
  const cap = stayPartyCap(product)
  if (cap === null || product.max_party_size === cap) return product
  return { ...product, max_party_size: cap }
}

/**
 * A stay has no guide, so there is no language to assign: a stay-only cart
 * carries NO participant language (the API requires one only when the cart
 * has a service line). Kept as a function so every call site reads one answer.
 */
export function stayGuestLanguages(): string[] {
  return []
}

/**
 * Promotion-skew fallback. An API that predates the "no participant language
 * on a stay-only cart" rule answers a stay submit with a typed
 * `participant_language_missing` 422. Only then is the customer's own UI
 * language copied onto every participant and the retry sent once; against a
 * current API the first submit succeeds and this never runs.
 */
export function withFallbackGuestLanguage<
  B extends { participants: Array<object>; customer_languages?: string[] | null },
>(body: B, locale: string = browserLocale()): B {
  const base = (locale || '').trim().toLowerCase().slice(0, 2)
  const language = /^[a-z]{2}$/.test(base) ? base : 'en'
  return {
    ...body,
    participants: body.participants.map((p) => ({ ...p, language })),
    customer_languages: [language],
  } as B
}
