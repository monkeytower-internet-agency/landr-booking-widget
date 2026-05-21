import { describe, expect, it } from 'vitest'
import type { Product, ProductAddon } from '@/api/types'
import {
  deriveStayWindow,
  findBreakfastAddonIds,
  formatCurrency,
  roomSubtotal,
  stayNightIsos,
  totalBreakfastQty,
  totalRoomCapacity,
  totalStayCost,
  type RoomSelection,
} from './accommodationCalc'

function makeRoom(
  id: string,
  pricePerNight: number | null,
  currency = 'EUR',
  capacityPerUnit: number | null = null,
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
    capacity_per_unit: capacityPerUnit,
  }
}

function makeAddon(
  addonProductId: string,
  name: string,
): ProductAddon {
  return {
    product_addon_id: `pa-${addonProductId}`,
    addon_product_id: addonProductId,
    name,
    name_localized: null,
    is_required: false,
    min_qty: 0,
    max_qty: null,
    sort_order: 0,
    price_per_unit: null,
    currency: null,
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

  // landr-ma5n: non-contiguous selections must count nights by SPAN
  // (last - first + 2), not by selectedDays.length + 1. The hotel
  // window is continuous from check-in to check-out — the customer does
  // not vacate the room on the gap day. Pre-fix this returned 3 nights
  // for [25, 27] which under-charged the operator by 1 night.
  it('counts nights by span for non-contiguous selections (landr-ma5n)', () => {
    const win = deriveStayWindow(['2026-05-25', '2026-05-27'])
    expect(win.checkInIso).toBe('2026-05-24')
    expect(win.checkOutIso).toBe('2026-05-28')
    expect(win.nights).toBe(4)
  })

  it('counts nights by span for multi-gap non-contiguous selections (landr-ma5n)', () => {
    // [Mon, Wed, Thu] — gap on Tuesday, then Wed-Thu contiguous. Hotel
    // span = Sun → Fri = 5 nights, NOT 4 (selectedDays.length + 1).
    const win = deriveStayWindow(['2026-05-25', '2026-05-27', '2026-05-28'])
    expect(win.checkInIso).toBe('2026-05-24')
    expect(win.checkOutIso).toBe('2026-05-29')
    expect(win.nights).toBe(5)
  })

  it('keeps deriveStayWindow.nights consistent with stayNightIsos.length (landr-ma5n)', () => {
    // Regression guard: before the fix, deriveStayWindow.nights and
    // stayNightIsos disagreed on non-contiguous input (the latter
    // already walked the full span). Lock them in step.
    const cases: string[][] = [
      ['2026-06-10', '2026-06-11', '2026-06-12'],
      ['2026-06-10'],
      ['2026-05-25', '2026-05-27'],
      ['2026-05-25', '2026-05-27', '2026-05-28'],
      ['2026-05-25', '2026-05-30'],
    ]
    for (const days of cases) {
      const win = deriveStayWindow(days)
      expect(win.nights).toBe(stayNightIsos(days).length)
    }
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

describe('totalRoomCapacity (landr-qpab)', () => {
  it('sums qty × capacity_per_unit across selections', () => {
    const products = [
      makeRoom('single', 49, 'EUR', 1),
      makeRoom('double', 73, 'EUR', 2),
    ]
    const selections: RoomSelection[] = [
      { productId: 'single', quantity: 2 },
      { productId: 'double', quantity: 1 },
    ]
    // 2*1 + 1*2 = 4
    expect(totalRoomCapacity(selections, products)).toBe(4)
  })

  it('treats missing capacity_per_unit as 1 (lenient default)', () => {
    const products = [makeRoom('legacy', 49, 'EUR', null)]
    expect(
      totalRoomCapacity([{ productId: 'legacy', quantity: 3 }], products),
    ).toBe(3)
  })

  it('returns 0 when no rooms are selected', () => {
    const products = [makeRoom('single', 49, 'EUR', 1)]
    expect(totalRoomCapacity([], products)).toBe(0)
  })

  it('skips selections whose product_id is unknown', () => {
    const products = [makeRoom('single', 49, 'EUR', 1)]
    const selections: RoomSelection[] = [
      { productId: 'single', quantity: 1 },
      { productId: 'ghost', quantity: 5 },
    ]
    expect(totalRoomCapacity(selections, products)).toBe(1)
  })
})

describe('findBreakfastAddonIds (landr-qpab)', () => {
  it('matches add-ons whose name contains "breakfast" (case-insensitive)', () => {
    const ids = findBreakfastAddonIds([
      makeAddon('a1', 'Breakfast'),
      makeAddon('a2', 'BREAKFAST'),
      makeAddon('a3', 'Continental breakfast'),
      makeAddon('a4', 'Video Package'),
    ])
    expect(ids.has('a1')).toBe(true)
    expect(ids.has('a2')).toBe(true)
    expect(ids.has('a3')).toBe(true)
    expect(ids.has('a4')).toBe(false)
    expect(ids.size).toBe(3)
  })

  it('returns an empty set when no add-ons match', () => {
    const ids = findBreakfastAddonIds([
      makeAddon('a1', 'Video Package'),
      makeAddon('a2', 'Photo Package'),
    ])
    expect(ids.size).toBe(0)
  })
})

describe('totalBreakfastQty (landr-qpab)', () => {
  it('sums picked qty across matching ids', () => {
    const ids = new Set(['bf-1', 'bf-2'])
    const selection = { 'bf-1': 2, 'bf-2': 3, 'video': 5 }
    expect(totalBreakfastQty(selection, ids)).toBe(5)
  })

  it('returns 0 when no breakfast addon is selected', () => {
    expect(totalBreakfastQty({}, new Set(['bf-1']))).toBe(0)
  })
})
