/**
 * landr-8r6oc.4 — widget Spanish + Turkish UI.
 *
 * Mirrors BookingForm.germanUI.test.tsx for the two languages added next to
 * German: the review screen renders in the language once it is in the
 * operator's customer_languages whitelist and the browser reports it, falls
 * back to English otherwise, and the locale does not break submitting.
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
  billing: { address_line1: 'Calle Mayor 1', address_line2: '', postal_code: '28013', city: 'Madrid', region: '', country: 'ES', company: '', tax_id: '', name: '' },
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

const CASES = [
  {
    lang: 'es',
    browser: 'es-ES',
    title: 'Revisa tu reserva',
    contact: 'Tu contacto',
    confirm: 'Confirmar reserva',
  },
  {
    lang: 'tr',
    browser: 'tr-TR',
    title: 'Rezervasyonunuzu gözden geçirin',
    contact: 'İletişim bilgileriniz',
    confirm: 'Rezervasyonu onayla',
  },
] as const

describe.each(CASES)('BookingForm — $lang UI (landr-8r6oc.4)', ({ lang, browser, title, contact, confirm }) => {
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

  it(`renders the review screen in ${lang} when it is whitelisted and the browser reports it`, () => {
    setBrowserLanguage(browser)
    configureCustomerLocale(['en', lang], 'en')
    renderForm()

    expect(screen.getByText(title)).toBeInTheDocument()
    expect(screen.getByText(contact)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: confirm })).toBeInTheDocument()
    // English and German strings must not leak through.
    expect(screen.queryByText('Review your booking')).not.toBeInTheDocument()
    expect(screen.queryByText('Ihre Buchung überprüfen')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm booking' })).not.toBeInTheDocument()
  })

  it(`falls back to English when ${lang} is not in the operator whitelist`, () => {
    setBrowserLanguage(browser)
    configureCustomerLocale(['en', 'de'], 'en')
    renderForm()

    expect(screen.getByText('Review your booking')).toBeInTheDocument()
    expect(screen.queryByText(title)).not.toBeInTheDocument()
  })

  it('an invite-language override wins over the whitelist and the browser', () => {
    setBrowserLanguage('en-US')
    configureCustomerLocale(['en'], 'en')
    overrideBookingLocale(lang)
    renderForm()

    expect(screen.getByText(title)).toBeInTheDocument()
  })

  it('the Confirm button still submits (locale does not break the flow)', async () => {
    setBrowserLanguage(browser)
    configureCustomerLocale([lang], lang)
    renderForm()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: confirm }))
    })

    expect(globalThis.fetch).toHaveBeenCalled()
  })
})
