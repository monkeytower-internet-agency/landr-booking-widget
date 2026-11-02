import type { EvaluatedOffer } from '@/api/types'
import type { PartyMember } from './offerCart'

export const STAY_DAYS = ['2026-11-02', '2026-11-03', '2026-11-04']

export const PARTY: PartyMember[] = [
  { key: 'm1', ref: 'g1', name: 'Ada Lovelace', attributes: {} },
  { key: 'm2', ref: 'g2', name: 'Bo Berg', attributes: {} },
]

/** An evaluated offer with sane defaults (booking-bound, locked, optional, online). */
export function evalOffer(id: string, over: Partial<EvaluatedOffer> = {}): EvaluatedOffer {
  return {
    id,
    parent_product_id: 'stay',
    product_id: `p-${id}`,
    rules: {},
    binding: 'booking',
    schedule: 'locked',
    collection: 'online',
    mode: 'optional',
    min_qty: 1,
    sort_order: 0,
    name: id,
    product_kind: 'service',
    in_cart: false,
    draft: false,
    ...over,
  }
}
