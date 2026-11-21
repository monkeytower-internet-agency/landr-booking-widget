/**
 * The billing address is entered on the Address step before the Review
 * (landr-rw8i2). The Review shows it as a summary card, links back to edit
 * it, and keeps Confirm disabled while it is incomplete (defence in depth:
 * a deep link or Back-navigation can land here without it). Entry-side
 * coverage lives in AddressStep.test.tsx.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import { StaffModeProvider } from '@/lib/staffMode.tsx'
import { submitBooking, submitStaffBooking } from '@/api/client'
import { BookingForm, type BookingSelection } from './BookingForm'
import { emptyBilling, type BillingDetails, type BookerDetails } from './detailsTypes'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return { ...actual, submitBooking: vi.fn(), submitStaffBooking: vi.fn() }
})

function makeProduct(): Product {
  return {
    product_id: 'service-1',
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
    hotel_offering: 'none',
    hotel_location_id: null,
    price_per_unit: null,
    currency: 'EUR',
  }
}

const SELECTION: BookingSelection = { kind: 'days', selectedDays: ['2026-05-23'] }

function booker(billing: BillingDetails = emptyBilling()): BookerDetails {
  return {
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    phone: '+34 600 000 000',
    billing,
    joins: true,
  }
}

function renderReview(props: Partial<React.ComponentProps<typeof BookingForm>> = {}) {
  const onConfirmed = vi.fn()
  const view = render(
    <BookingForm
      widgetToken="op-x"
      product={makeProduct()}
      selection={SELECTION}
      booker={booker()}
      participants={[
        {
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
          phone: '+34 600 000 000',
          service_role_code: '',
        },
      ]}
      pickupLocationId={null}
      onBack={vi.fn()}
      onConfirmed={onConfirmed}
      {...props}
    />,
  )
  return { onConfirmed, ...view }
}

async function clickConfirm() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('review-confirm-btn'))
  })
}

beforeEach(() => {
  vi.mocked(submitBooking).mockReset()
  vi.mocked(submitBooking).mockResolvedValue({ booking_id: 'b-1', semantic_state: 'pending' })
})

const FILLED: BillingDetails = {
  address_line1: 'Calle Mayor 1',
  address_line2: '3B',
  postal_code: '28013',
  city: 'Madrid',
  region: '',
  country: 'ES',
  company: '',
  tax_id: '',
  name: '',
}

const confirmBtn = () => screen.getByTestId('review-confirm-btn')

describe('BookingForm review — billing address summary', () => {
  it('shows the entered address as a read-only summary with no billing inputs', () => {
    renderReview({ booker: booker({ ...FILLED, company: 'Para42 SL', tax_id: 'B1', name: 'Grace Hopper' }) })
    const card = screen.getByTestId('review-billing')
    expect(card).toHaveTextContent('Billing address')
    expect(card).toHaveTextContent('Para42 SL')
    expect(card).toHaveTextContent('Grace Hopper')
    expect(card).toHaveTextContent('Calle Mayor 1')
    expect(card).toHaveTextContent('3B')
    expect(card).toHaveTextContent('28013 Madrid')
    expect(card).toHaveTextContent('Spain')
    expect(card).toHaveTextContent('B1')
    expect(document.querySelector('[name^="booker_billing"]')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Billing address' })).not.toBeInTheDocument()
  })

  it('"Edit" on the summary goes back to the Address step', () => {
    const onEditBilling = vi.fn()
    renderReview({ booker: booker(FILLED), onEditBilling })
    fireEvent.click(screen.getByTestId('review-billing-edit'))
    expect(onEditBilling).toHaveBeenCalledTimes(1)
  })

  it('no longer asks for the address on the review itself', () => {
    renderReview()
    expect(screen.queryByText(/enter your billing address/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('next-action-cue')).not.toBeInTheDocument()
  })
})

describe('BookingForm review — Confirm gate (defence in depth)', () => {
  it('keeps Confirm disabled, with a pointer to the Address step, while the address is incomplete', async () => {
    renderReview()
    expect(confirmBtn()).toBeDisabled()
    expect(document.getElementById('review-step-gate')).toHaveTextContent(
      'Add your billing address in the Address step to confirm.',
    )
    await clickConfirm()
    expect(submitBooking).not.toHaveBeenCalled()
  })

  it.each([
    ['street', { address_line1: '' }],
    ['postal code', { postal_code: '' }],
    ['city', { city: '  ' }],
    ['country', { country: '' }],
  ])('stays disabled when only the %s is empty', (_label, patch) => {
    renderReview({ booker: booker({ ...FILLED, ...patch }) })
    expect(confirmBtn()).toBeDisabled()
  })

  it('tolerates a booker persisted before billing existed', async () => {
    const legacy = {
      first_name: 'Ada',
      last_name: 'L',
      email: 'ada@example.com',
      phone: '+34600000000',
    } as unknown as BookerDetails
    renderReview({ booker: legacy })
    expect(confirmBtn()).toBeDisabled()
    await clickConfirm()
    expect(submitBooking).not.toHaveBeenCalled()
  })

  it('enables Confirm once the address is complete and submits it as customer_billing', async () => {
    renderReview({ booker: booker(FILLED) })
    expect(confirmBtn()).toBeEnabled()
    expect(document.getElementById('review-step-gate')).toHaveTextContent('Ready to confirm.')
    await clickConfirm()
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    expect(vi.mocked(submitBooking).mock.calls[0]![0].customer_billing).toEqual({
      address_line1: 'Calle Mayor 1',
      address_line2: '3B',
      postal_code: '28013',
      city: 'Madrid',
      region: null,
      country: 'ES',
      company: null,
      tax_id: null,
      name: null,
    })
  })

  // landr-jsu3n.2: optional "Invoice name" + company ride along, also for an
  // invitee joining through an invite link (the invite token rides the submit).
  it.each([
    ['direct booking', undefined],
    ['invite link', 'invite-token'],
  ])('submits the Invoice name and company - %s', async (_label, inviteToken) => {
    renderReview({
      inviteToken,
      booker: booker({ ...FILLED, company: 'Acme SL', tax_id: 'B12', name: 'Grace Hopper' }),
    })
    await clickConfirm()
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    const body = vi.mocked(submitBooking).mock.calls[0]![0]
    expect(body.customer_billing).toMatchObject({
      name: 'Grace Hopper',
      company: 'Acme SL',
      tax_id: 'B12',
    })
    expect(body.invite_token).toBe(inviteToken)
  })
})

describe('BookingForm review - billing address in staff mode (landr-uuntm.3)', () => {
  const STAFF = { active: true, token: 't.o.k', powers: [], operatorId: 'op-1' } as const
  function renderStaff(b: BookerDetails) {
    return render(
      <StaffModeProvider value={STAFF}>
        <BookingForm
          widgetToken="op-x"
          product={makeProduct()}
          selection={SELECTION}
          booker={b}
          participants={[]}
          pickupLocationId={null}
          onBack={vi.fn()}
          onConfirmed={vi.fn()}
        />
      </StaffModeProvider>,
    )
  }

  beforeEach(() => {
    vi.mocked(submitStaffBooking).mockReset()
    vi.mocked(submitStaffBooking).mockResolvedValue({
      booking_id: 'b-1',
      semantic_state: 'pending',
    } as never)
  })

  it('Confirm works without an address (optional for staff) and shows no empty summary', async () => {
    renderStaff(booker())
    expect(screen.queryByTestId('review-billing')).not.toBeInTheDocument()
    expect(confirmBtn()).toBeEnabled()
    expect(document.getElementById('review-step-gate')).toHaveTextContent('Ready to confirm.')
    await clickConfirm()
    await waitFor(() => expect(submitStaffBooking).toHaveBeenCalledTimes(1))
    expect(vi.mocked(submitStaffBooking).mock.calls[0]![1]).not.toHaveProperty(
      'customer_billing',
    )
  })

  it('carries an address the operator entered', async () => {
    renderStaff(booker(FILLED))
    expect(screen.getByTestId('review-billing')).toHaveTextContent('Calle Mayor 1')
    await clickConfirm()
    await waitFor(() => expect(submitStaffBooking).toHaveBeenCalledTimes(1))
    expect(vi.mocked(submitStaffBooking).mock.calls[0]![1].customer_billing).toMatchObject({
      address_line1: 'Calle Mayor 1',
      country: 'ES',
    })
  })
})
