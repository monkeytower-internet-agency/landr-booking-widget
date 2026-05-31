import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Confirmation } from './Confirmation'
import type { SubmitBookingResponse } from '@/api/types'

/**
 * Tests for the booking confirmation success page. landr-3vr5 added
 * the "Add to calendar" anchor, which is the focus here — the rest of
 * the card is covered indirectly by App.test.tsx.
 */

function baseResponse(overrides: Partial<SubmitBookingResponse> = {}): SubmitBookingResponse {
  return {
    booking_id: '00000000-0000-0000-0000-0000000000bb',
    semantic_state: 'pending',
    ...overrides,
  }
}

describe('Confirmation', () => {
  it('renders "Add to calendar" anchor when ical_url is present', () => {
    const response = baseResponse({
      ical_url: 'https://api.dev.landr.de/api/public/bookings/00000000-0000-0000-0000-0000000000bb/calendar.ics',
    })
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    const link = screen.getByRole('link', { name: /add to calendar/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', response.ical_url)
    // The download attribute should match the API's Content-Disposition
    // filename so save dialogs propose a sensible name on every browser.
    expect(link).toHaveAttribute(
      'download',
      `landr-booking-${response.booking_id}.ics`,
    )
  })

  it('omits the "Add to calendar" link when ical_url is missing', () => {
    const response = baseResponse() // no ical_url
    render(<Confirmation response={response} onRestart={vi.fn()} />)

    expect(
      screen.queryByRole('link', { name: /add to calendar/i }),
    ).not.toBeInTheDocument()
    // The card itself still renders.
    expect(screen.getByText(/booking received/i)).toBeInTheDocument()
  })

  it('always renders the "Make another booking" button regardless of ical_url', () => {
    const withIcal = baseResponse({ ical_url: 'https://x/y.ics' })
    const withoutIcal = baseResponse()
    const { rerender } = render(
      <Confirmation response={withIcal} onRestart={vi.fn()} />,
    )
    expect(
      screen.getByRole('button', { name: /make another booking/i }),
    ).toBeInTheDocument()
    rerender(<Confirmation response={withoutIcal} onRestart={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: /make another booking/i }),
    ).toBeInTheDocument()
  })
})
