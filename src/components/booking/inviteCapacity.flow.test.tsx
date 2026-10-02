/**
 * landr-f987a.6 (widget half): App-level capacity / seat-hold flow with a
 * mocked API — host confirmation text (held / not held / requested), invite
 * landing (held vs ended), Change dates with an unavailable host day, and the
 * 422 capacity_exceeded that carries `days`.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import { HttpError } from '@/api/client'
import App from '@/App'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    listProducts: vi.fn(),
    listProductGroups: vi.fn(),
    getOperatorSettings: vi.fn(),
    getOperatorServiceRoles: vi.fn(),
    getAvailability: vi.fn(),
    getFixedDateWindows: vi.fn(),
    listLocations: vi.fn(),
    listPickupLocationsForOperator: vi.fn(),
    submitBooking: vi.fn(),
    requestSubscriptionPerkOtp: vi.fn(),
    getHotelsForOperator: vi.fn(),
    getHotelRoomsForHotel: vi.fn(),
    getProductAddons: vi.fn(),
    estimateBookingPrice: vi.fn(),
    getProductFlow: vi.fn(),
    getInvitePrefill: vi.fn(),
    getContactPagePrefill: vi.fn(),
  },
}))

vi.mock('@/api/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/api/client')>()
  return { ...real, ...mocks }
})

const TOKEN = 'mock-token-abc'
const DAY = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)
const DAY_B = new Date(Date.now() + 11 * 86_400_000).toISOString().slice(0, 10)

const product = (over: Partial<Product> = {}): Product =>
  ({
    product_id: 'p-flow',
    slug: 'tandem',
    name: 'Tandem Flight',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'single_date',
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
    ...over,
  }) as Product

const slot = (date: string, available_seats: number) => ({
  availability_id: `slot-${date}`,
  date,
  start_time: null,
  end_time: null,
  capacity: 10,
  capacity_reserved: 10 - available_seats,
  available_seats,
  status: available_seats > 0 ? 'open' : 'fully_booked',
})

const prefill = (over: Record<string, unknown> = {}) => ({
  operator_id: 'op-1',
  widget_token: TOKEN,
  product_id: 'p-flow',
  dates: [DAY],
  hotel_location_id: null,
  is_shared_double: false,
  invitee_first_name: 'Thomas',
  invitee_last_name: 'Klein',
  host_display_name: 'Olaf K***n',
  host_reference: 'A1B2C3D4',
  language: 'en',
  ...over,
})

const inSeventyTwoHours = () => new Date(Date.now() + 72 * 3_600_000).toISOString()

async function driveToConfirm() {
  const setInput = (name: string, value: string) =>
    fireEvent.change(document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!, {
      target: { value },
    })
  await waitFor(() => expect(screen.getByText(/Pick a date/i)).toBeInTheDocument())
  await waitFor(() => {
    const enabled = screen
      .getAllByRole('gridcell')
      .map((c) => c.querySelector('button'))
      .filter((b): b is HTMLButtonElement => !!b && !b.disabled)
    expect(enabled.length).toBeGreaterThan(0)
  })
  const days = screen
    .getAllByRole('gridcell')
    .map((c) => c.querySelector('button'))
    .filter((b): b is HTMLButtonElement => !!b && !b.disabled)
  fireEvent.click(days[0]!)
  fireEvent.click(await screen.findByRole('button', { name: /continue/i }))
  await waitFor(() => expect(screen.getByText(/your contact details/i)).toBeInTheDocument())
  setInput('booker_first_name', 'Olaf')
  setInput('booker_last_name', 'Klein')
  setInput('booker_email', 'olaf@example.com')
  setInput('booker_phone', '+34 600000000')
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  await screen.findByTestId('participant-language-board')
  const submit = screen.getByTestId('language-step-submit') as HTMLButtonElement
  if (submit.disabled) {
    fireEvent.click(screen.getByTestId('lang-add-en'))
    await waitFor(() => expect(screen.getByTestId('language-step-submit')).toBeEnabled())
  }
  fireEvent.click(screen.getByTestId('language-step-submit'))
  await waitFor(() => expect(screen.getByText(/review your booking/i)).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: /confirm booking/i }))
}

const invite = (over: Record<string, unknown> = {}) => ({
  companion_id: 'c-1',
  name: 'Matthias',
  email: null,
  phone: null,
  phone_digits: null,
  invite_url: 'https://example.test/i/abc',
  whatsapp_url: null,
  linked_booking_reference: null,
  has_invite: true,
  ...over,
})

const confirmed = (invites: unknown[]) => ({
  booking_id: '00000000-0000-0000-0000-0000000000bb',
  status: 'confirmed',
  share_secret: 's',
  invites,
})

beforeEach(() => {
  window.sessionStorage.clear()
  mocks.getOperatorSettings.mockResolvedValue({ slug: 'para42', expose_seats_to_customer: false })
  mocks.getOperatorServiceRoles.mockResolvedValue([])
  mocks.listProductGroups.mockResolvedValue([])
  mocks.getAvailability.mockResolvedValue([slot(DAY, 5), slot(DAY_B, 5)])
  mocks.getFixedDateWindows.mockResolvedValue([])
  mocks.listLocations.mockResolvedValue([])
  mocks.listPickupLocationsForOperator.mockResolvedValue([])
  mocks.getHotelsForOperator.mockResolvedValue([])
  mocks.getHotelRoomsForHotel.mockResolvedValue([])
  mocks.getProductAddons.mockResolvedValue([])
  mocks.requestSubscriptionPerkOtp.mockResolvedValue({ ok: true })
  mocks.getProductFlow.mockResolvedValue({ modules: null })
  mocks.estimateBookingPrice.mockResolvedValue({
    line_items: [],
    operator_total: '0.00',
    hotel_total: '0.00',
    grand_total: '0.00',
    currency: 'EUR',
    applied_rules: [],
  })
  mocks.listProducts.mockResolvedValue([product()])
  window.history.replaceState({}, '', `/?w=${TOKEN}&start=dates`)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('host confirmation — seat hold text', () => {
  const run = async (inv: Record<string, unknown>) => {
    mocks.submitBooking.mockResolvedValue(confirmed([invite(inv)]))
    mocks.getInvitePrefill.mockResolvedValue(prefill())
    window.history.replaceState({}, '', '/i/tok-host')
    render(<App />)
    await driveToConfirm()
    return screen.findByTestId('invite-hold-line')
  }

  it('held: names the invitee, hours and deadline', async () => {
    const line = await run({ seat_hold_expires_at: inSeventyTwoHours(), seat_hold_hours: 72 })
    expect(line).toHaveTextContent(
      /When you booked, seats for Matthias were still free\. Held for 72 hours, until /,
    )
  })

  it('not held: only when the operator holds nothing (hours === 0)', async () => {
    const line = await run({ seat_hold_expires_at: null, seat_hold_hours: 0 })
    expect(line).toHaveTextContent('Seats for Matthias are not held')
  })

  it('requested: seats were not free at booking time', async () => {
    const line = await run({
      seat_hold_expires_at: inSeventyTwoHours(),
      seat_hold_hours: 72,
      seats_were_free: false,
    })
    expect(line).toHaveTextContent(
      /Seats for Matthias are requested and held for 72 hours, until .*The operator still has to confirm that everyone fits\./,
    )
  })

  it('unknown hours and no live hold: no line at all', async () => {
    mocks.submitBooking.mockResolvedValue(
      confirmed([invite({ seat_hold_expires_at: null, seat_hold_hours: null })]),
    )
    mocks.getInvitePrefill.mockResolvedValue(prefill())
    window.history.replaceState({}, '', '/i/tok-host')
    render(<App />)
    await driveToConfirm()
    await screen.findByTestId('invite-card')
    expect(screen.queryByTestId('invite-hold-line')).not.toBeInTheDocument()
  })
})

describe('invite landing', () => {
  const land = async (extra: Record<string, unknown>) => {
    mocks.getInvitePrefill.mockResolvedValue(prefill(extra))
    window.history.replaceState({}, '', '/i/tok-landing')
    render(<App />)
    await screen.findByTestId('invite-banner')
  }

  it('live hold: shows until when and passes the token to availability', async () => {
    await land({ seat_hold_expires_at: inSeventyTwoHours(), seat_hold_hours: 72 })
    expect(await screen.findByTestId('invite-hold')).toHaveTextContent(/Your seat is held until /)
    await waitFor(() => expect(mocks.getAvailability).toHaveBeenCalled())
    expect(mocks.getAvailability.mock.calls.at(-1)?.[3]).toBe('tok-landing')
  })

  it('ended hold: non-blocking "hold has ended" text, booking still possible', async () => {
    await land({ seat_hold_expires_at: null, seat_hold_hours: 24 })
    expect(await screen.findByTestId('invite-hold')).toHaveTextContent(
      'The hold on your seat has ended — you can still book while seats last.',
    )
  })

  it('never held (hours 0): no hold text', async () => {
    await land({ seat_hold_expires_at: null, seat_hold_hours: 0 })
    expect(screen.queryByTestId('invite-hold')).not.toBeInTheDocument()
  })
})

describe('Change dates with an unavailable host day', () => {
  it('blocks the summary, and Change dates drops the full day with a notice', async () => {
    mocks.listProducts.mockResolvedValue([product({ service_time_shape: 'days_range' })])
    mocks.getAvailability.mockResolvedValue([slot(DAY, 0), slot(DAY_B, 5)])
    mocks.getInvitePrefill.mockResolvedValue(prefill({ dates: [DAY, DAY_B] }))
    window.history.replaceState({}, '', '/i/tok-full')
    render(<App />)
    await screen.findByTestId('invite-dates-unavailable')
    expect(screen.getByRole('button', { name: /Continue with these dates/i })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Change dates/i }))
    await waitFor(() => expect(screen.getByText('1 day selected')).toBeInTheDocument())
    expect(screen.getByTestId('multi-day-reset-dropped-notice')).toBeInTheDocument()
    expect(screen.queryByTestId('operator-override-badge')).not.toBeInTheDocument()
  })
})

describe('422 capacity_exceeded with days', () => {
  it('names the short day instead of the generic copy and offers Change dates', async () => {
    mocks.getInvitePrefill.mockResolvedValue(prefill())
    window.history.replaceState({}, '', '/i/tok-422')
    mocks.submitBooking.mockRejectedValue(
      new HttpError(
        422,
        'Unprocessable Entity',
        JSON.stringify({
          detail: {
            error: 'capacity_exceeded',
            message: 'Not enough free seats (x: 1 seat short)',
            days: [{ date: DAY, seats_short: 1 }],
          },
        }),
      ),
    )
    render(<App />)
    await driveToConfirm()
    const err = await screen.findByTestId('review-error')
    expect(err).toHaveTextContent(/seats? left on .* — you need 1\./)
    expect(err).not.toHaveTextContent(/not enough space left/i)
    expect(screen.getByTestId('review-change-dates')).toBeInTheDocument()
  })
})
