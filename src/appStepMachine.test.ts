import { describe, expect, it } from 'vitest'

import type { Product } from '@/api/types'
import type { BookingSelection } from '@/components/booking/BookingForm'
import { stepAfterAccommodation } from './appStepMachine'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    product_id: 'p-1',
    slug: 'p-1',
    name: 'Test Product',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'time_slot',
    is_contiguous: false,
    duration_minutes: 30,
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
    ...overrides,
  }
}

const SLOT_SELECTION: BookingSelection = {
  kind: 'slot',
  slot: {
    availability_id: 'a-1',
    date: '2026-05-20',
    start_time: '09:00',
    end_time: '10:00',
    capacity: 4,
    capacity_reserved: 0,
    available_seats: 4,
    status: 'open',
  },
}

describe('stepAfterAccommodation (landr-4r80)', () => {
  it('routes to fill-form with pickup_location_id pre-set when a hotel was booked, skipping pick-pickup', () => {
    // The customer chose Hotel Mirador (loc-hotel-mirador). Even though
    // needs_pickup=true on the product, Martin's bus picks up AT the
    // hotel — so we must NOT show pick-pickup and instead lock the
    // pickup to the hotel's location row.
    const product = makeProduct({
      needs_pickup: true,
      hotel_offering: 'optional',
    })
    const next = stepAfterAccommodation(
      product,
      SLOT_SELECTION,
      1,
      [{ productId: 'room-1', quantity: 2 }],
      'loc-hotel-mirador',
    )
    expect(next.name).toBe('fill-form')
    if (next.name !== 'fill-form') throw new Error('narrowing')
    expect(next.pickupLocationId).toBe('loc-hotel-mirador')
    expect(next.accommodationRooms).toEqual([
      { productId: 'room-1', quantity: 2 },
    ])
    expect(next.participantCount).toBe(1)
  })

  it('routes to pick-pickup when no hotel was booked and the product needs a pickup', () => {
    // Optional hotel + customer said "No". Existing behaviour: pickup
    // must still be picked from the operator's pickup-role locations.
    const product = makeProduct({
      needs_pickup: true,
      hotel_offering: 'optional',
    })
    const next = stepAfterAccommodation(product, SLOT_SELECTION, 3, [], null)
    expect(next.name).toBe('pick-pickup')
    if (next.name !== 'pick-pickup') throw new Error('narrowing')
    expect(next.participantCount).toBe(3)
  })

  it('routes to fill-form with pickup_location_id=null when no hotel and no pickup needed', () => {
    const product = makeProduct({
      needs_pickup: false,
      hotel_offering: 'none',
    })
    const next = stepAfterAccommodation(product, SLOT_SELECTION, 2, [], null)
    expect(next.name).toBe('fill-form')
    if (next.name !== 'fill-form') throw new Error('narrowing')
    expect(next.pickupLocationId).toBeNull()
    expect(next.participantCount).toBe(2)
  })

  it('hotel-booked wins over needs_pickup=false (still locks pickup to the hotel)', () => {
    // Edge case: product doesn't normally need a pickup, but the
    // customer booked a hotel anyway. The hotel still becomes the
    // pickup_location_id because that's where the customer is — the
    // operator can decide downstream whether they actually dispatch
    // a vehicle. Keeping the routing consistent avoids surprising
    // back-end branches.
    const product = makeProduct({
      needs_pickup: false,
      hotel_offering: 'optional',
    })
    const next = stepAfterAccommodation(
      product,
      SLOT_SELECTION,
      4,
      [{ productId: 'room-1', quantity: 1 }],
      'loc-hotel-x',
    )
    expect(next.name).toBe('fill-form')
    if (next.name !== 'fill-form') throw new Error('narrowing')
    expect(next.pickupLocationId).toBe('loc-hotel-x')
    expect(next.participantCount).toBe(4)
  })

  it('threads participantCount through all branches (landr-mbge)', () => {
    // Sanity check: every shape returned by stepAfterAccommodation
    // carries participantCount so downstream steps (sidebar pricing,
    // overbook warning, submit payload) all see the same number.
    const cases = [
      { hotelLocationId: 'h-1', needs_pickup: true, expected: 'fill-form' },
      { hotelLocationId: null, needs_pickup: true, expected: 'pick-pickup' },
      { hotelLocationId: null, needs_pickup: false, expected: 'fill-form' },
    ] as const
    for (const c of cases) {
      const product = makeProduct({
        needs_pickup: c.needs_pickup,
        hotel_offering: 'optional',
      })
      const next = stepAfterAccommodation(
        product,
        SLOT_SELECTION,
        5,
        [],
        c.hotelLocationId,
      )
      expect(next.name).toBe(c.expected)
      if (next.name === 'fill-form' || next.name === 'pick-pickup') {
        expect(next.participantCount).toBe(5)
      }
    }
  })
})
