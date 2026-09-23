import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Confirmation } from './Confirmation'
import { HttpError } from '@/api/client'
import type {
  BookingCalendarEvent,
  BookingPeriod,
  BookingSummary,
  GroupSummary,
  InviteSummary,
  SubmitBookingResponse,
} from '@/api/types'
import { ALL_STAFF_POWERS, type StaffSession } from '@/lib/staffMode'
import { StaffModeProvider } from '@/lib/staffMode.tsx'

// landr-otml0.4: Email-send goes through the real API client
// (sendBookingInvite → POST .../invites/{id}/send). Mocked the same way
// AccommodationStep.test.tsx mocks lookupBookingReference — vi.hoisted +
// vi.mock('@/api/client') keeping every other export (submitBooking,
// mockSubmit-backed calls, etc.) at its real implementation.
const { mocks } = vi.hoisted(() => ({
  mocks: {
    sendBookingInvite: vi.fn<
      (
        bookingId: string,
        companionId: string,
        shareSecret: string,
        email: string,
      ) => Promise<{ status: string; invite_url: string }>
    >(),
  },
}))

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>(
    '@/api/client',
  )
  return {
    ...actual,
    sendBookingInvite: mocks.sendBookingInvite,
  }
})

/**
 * Tests for the booking confirmation success page.
 *
 * landr-3vr5 added the original "Add to calendar" (ICS download) anchor.
 * landr-acew extends it with Google Calendar and Outlook deep-link
 * buttons built from calendar_event fields returned by the API.
 */

const MOCK_BOOKING_ID = '00000000-0000-0000-0000-0000000000bb'
// landr-5aih0.4: the calendar link is token-scoped (signed booking token).
const MOCK_ICAL_URL =
  'https://api.dev.landr.de/api/public/bookings/000000000000000000000000000000bb.1900000000.sig/calendar.ics'
// The 8-hex reference the widget derives when `summary` is absent.
const MOCK_REFERENCE = '00000000'

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

// ------------------------------------------------------------------
// landr-otml0.4: invite card / group block / shared-double hint fixtures
// ------------------------------------------------------------------

function baseInvite(overrides: Partial<InviteSummary> = {}): InviteSummary {
  return {
    companion_id: 'companion-1',
    name: 'Thomas Klein',
    email: 'thomas@example.com',
    phone: '+49 151 2345678',
    phone_digits: '491512345678',
    invite_url: 'https://widget.dev.landr.de/i/tok_abc123',
    whatsapp_url:
      'https://wa.me/491512345678?text=https%3A%2F%2Fwidget.dev.landr.de%2F%3Finvite%3Dtok_abc123',
    linked_booking_reference: null,
    has_invite: true,
    ...overrides,
  }
}

function baseGroup(overrides: Partial<GroupSummary> = {}): GroupSummary {
  return {
    group_id: 'grp-1',
    label: 'Olaf K***n',
    members: [
      { reference: 'AAAA1111', display_name: 'Olaf K***n', is_self: true, is_host: true },
      { reference: 'BBBB2222', display_name: 'Thomas K***n', is_self: false, is_host: false },
    ],
    ...overrides,
  }
}

