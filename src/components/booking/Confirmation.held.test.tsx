/**
 * A request held over the operator's monthly cap, and the checkout of an
 * operator who takes no online payment.
 *
 * The held state comes from the booking-create response (`held_over_cap` +
 * `hold_expires_at`). It is a received request: not an error, not confirmed.
 */
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Confirmation } from './Confirmation'
import type { BookingSummary, SubmitBookingResponse } from '@/api/types'
import { formatRequestDeadline } from '@/lib/seatHold'

const BOOKING_ID = '00000000-0000-0000-0000-0000000000bb'
// Far in the future so the relative "tonight/tomorrow" hints never apply.
const DEADLINE = '2031-03-07T21:59:00Z'

function summary(overrides: Partial<BookingSummary> = {}): BookingSummary {
  return {
    booking_id: BOOKING_ID,
    booking_reference: 'REF-1234',
    operator_name: 'Sky Club',
    product_label: 'Tandem Classic',
    products: [{ product_id: 'svc', label: 'Tandem Classic', qty: 1, selected_days: ['2031-03-10'] }],
    dates: { days: ['2031-03-10'], start: '2031-03-10', end: '2031-03-10', label: '10 Mar 2031' },
    participant_count: 1,
    participants: [{ name: 'Ada Lovelace' }],
    pickup_location: null,
    pickup_locations: [],
    hotel: null,
    line_items: [
      {
        product_id: 'svc',
        label: 'Tandem Classic',
        qty: 1,
        units: 1,
        unit_price: '120.00',
        line_total: '120.00',
        paid_to: 'operator',
      },
    ],
    operator_total: '120.00',
    hotel_total: '0.00',
    grand_total: '120.00',
    currency: 'EUR',
    savings: [],
    savings_total: '0.00',
    subtotal_before_savings: '120.00',
    amount_due: '120.00',
    multi_day_savings: null,
    price_overridden: false,
    ...overrides,
  }
}

function held(overrides: Partial<SubmitBookingResponse> = {}): SubmitBookingResponse {
  return {
    booking_id: BOOKING_ID,
    semantic_state: 'pending',
    held_over_cap: true,
    hold_expires_at: DEADLINE,
    payment_mode: 'on_site',
    payment_methods: ['on_site'],
    ...overrides,
  }
}

