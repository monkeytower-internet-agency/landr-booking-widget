/**
 * Offer lines on the review screen: the evaluator's verdicts (mocked
 * `getOffers`), the 422 offer codes, the queued Confirm and what the submit
 * body carries.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EvaluatedLine, EvaluatedOffer, Product } from '@/api/types'
import { HttpError, getAvailability, getOffers, submitBooking } from '@/api/client'
import { tr } from '@/lib/strings'
import { BookingForm, type BookingSelection } from './BookingForm'
import type { BookerDetails, ParticipantDetails } from './detailsTypes'
import { makeOffer, makePick } from './offerTestFixtures'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    submitBooking: vi.fn(),
    getAvailability: vi.fn(),
    getOffers: vi.fn(),
  }
})

function makeServiceProduct(
  shape: 'days_range' | 'time_slot' = 'days_range',
): Product {
  return {
    product_id: 'service-1',
    slug: 'guided-day',
    name: 'Guided day',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: shape,
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

const DAYS_SELECTION: BookingSelection = {
  kind: 'days',
  selectedDays: ['2024-11-23', '2024-11-24', '2024-11-25'],
}

const ADA_BOOKER: BookerDetails = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone: '+34 600 000 000',
  billing: { address_line1: 'Calle Mayor 1', address_line2: '', postal_code: '28013', city: 'Madrid', region: '', country: 'ES', company: '', tax_id: '', name: '' },
}

function bookerAsParticipant(b: BookerDetails): ParticipantDetails {
  return {
    first_name: b.first_name,
    last_name: b.last_name,
    email: b.email,
    phone: b.phone,
    // landr-mg0a: empty role code exercises the BookingForm fallback
    // ('participant') so legacy review-only tests don't need to know
    // about the operator's role catalogue.
    service_role_code: '',
  }
}


const GRACE: ParticipantDetails = {
  first_name: 'Grace',
  last_name: 'Hopper',
  email: 'grace@example.com',
  phone: '',
  service_role_code: '',
}

function line(offers: EvaluatedOffer[], over: Partial<EvaluatedLine> = {}): EvaluatedLine {
  return { line_id: 'main', eligible: true, offers, draft: false, ...over }
}

function answer(...lines: EvaluatedLine[]) {
  vi.mocked(getOffers).mockResolvedValue({ lines })
}

function renderForm(extra: Partial<React.ComponentProps<typeof BookingForm>> = {}) {
  return render(
    <BookingForm
      widgetToken="para42"
      product={makeServiceProduct('days_range')}
      selection={DAYS_SELECTION}
      booker={ADA_BOOKER}
      participants={[bookerAsParticipant(ADA_BOOKER), GRACE]}
      pickupLocationId={null}
      onBack={vi.fn()}
      onConfirmed={vi.fn()}
      {...extra}
    />,
  )
}

const confirmButton = () => screen.getByRole('button', { name: /Confirm booking/i })

async function confirmWhenSettled() {
  await waitFor(() => expect(getOffers).toHaveBeenCalled())
  await waitFor(() => expect(confirmButton()).not.toBeDisabled())
  await act(async () => {
    fireEvent.click(confirmButton())
  })
}

beforeEach(() => {
  vi.mocked(submitBooking).mockReset()
  vi.mocked(getAvailability).mockReset().mockResolvedValue([])
  vi.mocked(getOffers).mockReset()
  answer(line([]))
})

const ERROR_COPY: Array<[string, Parameters<typeof tr>[0]]> = [
  ['offer_not_eligible', 'offerErrNotEligible'],
  ['product_not_eligible', 'offerErrProductNotEligible'],
  ['attribute_missing', 'offerErrAttributeMissing'],
  ['offer_parent_unknown', 'offerErrParentUnknown'],
  ['offer_participant_required', 'offerErrParticipantRequired'],
  ['offer_participant_duplicate', 'offerErrParticipantDuplicate'],
  ['offer_option_required', 'offerErrOptionRequired'],
  ['offer_option_unknown', 'offerErrOptionUnknown'],
  ['offer_quantity_out_of_range', 'offerErrQuantity'],
  ['companion_days_required', 'companionErrDaysRequired'],
  ['companion_days_outside_parent', 'companionErrOutsideParent'],
  ['offer_days_required', 'offerErrDaysRequired'],
  ['bad_parent_line', 'offerErrBadParent'],
]

describe('BookingForm — offer 422 codes render their copy', () => {
  it.each(ERROR_COPY)('%s', async (code, key) => {
    vi.mocked(submitBooking).mockRejectedValue(
      new HttpError(422, 'x', JSON.stringify({ detail: { error: code, line_id: 'o1' } })),
    )
    renderForm()
    await confirmWhenSettled()
    expect(await screen.findByText(tr(key, 'en'))).toBeInTheDocument()
    expect(submitBooking).toHaveBeenCalledTimes(1)
  })
})

describe('BookingForm — offers on the review screen', () => {
  it('disables Confirm and says why when the main line is ineligible', async () => {
    answer(
      line([], {
        eligible: false,
        eligibility_reason_key: 'guest_attr_all.age',
        eligibility_reason_params: { op: 'gte', value: 10 },
      }),
    )
    renderForm()
    const box = await screen.findByTestId('main-ineligible')
    expect(box).toHaveTextContent('No guests under 10')
    expect(confirmButton()).toBeDisabled()
    expect(submitBooking).not.toHaveBeenCalled()
  })

  it('queues a Confirm pressed while the evaluate call is pending and submits once the verdict lands', async () => {
    let release!: (v: { lines: EvaluatedLine[] }) => void
    vi.mocked(getOffers).mockReturnValue(new Promise((resolve) => (release = resolve)))
    vi.mocked(submitBooking).mockResolvedValue({ booking_id: 'b-1', semantic_state: 'pending' })
    renderForm()
    await act(async () => {
      fireEvent.click(confirmButton())
    })
    expect(submitBooking).not.toHaveBeenCalled()
    await waitFor(() => expect(getOffers).toHaveBeenCalled())
    await act(async () => {
      release({ lines: [line([])] })
    })
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
  })

  it('refs every guest g1..gN and names the ticked guest on the offer line, without any price field', async () => {
    const cot = makeOffer({
      id: 'offer-cot',
      product_id: 'cot-1',
      binding: 'person',
      collection: 'free',
      name: 'Baby cot',
    })
    answer(line([cot]))
    vi.mocked(submitBooking).mockResolvedValue({ booking_id: 'b-1', semantic_state: 'pending' })
    renderForm({
      companions: [
        { first_name: 'Linus', last_name: 'Pauling', email: '', phone: '', companion_kind: 'guest' },
      ],
      offerPicks: [makePick(cot, 'main', 'o1', { memberIds: ['g2'] })],
    })
    await confirmWhenSettled()
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    const body = vi.mocked(submitBooking).mock.calls[0]![0]
    expect(body.participants.map((p) => p.ref)).toEqual(['g1', 'g2'])
    expect(body.companions?.map((c) => c.ref)).toEqual(['g3'])
    const offerLine = body.products.find((p) => p.product_id === 'cot-1')!
    expect(offerLine).toMatchObject({
      line_id: 'o1',
      parent_line_id: 'main',
      offer_id: 'offer-cot',
      participant_id: 'g2',
    })
    expect(body.products[0]).toMatchObject({ line_id: 'main' })
    for (const l of body.products) {
      for (const k of ['price', 'collection', 'mode', 'schedule', 'binding']) {
        expect(l).not.toHaveProperty(k)
      }
    }
  })

  it('preselects a mandatory booking offer (checked, locked) and submits it; a server-attached person offer is not sent', async () => {
    const insurance = makeOffer({
      id: 'offer-ins',
      product_id: 'ins-1',
      mode: 'mandatory',
      name: 'Insurance',
    })
    const tax = makeOffer({
      id: 'offer-tax',
      product_id: 'tax-1',
      mode: 'mandatory',
      binding: 'person',
      collection: 'on_site',
      server_attached: true,
      name: 'Tourist tax',
    })
    answer(line([insurance, tax]))
    vi.mocked(submitBooking).mockResolvedValue({ booking_id: 'b-1', semantic_state: 'pending' })
    renderForm()
    const toggle = await screen.findByTestId('offer-toggle-offer-ins')
    await waitFor(() => expect(toggle).toBeChecked())
    expect(toggle).toBeDisabled()
    await confirmWhenSettled()
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    const ids = vi.mocked(submitBooking).mock.calls[0]![0].products.map((p) => p.product_id)
    expect(ids).toContain('ins-1')
    expect(ids).not.toContain('tax-1')
  })
})
