import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Confirmation } from './Confirmation'
import type { BookingCalendarEvent, SubmitBookingResponse } from '@/api/types'

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

  it('shows amber failure panel with role="status" when confirmation_email_status is "failed"', () => {
    const response = baseResponse({ confirmation_email_status: 'failed' })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const panel = screen.getByRole('status')
    expect(panel).toBeInTheDocument()
    // Must communicate that the booking IS confirmed.
    expect(panel).toHaveTextContent(/booking is confirmed/i)
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
})
