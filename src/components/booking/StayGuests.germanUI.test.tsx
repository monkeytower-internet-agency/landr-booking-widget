/**
 * Stay products (apartments sold per night) word their people as guests
 * ("Gäste"), services keep "Teilnehmer". One helper (partyTr in
 * src/lib/strings.ts) picks the wording by the MAIN product's kind; this suite
 * checks the places a customer sees it: crumb, details step, review summary
 * and the confirmation.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { BookingSummary, Product, ProductKind, SubmitBookingResponse } from '@/api/types'
import type { BreadcrumbItem } from '@/appStepMachine'
import { configureCustomerLocale } from '@/lib/locale'
import { BookingForm, type BookingSelection } from './BookingForm'
import { BreadcrumbNavContext } from './breadcrumbNav'
import { Confirmation } from './Confirmation'
import { DetailsStep } from './DetailsStep'
import type { BookerDetails, ParticipantDetails } from './detailsTypes'
import { StepBackButton } from './StepBackButton'

vi.stubEnv('VITE_USE_MOCKS', '0')
vi.stubEnv('VITE_API_BASE_URL', 'http://api.test.invalid')

function makeProduct(kind: ProductKind): Product {
  return {
    product_id: `${kind}-main`,
    slug: kind,
    name: kind === 'stay' ? 'Casa Mare' : 'Guided day',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: kind,
    service_time_shape: kind === 'stay' ? null : 'days_range',
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
    max_party_size: 4,
    price_per_unit: null,
    currency: 'EUR',
  } as Product
}

const SELECTION: BookingSelection = {
  kind: 'days',
  selectedDays: ['2026-06-10', '2026-06-11'],
}
const BOOKER: BookerDetails = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone: '+34 600 111 222',
  billing: { address_line1: 'Calle Mayor 1', address_line2: '', postal_code: '28013', city: 'Madrid', region: '', country: 'ES', company: '', tax_id: '', name: '' },
}
const PARTICIPANTS: ParticipantDetails[] = [{ ...BOOKER, service_role_code: 'participant' }]

function setBrowserLanguage(language: string) {
  vi.stubGlobal('navigator', { ...navigator, language })
}

function germanBrowser() {
  setBrowserLanguage('de-DE')
  configureCustomerLocale(['en', 'de'], 'en')
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () => new Response(JSON.stringify({ country: null }), { status: 200 }),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  configureCustomerLocale(null, null)
})

describe('Stay products say Gäste — details step', () => {
  const renderDetails = (kind: ProductKind) =>
    render(
      <DetailsStep
        product={makeProduct(kind)}
        selection={SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

  it('words the whole step as guests for a stay', () => {
    germanBrowser()
    renderDetails('stay')
    expect(screen.getByText('Gäste')).toBeInTheDocument()
    expect(screen.getByTestId('booker-participant-helper')).toHaveTextContent(
      'Sie stehen als Gast 1 in der Buchung.',
    )
    expect(screen.getByTestId('add-participant')).toHaveTextContent('+ Gast hinzufügen')

    fireEvent.click(screen.getByTestId('add-participant'))
    expect(screen.getByText('Gast 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gast 2 entfernen' })).toBeInTheDocument()
    expect(screen.getByText(/Fügen Sie alle weiteren Gäste hinzu/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Teilnehm/)
  })

  it('keeps Teilnehmer for a service', () => {
    germanBrowser()
    renderDetails('service')
    expect(screen.getByText('Teilnehmer')).toBeInTheDocument()
    expect(screen.getByTestId('booker-participant-helper')).toHaveTextContent(
      'Sie stehen als Teilnehmer 1 in der Buchung.',
    )
    expect(screen.getByTestId('add-participant')).toHaveTextContent('+ Teilnehmer hinzufügen')
  })
})

describe('Stay products say Gäste — review summary', () => {
  const renderReview = (kind: ProductKind) =>
    render(
      <BookingForm
        widgetToken="widget"
        product={makeProduct(kind)}
        selection={SELECTION}
        booker={BOOKER}
        participants={PARTICIPANTS}
        companions={[]}
        participantLanguages={{}}
        pickupLocationId={null}
        accommodationRooms={[]}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )

  it('titles the summary "Gäste" for a stay', () => {
    germanBrowser()
    renderReview('stay')
    expect(screen.getByTestId('review-participants')).toHaveTextContent('Gäste (1)')
    expect(screen.getByTestId('review-participants')).not.toHaveTextContent(/Teilnehm/)
  })

  it('titles the summary "Teilnehmer" for a service', () => {
    germanBrowser()
    renderReview('service')
    expect(screen.getByTestId('review-participants')).toHaveTextContent('Teilnehmer (1)')
  })
})

describe('Stay products say Gäste — breadcrumb', () => {
  const items: BreadcrumbItem[] = [
    { name: 'pick-selection', label: 'Dates', current: false, target: { name: 'pick-product' } as never },
    { name: 'details', label: 'Participants', current: true, target: null },
  ]
  const renderCrumbs = (productKind: ProductKind | null | undefined) =>
    render(
      <BreadcrumbNavContext.Provider value={{ items, onNavigate: vi.fn(), productKind }}>
        <StepBackButton />
      </BreadcrumbNavContext.Provider>,
    )

  it('reads Gäste on a stay and Teilnehmer otherwise', () => {
    germanBrowser()
    const { unmount } = renderCrumbs('stay')
    expect(screen.getByTestId('step-breadcrumb')).toHaveTextContent('Gäste')
    unmount()
    renderCrumbs('service')
    expect(screen.getByTestId('step-breadcrumb')).toHaveTextContent('Teilnehmer')
  })

  it('falls back to Teilnehmer when the kind is unknown', () => {
    germanBrowser()
    renderCrumbs(undefined)
    expect(screen.getByTestId('step-breadcrumb')).toHaveTextContent('Teilnehmer')
  })
})

describe('Stay products say Gäste — confirmation', () => {
  const summary = (): BookingSummary =>
    ({
      booking_id: '00000000-0000-0000-0000-0000000000bb',
      booking_reference: 'REF-1234',
      operator_name: 'Operator',
      product_label: 'Casa Mare',
      products: [{ product_id: 'stay-main', label: 'Casa Mare', qty: 1 }],
      dates: { days: ['2026-06-10'], start: '2026-06-10', end: '2026-06-11', label: '10–11 Jun 2026' },
      participant_count: 2,
      participants: [{ name: 'Ada Lovelace' }, { name: 'Grace Hopper' }],
      pickup_location: null,
      pickup_locations: [],
      hotel: null,
      line_items: [],
      operator_total: '180.00',
      hotel_total: '0.00',
      grand_total: '180.00',
      currency: 'EUR',
      savings: [],
      savings_total: '0.00',
      subtotal_before_savings: '180.00',
      amount_due: '180.00',
      multi_day_savings: null,
      price_overridden: false,
    }) as BookingSummary
  const response: SubmitBookingResponse = {
    booking_id: '00000000-0000-0000-0000-0000000000bb',
    semantic_state: 'confirmed',
    approval_outcome: 'auto_approved',
    summary: summary(),
  } as SubmitBookingResponse

  it('counts and lists guests for a stay', () => {
    germanBrowser()
    render(<Confirmation response={response} onRestart={vi.fn()} productKind="stay" />)
    const block = screen.getByTestId('confirmation-participants')
    expect(block).toHaveTextContent('2 Gäste')
    expect(block).toHaveTextContent('Gäste (in dieser Buchung enthalten)')
    expect(block).not.toHaveTextContent(/Teilnehm/)
  })

  it('keeps Teilnehmer for a service or an unknown kind', () => {
    germanBrowser()
    render(<Confirmation response={response} onRestart={vi.fn()} />)
    const block = screen.getByTestId('confirmation-participants')
    expect(block).toHaveTextContent('2 Teilnehmer')
    expect(block).toHaveTextContent('Teilnehmer (in dieser Buchung enthalten)')
  })
})
