/**
 * Contract test (landr-piyv). Asserts the JSON body that submitBooking
 * POSTs to /api/public/bookings matches the FastAPI PublicSubmitBookingIn
 * model defined in landr-api/app/routers/public_bookings.py.
 *
 * Earlier widget tests mocked `submitBooking` outright, so a contract
 * drift was invisible — the widget shipped a payload the API never
 * accepted and the failure surfaced as a generic "Failed to fetch" in
 * the browser. This test stubs the global `fetch` instead, capturing the
 * actual request body and validating the shape against the Pydantic
 * contract WITHOUT touching the real API.
 *
 * Re-import the client AFTER stubbing the env so the module-level
 * USE_MOCKS constant reads '0' (the global setup.ts pins it to '1' for
 * the rest of the suite).
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import { breakfastPick } from './offerTestFixtures'
import { BookingForm, type BookingSelection } from './BookingForm'
import type {
  BookerDetails,
  CompanionDetails,
  ParticipantDetails,
} from './detailsTypes'

// landr-rmcsu.7: the review's seat pre-check (any group > 1) reads
// availability before submit; stub that read so `fetch` only ever sees the
// submit POST these tests assert on.
vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    getAvailability: vi.fn().mockResolvedValue([]),
    listProducts: vi.fn().mockResolvedValue([]),
    getOffers: vi.fn().mockResolvedValue({ lines: [] }),
  }
})

vi.stubEnv('VITE_USE_MOCKS', '0')
vi.stubEnv('VITE_API_BASE_URL', 'http://api.test.invalid')

function makeServiceProduct(): Product {
  return {
    product_id: 'svc-main',
    slug: 'guided-day',
    name: 'Guided day',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'days_range',
    is_contiguous: true,
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
    hotel_offering: 'optional',
    hotel_location_id: null,
    price_per_unit: null,
    currency: 'EUR',
  }
}

const SELECTED_DAYS = ['2026-06-10', '2026-06-11', '2026-06-12']
const SELECTION: BookingSelection = { kind: 'days', selectedDays: SELECTED_DAYS }
const BOOKER: BookerDetails = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone: '+34 600 111 222',
  billing: { address_line1: 'Calle Mayor 1', address_line2: '', postal_code: '28013', city: 'Madrid', region: '', country: 'ES', company: '', tax_id: '', name: '' },
}
const PARTICIPANTS: ParticipantDetails[] = [
  // landr-mg0a: empty service_role_code intentionally exercises the
  // BookingForm fallback to 'participant' (which the contract assertion
  // below still expects). When DetailsStep is the actual upstream the
  // participant carries the operator's first ServiceRole code.
  { ...BOOKER, service_role_code: '' },
  {
    first_name: 'Grace',
    last_name: 'Hopper',
    email: 'grace@example.com',
    phone: '',
    service_role_code: '',
  },
]

/** Fields the FastAPI PublicSubmitBookingIn marks required. */
const REQUIRED_TOP_LEVEL = [
  'widget_token',
  'customer_first_name',
  'customer_email',
  'cancellation_deadline',
  'booking_channel',
  'products',
  'participants',
] as const

/** Optional but commonly-passed fields the widget MUST populate. */
const EXPECTED_TOP_LEVEL = [
  ...REQUIRED_TOP_LEVEL,
  'customer_last_name',
  'customer_phone',
  'customer_preferred_locale',
  'customer_billing',
] as const

const REQUIRED_PRODUCT_LINE = ['product_id', 'quantity'] as const
const REQUIRED_PARTICIPANT = ['first_name', 'service_role_code'] as const

