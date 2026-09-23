/**
 * landr-5aih0.9 — widget German UI.
 *
 * Confirmation renders in German when the browser reports a German
 * locale. This page has no operator-whitelist call of its own (App.tsx
 * configures the whitelist before mounting the booking flow; a direct
 * unit render like this one falls through to the plain browser-locale
 * tier of the resolver in src/lib/locale.ts), so a German browser locale
 * alone is enough here.
 */
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Confirmation } from './Confirmation'
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

function setBrowserLanguage(language: string) {
  vi.stubGlobal('navigator', { ...navigator, language })
}

describe('Confirmation — German UI (landr-5aih0.9)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the success screen and price breakdown in German', () => {
    setBrowserLanguage('de-DE')
    const response = baseResponse({ summary: baseSummary() })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByText('Buchung bestätigt')).toBeInTheDocument()
    expect(screen.getByTestId('confirmation-summary')).toHaveTextContent('Ihre Buchung')
    expect(screen.getByTestId('confirmation-price-breakdown')).toHaveTextContent(
      'Preisaufschlüsselung',
    )
    expect(screen.getByText('Referenz')).toBeInTheDocument()
    // English strings must not leak through.
    expect(screen.queryByText('Booking confirmed')).not.toBeInTheDocument()
    expect(screen.queryByText('Price breakdown')).not.toBeInTheDocument()
  })

  it('renders English on a non-German browser (default)', () => {
    setBrowserLanguage('en-US')
    const response = baseResponse({ summary: baseSummary() })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByText('Booking confirmed')).toBeInTheDocument()
    expect(screen.getByTestId('confirmation-summary')).toHaveTextContent('Your booking')
  })

  // landr-5aih0.2: the meeting-point block's button TEXT stays "Google
  // Maps"/"Waze" in every locale (brand names — see
  // noEnglishLiteral.test.ts's ALLOWED_LITERALS), but the aria-label is
  // translated, same as the Google/Outlook calendar buttons above it.
  it('translates the meeting-point aria-labels to German; the brand-name button text stays as-is', () => {
    setBrowserLanguage('de-DE')
    const response = baseResponse({
      summary: baseSummary({
        meeting_point: {
          id: 'pl-1',
          name: 'Main Beach',
          address: 'Playa de las Américas, 38660',
          lat: '28.05',
          lng: '-16.73',
          google_maps_url: 'https://www.google.com/maps/search/?api=1&query=28.05,-16.73',
          waze_url: 'https://waze.com/ul?ll=28.05,-16.73&navigate=yes',
        },
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.getByRole('link', { name: 'In Google Maps öffnen' }),
    ).toHaveTextContent('Google Maps')
    expect(screen.getByRole('link', { name: 'In Waze öffnen' })).toHaveTextContent('Waze')
  })
})
