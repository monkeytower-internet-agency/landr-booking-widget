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
 * A stay has no guide, so there is no language to choose: its guests carry
 * the customer's own UI language (one offered language skips the step and is
 * auto-filled at review). Falls back to English for anything that is not a
 * plain two-letter code.
 */
export function stayGuestLanguages(locale: string = browserLocale()): string[] {
  const base = (locale || '').trim().toLowerCase().slice(0, 2)
  return [/^[a-z]{2}$/.test(base) ? base : 'en']
}
