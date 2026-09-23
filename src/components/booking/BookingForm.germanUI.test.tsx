/**
 * landr-5aih0.9 — widget German UI.
 *
 * Full-flow check that BookingForm's review screen renders in German once
 * the operator's customer_languages whitelist includes 'de' and the
 * browser reports a German locale, and falls back to English when 'de' is
 * not in the whitelist (per the locale resolver in src/lib/locale.ts:
 * invite override → operator whitelist → browser → operator default).
 *
 * Named .germanUI. rather than .language. to avoid clashing with the
 * existing BookingForm.language.test.tsx, which covers a different concern
 * (per-participant guide language on the submit body, landr-r6e5x.4).
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import { configureCustomerLocale, overrideBookingLocale } from '@/lib/locale'
import { BookingForm, type BookingSelection } from './BookingForm'
import type { BookerDetails, ParticipantDetails } from './detailsTypes'

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
    hotel_offering: 'none',
    hotel_location_id: null,
    price_per_unit: null,
    currency: 'EUR',
  }
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
}
const PARTICIPANTS: ParticipantDetails[] = [{ ...BOOKER, service_role_code: 'participant' }]

function renderForm() {
  render(
    <BookingForm
      widgetToken="para42"
      product={makeServiceProduct()}
      selection={SELECTION}
      booker={BOOKER}
      participants={PARTICIPANTS}
      companions={[]}
      participantLanguages={{}}
      pickupLocationId={null}
      accommodationRooms={[]}
      addons={[]}
      onBack={vi.fn()}
      onConfirmed={vi.fn()}
    />,
  )
}

function setBrowserLanguage(language: string) {
  vi.stubGlobal('navigator', { ...navigator, language })
}

describe('BookingForm — German UI (landr-5aih0.9)', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ booking_id: 'b-1', semantic_state: 'pending' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    configureCustomerLocale(null, null)
    overrideBookingLocale(null)
  })

  it('renders the review screen in German when de is in the operator whitelist and the browser is German', () => {
    setBrowserLanguage('de-DE')
    configureCustomerLocale(['en', 'de'], 'en')
    renderForm()

    expect(screen.getByText('Ihre Buchung überprüfen')).toBeInTheDocument()
    expect(screen.getByText('Ihr Kontakt')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('E-Mail')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buchung bestätigen' })).toBeInTheDocument()
    // English strings must not leak through.
    expect(screen.queryByText('Review your booking')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm booking' })).not.toBeInTheDocument()
  })

  it('falls back to English when de is not in the operator whitelist, even on a German browser', () => {
    setBrowserLanguage('de-DE')
    configureCustomerLocale(['en', 'es'], 'en')
    renderForm()

    expect(screen.getByText('Review your booking')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm booking' })).toBeInTheDocument()
    expect(screen.queryByText('Ihre Buchung überprüfen')).not.toBeInTheDocument()
  })

  it('an invite-language override wins over the operator whitelist', () => {
    setBrowserLanguage('en-US')
    configureCustomerLocale(['en'], 'en')
    overrideBookingLocale('de')
    renderForm()

    expect(screen.getByText('Ihre Buchung überprüfen')).toBeInTheDocument()
  })

  it('the Confirm button actually submits in German mode (locale does not break the flow)', async () => {
    setBrowserLanguage('de-DE')
    configureCustomerLocale(['de'], 'de')
    renderForm()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Buchung bestätigen' }))
    })

    expect(globalThis.fetch).toHaveBeenCalled()
  })
})
