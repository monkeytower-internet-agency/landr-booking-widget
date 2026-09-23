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

  // landr-5aih0.27: review-gate follow-up on PR #327 — these four
  // sub-components (InviteCard, GroupBlock, SharedDoubleHint,
  // JoinErrorNotice) were already translated in #324, but had no German
  // render test proving it.
  it('renders InviteCard (per-companion invite) in German', () => {
    setBrowserLanguage('de-DE')
    const response = baseResponse({
      summary: baseSummary(),
      share_secret: 'sec-1',
      invites: [
        {
          companion_id: 'c1',
          name: 'Grace Hopper',
          email: 'grace@example.com',
          phone: null,
          phone_digits: null,
          invite_url: 'https://landr.de/i/abc',
          whatsapp_url: null,
          linked_booking_reference: null,
          has_invite: true,
        },
      ],
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.getByText('Nächster Schritt: Senden Sie Ihrer Gruppe ihren Buchungslink'),
    ).toBeInTheDocument()
    expect(screen.getByText('Jede Person schließt ihre eigene Buchung über ihren Link ab.')).toBeInTheDocument()
    expect(screen.getByText('Buchungslink senden an Grace Hopper')).toBeInTheDocument()
    expect(screen.getByTestId('invite-email')).toHaveTextContent('E-Mail')
    expect(screen.queryByText(/Next step: send your group/)).not.toBeInTheDocument()
  })

  it('renders GroupBlock ("booked together with") in German, excluding self', () => {
    setBrowserLanguage('de-DE')
    const response = baseResponse({
      summary: baseSummary(),
      group: {
        group_id: 'g1',
        label: 'Group',
        members: [
          { reference: 'REF-1', display_name: 'Ada Lovelace', is_self: false, is_host: true },
          { reference: 'REF-2', display_name: 'Grace Hopper', is_self: true, is_host: false },
        ],
      },
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const groupBlock = screen.getByTestId('confirmation-group')
    expect(groupBlock).toHaveTextContent('Gemeinsam gebucht mit')
    expect(groupBlock).toHaveTextContent('Ada Lovelace (Ref. REF-1) — Gastgeber')
    // Self (Grace) is excluded from THIS list entirely (not just
    // untranslated) — she still appears elsewhere, in the plain
    // participant summary, so the assertion is scoped to the group block.
    expect(groupBlock).not.toHaveTextContent('Grace Hopper')
    expect(groupBlock).not.toHaveTextContent('Booked together with')
  })

  it('renders JoinErrorNotice in German', () => {
    setBrowserLanguage('de-DE')
    const response = baseResponse({
      summary: baseSummary(),
      join_error: { error: 'unknown_reference' },
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.getByText(
        /Wir konnten keine Buchung mit dieser Referenz finden, daher wurde Ihre Buchung nicht damit verknüpft\./,
      ),
    ).toBeInTheDocument()
    expect(screen.getByTestId('confirmation-join-error')).toHaveTextContent(
      'Ihre Buchung selbst ist wie gewohnt bestätigt',
    )
    expect(screen.queryByText(/We couldn't find a booking/)).not.toBeInTheDocument()
  })

  it('renders SharedDoubleHint in German when no reference was ever entered', () => {
    setBrowserLanguage('de-DE')
    const response = baseResponse({ summary: baseSummary() })
    render(<Confirmation response={response} onRestart={vi.fn()} isSharedDouble />)

    const hint = screen.getByTestId('confirmation-shared-double-hint')
    expect(hint).toHaveTextContent('Teilen Sie sich ein Zimmer, das jemand anders gebucht hat?')
    expect(hint).toHaveTextContent('Referenz auf Ihrer Buchungsseite hinzufügen.')
    expect(hint).not.toHaveTextContent('Sharing a room booked by someone else?')
  })
})