/** navigator.clipboard is absent in jsdom by default — stub it per test. */
function stubClipboard(): { writeText: ReturnType<typeof vi.fn> } {
  const writeText = vi.fn(async () => undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
  return { writeText }
}

/**
 * landr-otml0.4 review fix (MAJOR 4): remove `navigator.clipboard` entirely
 * (an insecure context / older WebView) so CopyButton is forced onto its
 * `document.execCommand('copy')` fallback, and beyond.
 */
function stubClipboardUnavailable(): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: undefined,
  })
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

  // landr-nva1a.4 review round: the header reference should match the
  // confirmation email (same build_booking_summary builder) rather than
  // the raw booking_id UUID, whenever summary is present.
  it('shows summary.booking_reference (not the raw booking_id) when summary is present', () => {
    const response = baseResponse({
      summary: baseSummary({ booking_reference: 'REF-9999' }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByText('REF-9999')).toBeInTheDocument()
    expect(screen.queryByText(MOCK_BOOKING_ID)).not.toBeInTheDocument()
  })

  // landr-otml0.4 review fix (MAJOR 1): the raw booking_id UUID is a bearer
  // credential elsewhere in this API (cancel, .ics download both accept it
  // as their only credential) — it must never be shown/copyable as "the
  // reference" text. When summary is absent we now derive the 8-hex
  // reference client-side, the same way the API does, instead of falling
  // back to the UUID.
  it('derives the reference client-side (never the raw booking_id UUID) when summary is absent', () => {
    const response = baseResponse()
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    // MOCK_BOOKING_ID = '00000000-0000-0000-0000-0000000000bb' →
    // strip hyphens, first 8 hex chars, uppercased.
    expect(screen.getByTestId('confirmation-reference-value')).toHaveTextContent(
      '00000000',
    )
    expect(screen.queryByText(MOCK_BOOKING_ID)).not.toBeInTheDocument()
  })

  it('never exposes the raw booking_id UUID anywhere in the reference/copy block', () => {
    const response = baseResponse({
      summary: baseSummary({ booking_reference: 'REF-1234' }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByTestId('confirmation-reference-value')).not.toHaveTextContent(
      MOCK_BOOKING_ID,
    )
    expect(screen.getByTestId('confirmation-reference-copy')).not.toHaveTextContent(
      MOCK_BOOKING_ID,
    )
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

  // landr-5aih0.2: the meeting-point block (address + Google Maps/Waze)
  // renders under the plain "Pickup:" line when summary.meeting_point
  // carries an address or a map link.
  it('renders the meeting-point address + Google Maps/Waze buttons when summary.meeting_point is present', () => {
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

    const block = screen.getByTestId('confirmation-meeting-point')
    expect(block).toHaveTextContent('Playa de las Américas, 38660')
    expect(screen.getByRole('link', { name: /google maps/i })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=28.05,-16.73',
    )
    expect(screen.getByRole('link', { name: /waze/i })).toHaveAttribute(
      'href',
      'https://waze.com/ul?ll=28.05,-16.73&navigate=yes',
    )
  })

  // Waze needs coordinates (app/services/meeting_point.py: waze_url is ""
  // without geo) — the button must not render when the API sent no url.
  it('omits the Waze button when meeting_point.waze_url is empty (no geo)', () => {
    const response = baseResponse({
      summary: baseSummary({
        meeting_point: {
          id: 'pl-1',
          name: 'Main Beach',
          address: 'Playa de las Américas, 38660',
          lat: '',
          lng: '',
          google_maps_url:
            'https://www.google.com/maps/search/?api=1&query=Playa+de+las+Am%C3%A9ricas%2C+38660',
          waze_url: '',
        },
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByRole('link', { name: /google maps/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /waze/i })).not.toBeInTheDocument()
  })

  // The API always sends meeting_point as an object (empty_block(), never
  // null) when the booking has no pickup location — every field "". The
  // widget must degrade to no block at all rather than an empty shell.
  it('renders no meeting-point block when summary.meeting_point is the all-"" empty block', () => {
    const response = baseResponse({
      summary: baseSummary({
        pickup_location: null,
        pickup_locations: [],
        meeting_point: {
          id: '',
          name: '',
          address: '',
          lat: '',
          lng: '',
          google_maps_url: '',
          waze_url: '',
        },
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.queryByTestId('confirmation-meeting-point'),
    ).not.toBeInTheDocument()
  })

  it('renders no meeting-point block when summary.meeting_point is absent (older API deploy)', () => {
    const response = baseResponse({ summary: baseSummary() })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.queryByTestId('confirmation-meeting-point'),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('confirmation-pickup')).toHaveTextContent(
      'Main Beach',
    )
  })

  it('renders the hotel/room block when summary.hotel is present', () => {
    const response = baseResponse({
      summary: baseSummary({
        hotel: {
          // landr-78i5e.8: the stay window itself now renders via the
          // periods table (arrival/departure rows), not this room block —
          // see the "periods" describe below.
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
    expect(hotel).toHaveTextContent('Double Room')
    expect(hotel).toHaveTextContent('Breakfast')
  })

  it('omits the hotel block when summary.hotel is null', () => {
    const response = baseResponse({ summary: baseSummary({ hotel: null }) })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.queryByTestId('confirmation-hotel')).not.toBeInTheDocument()
  })

  // ------------------------------------------------------------------
  // landr-78i5e.8: periods table (replaces per-product DayChips + the
  // separate hotel stay-window line)
  // ------------------------------------------------------------------

  function consecutivePeriods(): BookingPeriod[] {
    return [
      {
        kind: 'arrival',
        start_date: '2026-06-14',
        end_date: '2026-06-14',
        label: 'Arrival',
        product_name: null,
        days: 1,
        meta: {},
      },
      {
        kind: 'activity',
        start_date: '2026-06-15',
        end_date: '2026-06-17',
        label: 'Tandem Classic',
        product_name: 'Tandem Classic',
        days: 3,
        meta: {},
      },
      {
        kind: 'departure',
        start_date: '2026-06-18',
        end_date: '2026-06-18',
        label: 'Departure',
        product_name: null,
        days: 1,
        meta: {},
      },
    ]
  }

  /** A gap (opted-out day) between two booked activity days splits the run
   * into two `activity` periods — see booking_periods.py's module
   * docstring. Four rows total: arrival, activity, activity, departure. */
  function gappedPeriods(): BookingPeriod[] {
    return [
      consecutivePeriods()[0],
      {
        kind: 'activity',
        start_date: '2026-06-15',
        end_date: '2026-06-15',
        label: 'Tandem Classic',
        product_name: 'Tandem Classic',
        days: 1,
        meta: {},
      },
      {
        kind: 'activity',
        start_date: '2026-06-17',
        end_date: '2026-06-17',
        label: 'Tandem Classic',
        product_name: 'Tandem Classic',
        days: 1,
        meta: {},
      },
      consecutivePeriods()[2],
    ]
  }

  it('renders the three-row consecutive shape (arrival, activity, departure)', () => {
    const response = baseResponse({
      summary: baseSummary({ periods: consecutivePeriods() }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const periods = screen.getByTestId('confirmation-periods')
    const rows = periods.querySelectorAll('li')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('Arrival')
    expect(rows[1]).toHaveTextContent('Tandem Classic')
    expect(rows[2]).toHaveTextContent('Departure')
  })

  it('renders the gapped shape as two separate activity rows', () => {
    const response = baseResponse({
      summary: baseSummary({ periods: gappedPeriods() }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const periods = screen.getByTestId('confirmation-periods')
    const rows = periods.querySelectorAll('li')
    expect(rows).toHaveLength(4)
    expect(rows[0]).toHaveTextContent('Arrival')
    expect(rows[1]).toHaveTextContent('Tandem Classic')
    expect(rows[2]).toHaveTextContent('Tandem Classic')
    expect(rows[3]).toHaveTextContent('Departure')
  })

  it('folds the hotel stay window into the periods table, not a separate line', () => {
    const response = baseResponse({
      summary: baseSummary({
        periods: consecutivePeriods(),
        hotel: {
          stay_window: { check_in: '2026-06-14', check_out: '2026-06-18', nights: 4 },
          rooms: [{ label: 'Double Room', qty: 1 }],
          total: '292.00',
        },
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    // The old standalone "check_in → check_out, N nights" line is gone —
    // that information now lives in the periods table's arrival/departure
    // rows instead.
    expect(screen.getByTestId('confirmation-hotel')).not.toHaveTextContent(
      '4 nights',
    )
    expect(screen.getByTestId('confirmation-periods')).toBeInTheDocument()
  })

  it('omits the periods table when summary.periods is absent (older API deploy)', () => {
    const response = baseResponse({ summary: baseSummary() })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.queryByTestId('confirmation-periods')).not.toBeInTheDocument()
  })

  // landr-78i5e.8 review fix (MAJOR): periods is best-effort/optional — an
  // older API deploy, or any periods_for_booking lookup failure, leaves it
  // absent/[]. The widget and API promote independently (Cloudflare Pages
  // vs Cloud Run), so this can happen even on a fully-current API. Losing
  // the hotel check-in/check-out date to that is not acceptable
  // degradation, so it must fall back to the stay-window line.
  it('falls back to the hotel stay-window line when summary.periods is absent', () => {
    const response = baseResponse({
      summary: baseSummary({
        periods: undefined,
        hotel: {
          stay_window: { check_in: '2026-06-14', check_out: '2026-06-18', nights: 4 },
          rooms: [{ label: 'Double Room', qty: 1 }],
          total: '292.00',
        },
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.queryByTestId('confirmation-periods')).not.toBeInTheDocument()
    expect(screen.getByTestId('confirmation-hotel')).toHaveTextContent('4 nights')
  })

  it('falls back to the hotel stay-window line when summary.periods is an empty array', () => {
    const response = baseResponse({
      summary: baseSummary({
        periods: [],
        hotel: {
          stay_window: { check_in: '2026-06-14', check_out: '2026-06-18', nights: 4 },
          rooms: [{ label: 'Double Room', qty: 1 }],
          total: '292.00',
        },
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.queryByTestId('confirmation-periods')).not.toBeInTheDocument()
    expect(screen.getByTestId('confirmation-hotel')).toHaveTextContent('4 nights')
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
  // Post-booking content (landr-nva1a.2). Fixture shape matches the real
  // API verbatim: {product_id, html, link} — NO `label` on the item
  // itself (landr-nva1a.4 review round).
  // ------------------------------------------------------------------

  it('renders sanitized post-booking html and strips a script tag', () => {
    const response = baseResponse({
      summary: baseSummary({
        post_booking: [
          {
            product_id: 'svc',
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

  it('strips <style> (content and all) and <form>/<input> from post-booking html', () => {
    const response = baseResponse({
      summary: baseSummary({
        post_booking: [
          {
            product_id: 'svc',
            html: '<style>body{color:red}</style><form><input value="x"></form><p>Safe text</p>',
            link: null,
          },
        ],
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const html = screen.getByTestId('confirmation-post-booking-html')
    expect(html.querySelector('style')).toBeNull()
    expect(html.querySelector('form')).toBeNull()
    expect(html.querySelector('input')).toBeNull()
    // <style>'s CONTENT is dropped too, not just unwrapped as text.
    expect(html.textContent).not.toMatch(/color:\s*red/)
    expect(html).toHaveTextContent('Safe text')
  })

  it('forces target=_blank + rel=noopener noreferrer on an in-content <a> even when the source omits them', () => {
    const response = baseResponse({
      summary: baseSummary({
        post_booking: [
          {
            product_id: 'svc',
            html: '<p>Read the <a href="https://example.com/waiver">waiver</a> first.</p>',
            link: null,
          },
        ],
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const link = screen.getByRole('link', { name: /waiver/i })
    expect(link).toHaveAttribute('href', 'https://example.com/waiver')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('drops the href of an in-content <a> with a non-http(s)/mailto/tel scheme, but keeps its text', () => {
    const response = baseResponse({
      summary: baseSummary({
        post_booking: [
          {
            product_id: 'svc',
            html: '<p><a href="javascript:alert(1)">Click me</a></p>',
            link: null,
          },
        ],
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.queryByRole('link', { name: /click me/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('confirmation-post-booking-html')).toHaveTextContent(
      'Click me',
    )
  })

  it('renders the post-booking link as a Button with target=_blank rel=noopener noreferrer', () => {
    const response = baseResponse({
      summary: baseSummary({
        post_booking: [
          {
            product_id: 'svc',
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
        post_booking: [{ product_id: 'svc', html: null, link: null }],
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.queryByTestId('confirmation-post-booking'),
    ).not.toBeInTheDocument()
  })

  // landr-nva1a.4 review round: no `label` on the wire item — the heading
  // (when shown at all) is looked up from summary.products.
  it('omits the item heading with a single product (nothing to disambiguate)', () => {
    const response = baseResponse({
      summary: baseSummary({
        post_booking: [{ product_id: 'svc', html: '<p>Info</p>', link: null }],
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const item = screen.getByTestId('confirmation-post-booking-item')
    expect(item.querySelector('h4')).toBeNull()
  })

  it('shows the product label as the item heading, looked up by product_id, with multiple products', () => {
    const response = baseResponse({
      summary: baseSummary({
        products: [
          { product_id: 'svc', label: 'Tandem Classic', qty: 1 },
          { product_id: 'addon-1', label: 'Video Package', qty: 1 },
        ],
        post_booking: [
          { product_id: 'addon-1', html: '<p>Your video link.</p>', link: null },
        ],
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const item = screen.getByTestId('confirmation-post-booking-item')
    expect(item.querySelector('h4')).toHaveTextContent('Video Package')
  })

  it('omits the heading (not a fallback string) when product_id has no match, even with multiple products', () => {
    const response = baseResponse({
      summary: baseSummary({
        products: [
          { product_id: 'svc', label: 'Tandem Classic', qty: 1 },
          { product_id: 'addon-1', label: 'Video Package', qty: 1 },
        ],
        post_booking: [
          { product_id: 'unknown-id', html: '<p>Orphan content.</p>', link: null },
        ],
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const item = screen.getByTestId('confirmation-post-booking-item')
    expect(item.querySelector('h4')).toBeNull()
    expect(item).toHaveTextContent('Orphan content.')
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
    // landr-5aih0.4: the filename carries the reference, never the UUID.
    expect(icsLink).toHaveAttribute(
      'download',
      `landr-booking-${MOCK_REFERENCE}.ics`,
    )
    expect(icsLink.getAttribute('download')).not.toContain(MOCK_BOOKING_ID)
  })

  it('names the .ics download after summary.booking_reference when present', () => {
    const response = baseResponse({
      ical_url: MOCK_ICAL_URL,
      summary: baseSummary({ booking_reference: 'AB12CD34' }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)
    const icsLink = screen.getByRole('link', { name: /download .ics/i })
    expect(icsLink).toHaveAttribute('download', 'landr-booking-AB12CD34.ics')
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
    // Reference still visible (derived client-side — never the raw UUID,
    // landr-otml0.4 review fix MAJOR 1).
    expect(screen.getByTestId('confirmation-reference-value')).toHaveTextContent(
      '00000000',
    )
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
    // Card must still render — never blank; reference visible (derived
    // client-side — never the raw UUID, landr-otml0.4 review fix MAJOR 1).
    expect(screen.getByText(/booking received/i)).toBeInTheDocument()
    expect(screen.getByTestId('confirmation-reference-value')).toHaveTextContent(
      '00000000',
    )
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

  // ------------------------------------------------------------------
  // landr-k9pji.5 — payment_mode-aware confirmation copy (API
  // landr-k9pji.4). All three modes are auto_approved scenarios; the
  // pre-existing payment_link_sent-only tests above cover the fallback
  // when payment_mode is absent (older API deploy).
  // ------------------------------------------------------------------

  it('payment_mode=on_site: pay-on-site note, regardless of payment_link_sent', () => {
    const response = baseResponse({
      approval_outcome: 'auto_approved',
      payment_mode: 'on_site',
      payment_link_sent: false,
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.getByText(/please pay on the day, at the meeting point/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/payment link/i)).not.toBeInTheDocument()
  })

  it('payment_mode=bank_transfer: bank-details-in-email note', () => {
    const response = baseResponse({
      approval_outcome: 'auto_approved',
      payment_mode: 'bank_transfer',
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.getByText(/bank details are in your confirmation email/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/payment link/i)).not.toBeInTheDocument()
  })

  it('payment_mode=online + payment_link_sent: deposit-flavoured payment-link line', () => {
    const response = baseResponse({
      approval_outcome: 'auto_approved',
      payment_mode: 'online',
      payment_link_sent: true,
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.getByTestId('confirmation-payment-mode-note'),
    ).toHaveTextContent(/a payment link for your deposit is on its way/i)
  })

  it('payment_mode=online without payment_link_sent: no payment line at all', () => {
    const response = baseResponse({
      approval_outcome: 'auto_approved',
      payment_mode: 'online',
      payment_link_sent: false,
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.queryByTestId('confirmation-payment-mode-note')).not.toBeInTheDocument()
    expect(screen.queryByText(/payment link/i)).not.toBeInTheDocument()
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

// ------------------------------------------------------------------
// landr-otml0.4: reference share, per-invitee cards, group block,
// shared-double hint, join_error notice.
// ------------------------------------------------------------------

describe('Confirmation — landr-otml0.4 group/invite share surfaces', () => {
  beforeEach(() => {
    mocks.sendBookingInvite.mockReset()
  })

  it('shows the reference prominently with a copy button and the share hint', async () => {
    const { writeText } = stubClipboard()
    const response = baseResponse({ summary: baseSummary({ booking_reference: 'REF-1234' }) })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByTestId('confirmation-reference-value')).toHaveTextContent('REF-1234')
    expect(
      screen.getByText(
        /share this with anyone booking their own guiding who wants to be grouped with you/i,
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('confirmation-reference-copy'))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('REF-1234'))
  })

  it('renders no invite cards, group block, or hint when the response carries none of it (older API / no companions)', () => {
    const response = baseResponse()
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.queryByTestId('confirmation-invites')).not.toBeInTheDocument()
    expect(screen.queryByTestId('confirmation-group')).not.toBeInTheDocument()
    expect(screen.queryByTestId('confirmation-shared-double-hint')).not.toBeInTheDocument()
    expect(screen.queryByTestId('confirmation-join-error')).not.toBeInTheDocument()
  })

  it('renders one invite card per companion, with WhatsApp/Email/Copy actions', () => {
    const response = baseResponse({
      share_secret: 'secret-abc',
      invites: [baseInvite()],
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByText('Send booking link to Thomas Klein')).toBeInTheDocument()
    // wa.me URL is used exactly as the API supplied it — never rebuilt
    // client-side (epic D5: WhatsApp is server-pre-built, no message API).
    const whatsapp = screen.getByTestId('invite-whatsapp')
    expect(whatsapp).toHaveAttribute('href', baseInvite().whatsapp_url)
    expect(whatsapp).toHaveAttribute('target', '_blank')
    expect(screen.getByTestId('invite-email')).toBeInTheDocument()
    expect(screen.getByTestId('invite-copy')).toBeInTheDocument()
  })

  it('leads with the invites as a headed call to action (landr-8sk6l)', () => {
    const response = baseResponse({
      share_secret: 'secret-abc',
      invites: [baseInvite()],
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)
    const section = screen.getByTestId('confirmation-invites')
    expect(section).toHaveAccessibleName('Next step: send your group their booking link')
    // Solid primary buttons, not the outline style of secondary actions.
    expect(screen.getByTestId('invite-email').className).toMatch(/\bbg-primary\b/)
  })

  it('falls back to the WhatsApp share-sheet link (no phone) exactly as given', () => {
    const invite = baseInvite({
      phone: null,
      phone_digits: null,
      whatsapp_url: 'https://wa.me/?text=https%3A%2F%2Fwidget.dev.landr.de%2F%3Finvite%3Dtok_abc123',
    })
    const response = baseResponse({ share_secret: 'secret-abc', invites: [invite] })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByTestId('invite-whatsapp')).toHaveAttribute('href', invite.whatsapp_url)
  })

  it('omits the WhatsApp button when the API supplied no whatsapp_url', () => {
    const invite = baseInvite({ whatsapp_url: null })
    const response = baseResponse({ share_secret: 'secret-abc', invites: [invite] })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.queryByTestId('invite-whatsapp')).not.toBeInTheDocument()
    expect(screen.getByTestId('invite-email')).toBeInTheDocument()
  })

  it('omits the Email button when the companion has no captured email (D11: phone-only)', () => {
    const invite = baseInvite({ email: null })
    const response = baseResponse({ share_secret: 'secret-abc', invites: [invite] })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.queryByTestId('invite-email')).not.toBeInTheDocument()
    expect(screen.getByTestId('invite-whatsapp')).toBeInTheDocument()
    // Copy link is always offered regardless of captured contact.
    expect(screen.getByTestId('invite-copy')).toBeInTheDocument()
  })

  it('sends the invite email on click, using the share_secret, and disables after success', async () => {
    mocks.sendBookingInvite.mockResolvedValue({
      status: 'queued',
      invite_url: baseInvite().invite_url,
    })
    const response = baseResponse({ share_secret: 'secret-abc', invites: [baseInvite()] })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    fireEvent.click(screen.getByTestId('invite-email'))

    await waitFor(() => expect(screen.getByTestId('invite-email')).toHaveTextContent('Sent'))
    expect(mocks.sendBookingInvite).toHaveBeenCalledWith(
      MOCK_BOOKING_ID,
      'companion-1',
      'secret-abc',
      'thomas@example.com',
    )
    expect(screen.getByTestId('invite-email')).toBeDisabled()
  })

  it('shows a retry affordance and keeps the button enabled when the email send fails', async () => {
    mocks.sendBookingInvite.mockRejectedValue(new Error('500'))
    const response = baseResponse({ share_secret: 'secret-abc', invites: [baseInvite()] })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    fireEvent.click(screen.getByTestId('invite-email'))

    await waitFor(() =>
      expect(screen.getByTestId('invite-email')).toHaveTextContent(/retry email/i),
    )
    expect(screen.getByTestId('invite-email')).not.toBeDisabled()
    expect(
      screen.getByText(/could not send that email/i),
    ).toBeInTheDocument()
  })

  it('copies the invite link to the clipboard', async () => {
    const { writeText } = stubClipboard()
    const response = baseResponse({ share_secret: 'secret-abc', invites: [baseInvite()] })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    fireEvent.click(screen.getByTestId('invite-copy'))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(baseInvite().invite_url))
  })

  // ------------------------------------------------------------------
  // landr-otml0.4 review fix (MAJOR 2): no share_secret → disabled + hint,
  // never a silent no-op.
  // ------------------------------------------------------------------

  it('disables the Email button and shows a hint when share_secret is absent', () => {
    const response = baseResponse({ invites: [baseInvite()] }) // no share_secret
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const emailButton = screen.getByTestId('invite-email')
    expect(emailButton).toBeDisabled()
    expect(emailButton).toHaveAttribute('title', expect.stringMatching(/unavailable/i))
    expect(screen.getByTestId('invite-email-unavailable')).toHaveTextContent(
      /email sending unavailable — copy the link instead/i,
    )
    // Clicking a disabled button never fires the handler.
    fireEvent.click(emailButton)
    expect(mocks.sendBookingInvite).not.toHaveBeenCalled()
  })

  // ------------------------------------------------------------------
  // landr-otml0.4 review fix (MAJOR 3): failure classification by HTTP
  // status — different message and retry-ability per status.
  // ------------------------------------------------------------------

  it('404 → "link can\'t be emailed" message, no retry (button stays disabled)', async () => {
    mocks.sendBookingInvite.mockRejectedValue(new HttpError(404, 'Not Found', ''))
    const response = baseResponse({ share_secret: 'secret-abc', invites: [baseInvite()] })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    fireEvent.click(screen.getByTestId('invite-email'))

    await waitFor(() =>
      expect(screen.getByTestId('invite-email-error')).toHaveTextContent(
        /can't be emailed from here any more — copy it instead/i,
      ),
    )
    expect(screen.getByTestId('invite-email')).toBeDisabled()
  })

  it('422 → "email address was rejected" message, no retry (button stays disabled)', async () => {
    mocks.sendBookingInvite.mockRejectedValue(
      new HttpError(422, 'Unprocessable Entity', ''),
    )
    const response = baseResponse({ share_secret: 'secret-abc', invites: [baseInvite()] })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    fireEvent.click(screen.getByTestId('invite-email'))

    await waitFor(() =>
      expect(screen.getByTestId('invite-email-error')).toHaveTextContent(
        /that email address was rejected/i,
      ),
    )
    expect(screen.getByTestId('invite-email')).toBeDisabled()
  })

  it('429 → "too many emails" message, retry allowed (button re-enables)', async () => {
    mocks.sendBookingInvite.mockRejectedValue(
      new HttpError(429, 'Too Many Requests', ''),
    )
    const response = baseResponse({ share_secret: 'secret-abc', invites: [baseInvite()] })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    fireEvent.click(screen.getByTestId('invite-email'))

    await waitFor(() =>
      expect(screen.getByTestId('invite-email-error')).toHaveTextContent(
        /too many emails right now — try again in a few minutes/i,
      ),
    )
    expect(screen.getByTestId('invite-email')).not.toBeDisabled()
    expect(screen.getByTestId('invite-email')).toHaveTextContent(/retry email/i)
  })

  it('a network/generic failure keeps the existing retry-able generic message', async () => {
    mocks.sendBookingInvite.mockRejectedValue(new TypeError('Failed to fetch'))
    const response = baseResponse({ share_secret: 'secret-abc', invites: [baseInvite()] })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    fireEvent.click(screen.getByTestId('invite-email'))

    await waitFor(() =>
      expect(screen.getByTestId('invite-email-error')).toHaveTextContent(
        /could not send that email/i,
      ),
    )
    expect(screen.getByTestId('invite-email')).not.toBeDisabled()
  })

  it('shows "Booked ✓" with the linked reference instead of actions once a companion has joined', () => {
    const invite = baseInvite({ linked_booking_reference: 'CCCC3333' })
    const response = baseResponse({ share_secret: 'secret-abc', invites: [invite] })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByTestId('invite-linked')).toHaveTextContent('Booked ✓ (ref CCCC3333)')
    expect(screen.queryByTestId('invite-whatsapp')).not.toBeInTheDocument()
    expect(screen.queryByTestId('invite-email')).not.toBeInTheDocument()
    expect(screen.queryByTestId('invite-copy')).not.toBeInTheDocument()
  })

  it('renders the "Booked together with" group block, excluding self', () => {
    const response = baseResponse({ group: baseGroup() })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const group = screen.getByTestId('confirmation-group')
    expect(group).toHaveTextContent('Booked together with')
    expect(group).toHaveTextContent('Thomas K***n (ref BBBB2222)')
    // Self is excluded — the booker already knows they're on the list.
    expect(group).not.toHaveTextContent('Olaf K***n')
  })

  it('renders nothing for a group of one (self only — should not happen per API contract, but degrade quietly)', () => {
    const response = baseResponse({
      group: baseGroup({
        members: [{ reference: 'AAAA1111', display_name: 'Olaf K***n', is_self: true, is_host: true }],
      }),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.queryByTestId('confirmation-group')).not.toBeInTheDocument()
  })

  it('shows the shared-double "add reference later" hint when isSharedDouble and no group/join_error', () => {
    const response = baseResponse()
    render(<Confirmation response={response} onRestart={vi.fn()} isSharedDouble />)

    expect(screen.getByTestId('confirmation-shared-double-hint')).toBeInTheDocument()
  })

  it('omits the shared-double hint once a group already formed', () => {
    const response = baseResponse({ group: baseGroup() })
    render(<Confirmation response={response} onRestart={vi.fn()} isSharedDouble />)

    expect(screen.queryByTestId('confirmation-shared-double-hint')).not.toBeInTheDocument()
  })

  it('omits the shared-double hint when a join_error already covers it', () => {
    const response = baseResponse({ join_error: { error: 'unknown_reference' } })
    render(<Confirmation response={response} onRestart={vi.fn()} isSharedDouble />)

    expect(screen.queryByTestId('confirmation-shared-double-hint')).not.toBeInTheDocument()
    expect(screen.getByTestId('confirmation-join-error')).toBeInTheDocument()
  })

  it('links the shared-double hint to the customer page when the API supplied one', () => {
    const response = baseResponse({ customer_page_url: 'https://my.landr.de/t/abc123' })
    render(<Confirmation response={response} onRestart={vi.fn()} isSharedDouble />)

    const link = screen.getByRole('link', { name: /add their reference on your booking page/i })
    expect(link).toHaveAttribute('href', 'https://my.landr.de/t/abc123#join')
  })

  it('omits the link (plain text only) when customer_page_url is absent', () => {
    const response = baseResponse()
    render(<Confirmation response={response} onRestart={vi.fn()} isSharedDouble />)

    expect(screen.queryByRole('link', { name: /add their reference/i })).not.toBeInTheDocument()
    expect(screen.getByTestId('confirmation-shared-double-hint')).toHaveTextContent(
      /add their reference on your booking page/i,
    )
  })

  it('shows a calm join_error notice without blocking the rest of the page', () => {
    const response = baseResponse({
      join_error: { error: 'same_booking' },
      summary: baseSummary(),
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(screen.getByTestId('confirmation-join-error')).toHaveTextContent(
      /that reference points to your own booking/i,
    )
    // The rest of the confirmation screen still renders normally.
    expect(screen.getByTestId('confirmation-summary')).toBeInTheDocument()
  })
})

// ------------------------------------------------------------------
// landr-otml0.4 review fix (MAJOR 4): CopyButton's never-a-silent-no-op
// fallback chain — navigator.clipboard → execCommand('copy') → reveal a
// manual select-and-copy input.
// ------------------------------------------------------------------

describe('Confirmation — landr-otml0.4 CopyButton fallback chain', () => {
  const originalExecCommand = document.execCommand

  afterEach(() => {
    document.execCommand = originalExecCommand
  })

  it('falls back to document.execCommand("copy") when navigator.clipboard is unavailable', () => {
    stubClipboardUnavailable()
    document.execCommand = vi.fn(() => true)
    const response = baseResponse({ summary: baseSummary({ booking_reference: 'REF-1234' }) })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    fireEvent.click(screen.getByTestId('confirmation-reference-copy'))

    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(screen.getByTestId('confirmation-reference-copy')).toHaveTextContent(/copied/i)
  })

  it('reveals a manual select-and-copy input when both clipboard and execCommand fail', () => {
    stubClipboardUnavailable()
    document.execCommand = vi.fn(() => false)
    const response = baseResponse({ summary: baseSummary({ booking_reference: 'REF-1234' }) })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    fireEvent.click(screen.getByTestId('confirmation-reference-copy'))

    // The button is replaced by a readonly input carrying the exact value —
    // never a silent no-op.
    expect(screen.queryByTestId('confirmation-reference-copy')).not.toBeInTheDocument()
    const manualInput = screen.getByTestId(
      'confirmation-reference-copy-manual',
    ) as HTMLInputElement
    expect(manualInput).toHaveValue('REF-1234')
    expect(manualInput).toHaveAttribute('readonly')
  })

  it('reveals the manual fallback when execCommand throws rather than returning false', () => {
    stubClipboardUnavailable()
    document.execCommand = vi.fn(() => {
      throw new Error('not implemented')
    })
    const response = baseResponse({ share_secret: 'secret-abc', invites: [baseInvite()] })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    fireEvent.click(screen.getByTestId('invite-copy'))

    const manualInput = screen.getByTestId('invite-copy-manual') as HTMLInputElement
    expect(manualInput).toHaveValue(baseInvite().invite_url)
  })
})
