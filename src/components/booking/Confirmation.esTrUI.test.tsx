/**
 * landr-8r6oc.18 - Spanish and Turkish render tests for Confirmation,
 * mirroring Confirmation.germanUI.test.tsx. The operator's customer_languages
 * whitelist contains the language (configureCustomerLocale), as App.tsx
 * configures it before the booking flow mounts.
 */
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Confirmation } from './Confirmation'
import { configureCustomerLocale } from '@/lib/locale'
import type { BookingSummary, SubmitBookingResponse } from '@/api/types'

const MOCK_BOOKING_ID = '00000000-0000-0000-0000-0000000000bb'

function baseSummary(overrides: Partial<BookingSummary> = {}): BookingSummary {
  return {
    booking_id: MOCK_BOOKING_ID,
    booking_reference: 'REF-1234',
    operator_name: 'Para42',
    product_label: 'Tandem Classic',
    products: [
      { product_id: 'svc', label: 'Tandem Classic', qty: 1, selected_days: ['2026-06-15'] },
    ],
    dates: { days: ['2026-06-15'], start: '2026-06-15', end: '2026-06-15', label: '15 Jun 2026' },
    participant_count: 2,
    participants: [{ name: 'Ada Lovelace' }, { name: 'Grace Hopper' }],
    pickup_location: null,
    pickup_locations: [],
    hotel: null,
    line_items: [
      {
        product_id: 'svc',
        label: 'Tandem Classic',
        qty: 1,
        units: 1,
        unit_price: '180.00',
        line_total: '180.00',
        paid_to: 'operator',
      },
    ],
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
    ...overrides,
  }
}

function baseResponse(overrides: Partial<SubmitBookingResponse> = {}): SubmitBookingResponse {
  return {
    booking_id: MOCK_BOOKING_ID,
    semantic_state: 'confirmed',
    approval_outcome: 'auto_approved',
    ...overrides,
  }
}

function setBrowserLanguage(language: string, whitelist: string[]) {
  vi.stubGlobal('navigator', { ...navigator, language })
  configureCustomerLocale(whitelist, whitelist[0])
}

describe.each([
  {
    browser: 'es-ES',
    lang: 'es',
    whitelist: ['en', 'es'],
    heading: 'Reserva confirmada',
    summary: 'Tu reserva',
    breakdown: 'Desglose del precio',
    reference: 'Referencia',
  },
  {
    browser: 'tr-TR',
    lang: 'tr',
    whitelist: ['en', 'tr'],
    heading: 'Rezervasyon onaylandı',
    summary: 'Rezervasyonunuz',
    breakdown: 'Fiyat dökümü',
    reference: 'Referans',
  },
])('Confirmation - $lang UI (landr-8r6oc.18)', (c) => {
  afterEach(() => {
    vi.unstubAllGlobals()
    configureCustomerLocale(null, null)
  })

  it('renders the success screen and price breakdown in the customer language', () => {
    setBrowserLanguage(c.browser, c.whitelist)
    const response = baseResponse({ summary: baseSummary() })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByText(c.heading)).toBeInTheDocument()
    expect(screen.getByTestId('confirmation-summary')).toHaveTextContent(c.summary)
    expect(screen.getByTestId('confirmation-price-breakdown')).toHaveTextContent(c.breakdown)
    expect(screen.getByText(c.reference)).toBeInTheDocument()
    // Neither English nor German may leak through.
    expect(screen.queryByText('Booking confirmed')).not.toBeInTheDocument()
    expect(screen.queryByText('Price breakdown')).not.toBeInTheDocument()
    expect(screen.queryByText('Buchung bestätigt')).not.toBeInTheDocument()
    expect(screen.queryByText('Preisaufschlüsselung')).not.toBeInTheDocument()
  })

  it('falls back to the operator default when the browser language is not whitelisted', () => {
    setBrowserLanguage('fr-FR', [c.lang, 'en'])
    const response = baseResponse({ summary: baseSummary() })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByText(c.heading)).toBeInTheDocument()
  })
})
