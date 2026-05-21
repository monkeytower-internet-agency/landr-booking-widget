import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CancelPage } from './CancelPage'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    cancelBooking: vi.fn<(bookingId: string) => Promise<unknown>>(),
  },
}))

vi.mock('@/api/client', () => ({
  cancelBooking: mocks.cancelBooking,
}))

const BOOKING_ID = '11111111-1111-1111-1111-111111111111'

describe('CancelPage', () => {
  beforeEach(() => {
    mocks.cancelBooking.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the confirm question with both buttons enabled', () => {
    render(<CancelPage bookingId={BOOKING_ID} />)
    expect(
      screen.getByText(/cancel your booking\?/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /yes, cancel booking/i }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: /no, keep booking/i }),
    ).toBeEnabled()
    // The booking id is surfaced so the customer can sanity-check
    // they're cancelling the right one.
    expect(screen.getByText(BOOKING_ID)).toBeInTheDocument()
  })

  it('clicking Yes calls cancelBooking and renders the success card', async () => {
    mocks.cancelBooking.mockResolvedValue({
      ok: true,
      booking_id: BOOKING_ID,
      message: 'booking cancelled',
    })
    render(<CancelPage bookingId={BOOKING_ID} />)

    fireEvent.click(screen.getByRole('button', { name: /yes, cancel booking/i }))

    await waitFor(() => {
      expect(screen.getByText(/booking cancelled/i)).toBeInTheDocument()
    })
    expect(mocks.cancelBooking).toHaveBeenCalledExactlyOnceWith(BOOKING_ID)
    expect(screen.getByText(/sorry to see you go/i)).toBeInTheDocument()
  })

  it('failed cancel shows the error card with a Try again button', async () => {
    mocks.cancelBooking.mockRejectedValue(new Error('404 Not Found'))
    render(<CancelPage bookingId={BOOKING_ID} />)

    fireEvent.click(screen.getByRole('button', { name: /yes, cancel booking/i }))

    await waitFor(() => {
      expect(screen.getByText(/cancellation failed/i)).toBeInTheDocument()
    })
    // Try again resets to the confirm view (without re-running cancel).
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(
      screen.getByText(/cancel your booking\?/i),
    ).toBeInTheDocument()
  })

  it('No, keep booking calls history.back when there is history to go back to', () => {
    // history.length defaults to 1 in jsdom; we need >1 for the back()
    // branch to fire.
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    Object.defineProperty(window.history, 'length', {
      configurable: true,
      value: 2,
    })

    render(<CancelPage bookingId={BOOKING_ID} />)
    fireEvent.click(screen.getByRole('button', { name: /no, keep booking/i }))

    expect(backSpy).toHaveBeenCalledOnce()
    // Crucially: cancelBooking is NOT called.
    expect(mocks.cancelBooking).not.toHaveBeenCalled()
  })

  it('Yes button is disabled while the request is in flight', async () => {
    let resolvePromise!: (value: unknown) => void
    mocks.cancelBooking.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve
      }),
    )
    render(<CancelPage bookingId={BOOKING_ID} />)
    const yesBtn = screen.getByRole('button', { name: /yes, cancel booking/i })
    fireEvent.click(yesBtn)
    // Now in 'submitting' — both buttons disabled, label changes.
    expect(
      screen.getByRole('button', { name: /cancelling/i }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /no, keep booking/i }),
    ).toBeDisabled()
    // Resolve so the test doesn't leak a pending promise.
    resolvePromise({ ok: true, booking_id: BOOKING_ID, message: 'ok' })
    await waitFor(() =>
      expect(screen.getByText(/booking cancelled/i)).toBeInTheDocument(),
    )
  })
})