describe('BookingForm submit body — matches /api/public/bookings PublicSubmitBookingIn (landr-piyv)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(
        JSON.stringify({
          booking_id: 'b-1',
          semantic_state: 'pending',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ))
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('POSTs to /api/public/bookings with a body matching PublicSubmitBookingIn (all required fields + correct shapes)', async () => {
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={PARTICIPANTS}
        pickupLocationId="loc-pickup-1"
        accommodationRooms={[{ productId: 'room-deluxe', quantity: 2 }]}
        roomPicks={[breakfastPick('room-deluxe', 4)]}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/api\/public\/bookings$/)
    expect(init.method).toBe('POST')

    const body = JSON.parse(String(init.body)) as Record<string, unknown>

    // All required (and expected-optional) top-level fields are present
    for (const key of EXPECTED_TOP_LEVEL) {
      expect(body, `top-level field "${key}" must be in body`).toHaveProperty(key)
    }

    // Customer fields flattened from the booker
    expect(body.widget_token).toBe('para42')
    expect(body.customer_first_name).toBe('Ada')
    expect(body.customer_last_name).toBe('Lovelace')
    expect(body.customer_email).toBe('ada@example.com')
    expect(body.customer_phone).toBe('+34 600 111 222')
    expect(typeof body.customer_preferred_locale).toBe('string')
    expect(body.booking_channel).toBe('public_website')

    // landr-uuntm.3: billing address — trimmed, blank optionals -> null,
    // country upper-cased (BillingAddressIn, landr-uuntm.1).
    expect(body.customer_billing).toEqual({
      address_line1: 'Calle Mayor 1',
      address_line2: null,
      postal_code: '28013',
      city: 'Madrid',
      region: null,
      country: 'ES',
      company: null,
      tax_id: null,
      name: null,
    })

    // cancellation_deadline is an ISO datetime string, computed as
    // 00:00 UTC of (firstDay − 1 day) = 2026-06-09T00:00:00.000Z
    expect(typeof body.cancellation_deadline).toBe('string')
    expect(body.cancellation_deadline).toBe('2026-06-09T00:00:00.000Z')

    // products: service + 1 room + 1 room offer line = 3 lines, each with required ProductLineIn fields
    const products = body.products as Array<Record<string, unknown>>
    expect(products).toHaveLength(3)
    for (const line of products) {
      for (const key of REQUIRED_PRODUCT_LINE) {
        expect(line, `product line must have "${key}"`).toHaveProperty(key)
      }
      expect(typeof line.product_id).toBe('string')
      expect(typeof line.quantity).toBe('number')
      // selected_days is the widget's preferred date encoding (vs date_range_start/end)
      expect(Array.isArray(line.selected_days)).toBe(true)
    }

    // Service line carries the picked days verbatim
    expect(products[0]).toMatchObject({
      product_id: 'svc-main',
      quantity: 1,
      selected_days: SELECTED_DAYS,
    })

    // Room line uses the NIGHT window (check-in 06-09 → check-out 06-13
    // exclusive) — 4 nights, not the 3 service days. This is the
    // landr-piyv contract correction.
    expect(products[1]).toMatchObject({
      product_id: 'room-deluxe',
      quantity: 2,
      selected_days: ['2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12'],
    })

    // Offer lines (per-line item, not folded into a separate field).
    // landr-fxza.4: THE MISSING ASSERTION — a room-tied offer line
    // (product_kind='hotel_room', e.g. breakfast) must get the SAME night
    // window as the room line above (products[1]), NOT the 3 raw service
    // days. Pre-fix this line asserted only { product_id, quantity },
    // deliberately never checking selected_days — that omission WAS the
    // bug (BookingForm.tsx gave it SELECTED_DAYS instead of the 4 nights).
    expect(products[2]).toMatchObject({
      product_id: 'breakfast-1',
      quantity: 4,
      selected_days: ['2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12'],
    })
    // The offer line hangs off its room type and names the offer; it never
    // carries a price, collection, mode, schedule or binding.
    expect(products[2]).toMatchObject({
      line_id: 'a1',
      parent_line_id: 'r-room-deluxe',
      offer_id: 'offer-breakfast-1',
    })
    for (const k of ['price', 'collection', 'mode', 'schedule', 'binding']) {
      expect(products[2]).not.toHaveProperty(k)
    }

    // participants: 2 entries, each with required ParticipantIn fields
    const participants = body.participants as Array<Record<string, unknown>>
    expect(participants).toHaveLength(2)
    for (const p of participants) {
      for (const key of REQUIRED_PARTICIPANT) {
        expect(p, `participant must have "${key}"`).toHaveProperty(key)
      }
      expect(typeof p.first_name).toBe('string')
      expect(typeof p.service_role_code).toBe('string')
      // pickup_location_id may be string|null; here we passed one so it should appear
      expect(p.pickup_location_id).toBe('loc-pickup-1')
    }

    // Booker mirrored as participants[0]
    expect(participants[0]).toMatchObject({
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      service_role_code: 'participant',
    })

    // No legacy/extraneous keys the old payload used — must not leak through
    expect(body).not.toHaveProperty('booker')
    expect(body).not.toHaveProperty('product_id')
    expect(body).not.toHaveProperty('accommodation_rooms')
    expect(body).not.toHaveProperty('addon_lines')
    expect(body).not.toHaveProperty('selected_days')
    expect(body).not.toHaveProperty('pickup_location_id')
  })

  it('landr-fxza.4: a single guided day yields a 2-night stay, so a room-tied add-on (breakfast) gets 2 nights, not 1 raw day', async () => {
    // The ticket's own worked example (booking a453eae2): one activity day
    // pads to check-in the evening before + check-out the morning after —
    // 2026-09-01 alone becomes the 2-night stay [2026-08-31, 2026-09-01].
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={{ kind: 'days', selectedDays: ['2026-09-01'] }}
        booker={BOOKER}
        participants={[{ ...BOOKER, service_role_code: '' }]}
        pickupLocationId="loc-pickup-1"
        accommodationRooms={[{ productId: 'room-1', quantity: 1 }]}
        roomPicks={[breakfastPick('room-1', 1)]}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    const products = body.products as Array<Record<string, unknown>>

    const room = products.find((p) => p.product_id === 'room-1')
    const breakfast = products.find((p) => p.product_id === 'breakfast-1')
    expect(room?.selected_days).toEqual(['2026-08-31', '2026-09-01'])
    // THE FIX: breakfast must match the room's 2-night window (2 billable
    // units at submit time — see app/services/pricing.py's per_day_base
    // evaluator, units = len(selected_days)) — not the single raw
    // activity day it got pre-fix.
    expect(breakfast?.selected_days).toEqual(['2026-08-31', '2026-09-01'])
    expect((breakfast?.selected_days as unknown[]).length).toBe(2)
  })

  it('surfaces a FastAPI 422 detail array instead of a generic error string', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          detail: [
            {
              loc: ['body', 'customer_email'],
              msg: 'field required',
              type: 'value_error.missing',
            },
            {
              loc: ['body', 'cancellation_deadline'],
              msg: 'field required',
              type: 'value_error.missing',
            },
          ],
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={[{ ...BOOKER, service_role_code: "" }]}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })

    const errBox = await screen.findByTestId('review-error')
    expect(errBox.textContent).toMatch(/422/)
    expect(errBox.textContent).toMatch(/customer_email/)
    expect(errBox.textContent).toMatch(/cancellation_deadline/)
  })

  // landr-otml0.3 review fix (MINOR 6): companion_contact_required fires
  // onCompanionContactRequired with the 0-based companion_index so the
  // caller can navigate back and highlight the exact row.
  it('fires onCompanionContactRequired with the companion_index on a companion_contact_required 422', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          detail: {
            error: 'companion_contact_required',
            companion_index: 1,
            first_name: 'Thomas',
          },
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const onCompanionContactRequired = vi.fn()
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={[{ ...BOOKER, service_role_code: '' }]}
        pickupLocationId={null}
        onCompanionContactRequired={onCompanionContactRequired}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() =>
      expect(onCompanionContactRequired).toHaveBeenCalledWith(1),
    )
  })

  // landr-zeg4u.6: safety net for the shared-double rule — only the booker's
  // bed is the host's double, so the API 422s any other guiding participant
  // without a room. Name them instead of dumping the raw error.
  it('maps a shared_double_room_occupancy_invalid participant_unassigned 422 to a readable message', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          detail: {
            error: 'shared_double_room_occupancy_invalid',
            reason: 'participant_unassigned',
            participant_index: 1,
            room_product_id: null,
            unit_index: null,
            message: 'raw server text',
          },
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={[
          { ...BOOKER, service_role_code: '' },
          { ...BOOKER, first_name: 'Anna', last_name: 'Pilot', service_role_code: '' },
        ]}
        pickupLocationId="hotel-a"
        isSharedDouble
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    const errBox = await screen.findByTestId('review-error')
    expect(errBox.textContent).toMatch(/Anna/)
    expect(errBox.textContent).toMatch(/only you share the host's room/i)
    expect(errBox.textContent).not.toMatch(/422/)
  })

  it('maps any other shared_double_room_occupancy_invalid 422 to a readable message', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          detail: {
            error: 'shared_double_room_occupancy_invalid',
            reason: 'unit_empty',
            room_product_id: 'double-room',
            unit_index: 0,
          },
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={[{ ...BOOKER, service_role_code: '' }]}
        pickupLocationId="hotel-a"
        isSharedDouble
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    const errBox = await screen.findByTestId('review-error')
    expect(errBox.textContent).toMatch(/go back to accommodation/i)
    expect(errBox.textContent).not.toMatch(/422/)
  })

  it('omits no required PublicSubmitBookingIn field when the booking has no rooms / no addons', async () => {
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={[{ ...BOOKER, service_role_code: "" }]}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>

    for (const key of REQUIRED_TOP_LEVEL) {
      expect(body, `required field "${key}" must be in minimal body`).toHaveProperty(key)
    }
    const products = body.products as unknown[]
    expect(products).toHaveLength(1) // just the service line
    const participants = body.participants as unknown[]
    expect(participants).toHaveLength(1)
  })

  // landr-ffyg.2: the submit body always carries is_shared_double — false
  // for a regular booking, true for the second-pilot-sharing mode.
  it('sends is_shared_double=false by default (regular booking)', async () => {
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={[{ ...BOOKER, service_role_code: '' }]}
        pickupLocationId="loc-pickup-1"
        accommodationRooms={[{ productId: 'room-deluxe', quantity: 1 }]}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.is_shared_double).toBe(false)
  })

  it('shared-double mode: is_shared_double=true, NO hotel_room line, pickup is the shared hotel (landr-ffyg.1 contract)', async () => {
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={[{ ...BOOKER, service_role_code: '' }]}
        // shared-double: the hotel is the pickup; NO accommodationRooms.
        pickupLocationId="loc-shared-hotel"
        accommodationRooms={[]}
        isSharedDouble
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>

    // Top-level marker the API persists + validates (landr-ffyg.1).
    expect(body.is_shared_double).toBe(true)

    // ONLY the guiding service line — zero hotel_room lines (the API 422s
    // a shared-double booking that carries a room line).
    const products = body.products as Array<Record<string, unknown>>
    expect(products).toHaveLength(1)
    expect(products[0]).toMatchObject({ product_id: 'svc-main', quantity: 1 })

    // Every participant is collected from the shared hotel (the API 422s a
    // shared-double booking with no participant pickup_location_id).
    const participants = body.participants as Array<Record<string, unknown>>
    expect(participants.length).toBeGreaterThan(0)
    for (const p of participants) {
      expect(p.pickup_location_id).toBe('loc-shared-hotel')
    }
  })

  // landr-zeg4u.4: an invitee sharing the host's double may book ADDITIONAL
  // rooms for the companions they bring. The shared double still covers the
  // guiding participant (no room on them); only companions carry a room.
  it('shared-double + additional rooms: room line ships, only companions carry the room', async () => {
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={[{ ...BOOKER, service_role_code: '' }]}
        companions={[
          { first_name: 'Mia', last_name: '', email: '', phone: '', companion_kind: 'guest' },
          { first_name: 'Leo', last_name: '', email: '', phone: '', companion_kind: 'guest' },
        ]}
        pickupLocationId="loc-shared-hotel"
        accommodationRooms={[{ productId: 'room-double', quantity: 1 }]}
        roomAssignment={{
          1: { roomProductId: 'room-double', unitIndex: 0 },
          2: { roomProductId: 'room-double', unitIndex: 0 },
        }}
        isSharedDouble
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>

    expect(body.is_shared_double).toBe(true)
    const products = body.products as Array<Record<string, unknown>>
    expect(products.map((p) => p.product_id)).toEqual(['svc-main', 'room-double'])
    const participants = body.participants as Array<Record<string, unknown>>
    expect(participants[0]).toMatchObject({
      pickup_location_id: 'loc-shared-hotel',
      room_product_id: null,
      room_unit_index: null,
    })
    const companions = body.companions as Array<Record<string, unknown>>
    for (const c of companions) {
      expect(c).toMatchObject({ room_product_id: 'room-double', room_unit_index: 0 })
    }
  })

  // landr-gb2f.2: PINNED wire contract — assigned participants carry
  // room_product_id + room_unit_index; unassigned send null. products[]
  // line items are NOT changed by the assignment.
  it('attaches room_product_id + room_unit_index per participant from roomAssignment', async () => {
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={PARTICIPANTS}
        pickupLocationId="loc-pickup-1"
        accommodationRooms={[{ productId: 'room-double', quantity: 2 }]}
        // participant 0 → unit 0; participant 1 → unit 1 of the same room.
        roomAssignment={{
          0: { roomProductId: 'room-double', unitIndex: 0 },
          1: { roomProductId: 'room-double', unitIndex: 1 },
        }}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>

    const participants = body.participants as Array<Record<string, unknown>>
    expect(participants[0]).toMatchObject({
      room_product_id: 'room-double',
      room_unit_index: 0,
    })
    expect(participants[1]).toMatchObject({
      room_product_id: 'room-double',
      room_unit_index: 1,
    })

    // products[] is untouched by the assignment — still service + 1 room line.
    const products = body.products as Array<Record<string, unknown>>
    expect(products).toHaveLength(2)
    expect(products[1]).toMatchObject({ product_id: 'room-double', quantity: 2 })
  })

  it('sends room_product_id/room_unit_index = null for unassigned participants (and when no roomAssignment given)', async () => {
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={PARTICIPANTS}
        pickupLocationId="loc-pickup-1"
        accommodationRooms={[{ productId: 'room-double', quantity: 1 }]}
        // Only participant 0 assigned; participant 1 left unassigned.
        roomAssignment={{ 0: { roomProductId: 'room-double', unitIndex: 0 } }}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    const participants = body.participants as Array<Record<string, unknown>>

    expect(participants[0]).toMatchObject({
      room_product_id: 'room-double',
      room_unit_index: 0,
    })
    // Unassigned participant → both fields present and null (not omitted).
    expect(participants[1].room_product_id).toBeNull()
    expect(participants[1].room_unit_index).toBeNull()
  })

  // landr-87n9.3: PINNED wire contract — non-guiding companions are sent as
  // a top-level companions[] (NOT in participants[]), each carrying
  // first_name (required) + optional last_name/email/phone + the whole-party
  // room assignment (room_product_id + room_unit_index) read from the
  // assignment map at index participants.length + companionIdx.
  it('sends companions[] as a top-level array with assignment + optional fields', async () => {
    const COMPANIONS: CompanionDetails[] = [
      { first_name: 'Mia', last_name: 'Berg', email: 'mia@example.com', phone: '', companion_kind: 'guest' },
      { first_name: 'Leo', last_name: '', email: '', phone: '+34 600 999', companion_kind: 'guest' },
    ]
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={PARTICIPANTS}
        companions={COMPANIONS}
        pickupLocationId="loc-pickup-1"
        accommodationRooms={[{ productId: 'room-double', quantity: 2 }]}
        // Unified party index: participants 0,1 then companions 2,3.
        // p0→unit0, p1→unit0, companion0(idx2)→unit1, companion1(idx3)→unit1.
        roomAssignment={{
          0: { roomProductId: 'room-double', unitIndex: 0 },
          1: { roomProductId: 'room-double', unitIndex: 0 },
          2: { roomProductId: 'room-double', unitIndex: 1 },
          3: { roomProductId: 'room-double', unitIndex: 1 },
        }}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>

    // companions[] is top-level and NOT merged into participants[].
    const participants = body.participants as Array<Record<string, unknown>>
    expect(participants).toHaveLength(2)

    const companions = body.companions as Array<Record<string, unknown>>
    expect(companions).toHaveLength(2)

    // first_name required; optional fields normalised to null when blank.
    expect(companions[0]).toMatchObject({
      first_name: 'Mia',
      last_name: 'Berg',
      email: 'mia@example.com',
      phone: null,
      room_product_id: 'room-double',
      room_unit_index: 1,
    })
    expect(companions[1]).toMatchObject({
      first_name: 'Leo',
      last_name: null,
      email: null,
      phone: '+34 600 999',
      room_product_id: 'room-double',
      room_unit_index: 1,
    })

    // Companions carry NO service_role (they are not guiding participants).
    expect(companions[0]).not.toHaveProperty('service_role_code')
  })

  // landr-6stj: PINNED wire contract — a 'slot' selection (AvailabilityPicker
  // / FixedDateWindowPicker) carries the exact product_availability row the
  // customer clicked as slot.availability_id; the primary service line must
  // forward it as product_availability_id so the API can persist it instead
  // of leaving booking_products.product_availability_id NULL forever.
  it('forwards slot.availability_id as product_availability_id on the primary service line for a slot selection', async () => {
    const SLOT_SELECTION: BookingSelection = {
      kind: 'slot',
      slot: {
        availability_id: 'avail-123',
        date: '2026-06-10',
        start_time: '09:00:00',
        end_time: '11:00:00',
        capacity: 10,
        capacity_reserved: 2,
        available_seats: 8,
        status: 'open',
      },
    }

    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SLOT_SELECTION}
        booker={BOOKER}
        participants={[{ ...BOOKER, service_role_code: '' }]}
        pickupLocationId={null}
        accommodationRooms={[{ productId: 'room-deluxe', quantity: 1 }]}
        roomPicks={[breakfastPick('room-deluxe', 1)]}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    const products = body.products as Array<Record<string, unknown>>

    // Primary service line carries the picked availability row.
    expect(products[0]).toMatchObject({
      product_id: 'svc-main',
      product_availability_id: 'avail-123',
    })

    // Non-primary lines (rooms/addons span the whole stay, not one slot)
    // must NOT carry the field.
    expect(products[1]).not.toHaveProperty('product_availability_id')
    expect(products[2]).not.toHaveProperty('product_availability_id')
  })

  // landr-k9pji.1: a booking_mode='on_request' product's synthesised day has
  // availability_id === null (no product_availability row exists). The key
  // must be OMITTED, not sent as null — and the day still reaches the API as
  // selected_days.
  it('omits product_availability_id for a synthesised on-request slot (availability_id null)', async () => {
    const SYNTHETIC_SELECTION: BookingSelection = {
      kind: 'slot',
      slot: {
        availability_id: null,
        date: '2026-06-11',
        start_time: null,
        end_time: null,
        capacity: 2,
        capacity_reserved: 0,
        available_seats: 2,
        status: 'open',
      },
    }

    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SYNTHETIC_SELECTION}
        booker={BOOKER}
        participants={[{ ...BOOKER, service_role_code: '' }]}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    const products = body.products as Array<Record<string, unknown>>
    expect(products[0]).toMatchObject({
      product_id: 'svc-main',
      selected_days: ['2026-06-11'],
    })
    expect(products[0]).not.toHaveProperty('product_availability_id')
  })

  // landr-xtkae.2: a synthesised fixed-time slot has no availability row; the
  // API identifies it by date + slot_start_time ("HH:MM", NOT the "HH:MM:SS"
  // availability returns).
  it('sends slot_start_time as HH:MM for a synthesised fixed-time slot and no product_availability_id', async () => {
    const TIMED_SELECTION: BookingSelection = {
      kind: 'slot',
      slot: {
        availability_id: null,
        date: '2026-06-11',
        start_time: '11:00:00',
        end_time: null,
        capacity: 2,
        capacity_reserved: 0,
        available_seats: 2,
        status: 'open',
      },
    }

    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={TIMED_SELECTION}
        booker={BOOKER}
        participants={[{ ...BOOKER, service_role_code: '' }]}
        pickupLocationId={null}
        accommodationRooms={[{ productId: 'room-deluxe', quantity: 1 }]}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    const products = body.products as Array<Record<string, unknown>>
    expect(products[0]).toMatchObject({
      product_id: 'svc-main',
      selected_days: ['2026-06-11'],
      slot_start_time: '11:00',
    })
    expect(products[0]).not.toHaveProperty('product_availability_id')
    // Only the primary line carries the slot.
    expect(products[1]).not.toHaveProperty('slot_start_time')
  })

  it('omits product_availability_id for a days-range selection (no single slot to attach)', async () => {
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={[{ ...BOOKER, service_role_code: '' }]}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    const products = body.products as Array<Record<string, unknown>>
    expect(products[0]).not.toHaveProperty('product_availability_id')
  })

  it('omits the companions field entirely when there are no companions', async () => {
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={[{ ...BOOKER, service_role_code: '' }]}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body).not.toHaveProperty('companions')
  })

  // landr-otml0.3: invite_token / join_ref on submit.
  it('omits invite_token and join_ref for a regular (non-invite, no-reference) booking', async () => {
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={[{ ...BOOKER, service_role_code: '' }]}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body).not.toHaveProperty('invite_token')
    expect(body).not.toHaveProperty('join_ref')
  })

  it('sends invite_token when the booking arrived via a resolved invite link', async () => {
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={[{ ...BOOKER, service_role_code: '' }]}
        pickupLocationId={null}
        inviteToken="tok-1"
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.invite_token).toBe('tok-1')
    expect(body).not.toHaveProperty('join_ref')
  })

  it('sends via_alternative_of only when the product was switched via an alternative', async () => {
    const submit = async (via?: string) => {
      fetchSpy.mockClear()
      const { unmount } = render(
        <BookingForm
          widgetToken="para42"
          product={makeServiceProduct()}
          selection={SELECTION}
          booker={BOOKER}
          participants={[{ ...BOOKER, service_role_code: '' }]}
          pickupLocationId={null}
          viaAlternativeOf={via}
          onBack={vi.fn()}
          onConfirmed={vi.fn()}
        />,
      )
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
      })
      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
      unmount()
      return JSON.parse(String(init.body)) as Record<string, unknown>
    }
    expect(await submit()).not.toHaveProperty('via_alternative_of')
    expect((await submit('prod-original')).via_alternative_of).toBe('prod-original')
  })

  it('sends join_ref when the customer confirmed a shared-double reference', async () => {
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={[{ ...BOOKER, service_role_code: '' }]}
        pickupLocationId={null}
        joinRef="A1B2C3D4"
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.join_ref).toBe('A1B2C3D4')
    expect(body).not.toHaveProperty('invite_token')
  })

  it('reads share_secret/invites/group/join_error from the response without throwing (contract carries them through)', async () => {
    fetchSpy.mockImplementation(async () => new Response(
        JSON.stringify({
          booking_id: 'b-1',
          semantic_state: 'pending',
          share_secret: 'secret-abc',
          invites: [
            {
              companion_id: 'c-1',
              name: 'Thomas Klein',
              email: 'thomas@example.com',
              phone: null,
              phone_digits: null,
              invite_url: 'https://bw-dev.landr.de/i/tok-2',
              whatsapp_url: null,
              linked_booking_reference: null,
              has_invite: true,
            },
          ],
          group: {
            group_id: 'g-1',
            label: 'Olaf K***n',
            members: [
              {
                reference: 'A1B2C3D4',
                display_name: 'Olaf K***n',
                is_self: false,
                is_host: true,
              },
            ],
          },
          join_error: null,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ))
    const onConfirmed = vi.fn()
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={[{ ...BOOKER, service_role_code: '' }]}
        pickupLocationId={null}
        joinRef="A1B2C3D4"
        onBack={vi.fn()}
        onConfirmed={onConfirmed}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1))
    const [response] = onConfirmed.mock.calls[0]!
    expect(response.share_secret).toBe('secret-abc')
    expect(response.group.members[0].reference).toBe('A1B2C3D4')
    expect(response.invites[0].invite_url).toContain('tok-2')
  })
})

