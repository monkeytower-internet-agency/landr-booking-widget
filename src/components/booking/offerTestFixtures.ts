/** Test fixtures for offer lines (shared by the BookingForm suites). */
import type { EvaluatedOffer } from '@/api/types'
import { newPick, type OfferPick } from './offerCart'

export function makeOffer(over: Partial<EvaluatedOffer> = {}): EvaluatedOffer {
  return {
    id: 'offer-1',
    parent_product_id: null,
    product_id: 'extra-1',
    rules: { mode: 'all', items: [] },
    binding: 'booking',
    schedule: 'locked',
    collection: 'online',
    mode: 'optional',
    options: [],
    required_attributes: [],
    min_qty: 0,
    max_qty: null,
    sort_order: 0,
    name: 'Extra',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    product_kind: 'service',
    day_selection: null,
    in_cart: false,
    price_preview: null,
    stock: null,
    server_attached: false,
    draft: false,
    ...over,
  }
}

/** A pick of `offer` under `parentLineId` (a room type's line is `r-<roomId>`). */
export function makePick(
  offer: EvaluatedOffer,
  parentLineId: string,
  lineId: string,
  over: Partial<OfferPick> = {},
): OfferPick {
  return { ...newPick(offer, parentLineId, lineId, []), ...over }
}

/** A room type's breakfast: a `free` pick with a quantity. */
export function breakfastPick(roomId: string, quantity: number, productId = 'breakfast-1', lineId = 'a1'): OfferPick {
  const offer = makeOffer({
    id: `offer-${productId}`,
    product_id: productId,
    binding: 'free',
    min_qty: 0,
    name: 'Breakfast',
    product_kind: 'hotel_room',
  })
  return makePick(offer, `r-${roomId}`, lineId, { quantity })
}
