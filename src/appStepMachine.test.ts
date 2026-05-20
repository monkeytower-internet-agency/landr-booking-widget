import { describe, expect, it } from 'vitest'

import type { Product } from '@/api/types'
import type { BookingSelection } from '@/components/booking/BookingForm'
import type {
  BookerDetails,
  ParticipantDetails,
} from '@/components/booking/detailsTypes'
import { sidebarInputsForStep, stepAfterAccommodation } from './appStepMachine'

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

const ADA: BookerDetails = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone: '+34 600000000',
}

function makeParticipants(n: number): ParticipantDetails[] {
  const rows: ParticipantDetails[] = [
    {
      first_name: ADA.first_name,
      last_name: ADA.last_name,
      email: ADA.email,
      phone: ADA.phone,
    },
  ]
  for (let i = 1; i < n; i += 1) {
    rows.push({
      first_name: `P${i + 1}`,
      last_name: 'Doe',
      email: '',
      phone: '',
    })
  }
  return rows
}

describe('stepAfterAccommodation (landr-4r80 + landr-8c03)', () => {
  it('routes to fill-form with pickup_location_id pre-set when a hotel was booked, skipping pick-pickup', () => {
    const product = makeProduct({
      needs_pickup: true,
      hotel_offering: 'optional',
    })
    const next = stepAfterAccommodation(
      product,
      SLOT_SELECTION,
      ADA,
      makeParticipants(1),
      [{ productId: 'room-1', quantity: 2 }],
      'loc-hotel-mirador',
    )
    expect(next.name).toBe('fill-form')
    if (next.name !== 'fill-form') throw new Error('narrowing')
    expect(next.pickupLocationId).toBe('loc-hotel-mirador')
    expect(next.accommodationRooms).toEqual([
      { productId: 'room-1', quantity: 2 },
    ])
    expect(next.booker).toEqual(ADA)
    expect(next.participants).toHaveLength(1)
  })

  it('routes to pick-pickup when no hotel was booked and the product needs a pickup', () => {
    const product = makeProduct({
      needs_pickup: true,
      hotel_offering: 'optional',
    })
    const next = stepAfterAccommodation(
      product,
      SLOT_SELECTION,
      ADA,
      makeParticipants(3),
      [],
      null,
    )
    expect(next.name).toBe('pick-pickup')
    if (next.name !== 'pick-pickup') throw new Error('narrowing')
    expect(next.participants).toHaveLength(3)
    expect(next.booker).toEqual(ADA)
  })

  it('routes to fill-form with pickup_location_id=null when no hotel and no pickup needed', () => {
    const product = makeProduct({
      needs_pickup: false,
      hotel_offering: 'none',
    })
    const next = stepAfterAccommodation(
      product,
      SLOT_SELECTION,
      ADA,
      makeParticipants(2),
      [],
      null,
    )
    expect(next.name).toBe('fill-form')
    if (next.name !== 'fill-form') throw new Error('narrowing')
    expect(next.pickupLocationId).toBeNull()
    expect(next.participants).toHaveLength(2)
  })

  it('hotel-booked wins over needs_pickup=false (still locks pickup to the hotel)', () => {
    const product = makeProduct({
      needs_pickup: false,
      hotel_offering: 'optional',
    })
    const next = stepAfterAccommodation(
      product,
      SLOT_SELECTION,
      ADA,
      makeParticipants(4),
      [{ productId: 'room-1', quantity: 1 }],
      'loc-hotel-x',
    )
    expect(next.name).toBe('fill-form')
    if (next.name !== 'fill-form') throw new Error('narrowing')
    expect(next.pickupLocationId).toBe('loc-hotel-x')
    expect(next.participants).toHaveLength(4)
  })

  it('threads booker + participants through every branch (landr-8c03)', () => {
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
        ADA,
        makeParticipants(5),
        [],
        c.hotelLocationId,
      )
      expect(next.name).toBe(c.expected)
      if (next.name === 'fill-form' || next.name === 'pick-pickup') {
        expect(next.participants).toHaveLength(5)
        expect(next.booker).toEqual(ADA)
      }
    }
  })
})

describe('sidebarInputsForStep (landr-8c03 — participant names threaded through)', () => {
  it('returns empty participantNames before DetailsStep has confirmed', () => {
    const product = makeProduct()
    const inputs = sidebarInputsForStep({
      name: 'details',
      product,
      selection: SLOT_SELECTION,
    })
    expect(inputs?.participantNames).toEqual([])
    expect(inputs?.participantCount).toBe(1)
  })

  it('surfaces participant first names downstream of DetailsStep', () => {
    const product = makeProduct()
    const inputs = sidebarInputsForStep({
      name: 'pick-accommodation',
      product,
      selection: SLOT_SELECTION,
      booker: ADA,
      participants: [
        { first_name: 'Ada', last_name: 'L', email: '', phone: '' },
        { first_name: 'Grace', last_name: 'H', email: '', phone: '' },
        { first_name: '', last_name: '', email: '', phone: '' },
      ],
    })
    // Empty names filtered out.
    expect(inputs?.participantNames).toEqual(['Ada', 'Grace'])
    expect(inputs?.participantCount).toBe(3)
  })
})
