/**
 * Staff-mode pass booking: the same tier picker, but the booking goes to the
 * operator-scoped staff endpoint with the signed session and the chosen
 * pass_tier_id, may start in the past, and never offers the member code flow.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  PassTiersResponse,
  Product,
  SubmitBookingResponse,
} from '@/api/types'
import { ALL_STAFF_POWERS, type StaffSession } from '@/lib/staffMode'
import { StaffModeProvider } from '@/lib/staffMode.tsx'
import { PassCheckoutStep } from './PassCheckoutStep'
import type { StaffSubmitBody } from './staffSubmitAdapter'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getPassTiers: vi.fn<(...a: unknown[]) => Promise<unknown>>(),
    submitBooking: vi.fn<(...a: unknown[]) => Promise<unknown>>(),
    submitStaffBooking: vi.fn<(op: string, body: StaffSubmitBody) => Promise<unknown>>(),
  },
}))

vi.mock('@/api/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/api/client')>()
  return { ...real, ...mocks }
})

const OPERATOR_ID = 'a1b2c3d4-0001-0001-0001-000000000002'
const STAFF: StaffSession = {
  active: true,
  token: 'staff.signed.token',
  powers: ALL_STAFF_POWERS,
  operatorId: OPERATOR_ID,
}

const product = {
  product_id: 'pass-1',
  slug: 'site-pass',
  name: 'Site pass',
  product_kind: 'pass',
  service_time_shape: null,
  is_contiguous: false,
} as unknown as Product

const tiers: PassTiersResponse = {
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
      id: 't-three', label: 'Three days', validity_kind: 'days', validity_days: 3,
      season_start: null, season_end: null, price_cents: 6000,
      has_member_price: false, member_price_cents: null, unit_price_cents: 6000,
    },
  ],
}

const RESPONSE = { booking_id: 'b-staff', semantic_state: 'pending' } as SubmitBookingResponse

function fill(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function renderStep(session: StaffSession = STAFF, onConfirmed = vi.fn()) {
  render(
    <StaffModeProvider value={session}>
      <PassCheckoutStep
        product={product}
        widgetToken="op-token"
        serviceRoles={[{ id: 'r', code: 'guest', label: 'Guest', label_localized: null, sort_order: 0 }]}
        operatorTimezone="UTC"
        operatorCountry="DE"
        onConfirmed={onConfirmed}
      />
    </StaffModeProvider>,
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
  mocks.getPassTiers.mockResolvedValue(tiers)
  mocks.submitStaffBooking.mockResolvedValue(RESPONSE)
  mocks.submitBooking.mockResolvedValue(RESPONSE)
})

afterEach(() => vi.restoreAllMocks())

describe('PassCheckoutStep in staff mode', () => {
  it('books the chosen tier through the staff endpoint with the signed session', async () => {
    const onConfirmed = renderStep()
    await fillDetails()
    expect(screen.getAllByTestId('pass-tier')).toHaveLength(2)
    fireEvent.click(screen.getAllByTestId('pass-tier')[1].querySelector('input')!)
    fireEvent.click(screen.getByTestId('pass-submit'))

    await waitFor(() => expect(mocks.submitStaffBooking).toHaveBeenCalledTimes(1))
    expect(mocks.submitBooking).not.toHaveBeenCalled()
    const [operatorId, body] = mocks.submitStaffBooking.mock.calls[0]
    expect(operatorId).toBe(OPERATOR_ID)
    expect(body.staff_session).toBe('staff.signed.token')
    expect(body.booking_channel).toBe('agent_dashboard')
    expect(body).not.toHaveProperty('widget_token')
    expect(body).not.toHaveProperty('pass_member_proof')
    expect(body.products[0]).toMatchObject({
      product_id: 'pass-1', pass_tier_id: 't-three', quantity: 1,
    })
    expect(body.customer_email).toBe('bea@example.com')
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledWith(RESPONSE, 'bea@example.com'))
  })

  it('lets staff backfill a start date in the past', async () => {
    renderStep()
    await fillDetails()
    fill(/start date/i, '2020-01-02')
    expect(screen.queryByText(/start date.*past|in the past/i)).toBeNull()
    const submit = screen.getByTestId('pass-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(false)
    fireEvent.click(submit)
    await waitFor(() => expect(mocks.submitStaffBooking).toHaveBeenCalled())
    expect(mocks.submitStaffBooking.mock.calls[0][1].products[0].selected_days).toEqual([
      '2020-01-02',
    ])
  })

  it('skips the member code flow and tells staff the price follows the email', async () => {
    renderStep()
    await fillDetails()
    expect(screen.queryByTestId('pass-member-block')).toBeNull()
    expect(screen.getByTestId('pass-staff-member-note')).toBeTruthy()
  })

  it('refuses to fall back to the public endpoint when the operator is unknown', async () => {
    renderStep({ ...STAFF, operatorId: null })
    await fillDetails()
    fireEvent.click(screen.getByTestId('pass-submit'))
    await screen.findByTestId('pass-error')
    expect(mocks.submitStaffBooking).not.toHaveBeenCalled()
    expect(mocks.submitBooking).not.toHaveBeenCalled()
  })
})
