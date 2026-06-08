import { describe, it, expect, vi, afterEach } from 'vitest'
import * as client from './client'
import type { StaffSubmitBody, SubmitBookingBody } from './types'
import { MOCK_PREVIEW_TOKEN } from './mocks'

describe('listProducts with mocks', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns all products when no group is specified', async () => {
    const products = await client.listProducts('para42')
    expect(products.length).toBeGreaterThan(0)
  })

  it('respects group filter in mock mode', async () => {
    const allProducts = await client.listProducts('para42')
    const coursesProducts = await client.listProducts('para42', { group: 'courses' })
    expect(coursesProducts.length).toBeLessThanOrEqual(allProducts.length)
  })
})

describe('getOperatorSettings with mocks (landr-e10.9)', () => {
  it('returns the operator slug and the safe default (false) for unknown operators', async () => {
    const settings = await client.getOperatorSettings('para42')
    expect(settings.slug).toBe('para42')
    expect(settings.expose_seats_to_customer).toBe(false)
  })
})

describe('getOperatorServiceRoles with mocks (landr-mg0a)', () => {
  it('returns the auto-seeded participant role by default', async () => {
    const roles = await client.getOperatorServiceRoles('para42')
    expect(roles).toHaveLength(1)
    expect(roles[0]?.code).toBe('participant')
    expect(roles[0]?.label).toBe('Participant')
    // id must be a non-empty string the BookingForm can pass through.
    expect(typeof roles[0]?.id).toBe('string')
    expect(roles[0]?.id.length).toBeGreaterThan(0)
  })
})

// landr-7zc5.3: preview mode — preview_token forwarded on fetch + submit.
describe('preview mode (landr-7zc5.3)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('absent preview_token → published-only products (no draft badge source)', async () => {
    const products = await client.listProducts('para42')
    // No draft products in the list (is_publicly_listed=false absent from results).
    for (const p of products) {
      expect(p.is_publicly_listed).not.toBe(false)
    }
  })

  it('present preview_token → draft products included in the list', async () => {
    const products = await client.listProducts('para42', { previewToken: MOCK_PREVIEW_TOKEN })
    const drafts = products.filter((p) => p.is_publicly_listed === false)
    expect(drafts.length).toBeGreaterThan(0)
  })

  it('preview_token forwarded to fetch: appends ?preview_token to the products URL', async () => {
    vi.stubEnv('VITE_USE_MOCKS', '0')
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    )
    await client.listProducts('tok-abc', { previewToken: 'prev-xyz' })
    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain('preview_token=prev-xyz')
    expect(calledUrl).toContain('/api/public/operators/tok-abc/products')
  })

  it('absent preview_token → fetch URL has NO preview_token param', async () => {
    vi.stubEnv('VITE_USE_MOCKS', '0')
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    )
    await client.listProducts('tok-abc')
    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).not.toContain('preview_token')
  })

  it('preview_token forwarded on submit: body includes preview_token field', async () => {
    vi.stubEnv('VITE_USE_MOCKS', '0')
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ booking_id: 'b-1', semantic_state: 'pending' }), { status: 200 }),
    )
    const baseBody: SubmitBookingBody = {
      widget_token: 'tok-abc',
      customer_first_name: 'Ada',
      customer_email: 'ada@example.com',
      cancellation_deadline: '2026-06-01T00:00:00Z',
      products: [{ product_id: 'p-1', quantity: 1, selected_days: ['2026-06-10'] }],
      participants: [{ first_name: 'Ada', service_role_code: 'participant' }],
    }
    await client.submitBooking(baseBody, { previewToken: 'prev-xyz' })
    const sentBody = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>
    expect(sentBody.preview_token).toBe('prev-xyz')
  })

  it('absent preview_token on submit → body has no preview_token field', async () => {
    vi.stubEnv('VITE_USE_MOCKS', '0')
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ booking_id: 'b-1', semantic_state: 'pending' }), { status: 200 }),
    )
    const baseBody: SubmitBookingBody = {
      widget_token: 'tok-abc',
      customer_first_name: 'Ada',
      customer_email: 'ada@example.com',
      cancellation_deadline: '2026-06-01T00:00:00Z',
      products: [{ product_id: 'p-1', quantity: 1, selected_days: ['2026-06-10'] }],
      participants: [{ first_name: 'Ada', service_role_code: 'participant' }],
    }
    await client.submitBooking(baseBody)
    const sentBody = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>
    expect(sentBody).not.toHaveProperty('preview_token')
  })
})

// landr-aoak.4: staff-authorized submit goes to the SEPARATE operator-scoped
// endpoint, NOT /api/public/bookings.
describe('submitStaffBooking (landr-aoak.4)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const OPERATOR_ID = 'a1b2c3d4-0001-0001-0001-000000000002'

  function staffBody(): StaffSubmitBody {
    return {
      staff_session: 'signed.staff.token',
      customer_first_name: 'Ada',
      customer_email: 'ada@example.com',
      cancellation_deadline: '2026-06-01T00:00:00Z',
      booking_channel: 'agent_dashboard',
      products: [{ product_id: 'p-1', quantity: 1, selected_days: ['2026-06-10'] }],
      participants: [
        { first_name: 'Ada', service_role_code: 'participant', phone: '+34600000001' },
      ],
      ignore_capacity: true,
      override_gross_total: '199.95',
      override_reason: 'loyalty comp',
    }
  }

  it('POSTs the staff endpoint at the operator-scoped path with the session body', async () => {
    vi.stubEnv('VITE_USE_MOCKS', '0')
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          booking_id: 'bk-staff-1',
          semantic_state: 'pending',
          stage_code: 'awaiting_payment',
          approval_outcome: 'staff_authorized',
          forced: true,
          price_overridden: true,
        }),
        { status: 201 },
      ),
    )

    const res = await client.submitStaffBooking(OPERATOR_ID, staffBody())

    // URL: the operator-scoped staff path — NOT /api/public/bookings.
    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toBe(
      `https://api.example.com/api/staff/operators/${OPERATOR_ID}/bookings/submit`,
    )
    expect(calledUrl).not.toContain('/api/public/bookings')

    const init = fetchSpy.mock.calls[0]?.[1]
    expect(init?.method).toBe('POST')
    const sent = JSON.parse(init?.body as string) as Record<string, unknown>
    // Credential is the staff_session; NO widget_token.
    expect(sent.staff_session).toBe('signed.staff.token')
    expect(sent).not.toHaveProperty('widget_token')
    // Power fields + string override survive on the wire.
    expect(sent.ignore_capacity).toBe(true)
    expect(sent.override_gross_total).toBe('199.95')
    expect(sent.override_reason).toBe('loyalty comp')
    expect(sent.booking_channel).toBe('agent_dashboard')

    // Response maps to booking_id for the completion postMessage.
    expect(res.booking_id).toBe('bk-staff-1')
    expect(res.semantic_state).toBe('pending')
    expect(res.approval_outcome).toBe('staff_authorized')
  })

  it('encodes the operator id into the path', async () => {
    vi.stubEnv('VITE_USE_MOCKS', '0')
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ booking_id: 'b', semantic_state: 'pending' }), {
        status: 201,
      }),
    )
    await client.submitStaffBooking('op/with space', staffBody())
    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain('/api/staff/operators/op%2Fwith%20space/bookings/submit')
  })

  it('returns the mock submit shape in mock mode (no real fetch)', async () => {
    vi.stubEnv('VITE_USE_MOCKS', '1')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const res = await client.submitStaffBooking(OPERATOR_ID, staffBody())
    expect(res.booking_id).toBeTruthy()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