function setBrowserLanguage(language: string) {
  vi.stubGlobal('navigator', { ...navigator, language })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Confirmation: held request', () => {
  it('says the request was received and names the enforced deadline, not "confirmed"', () => {
    setBrowserLanguage('en-US')
    render(
      <Confirmation
        response={held({ summary: summary() })}
        onRestart={vi.fn()}
        operatorName="Sky Club"
        contactEmail="hello@skyclub.example"
      />,
    )
    expect(screen.getByTestId('confirmation-title')).toHaveTextContent('Request received')
    expect(screen.queryByText('Booking confirmed')).not.toBeInTheDocument()
    const deadline = screen.getByTestId('confirmation-held-deadline')
    expect(deadline).toHaveTextContent('Sky Club will confirm your request by')
    // Rendered from hold_expires_at, never a hard-coded "7 days".
    expect(deadline).toHaveTextContent(formatRequestDeadline(DEADLINE, 'en-US') as string)
    expect(deadline).not.toHaveTextContent(/7 days/i)
    expect(screen.getByTestId('confirmation-held')).toHaveTextContent('Nothing is due now')
  })

  it('is not an error: no failure notice and no awaiting-approval line', () => {
    setBrowserLanguage('en-US')
    render(
      <Confirmation
        response={held({ confirmation_email_status: 'failed' })}
        onRestart={vi.fn()}
        operatorName="Sky Club"
      />,
    )
    expect(screen.queryByText(/could not be sent/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/awaiting confirmation/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('confirmation-held')).toBeInTheDocument()
  })

  it('shows the operator contact details as a mailto link', () => {
    setBrowserLanguage('en-US')
    render(
      <Confirmation
        response={held()}
        onRestart={vi.fn()}
        operatorName="Sky Club"
        contactEmail="hello@skyclub.example"
      />,
    )
    const link = screen.getByRole('link', { name: 'hello@skyclub.example' })
    expect(link).toHaveAttribute('href', 'mailto:hello@skyclub.example')
  })

  it('hides the contact line when the operator has no public email', () => {
    setBrowserLanguage('en-US')
    render(<Confirmation response={held()} onRestart={vi.fn()} operatorName="Sky Club" />)
    expect(screen.queryByTestId('confirmation-held-contact')).not.toBeInTheDocument()
  })

  it('offers no calendar download for a request that is not confirmed', () => {
    setBrowserLanguage('en-US')
    render(
      <Confirmation
        response={held({ ical_url: 'https://api.example/cal.ics' })}
        onRestart={vi.fn()}
        operatorName="Sky Club"
      />,
    )
    expect(screen.queryByText(/ics/i)).not.toBeInTheDocument()
  })

  it('renders a usable message when the API sent no (or a broken) deadline', () => {
    setBrowserLanguage('en-US')
    for (const bad of [null, undefined, 'not-a-date']) {
      const { unmount } = render(
        <Confirmation
          response={held({ hold_expires_at: bad })}
          onRestart={vi.fn()}
          operatorName="Sky Club"
        />,
      )
      expect(screen.getByTestId('confirmation-held-deadline')).toHaveTextContent(
        'Sky Club will get back to you about your request.',
      )
      unmount()
    }
  })

  it('falls back to generic wording without an operator name', () => {
    setBrowserLanguage('en-US')
    render(<Confirmation response={held()} onRestart={vi.fn()} />)
    expect(screen.getByTestId('confirmation-held-deadline')).toHaveTextContent(
      'The operator will confirm your request by',
    )
  })

  it('renders in German', () => {
    setBrowserLanguage('de-DE')
    render(
      <Confirmation
        response={held()}
        onRestart={vi.fn()}
        operatorName="Sky Club"
        contactEmail="hello@skyclub.example"
      />,
    )
    expect(screen.getByTestId('confirmation-title')).toHaveTextContent('Anfrage erhalten')
    expect(screen.getByTestId('confirmation-held-deadline')).toHaveTextContent(
      'Sky Club bestätigt Ihre Anfrage bis',
    )
    expect(screen.getByTestId('confirmation-held')).toHaveTextContent('Kontakt')
    expect(screen.queryByText('Request received')).not.toBeInTheDocument()
  })

  it('a booking that is not held keeps today\'s confirmed screen', () => {
    setBrowserLanguage('en-US')
    render(
      <Confirmation
        response={{
          booking_id: BOOKING_ID,
          semantic_state: 'confirmed',
          approval_outcome: 'auto_approved',
          held_over_cap: false,
        }}
        onRestart={vi.fn()}
      />,
    )
    expect(screen.getByTestId('confirmation-title')).toHaveTextContent('Booking confirmed')
    expect(screen.queryByTestId('confirmation-held')).not.toBeInTheDocument()
  })
})

describe('Confirmation: operator without online payment', () => {
  const direct = (overrides: Partial<SubmitBookingResponse> = {}): SubmitBookingResponse => ({
    booking_id: BOOKING_ID,
    semantic_state: 'confirmed',
    approval_outcome: 'auto_approved',
    payment_mode: 'on_site',
    payment_methods: ['on_site'],
    summary: summary(),
    ...overrides,
  })

  it('shows "pay directly to <operator>" and no payment link', () => {
    setBrowserLanguage('en-US')
    render(<Confirmation response={direct()} onRestart={vi.fn()} operatorName="Sky Club" />)
    expect(screen.getByTestId('confirmation-pay-directly')).toHaveTextContent(
      'Pay directly to Sky Club. There is no online payment.',
    )
    expect(screen.queryByText(/payment link/i)).not.toBeInTheDocument()
  })

  it('follows the payment methods, not any plan name: online adds no such line', () => {
    setBrowserLanguage('en-US')
    render(
      <Confirmation
        response={direct({ payment_mode: 'online', payment_methods: ['online', 'on_site'] })}
        onRestart={vi.fn()}
        operatorName="Sky Club"
      />,
    )
    expect(screen.queryByTestId('confirmation-pay-directly')).not.toBeInTheDocument()
  })

  it('is also shown on a held request\'s price breakdown', () => {
    setBrowserLanguage('en-US')
    render(<Confirmation response={held({ summary: summary() })} onRestart={vi.fn()} operatorName="Sky Club" />)
    expect(screen.getByTestId('confirmation-pay-directly')).toBeInTheDocument()
  })
})
