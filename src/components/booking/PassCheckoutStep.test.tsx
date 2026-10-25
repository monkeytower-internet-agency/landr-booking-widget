import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  PassTiersResponse,
  Product,
  SubmitBookingBody,
  SubmitBookingResponse,
} from '@/api/types'
import { PassCheckoutStep } from './PassCheckoutStep'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getPassTiers: vi.fn<(...a: unknown[]) => Promise<unknown>>(),
    requestPassMemberProof: vi.fn<(...a: unknown[]) => Promise<unknown>>(),
    requestSubscriptionPerkOtp: vi.fn<(...a: unknown[]) => Promise<unknown>>(),
    submitBooking: vi.fn<(body: SubmitBookingBody) => Promise<unknown>>(),
  },
}))

vi.mock('@/api/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/api/client')>()
  return { ...real, ...mocks }
})

const WIDGET = 'mock-widget-token'

const product = {
  product_id: 'pass-1',
  slug: 'site-pass',
  name: 'Site pass',
  product_kind: 'pass',
  service_time_shape: null,
  is_contiguous: false,
} as unknown as Product

const guestTiers: PassTiersResponse = {
  product_id: 'pass-1',
  currency: 'EUR',
  is_member: false,
  tiers: [
    {
      id: 't-day', label: 'Day', validity_kind: 'day', validity_days: null,
      season_start: null, season_end: null, price_cents: 2500,
      has_member_price: true, member_price_cents: null, unit_price_cents: 2500,
    },
    {
      id: 't-season', label: 'Season', validity_kind: 'season', validity_days: null,
      season_start: '2099-04-01', season_end: '2099-10-31', price_cents: 30000,
      has_member_price: false, member_price_cents: null, unit_price_cents: 30000,
    },
  ],
}

const memberTiers: PassTiersResponse = {
  ...guestTiers,
  is_member: true,
  tiers: [
    { ...guestTiers.tiers[0], member_price_cents: 1500, unit_price_cents: 1500 },
    guestTiers.tiers[1],
  ],
}

const RESPONSE = { booking_id: 'b1', semantic_state: 'pending' } as SubmitBookingResponse

function fill(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function renderStep(onConfirmed = vi.fn()) {
  render(
    <PassCheckoutStep
      product={product}
      widgetToken={WIDGET}
      serviceRoles={[{ id: 'r', code: 'guest', label: 'Guest', label_localized: null, sort_order: 0 }]}
      operatorTimezone="UTC"
      operatorCountry="DE"
      onConfirmed={onConfirmed}
    />,
  )
  return onConfirmed
}

async function fillDetails() {
  await screen.findByTestId('pass-tier-list')
  fill(/first name/i, 'Bea')
  fill(/last name/i, 'Buyer')
  fill(/^e-?mail/i, 'bea@example.com')
  fill(/phone/i, '+4915100000')
  fill(/street/i, 'Hauptstr. 1')
  fill(/postal/i, '10115')
  fill(/city/i, 'Berlin')
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getPassTiers.mockResolvedValue(guestTiers)
  mocks.submitBooking.mockResolvedValue(RESPONSE)
})

