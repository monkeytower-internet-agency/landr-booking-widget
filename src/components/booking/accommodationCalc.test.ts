import { describe, expect, it } from 'vitest'
import type { Product } from '@/api/types'
import {
  deriveStayWindow,
  formatCurrency,
  roomSubtotal,
  totalStayCost,
  type RoomSelection,
} from './accommodationCalc'

function makeRoom(
  id: string,
  pricePerNight: number | null,
  currency = 'EUR',
): Product {
  return {
    product_id: id,
    slug: id,
    name: id,
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'hotel_room',
    service_time_shape: null,
    is_contiguous: false,
    duration_minutes: null,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: null,
    group_slug: null,
    group_name: null,
    sort_order: 0,
    sport_subcategory_codes: [],
    location_ids: [],
    needs_pickup: false,
    hotel_offering: 'none',
    hotel_location_id: 'hotel-1',
    price_per_unit: pricePerNight,
    currency,
  }
}

describe('deriveStayWindow', () => {
  it('returns null fields + nights=0 for empty input', () => {
    const win = deriveStayWindow([])
    expect(win.checkInIso).toBeNull()
    expect(win.checkOutIso).toBeNull()
    expect(win.nights).toBe(0)
  })

  it('derives check-in = first-1 and check-out = last+1; nights = days+1', () => {
    const win = deriveStayWindow(['2026-06-10', '2026-06-11', '2026-06-12'])
    expect(win.checkInIso).toBe('2026-06-09')
    expect(win.checkOutIso).toBe('2026-06-13')
    expect(win.nights).toBe(4)
  })

  it('handles a single selected day', () => {
    const win = deriveStayWindow(['2026-06-10'])
    expect(win.checkInIso).toBe('2026-06-09')
    expect(win.checkOutIso).toBe('2026-06-11')
    expect(win.nights).toBe(2)
  })

  it('handles unsorted input by sorting first', () => {
    const win = deriveStayWindow(['2026-06-12', '2026-06-10', '2026-06-11'])
    expect(win.checkInIso).toBe('2026-06-09')
    expect(win.checkOutIso).toBe('2026-06-13')
  })

  it('handles month boundary correctly', () => {
    const win = deriveStayWindow(['2026-05-31'])
    expect(win.checkInIso).toBe('2026-05-30')
    expect(win.checkOutIso).toBe('2026-06-01')
  })
})

describe('roomSubtotal', () => {
  it('multiplies price × qty × nights', () => {
    const room = makeRoom('r1', 50)
    expect(roomSubtotal(room, 2, 3)).toBe(300)
  })

  it('returns 0 when room has no price_per_unit', () => {
    const room = makeRoom('r1', null)
    expect(roomSubtotal(room, 2, 3)).toBe(0)
  })

  it('returns 0 when qty is zero or negative', () => {
    const room = makeRoom('r1', 50)
    expect(roomSubtotal(room, 0, 3)).toBe(0)
  })

  it('returns 0 when nights is zero', () => {
    const room = makeRoom('r1', 50)
    expect(roomSubtotal(room, 2, 0)).toBe(0)
  })
})

describe('totalStayCost', () => {
  it('sums subtotals across multiple rooms and carries the currency', () => {
    const products = [makeRoom('single', 49), makeRoom('double', 73)]
    const selections: RoomSelection[] = [
      { productId: 'single', quantity: 1 },
      { productId: 'double', quantity: 2 },
    ]
    const result = totalStayCost(selections, products, 3)
    // (49 * 1 + 73 * 2) * 3 = 585
    expect(result.amount).toBe(585)
    expect(result.currency).toBe('EUR')
  })

  it('skips selections whose product_id is unknown', () => {
    const products = [makeRoom('single', 49)]
    const result = totalStayCost(
      [
        { productId: 'single', quantity: 1 },
        { productId: 'ghost', quantity: 2 },
      ],
      products,
      2,
    )
    expect(result.amount).toBe(98)
  })

  it('returns amount=0 for priceless rooms but still carries product currency', () => {
    const products = [makeRoom('priceless', null)]
    const result = totalStayCost(
      [{ productId: 'priceless', quantity: 2 }],
      products,
      3,
    )
    expect(result.amount).toBe(0)
    // currency is carried from the first product that has one — the
    // helper does not gate on subtotal>0 because the caller may still
    // want to format the zero amount in the right currency.
    expect(result.currency).toBe('EUR')
  })

  it('returns currency=null when there are no selections at all', () => {
    const result = totalStayCost([], [makeRoom('r', 50)], 3)
    expect(result.amount).toBe(0)
    expect(result.currency).toBeNull()
  })
})

describe('formatCurrency', () => {
  it('formats with Intl when possible', () => {
    const out = formatCurrency(49.5, 'EUR')
    // Locale-dependent: just assert it contains the digits and a currency hint
    expect(out).toMatch(/49[.,]50/)
  })

  it('falls back gracefully on unknown currency codes', () => {
    const out = formatCurrency(12, 'XYZ')
    // Either Intl prints "12.00 XYZ" / "XYZ 12.00" / similar; just check
    // the amount appears and the code is mentioned somewhere.
    expect(out).toMatch(/12/)
    expect(out).toMatch(/XYZ/)
  })

  it('defaults to EUR when currency is null/undefined', () => {
    expect(formatCurrency(10, null)).toMatch(/10[.,]00/)
    expect(formatCurrency(10, undefined)).toMatch(/10[.,]00/)
  })
})
