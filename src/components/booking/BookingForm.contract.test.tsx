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
import { BookingForm, type BookingSelection } from './BookingForm'
import type {
  BookerDetails,
  CompanionDetails,
  ParticipantDetails,
} from './detailsTypes'

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
] as const

const REQUIRED_PRODUCT_LINE = ['product_id', 'quantity'] as const
const REQUIRED_PARTICIPANT = ['first_name', 'service_role_code'] as const

describe('BookingForm submit body — matches /api/public/bookings PublicSubmitBookingIn (landr-piyv)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          booking_id: 'b-1',
          semantic_state: 'pending',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    )
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
        addons={[
          { productId: 'breakfast-1', quantity: 4 },
          { productId: 'video-pkg', quantity: 1 },
        ]}
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

    // cancellation_deadline is an ISO datetime string, computed as
    // 00:00 UTC of (firstDay − 1 day) = 2026-06-09T00:00:00.000Z
    expect(typeof body.cancellation_deadline).toBe('string')
    expect(body.cancellation_deadline).toBe('2026-06-09T00:00:00.000Z')

    // products: service + 1 room + 2 addons = 4 lines, each with required ProductLineIn fields
    const products = body.products as Array<Record<string, unknown>>
    expect(products).toHaveLength(4)
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

    // Add-on lines (per-line item, not folded into a separate field)
    expect(products[2]).toMatchObject({ product_id: 'breakfast-1', quantity: 4 })
    expect(products[3]).toMatchObject({ product_id: 'video-pkg', quantity: 1 })

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
})