describe('PassCheckoutStep', () => {
  it('lists the tiers with guest prices and hides the member amount', async () => {
    renderStep()
    const tiers = await screen.findAllByTestId('pass-tier')
    expect(tiers).toHaveLength(2)
    expect(screen.getAllByTestId('pass-tier-price')[0].textContent).toMatch(/25/)
    expect(screen.queryByText(/15[.,]00/)).toBeNull()
    expect(screen.getByTestId('pass-member-block')).toBeTruthy()
  })

  it('books a day pass with the tier, the start date and the party size', async () => {
    const onConfirmed = renderStep()
    await fillDetails()
    fireEvent.click(screen.getByTestId('pass-submit'))
    await waitFor(() => expect(mocks.submitBooking).toHaveBeenCalledTimes(1))
    const body = mocks.submitBooking.mock.calls[0][0]
    expect(body.products).toHaveLength(1)
    expect(body.products[0]).toMatchObject({
      product_id: 'pass-1', pass_tier_id: 't-day', quantity: 1,
    })
    expect(body.products[0].selected_days).toHaveLength(1)
    expect(body.participants[0]).toMatchObject({
      first_name: 'Bea', last_name: 'Buyer', phone: '+4915100000',
    })
    expect(body.customer_billing).toMatchObject({ city: 'Berlin', country: 'DE' })
    expect(body.pass_member_proof).toBeUndefined()
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledWith(RESPONSE, 'bea@example.com'))
  })

  it('needs one name per extra guest and multiplies the total', async () => {
    renderStep()
    await fillDetails()
    fireEvent.change(screen.getByLabelText(/guests/i), { target: { value: '2' } })
    expect((screen.getByTestId('pass-submit') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/guest 2/i), { target: { value: 'Gus Guest' } })
    expect((screen.getByTestId('pass-submit') as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByTestId('pass-total').textContent).toMatch(/50/)
    fireEvent.click(screen.getByTestId('pass-submit'))
    await waitFor(() => expect(mocks.submitBooking).toHaveBeenCalled())
    const body = mocks.submitBooking.mock.calls[0][0]
    expect(body.products[0].quantity).toBe(2)
    expect(body.participants.map((p) => p.first_name)).toEqual(['Bea', 'Gus'])
  })

  it('has no start date for a season tier and anchors on the season start', async () => {
    renderStep()
    await fillDetails()
    fireEvent.click(screen.getAllByTestId('pass-tier')[1].querySelector('input')!)
    expect(screen.queryByLabelText(/start date/i)).toBeNull()
    expect(screen.getByTestId('pass-season-note')).toBeTruthy()
    fireEvent.click(screen.getByTestId('pass-submit'))
    await waitFor(() => expect(mocks.submitBooking).toHaveBeenCalled())
    const line = mocks.submitBooking.mock.calls[0][0].products[0]
    expect(line.pass_tier_id).toBe('t-season')
    expect(line.selected_days).toEqual(['2099-04-01'])
  })

  it('exchanges the emailed code for a proof, re-reads the tiers and sends the proof', async () => {
    mocks.requestSubscriptionPerkOtp.mockResolvedValue({ ok: true })
    mocks.requestPassMemberProof.mockResolvedValue({ member_proof: 'pm.1.sig', expires_in: 900 })
    renderStep()
    await fillDetails()
    fireEvent.click(screen.getByTestId('pass-member-toggle'))
    fireEvent.click(screen.getByTestId('pass-member-send'))
    await waitFor(() => expect(mocks.requestSubscriptionPerkOtp).toHaveBeenCalledWith(WIDGET, 'bea@example.com'))
    mocks.getPassTiers.mockResolvedValue(memberTiers)
    fill(/code from your email/i, '123456')
    fireEvent.click(screen.getByTestId('pass-member-apply'))
    await screen.findByTestId('pass-member-applied')
    expect(mocks.getPassTiers).toHaveBeenLastCalledWith(WIDGET, 'pass-1', {
      email: 'bea@example.com', memberProof: 'pm.1.sig',
    })
    expect(screen.getByTestId('pass-total').textContent).toMatch(/15/)
    fireEvent.click(screen.getByTestId('pass-submit'))
    await waitFor(() => expect(mocks.submitBooking).toHaveBeenCalled())
    expect(mocks.submitBooking.mock.calls[0][0].pass_member_proof).toBe('pm.1.sig')
  })

  it('says so when the code does not work and keeps the guest price', async () => {
    mocks.requestSubscriptionPerkOtp.mockResolvedValue({ ok: true })
    mocks.requestPassMemberProof.mockRejectedValue(new Error('403'))
    renderStep()
    await fillDetails()
    fireEvent.click(screen.getByTestId('pass-member-toggle'))
    fireEvent.click(screen.getByTestId('pass-member-send'))
    await screen.findByLabelText(/code from your email/i)
    fill(/code from your email/i, '000000')
    fireEvent.click(screen.getByTestId('pass-member-apply'))
    await screen.findByTestId('pass-member-error')
    expect(screen.getByTestId('pass-total').textContent).toMatch(/25/)
    expect(screen.queryByTestId('pass-member-applied')).toBeNull()
  })

  it('shows an error when the booking is refused', async () => {
    mocks.submitBooking.mockRejectedValue(new Error('boom'))
    renderStep()
    await fillDetails()
    fireEvent.click(screen.getByTestId('pass-submit'))
    await screen.findByTestId('pass-error')
  })

  it('says when no passes are on sale', async () => {
    mocks.getPassTiers.mockResolvedValue({ ...guestTiers, tiers: [] })
    renderStep()
    await screen.findByTestId('pass-no-tiers')
  })
})
