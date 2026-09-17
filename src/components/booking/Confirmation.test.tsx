import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Confirmation } from './Confirmation'
import type {
  BookingCalendarEvent,
  BookingSummary,
  SubmitBookingResponse,
} from '@/api/types'
import { ALL_STAFF_POWERS, type StaffSession } from '@/lib/staffMode'
import { StaffModeProvider } from '@/lib/staffMode.tsx'

/**
 * Tests for the booking confirmation success page.
 *
 * landr-3vr5 added the original "Add to calendar" (ICS download) anchor.
 * landr-acew extends it with Google Calendar and Outlook deep-link
 * buttons built from calendar_event fields returned by the API.
 */

const MOCK_BOOKING_ID = '00000000-0000-0000-0000-0000000000bb'
const MOCK_ICAL_URL = `https://api.dev.landr.de/api/public/bookings/${MOCK_BOOKING_ID}/calendar.ics`

const MOCK_EVENT: BookingCalendarEvent = {
  title: 'Tandem Classic — Para42',
  start_date: '2026-06-15',
  end_date: '2026-06-15',
  description: 'Booking for Jane Doe. Confirmed via Para42.',
  location: 'Para42',
}

function baseResponse(overrides: Partial<SubmitBookingResponse> = {}): SubmitBookingResponse {
  return {
    booking_id: MOCK_BOOKING_ID,
    semantic_state: 'pending',
    ...overrides,
  }
}

/** Parse query params from a full URL string for targeted assertions. */
function qs(url: string): URLSearchParams {
  return new URLSearchParams(url.split('?')[1] ?? '')
}

// ------------------------------------------------------------------
// landr-nva1a.4: success-screen summary/savings/post-booking fixtures
// ------------------------------------------------------------------

