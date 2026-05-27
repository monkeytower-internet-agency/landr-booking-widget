import { describe, expect, it } from 'vitest'

import type { Product } from '@/api/types'
import type { BookingSelection } from '@/components/booking/BookingForm'
import type {
  BookerDetails,
  CompanionDetails,
  ParticipantDetails,
} from '@/components/booking/detailsTypes'
import {
  deriveAccommodationMode,
  sidebarInputsForStep,
  stepAfterAccommodation,
  stepBeforeReview,
} from './appStepMachine'

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
      // landr-mg0a: empty role code is fine here — step-machine routing
      // is orthogonal to participant role selection.
      service_role_code: '',
    },
  ]
  for (let i = 1; i < n; i += 1) {
    rows.push({
      first_name: `P${i + 1}`,
      last_name: 'Doe',
      email: '',
      phone: '',
      service_role_code: '',
    })
  }
  return rows
}

// landr-87n9.3: non-guiding companions helper for the step-machine tests.
function makeCompanions(n: number): CompanionDetails[] {
  const rows: CompanionDetails[] = []
  for (let i = 0; i < n; i += 1) {
    rows.push({ first_name: `C${i + 1}`, last_name: '', email: '', phone: '', companion_kind: 'guest' as const })
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
      [],
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
      [],
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

describe('stepBeforeReview (landr-87n9.1 — back-nav mirrors the forward machine)', () => {
  const baseArgs = (overrides: Record<string, unknown> = {}) => ({
    product: makeProduct({ needs_pickup: true, hotel_offering: 'optional' }),
    selection: SLOT_SELECTION,
    booker: ADA,
    participants: makeParticipants(2),
    companions: makeCompanions(0),
    pickupLocationId: null as string | null,
    accommodationRooms: [{ productId: 'room-1', quantity: 1 }],
    addons: [],
    ...overrides,
  })

  it('REGRESSION: a booked hotel + needs_pickup product → Back returns to pick-accommodation (NOT pick-pickup, which was skipped forward)', () => {
    const prev = stepBeforeReview(
      baseArgs({
        // hotel was booked → forward path made the hotel the pickup and
        // SKIPPED pick-pickup. pickupLocationId is the hotel's location id.
        hotelLocationId: 'loc-hotel-mirador',
        pickupLocationId: 'loc-hotel-mirador',
      }),
    )
    expect(prev.name).toBe('pick-accommodation')
    if (prev.name !== 'pick-accommodation') throw new Error('narrowing')
    // rooms + hotel restored for the re-mount.
    expect(prev.hotelLocationId).toBe('loc-hotel-mirador')
    expect(prev.accommodationRooms).toEqual([
      { productId: 'room-1', quantity: 1 },
    ])
    expect(prev.participants).toHaveLength(2)
  })

  it('shared-double (hotel set, no rooms) → Back also returns to pick-accommodation', () => {
    const prev = stepBeforeReview(
      baseArgs({
        hotelLocationId: 'loc-shared',
        pickupLocationId: 'loc-shared',
        accommodationRooms: [],
        isSharedDouble: true,
        accommodationMode: 'shared-double',
      }),
    )
    expect(prev.name).toBe('pick-accommodation')
    if (prev.name !== 'pick-accommodation') throw new Error('narrowing')
    expect(prev.isSharedDouble).toBe(true)
    expect(prev.accommodationMode).toBe('shared-double')
  })

  it('guiding-only opt-out on a hotel-offering product → Back returns to pick-accommodation (the customer passed through it)', () => {
    const prev = stepBeforeReview(
      baseArgs({
        product: makeProduct({ needs_pickup: true, hotel_offering: 'optional' }),
        hotelLocationId: null,
        pickupLocationId: 'loc-free-pickup',
        accommodationRooms: [],
        includeHotel: false,
        accommodationMode: 'guiding-only',
      }),
    )
    expect(prev.name).toBe('pick-accommodation')
  })

  it('no hotel offering + needs_pickup → Back returns to pick-pickup with the prior choice restored', () => {
    const prev = stepBeforeReview(
      baseArgs({
        product: makeProduct({ needs_pickup: true, hotel_offering: 'none' }),
        hotelLocationId: null,
        pickupLocationId: 'loc-hauptplatz',
        accommodationRooms: [],
      }),
    )
    expect(prev.name).toBe('pick-pickup')
    if (prev.name !== 'pick-pickup') throw new Error('narrowing')
    expect(prev.pickupLocationId).toBe('loc-hauptplatz')
  })

  it('no hotel, no pickup, but service add-ons were shown → Back returns to pick-service-addons', () => {
    const prev = stepBeforeReview(
      baseArgs({
        product: makeProduct({ needs_pickup: false, hotel_offering: 'none' }),
        hotelLocationId: null,
        accommodationRooms: [],
        addons: [{ productId: 'addon-1', quantity: 1 }],
        hadServiceAddons: true,
      }),
    )
    expect(prev.name).toBe('pick-service-addons')
    if (prev.name !== 'pick-service-addons') throw new Error('narrowing')
    expect(prev.addons).toEqual([{ productId: 'addon-1', quantity: 1 }])
  })

  it('no hotel, no pickup, no service add-ons → Back returns to details', () => {
    const prev = stepBeforeReview(
      baseArgs({
        product: makeProduct({ needs_pickup: false, hotel_offering: 'none' }),
        hotelLocationId: null,
        accommodationRooms: [],
        hadServiceAddons: false,
      }),
    )
    expect(prev.name).toBe('details')
  })

  it('back-target mirrors stepAfterAccommodation: whatever forward skipped, Back skips too', () => {
    // For each forward case, the step Back lands on must be a step the
    // forward machine would actually have rendered.
    const cases = [
      { hotelLocationId: 'h-1', needs_pickup: true, hotel_offering: 'optional', back: 'pick-accommodation' },
      { hotelLocationId: null, needs_pickup: true, hotel_offering: 'optional', back: 'pick-accommodation' },
      { hotelLocationId: null, needs_pickup: true, hotel_offering: 'none', back: 'pick-pickup' },
      { hotelLocationId: null, needs_pickup: false, hotel_offering: 'none', back: 'details' },
    ] as const
    for (const c of cases) {
      const prev = stepBeforeReview(
        baseArgs({
          product: makeProduct({
            needs_pickup: c.needs_pickup,
            hotel_offering: c.hotel_offering,
          }),
          hotelLocationId: c.hotelLocationId,
          accommodationRooms: c.hotelLocationId ? [{ productId: 'r', quantity: 1 }] : [],
        }),
      )
      expect(prev.name).toBe(c.back)
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
      companions: [],
      participants: [
        {
          first_name: 'Ada',
          last_name: 'L',
          email: '',
          phone: '',
          service_role_code: '',
        },
        {
          first_name: 'Grace',
          last_name: 'H',
          email: '',
          phone: '',
          service_role_code: '',
        },
        {
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          service_role_code: '',
        },
      ],
    })
    // Empty names filtered out.
    expect(inputs?.participantNames).toEqual(['Ada', 'Grace'])
    expect(inputs?.participantCount).toBe(3)
  })
})

describe('deriveAccommodationMode (landr-ffyg.2)', () => {
  it('returns shared-double when the flag is set (regardless of hotel)', () => {
    expect(deriveAccommodationMode('hotel-1', true)).toBe('shared-double')
    expect(deriveAccommodationMode(null, true)).toBe('shared-double')
  })

  it('returns guiding-only when no hotel and not shared', () => {
    expect(deriveAccommodationMode(null, false)).toBe('guiding-only')
    expect(deriveAccommodationMode(null, undefined)).toBe('guiding-only')
  })

  it('returns package when a hotel is set and not shared', () => {
    expect(deriveAccommodationMode('hotel-1', false)).toBe('package')
    expect(deriveAccommodationMode('hotel-1', undefined)).toBe('package')
  })
})

describe('stepAfterAccommodation — shared-double bypass (landr-ffyg.2)', () => {
  it('shared-double (hotel set, NO rooms) routes straight to fill-form with the hotel as pickup, skipping pick-pickup', () => {
    // needs_pickup=true would normally route to pick-pickup, but the hotel
    // is set so the landr-4r80 routing wins and the customer NEVER reaches
    // the free pickup picker — exactly the shared-double requirement.
    const product = makeProduct({
      needs_pickup: true,
      hotel_offering: 'optional',
    })
    const next = stepAfterAccommodation(
      product,
      SLOT_SELECTION,
      ADA,
      makeParticipants(1),
      [], // companions
      [], // NO room lines for a shared-double booking
      'loc-shared-hotel',
      [],
      false,
      true, // includeHotel
      true, // isSharedDouble
      'shared-double',
    )
    expect(next.name).toBe('fill-form')
    if (next.name !== 'fill-form') throw new Error('narrowing')
    expect(next.pickupLocationId).toBe('loc-shared-hotel')
    expect(next.accommodationRooms).toEqual([])
    expect(next.isSharedDouble).toBe(true)
    expect(next.accommodationMode).toBe('shared-double')
  })

  it('threads accommodationMode through the guiding-only branch (no hotel, no pickup)', () => {
    const product = makeProduct({
      needs_pickup: false,
      hotel_offering: 'optional',
    })
    const next = stepAfterAccommodation(
      product,
      SLOT_SELECTION,
      ADA,
      makeParticipants(2),
      [], // companions
      [],
      null,
      [],
      false,
      false,
      false,
      'guiding-only',
    )
    expect(next.name).toBe('fill-form')
    if (next.name !== 'fill-form') throw new Error('narrowing')
    expect(next.pickupLocationId).toBeNull()
    expect(next.isSharedDouble).toBe(false)
    expect(next.accommodationMode).toBe('guiding-only')
  })
})