describe('BookingForm submit body — billing address (landr-uuntm.3)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ booking_id: 'b-1', semantic_state: 'pending' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }))
  })
  afterEach(() => fetchSpy.mockRestore())

  async function submit(booker: typeof BOOKER) {
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={booker}
        participants={PARTICIPANTS}
        pickupLocationId={null}
        accommodationRooms={[]}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    return JSON.parse(String(init.body)) as Record<string, unknown>
  }

  it('sends company and tax id when the customer invoices a company', async () => {
    const body = await submit({
      ...BOOKER,
      billing: {
        address_line1: 'Hauptstr. 5',
        address_line2: 'Hinterhaus',
        postal_code: '10115',
        city: 'Berlin',
        region: 'BE',
        country: 'DE',
        company: 'Para42 GmbH',
        tax_id: 'DE123456789',
        name: ' Grace Hopper ',
      },
    })
    expect(body.customer_billing).toEqual({
      address_line1: 'Hauptstr. 5',
      address_line2: 'Hinterhaus',
      postal_code: '10115',
      city: 'Berlin',
      region: 'BE',
      country: 'DE',
      company: 'Para42 GmbH',
      tax_id: 'DE123456789',
      name: 'Grace Hopper',
    })
  })

  it('omits customer_billing entirely when no complete address exists (staff-entered booking)', async () => {
    const body = await submit({
      ...BOOKER,
      billing: {
        address_line1: '',
        address_line2: '',
        postal_code: '',
        city: '',
        region: '',
        country: '',
        company: '',
        tax_id: '',
        name: '',
      },
    })
    expect(body).not.toHaveProperty('customer_billing')
  })
})

