/**
 * landr-zcb24.12: the party step asked the ages with the main flow's bands and
 * stored each adult's band floor. A product added on the review step whose flow
 * brings a finer cut re-asks the affected guests, and the submit carries the
 * refined floors.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProductFlowResponse } from '@/api/flowTypes'
import type { Product } from '@/api/types'
import { getAvailability, getOffers, submitBooking } from '@/api/client'
import { BookingForm, type BookingSelection } from './BookingForm'
import { inheritLine } from './crossSell'
import type { BookerDetails, ParticipantDetails } from './detailsTypes'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    submitBooking: vi.fn(),
    getAvailability: vi.fn(),
    getOffers: vi.fn(),
  }
})

function makeService(id: string): Product {
  return {
    product_id: id,
    slug: id,
    name: id,
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

const DAYS = ['2024-11-23', '2024-11-24']
const SELECTION: BookingSelection = { kind: 'days', selectedDays: DAYS }
const BOOKER: BookerDetails = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone: '+34 600 000 000',
  billing: { address_line1: 'Calle Mayor 1', address_line2: '', postal_code: '28013', city: 'Madrid', region: '', country: 'ES', company: '', tax_id: '', name: '' },
}

const CHILD = { key: 'child', min_age: 0, max_age: 17 }
const MAIN_FLOW = {
  modules: null,
  age_needed: true,
  age_bands: [CHILD, { key: 'adult', min_age: 18, max_age: null }],
} as unknown as ProductFlowResponse
const EXTRA_FLOW = {
  modules: null,
  age_needed: true,
  age_bands: [
    CHILD,
    { key: 'adult', min_age: 18, max_age: 64 },
    { key: 'age_65_plus', min_age: 65, max_age: null },
  ],
} as unknown as ProductFlowResponse

// the party step stored 'Adult 18+' as the floor 18 for both adults
function adult(first: string): ParticipantDetails {
  return {
    first_name: first,
    last_name: 'X',
    email: `${first.toLowerCase()}@example.com`,
    phone: '+34 600 000 001',
    service_role_code: '',
    occupant_age_band: 'adult',
    occupant_age: 18,
    guest_attributes: { age: 18, _inexact: ['age'] },
  }
}

beforeEach(() => {
  vi.mocked(submitBooking).mockReset()
  vi.mocked(getAvailability).mockReset().mockResolvedValue([])
  vi.mocked(getOffers).mockReset().mockResolvedValue({ lines: [{ line_id: 'main', eligible: true, offers: [], draft: false }] })
})

function renderForm(extraFlow: ProductFlowResponse) {
  const line = { ...inheritLine(makeService('extra-1'), DAYS, 'l1', extraFlow), checking: false }
  return render(
    <BookingForm
      widgetToken="para42"
      product={makeService('main-1')}
      productFlow={MAIN_FLOW}
      selection={SELECTION}
      booker={BOOKER}
      participants={[adult('Ada'), adult('Grace')]}
      pickupLocationId={null}
      onBack={vi.fn()}
      onConfirmed={vi.fn()}
      extraLines={[line]}
      onExtraLinesChange={vi.fn()}
    />,
  )
}

const confirmButton = () => screen.getByRole('button', { name: /Confirm booking/i })

describe('review step re-asks the guests an added line splits (landr-zcb24.12)', () => {
  it('blocks the booking until each affected guest picks a refined band, then sends the floors', async () => {
    vi.mocked(submitBooking).mockResolvedValue({ booking_id: 'b-1', semantic_state: 'pending' })
    renderForm(EXTRA_FLOW)
    expect(await screen.findByTestId('inline-age-band-0')).toBeInTheDocument()
    expect(screen.getByTestId('inline-age-band-1')).toBeInTheDocument()
    await waitFor(() => expect(confirmButton()).toBeDisabled())

    fireEvent.change(screen.getByTestId('inline-age-band-0'), { target: { value: 'age_65_plus' } })
    fireEvent.change(screen.getByTestId('inline-age-band-1'), { target: { value: 'adult' } })
    await waitFor(() => expect(confirmButton()).not.toBeDisabled())
    await act(async () => {
      fireEvent.click(confirmButton())
    })
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    const body = vi.mocked(submitBooking).mock.calls[0]![0]
    expect(body.participants.map((p) => p.occupant_age)).toEqual([65, 18])
    expect(body.participants.map((p) => p.guest_attributes)).toEqual([
      { age: 18, _inexact: ['age'] },
      { age: 18, _inexact: ['age'] },
    ])
  })

  it('asks nothing when the added line brings no new cut', async () => {
    renderForm(MAIN_FLOW)
    await waitFor(() => expect(confirmButton()).not.toBeDisabled())
    expect(screen.queryByTestId('inline-age-band-0')).not.toBeInTheDocument()
  })
})