function baseSummary(overrides: Partial<BookingSummary> = {}): BookingSummary {
  return {
    booking_id: MOCK_BOOKING_ID,
    booking_reference: 'REF-1234',
    operator_name: 'Para42',
    product_label: 'Tandem Classic',
    products: [
      {
        product_id: 'svc',
        label: 'Tandem Classic',
        qty: 1,
        selected_days: ['2026-06-15', '2026-06-16', '2026-06-17'],
      },
    ],
    dates: {
      days: ['2026-06-15', '2026-06-16', '2026-06-17'],
      start: '2026-06-15',
      end: '2026-06-17',
      label: '15–17 Jun 2026',
    },
    participant_count: 2,
    participants: [{ name: 'Ada Lovelace' }, { name: 'Grace Hopper' }],
    pickup_location: 'Main Beach',
    pickup_locations: [{ id: 'pl-1', name: 'Main Beach' }],
    hotel: null,
    line_items: [
      {
        product_id: 'svc',
        label: 'Tandem Classic',
        qty: 1,
        units: 3,
        unit_price: '60.00',
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

describe('Confirmation — landr-nva1a.4 success-screen summary', () => {
  it('renders exactly today\'s content when summary is absent (graceful degrade)', () => {
    const response = baseResponse()
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.queryByTestId('confirmation-summary')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('confirmation-savings-congrats'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('confirmation-price-breakdown'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('confirmation-post-booking'),
    ).not.toBeInTheDocument()
  })

  it('renders the "Your booking" card from summary: products, dates, participants, pickup', () => {
    const response = baseResponse({ summary: baseSummary() })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const card = screen.getByTestId('confirmation-summary')
    expect(card).toHaveTextContent('Tandem Classic')
    expect(card).toHaveTextContent(/15.*17.*Jun.*2026/)
    expect(screen.getByTestId('confirmation-participants')).toHaveTextContent(
      '2 participants',
    )
    expect(screen.getByTestId('confirmation-participants')).toHaveTextContent(
      'Ada Lovelace, Grace Hopper',
    )
    expect(screen.getByTestId('confirmation-pickup')).toHaveTextContent(
      'Main Beach',
    )
  })

  it('renders the hotel/room block when summary.hotel is present', () => {
    const response = baseResponse({
      summary: baseSummary({
        hotel: {
          stay_window: { check_in: '2026-06-14', check_out: '2026-06-18', nights: 4 },
          rooms: [
            { label: 'Double Room', qty: 1, addons: [{ label: 'Breakfast', qty: 2 }] },
          ],
          total: '292.00',
        },
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const hotel = screen.getByTestId('confirmation-hotel')
    expect(hotel).toHaveTextContent('4 nights')
    expect(hotel).toHaveTextContent('Double Room')
    expect(hotel).toHaveTextContent('Breakfast')
  })

  it('omits the hotel block when summary.hotel is null', () => {
    const response = baseResponse({ summary: baseSummary({ hotel: null }) })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.queryByTestId('confirmation-hotel')).not.toBeInTheDocument()
  })

  // ------------------------------------------------------------------
  // Savings congrats card
  // ------------------------------------------------------------------

  it('shows the consecutive-days congrats copy', () => {
    const response = baseResponse({
      summary: baseSummary({
        multi_day_savings: { days: 3, amount: '15.00', consecutive: true },
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByTestId('confirmation-savings-congrats')).toHaveTextContent(
      '3 days in a row — you saved €15.00!',
    )
  })

  it('shows the non-consecutive "by booking N days" congrats copy', () => {
    const response = baseResponse({
      summary: baseSummary({
        multi_day_savings: { days: 5, amount: '20.00', consecutive: false },
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByTestId('confirmation-savings-congrats')).toHaveTextContent(
      'You saved €20.00 by booking 5 days!',
    )
  })

  it('omits the congrats card when multi_day_savings is null', () => {
    const response = baseResponse({ summary: baseSummary({ multi_day_savings: null }) })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.queryByTestId('confirmation-savings-congrats'),
    ).not.toBeInTheDocument()
  })

  it('skips the congrats card when price_overridden is true, even with multi_day_savings present', () => {
    const response = baseResponse({
      summary: baseSummary({
        price_overridden: true,
        multi_day_savings: { days: 3, amount: '15.00', consecutive: true },
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.queryByTestId('confirmation-savings-congrats'),
    ).not.toBeInTheDocument()
    // The rest of the summary/breakdown still render.
    expect(screen.getByTestId('confirmation-summary')).toBeInTheDocument()
    expect(screen.getByTestId('confirmation-price-breakdown')).toBeInTheDocument()
  })

  it('skips the congrats card in staff mode, but still shows summary + breakdown', () => {
    const STAFF: StaffSession = {
      active: true,
      token: 'staff.signed.token',
      powers: ALL_STAFF_POWERS,
      operatorId: 'a1b2c3d4-0001-0001-0001-000000000002',
    }
    const response = baseResponse({
      summary: baseSummary({
        multi_day_savings: { days: 3, amount: '15.00', consecutive: true },
      }),
    })
    render(
      <StaffModeProvider value={STAFF}>
        <Confirmation response={response} onRestart={vi.fn()} />
      </StaffModeProvider>,
    )

    expect(
      screen.queryByTestId('confirmation-savings-congrats'),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('confirmation-summary')).toBeInTheDocument()
    expect(screen.getByTestId('confirmation-price-breakdown')).toBeInTheDocument()
  })

  // ------------------------------------------------------------------
  // Price breakdown
  // ------------------------------------------------------------------

  it('renders Subtotal → savings rows → Amount due when savings are present', () => {
    const response = baseResponse({
      summary: baseSummary({
        savings: [
          { kind: 'multi_day', label: 'Multi-day savings', amount: '15.00' },
          { kind: 'voucher', label: 'Voucher SUMMER10', amount: '9.00' },
        ],
        savings_total: '24.00',
        subtotal_before_savings: '180.00',
        amount_due: '156.00',
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const breakdown = screen.getByTestId('confirmation-price-breakdown')
    expect(breakdown).toHaveTextContent('Subtotal')
    expect(breakdown).toHaveTextContent('Multi-day savings')
    expect(breakdown).toHaveTextContent('Voucher SUMMER10')
    expect(breakdown).toHaveTextContent('Amount due')
    const amountDue = screen.getByTestId('confirmation-amount-due')
    expect(amountDue).toHaveTextContent('156')
  })

  it('renders only the Amount due row (no Subtotal) when there are no savings', () => {
    const response = baseResponse({ summary: baseSummary() })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.queryByTestId('confirmation-subtotal'),
    ).not.toBeInTheDocument()
    const amountDue = screen.getByTestId('confirmation-amount-due')
    expect(amountDue).toHaveTextContent('Amount due')
    expect(amountDue).toHaveTextContent('180')
  })

  it('keeps at-hotel lines/total separate from the operator Amount due', () => {
    const response = baseResponse({
      summary: baseSummary({
        hotel: { stay_window: null, rooms: [], total: '196.00' },
        line_items: [
          {
            product_id: 'svc',
            label: 'Tandem Classic',
            qty: 1,
            units: 3,
            unit_price: '60.00',
            line_total: '180.00',
            paid_to: 'operator',
          },
          {
            product_id: 'room',
            label: 'Single Room',
            qty: 1,
            units: 4,
            unit_price: '49.00',
            line_total: '196.00',
            paid_to: 'hotel',
          },
        ],
        hotel_total: '196.00',
        grand_total: '376.00',
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const breakdown = screen.getByTestId('confirmation-price-breakdown')
    expect(breakdown).toHaveTextContent('Single Room')
    expect(breakdown).toHaveTextContent('pay at check-in')
    const amountDue = screen.getByTestId('confirmation-amount-due')
    // Amount due is the operator-only figure (180), not grand_total (376).
    expect(amountDue).toHaveTextContent('180')
    expect(amountDue).not.toHaveTextContent('376')
  })

  // ------------------------------------------------------------------
  // Post-booking content (landr-nva1a.2)
  // ------------------------------------------------------------------

  it('renders sanitized post-booking html and strips a script tag', () => {
    const response = baseResponse({
      summary: baseSummary({
        post_booking: [
          {
            product_id: 'svc',
            label: 'Tandem Classic',
            html: '<p>Bring sunscreen!</p><script>alert(1)</script>',
            link: null,
          },
        ],
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const html = screen.getByTestId('confirmation-post-booking-html')
    expect(html).toHaveTextContent('Bring sunscreen!')
    expect(html.innerHTML).not.toMatch(/<script/i)
    expect(html.querySelector('script')).toBeNull()
  })

  it('renders the post-booking link as a Button with target=_blank rel=noopener noreferrer', () => {
    const response = baseResponse({
      summary: baseSummary({
        post_booking: [
          {
            product_id: 'svc',
            label: 'Tandem Classic',
            html: null,
            link: { url: 'https://example.com/waiver', label: 'Sign the waiver' },
          },
        ],
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const link = screen.getByRole('link', { name: /sign the waiver/i })
    expect(link).toHaveAttribute('href', 'https://example.com/waiver')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('never renders a non-http(s) post-booking link (e.g. javascript:)', () => {
    const response = baseResponse({
      summary: baseSummary({
        post_booking: [
          {
            product_id: 'svc',
            label: 'Tandem Classic',
            html: '<p>Some info</p>',
            link: { url: 'javascript:alert(1)', label: 'Click me' },
          },
        ],
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.queryByRole('link', { name: /click me/i }),
    ).not.toBeInTheDocument()
    // The html half of the same item still renders.
    expect(screen.getByTestId('confirmation-post-booking-html')).toHaveTextContent(
      'Some info',
    )
  })

  it('omits the post-booking section entirely when summary.post_booking is absent', () => {
    const response = baseResponse({ summary: baseSummary() })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.queryByTestId('confirmation-post-booking'),
    ).not.toBeInTheDocument()
  })

  it('omits an item that has neither html nor a valid link', () => {
    const response = baseResponse({
      summary: baseSummary({
        post_booking: [
          { product_id: 'svc', label: 'Tandem Classic', html: null, link: null },
        ],
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.queryByTestId('confirmation-post-booking'),
    ).not.toBeInTheDocument()
  })
})

describe('Confirmation', () => {
  // ------------------------------------------------------------------
  // landr-3vr5: original ICS download anchor (backwards-compat tests)
  // ------------------------------------------------------------------

  it('shows Download .ics when ical_url is present (no calendar_event)', () => {
    const response = baseResponse({ ical_url: MOCK_ICAL_URL })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const icsLink = screen.getByRole('link', { name: /download .ics/i })
    expect(icsLink).toBeInTheDocument()
    expect(icsLink).toHaveAttribute('href', MOCK_ICAL_URL)
    expect(icsLink).toHaveAttribute(
      'download',
      `landr-booking-${MOCK_BOOKING_ID}.ics`,
    )
  })

  it('omits the calendar group when ical_url is missing', () => {
    const response = baseResponse()
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.queryByRole('link', { name: /google calendar/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /outlook/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /download .ics/i }),
    ).not.toBeInTheDocument()
    // Card still renders.
    expect(screen.getByText(/booking received/i)).toBeInTheDocument()
  })

  // ------------------------------------------------------------------
  // landr-acew: Google Calendar link
  // ------------------------------------------------------------------

  it('renders Google Calendar link when calendar_event is present', () => {
    const response = baseResponse({
      ical_url: MOCK_ICAL_URL,
      calendar_event: MOCK_EVENT,
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const link = screen.getByRole('link', { name: /google calendar/i })
    expect(link).toBeInTheDocument()
    const href = link.getAttribute('href') ?? ''
    expect(href).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render/)
    const params = qs(href)
    expect(params.get('action')).toBe('TEMPLATE')
    expect(params.get('text')).toBe(MOCK_EVENT.title)
    // dates: start 20260615, end exclusive 20260616
    expect(params.get('dates')).toBe('20260615/20260616')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('does NOT render Google Calendar link when calendar_event is absent', () => {
    const response = baseResponse({ ical_url: MOCK_ICAL_URL })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.queryByRole('link', { name: /google calendar/i }),
    ).not.toBeInTheDocument()
  })

  // ------------------------------------------------------------------
  // landr-acew: Outlook link
  // ------------------------------------------------------------------

  it('renders Outlook link when calendar_event is present', () => {
    const response = baseResponse({
      ical_url: MOCK_ICAL_URL,
      calendar_event: MOCK_EVENT,
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const link = screen.getByRole('link', { name: /outlook/i })
    expect(link).toBeInTheDocument()
    const href = link.getAttribute('href') ?? ''
    expect(href).toMatch(
      /^https:\/\/outlook\.live\.com\/calendar\/0\/deeplink\/compose/,
    )
    const params = qs(href)
    expect(params.get('rru')).toBe('addevent')
    expect(params.get('subject')).toBe(MOCK_EVENT.title)
    // startdt and enddt are inclusive ISO dates for Outlook
    expect(params.get('startdt')).toBe('2026-06-15')
    expect(params.get('enddt')).toBe('2026-06-15')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('does NOT render Outlook link when calendar_event is absent', () => {
    const response = baseResponse({ ical_url: MOCK_ICAL_URL })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.queryByRole('link', { name: /outlook/i }),
    ).not.toBeInTheDocument()
  })

  // ------------------------------------------------------------------
  // landr-acew: multi-day event date handling
  // ------------------------------------------------------------------

  it('encodes multi-day date range correctly in both providers', () => {
    const event: BookingCalendarEvent = {
      title: 'Alpine Week',
      start_date: '2026-07-01',
      end_date: '2026-07-07',
    }
    const response = baseResponse({ ical_url: MOCK_ICAL_URL, calendar_event: event })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const googleParams = qs(
      screen.getByRole('link', { name: /google calendar/i }).getAttribute('href') ?? '',
    )
    // Google end is exclusive: 2026-07-08 → 20260708
    expect(googleParams.get('dates')).toBe('20260701/20260708')

    const outlookParams = qs(
      screen.getByRole('link', { name: /outlook/i }).getAttribute('href') ?? '',
    )
    // Outlook end is inclusive: 2026-07-07
    expect(outlookParams.get('startdt')).toBe('2026-07-01')
    expect(outlookParams.get('enddt')).toBe('2026-07-07')
  })

  // ------------------------------------------------------------------
  // Misc / regression guards
  // ------------------------------------------------------------------

  it('always renders the "Make another booking" button', () => {
    const withAll = baseResponse({
      ical_url: MOCK_ICAL_URL,
      calendar_event: MOCK_EVENT,
    })
    const withoutAll = baseResponse()
    const { rerender } = render(
      <Confirmation response={withAll} onRestart={vi.fn()} />,
    )
    expect(
      screen.getByRole('button', { name: /make another booking/i }),
    ).toBeInTheDocument()
    rerender(<Confirmation response={withoutAll} onRestart={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: /make another booking/i }),
    ).toBeInTheDocument()
  })

  it('renders all three calendar options when both ical_url and calendar_event are present', () => {
    const response = baseResponse({
      ical_url: MOCK_ICAL_URL,
      calendar_event: MOCK_EVENT,
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByRole('link', { name: /google calendar/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /outlook/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /download .ics/i })).toBeInTheDocument()
  })

  it('does NOT blank the page when calendar_event is malformed (missing start_date/end_date)', () => {
    // landr-9ut4 regression: the API once emitted { start, end } instead of
    // { start_date, end_date }. The old code called buildGoogleCalendarUrl on
    // that object, which threw on `undefined.split('-')` during render and —
    // with no error boundary — unmounted the whole widget, blanking the
    // confirmation screen. A malformed event must now degrade to ICS-only.
    const malformed = {
      title: 'Tandem Classic — Para42',
      start: '2026-06-15',
      end: '2026-06-15',
      location: 'Para42',
    } as unknown as BookingCalendarEvent
    const response = baseResponse({
      ical_url: MOCK_ICAL_URL,
      calendar_event: malformed,
    })

    expect(() =>
      render(<Confirmation response={response} onRestart={vi.fn()} />),
    ).not.toThrow()
    // Card + ICS still render; the calendar deep-links are simply skipped.
    expect(screen.getByText(/booking received/i)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /download .ics/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /google calendar/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /outlook/i }),
    ).not.toBeInTheDocument()
  })

  // ------------------------------------------------------------------
  // landr-y31z: confirmation_email_status four-state messaging
  // ------------------------------------------------------------------

  it('shows success copy when confirmation_email_status is "sent"', () => {
    const response = baseResponse({ confirmation_email_status: 'sent' })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByText(/confirmation email has been sent/i)).toBeInTheDocument()
    // Must NOT show the failure panel.
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    // Card must still render — never blank.
    expect(screen.getByText(/booking received/i)).toBeInTheDocument()
    // Reference still visible.
    expect(screen.getByText(MOCK_BOOKING_ID)).toBeInTheDocument()
  })

  it('shows success copy when confirmation_email_status is "captured"', () => {
    const response = baseResponse({ confirmation_email_status: 'captured' })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByText(/confirmation email has been sent/i)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText(/booking received/i)).toBeInTheDocument()
  })

  it('shows amber failure panel with role="status" when confirmation_email_status is "failed" (approval_outcome absent, old-API back-compat)', () => {
    // landr-5oox.27: no approval_outcome field on this response (simulates
    // an older API deploy) — resolveApprovalKind treats that as 'manual',
    // same as the title/body above, so the panel must NOT claim "confirmed".
    const response = baseResponse({ confirmation_email_status: 'failed' })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const panel = screen.getByRole('status')
    expect(panel).toBeInTheDocument()
    // Must NOT claim the booking is confirmed — outcome is unknown/manual.
    expect(panel).toHaveTextContent(/we received your booking request/i)
    expect(panel).not.toHaveTextContent(/booking is confirmed/i)
    // Must instruct customer to contact the operator.
    expect(panel).toHaveTextContent(/contact/i)
    // The regular "confirmation email" paragraph must NOT appear.
    expect(screen.queryByText(/you will receive a confirmation email/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/confirmation email has been sent/i)).not.toBeInTheDocument()
    // Card must still render — never blank; reference visible.
    expect(screen.getByText(/booking received/i)).toBeInTheDocument()
    expect(screen.getByText(MOCK_BOOKING_ID)).toBeInTheDocument()
    // "Make another booking" button still present.
    expect(screen.getByRole('button', { name: /make another booking/i })).toBeInTheDocument()
    // OD-7: no bus/seat/capacity/approval-policy language.
    expect(screen.queryByText(/bus/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/seat/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/capacity/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/approval policy/i)).not.toBeInTheDocument()
  })

  it('shows neutral "will receive" copy when confirmation_email_status is "pending"', () => {
    const response = baseResponse({ confirmation_email_status: 'pending' })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByText(/you will receive a confirmation email shortly/i)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText(/booking received/i)).toBeInTheDocument()
  })

  it('shows neutral "will receive" copy when confirmation_email_status is absent (old API, back-compat)', () => {
    // Explicitly omit the field — simulates a pre-landr-2js5 API response.
    const response = baseResponse()
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByText(/you will receive a confirmation email shortly/i)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText(/booking received/i)).toBeInTheDocument()
  })

  // ------------------------------------------------------------------
  // landr-5oox.6 (OD-7): confirmed vs awaiting-confirmation copy, driven
  // by approval_outcome + payment_link_sent. Never leaks raw semantic_state
  // or mentions buses/seats/capacity/approval policy to the customer.
  // ------------------------------------------------------------------

  it('auto_approved + payment_link_sent: "Booking confirmed" title, inbox copy, payment-link line', () => {
    const response = baseResponse({
      approval_outcome: 'auto_approved',
      payment_link_sent: true,
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByText(/booking confirmed/i)).toBeInTheDocument()
    expect(
      screen.getByText(/your booking is confirmed — the details are in your inbox/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/a payment link is on its way/i)).toBeInTheDocument()
    // Never leak the raw semantic_state value, and never mention capacity.
    expect(screen.queryByText(response.semantic_state)).not.toBeInTheDocument()
    expect(screen.queryByText(/capacity/i)).not.toBeInTheDocument()
  })

  it('auto_approved without payment_link_sent: same confirmed copy, no payment-link line', () => {
    const response = baseResponse({ approval_outcome: 'auto_approved' })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByText(/booking confirmed/i)).toBeInTheDocument()
    expect(
      screen.getByText(/your booking is confirmed — the details are in your inbox/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/payment link/i)).not.toBeInTheDocument()
    expect(screen.queryByText(response.semantic_state)).not.toBeInTheDocument()
    expect(screen.queryByText(/capacity/i)).not.toBeInTheDocument()
  })

  it('requires_general_approval: "Booking received" title, awaiting-confirmation copy, no raw state', () => {
    const response = baseResponse({ approval_outcome: 'requires_general_approval' })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByText(/booking received/i)).toBeInTheDocument()
    expect(screen.getByText(/awaiting confirmation/i)).toBeInTheDocument()
    expect(screen.getByText(/you will receive a confirmation email shortly/i)).toBeInTheDocument()
    expect(screen.queryByText(/booking confirmed/i)).not.toBeInTheDocument()
    expect(screen.queryByText(response.semantic_state)).not.toBeInTheDocument()
    expect(screen.queryByText(/capacity/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/bus/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/seat/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/approval policy/i)).not.toBeInTheDocument()
  })

  it('requires_hotel_approval: same awaiting-confirmation copy as the general-approval manual path', () => {
    const response = baseResponse({ approval_outcome: 'requires_hotel_approval' })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByText(/booking received/i)).toBeInTheDocument()
    expect(screen.getByText(/awaiting confirmation/i)).toBeInTheDocument()
    expect(screen.getByText(/you will receive a confirmation email shortly/i)).toBeInTheDocument()
    expect(screen.queryByText(/booking confirmed/i)).not.toBeInTheDocument()
    expect(screen.queryByText(response.semantic_state)).not.toBeInTheDocument()
    expect(screen.queryByText(/capacity/i)).not.toBeInTheDocument()
  })

  // ------------------------------------------------------------------
  // landr-5oox.27 (follow-up of landr-5oox.6, OD-7): the failed-email
  // amber panel must be outcome-aware too, not just the title/body — a
  // manual outcome is only requested, never confirmed, even when the
  // confirmation email itself failed to send.
  // ------------------------------------------------------------------

  it('failed email × manual outcome: "we received your booking request" panel, never "confirmed"', () => {
    const response = baseResponse({
      confirmation_email_status: 'failed',
      approval_outcome: 'requires_general_approval',
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const panel = screen.getByRole('status')
    expect(panel).toHaveTextContent(/we received your booking request/i)
    expect(panel).not.toHaveTextContent(/booking is confirmed/i)
    // Same recovery guidance regardless of outcome.
    expect(panel).toHaveTextContent(/contact the operator/i)
    // Title reflects the manual outcome too — never "Booking confirmed".
    expect(screen.getByText(/booking received/i)).toBeInTheDocument()
    expect(screen.queryByText(/booking confirmed/i)).not.toBeInTheDocument()
    // OD-7: no bus/seat/capacity/approval-policy language, no raw state.
    expect(screen.queryByText(response.semantic_state)).not.toBeInTheDocument()
    expect(screen.queryByText(/bus/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/seat/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/capacity/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/approval policy/i)).not.toBeInTheDocument()
  })

  it('failed email × auto_approved outcome: existing "booking is confirmed" panel copy is preserved', () => {
    const response = baseResponse({
      confirmation_email_status: 'failed',
      approval_outcome: 'auto_approved',
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const panel = screen.getByRole('status')
    expect(panel).toHaveTextContent(/booking is confirmed/i)
    expect(panel).not.toHaveTextContent(/we received your booking request/i)
    expect(panel).toHaveTextContent(/contact the operator/i)
    // Title reflects the auto outcome.
    expect(screen.getByText(/booking confirmed/i)).toBeInTheDocument()
    // OD-7: no bus/seat/capacity/approval-policy language, no raw state.
    expect(screen.queryByText(response.semantic_state)).not.toBeInTheDocument()
    expect(screen.queryByText(/bus/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/seat/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/capacity/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/approval policy/i)).not.toBeInTheDocument()
  })

  // ------------------------------------------------------------------
  // landr-821d6.7: customer-facing lifecycle stage label
  // ------------------------------------------------------------------

  it('landr-821d6.7: shows the resolved customer stage label when the API supplies stage', () => {
    // landr-821d6.7 review round: the wire shape is pre-resolved
    // server-side ({code, label, label_localized}) — the customer_label-
    // vs-staff-label choice is already baked into `label` before it
    // reaches the widget. See CustomerStageLabel in api/types.ts.
    const response = baseResponse({
      stage: {
        code: 'awaiting_hotel_approval',
        label: 'Modifications open',
        label_localized: { es: 'Modificaciones abiertas' },
      },
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByTestId('confirmation-stage-label')).toHaveTextContent(
      'Modifications open',
    )
  })

  it('landr-821d6.7: renders no stage line when the API omits stage (rolling deploy)', () => {
    const response = baseResponse()
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.queryByTestId('confirmation-stage-label')).not.toBeInTheDocument()
  })
})