// landr-jiagg.2: PINNED wire contract for "I'm booking for someone else and
// won't take part". The booker stays the customer_* (invoice recipient);
// participants[] carries NO booker row when joins=false and DOES carry it
// when joins=true; is_shared_double is never sent when joins=false.
describe('BookingForm submit body — booker not taking part (landr-jiagg.2)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ booking_id: 'b-1', semantic_state: 'pending' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }))
  })
  afterEach(() => fetchSpy.mockRestore())

  const CHILD: ParticipantDetails = {
    id: 'pm-child',
    first_name: 'Max',
    last_name: 'Lovelace',
    email: '',
    phone: '',
    service_role_code: 'participant',
  }
  const FRIEND: ParticipantDetails = {
    id: 'pm-friend',
    first_name: 'Grace',
    last_name: 'Hopper',
    email: '',
    phone: '+34 600 999 888',
    service_role_code: 'participant',
  }

  async function submit(
    booker: BookerDetails,
    participants: ParticipantDetails[],
    extra: { isSharedDouble?: boolean; pickupLocationId?: string | null } = {},
  ) {
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={booker}
        participants={participants}
        pickupLocationId={extra.pickupLocationId ?? null}
        accommodationRooms={[]}
        isSharedDouble={extra.isSharedDouble}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    return JSON.parse(String(init.body)) as Record<string, unknown>
  }

  it('joins=false: participants[] is the roster only; the booker stays the customer', async () => {
    const body = await submit({ ...BOOKER, joins: false }, [CHILD, FRIEND])
    expect(body.customer_first_name).toBe('Ada')
    expect(body.customer_email).toBe('ada@example.com')
    const participants = body.participants as Array<Record<string, unknown>>
    expect(participants.map((p) => p.first_name)).toEqual(['Max', 'Grace'])
    expect(participants.some((p) => p.first_name === 'Ada')).toBe(false)
  })

  it('joins=false: Participant 1 blank email/phone are filled from the booker; rows 2..N untouched', async () => {
    const body = await submit({ ...BOOKER, joins: false }, [CHILD, FRIEND])
    const participants = body.participants as Array<Record<string, unknown>>
    expect(participants[0]).toMatchObject({
      first_name: 'Max',
      email: 'ada@example.com',
      phone: '+34 600 111 222',
    })
    expect(participants[1]).toMatchObject({
      first_name: 'Grace',
      email: null,
      phone: '+34 600 999 888',
    })
  })

  it('joins=false: never sends is_shared_double, even if a stale draft says shared double', async () => {
    const body = await submit({ ...BOOKER, joins: false }, [CHILD], {
      isSharedDouble: true,
      pickupLocationId: 'hotel-a',
    })
    expect(body).not.toHaveProperty('is_shared_double')
  })

  it('joins=true: participants[0] is the booker row and is_shared_double is sent', async () => {
    const body = await submit({ ...BOOKER, joins: true }, [
      { ...BOOKER, id: 'booker', service_role_code: 'participant' },
      FRIEND,
    ])
    const participants = body.participants as Array<Record<string, unknown>>
    expect(participants.map((p) => p.first_name)).toEqual(['Ada', 'Grace'])
    expect(body.is_shared_double).toBe(false)
  })

  it('a legacy booker without the flag is treated as joining (key sent)', async () => {
    const body = await submit(BOOKER, PARTICIPANTS)
    expect(body.is_shared_double).toBe(false)
    expect((body.participants as unknown[]).length).toBe(2)
  })

  it('maps a shared_double_requires_booker 422 to a readable message', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          detail: { error: 'shared_double_requires_booker', message: 'raw server text' },
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={BOOKER}
        participants={PARTICIPANTS}
        pickupLocationId="hotel-a"
        isSharedDouble
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    const errBox = await screen.findByTestId('review-error')
    expect(errBox.textContent).toMatch(/only pick it when you take part yourself/i)
    expect(errBox.textContent).not.toMatch(/422/)
  })

  // Review follow-up (MAJOR): a reference confirmed while the booker still
  // took part (accommodation → Back → tick the toggle) must never link the
  // non-participating booker's booking into the host's group.
  it('joins=false: a stale confirmed join_ref and shared double are both dropped from the body', async () => {
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={{ ...BOOKER, joins: false }}
        participants={[CHILD]}
        pickupLocationId="hotel-a"
        accommodationRooms={[]}
        isSharedDouble
        joinRef="A1B2C3D4"
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body).not.toHaveProperty('join_ref')
    expect(body).not.toHaveProperty('is_shared_double')
  })

  it('joins=true: the confirmed join_ref still rides along', async () => {
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct()}
        selection={SELECTION}
        booker={{ ...BOOKER, joins: true }}
        participants={[{ ...BOOKER, id: 'booker', service_role_code: 'participant' }]}
        pickupLocationId="hotel-a"
        accommodationRooms={[]}
        isSharedDouble
        joinRef="A1B2C3D4"
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.join_ref).toBe('A1B2C3D4')
    expect(body.is_shared_double).toBe(true)
  })
})
