import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HttpError, type CancelPreview } from '@/api/client'

import { CancelPage } from './CancelPage'

/**
 * CancelPage (landr-sgnd; token + deadline + refund since landr-5aih0.7).
 * The API client is mocked; HttpError / isCancellationDeadlinePassed stay
 * real so the 409 branch is exercised through the same helper the page uses.
 */

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getCancelPreview: vi.fn<(token: string) => Promise<unknown>>(),
    cancelBooking: vi.fn<(token: string) => Promise<unknown>>(),
  },
}))

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return {
    ...actual,
    getCancelPreview: mocks.getCancelPreview,
    cancelBooking: mocks.cancelBooking,
  }
})

const TOKEN = '11111111111111111111111111111111.1790000000.sig_-AbC'
const DEADLINE = '2026-07-13T23:00:00+00:00'
const TZ = 'Atlantic/Canary'

function preview(overrides: Partial<CancelPreview> = {}): CancelPreview {
  return {
    booking_id: '11111111-1111-1111-1111-111111111111',
    booking_reference: '11111111',
    allowed: true,
    already_cancelled: false,
    deadline: DEADLINE,
    timezone: TZ,
    refund: { amount: '75.00', currency: 'EUR', method: 'stripe_auto' },
    operator: { name: 'Sky Op', phone: '+34 600 000 000', email: 'hello@sky.example' },
    policy_text: null,
    locale: 'en',
    refund_status: null,
    ...overrides,
  }
}

function expectedDeadline(locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
    timeZoneName: 'short',
  }).format(new Date(DEADLINE))
}

/** Intl output uses (narrow) no-break spaces; the DOM matchers collapse them. */
function norm(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/gu, ' ').trim()
}

function textOf(testId: string): string {
  return norm(screen.getByTestId(testId).textContent)
}

function money(locale: string, amount = 75): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount)
}

async function renderLoaded(p: CancelPreview = preview()) {
  mocks.getCancelPreview.mockResolvedValue(p)
  render(<CancelPage token={TOKEN} />)
  await waitFor(() => expect(screen.queryByText(/loading your booking/i)).toBeNull())
}

describe('CancelPage', () => {
  beforeEach(() => {
    mocks.getCancelPreview.mockReset()
    mocks.cancelBooking.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads the preview for the token and never cancels on mount', async () => {
    await renderLoaded()
    expect(mocks.getCancelPreview).toHaveBeenCalledExactlyOnceWith(TOKEN)
    // Prefetcher safety: landing on the page must not cancel anything.
    expect(mocks.cancelBooking).not.toHaveBeenCalled()
  })

  it('shows the free-cancellation deadline, the refund and both buttons', async () => {
    await renderLoaded()
    expect(screen.getByText(/cancel your booking\?/i)).toBeInTheDocument()
    expect(textOf('cancel-deadline')).toBe(
      norm(`Free cancellation until ${expectedDeadline('en')}.`),
    )
    expect(textOf('cancel-refund')).toBe(
      norm(`You will get ${money('en')} back to your original payment method.`),
    )
    expect(screen.getByText('Booking 11111111')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /yes, cancel booking/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /no, keep booking/i })).toBeEnabled()
  })

  it('names the operator for a manual refund', async () => {
    await renderLoaded(preview({ refund: { amount: '75.00', currency: 'EUR', method: 'manual' } }))
    expect(textOf('cancel-refund')).toBe(
      norm(`Sky Op will refund ${money('en')} to you directly.`),
    )
  })

  it('says there is nothing to refund when nothing was paid', async () => {
    await renderLoaded(preview({ refund: { amount: '0.00', currency: 'EUR', method: 'none' } }))
    expect(screen.getByTestId('cancel-refund')).toHaveTextContent(/nothing to refund/i)
  })

  it('shows the operator policy text', async () => {
    await renderLoaded(preview({ policy_text: 'Free until the day before.' }))
    expect(screen.getByText('Free until the day before.')).toBeInTheDocument()
  })

  it('Yes cancels with the token and shows the refund outcome', async () => {
    mocks.cancelBooking.mockResolvedValue({
      ok: true, booking_id: 'x', message: 'booking cancelled', refund_status: 'refunded',
    })
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: /yes, cancel booking/i }))
    await waitFor(() => expect(screen.getByText('Booking cancelled')).toBeInTheDocument())
    expect(mocks.cancelBooking).toHaveBeenCalledExactlyOnceWith(TOKEN)
    expect(screen.getByText(/refund is on its way/i)).toBeInTheDocument()
  })

  it('a manual refund outcome names the operator', async () => {
    mocks.cancelBooking.mockResolvedValue({
      ok: true, booking_id: 'x', message: 'booking cancelled',
      refund_status: 'manual_refund_needed',
    })
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: /yes, cancel booking/i }))
    await waitFor(() =>
      expect(screen.getByText('Sky Op will contact you about your refund.')).toBeInTheDocument(),
    )
  })

  it('after the deadline it refuses and shows the operator contact', async () => {
    await renderLoaded(preview({ allowed: false }))
    expect(screen.getByText(/can no longer be cancelled online/i)).toBeInTheDocument()
    expect(textOf('cancel-refusal')).toContain(norm(`until ${expectedDeadline('en')}`))
    expect(textOf('cancel-refusal')).toContain('Please contact Sky Op')
    expect(screen.queryByRole('button', { name: /yes, cancel booking/i })).toBeNull()
    expect(screen.getByRole('link', { name: 'Call +34 600 000 000' })).toHaveAttribute(
      'href', 'tel:+34600000000',
    )
    expect(screen.getByRole('link', { name: 'Email hello@sky.example' })).toHaveAttribute(
      'href', 'mailto:hello@sky.example',
    )
  })

  it('a 409 on confirm switches to the refusal instead of an error', async () => {
    mocks.cancelBooking.mockRejectedValue(
      new HttpError(409, 'Conflict', JSON.stringify({
        detail: { error: 'cancellation_deadline_passed', deadline: DEADLINE },
      })),
    )
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: /yes, cancel booking/i }))
    await waitFor(() =>
      expect(screen.getByText(/can no longer be cancelled online/i)).toBeInTheDocument(),
    )
    expect(screen.getByTestId('cancel-contact')).toBeInTheDocument()
  })

  it('another failure shows the error card; Try again returns without calling the API', async () => {
    mocks.cancelBooking.mockRejectedValue(new HttpError(500, 'Server Error', ''))
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: /yes, cancel booking/i }))
    await waitFor(() => expect(screen.getByText(/cancellation failed/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(screen.getByText(/cancel your booking\?/i)).toBeInTheDocument()
    expect(mocks.cancelBooking).toHaveBeenCalledOnce()
  })

  it('a bad or expired link shows the invalid card and offers no action', async () => {
    mocks.getCancelPreview.mockRejectedValue(new HttpError(401, 'Unauthorized', ''))
    render(<CancelPage token="11111111-1111-1111-1111-111111111111" />)
    await waitFor(() =>
      expect(screen.getByText(/this link is no longer valid/i)).toBeInTheDocument(),
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(mocks.cancelBooking).not.toHaveBeenCalled()
  })

  it('an already cancelled booking shows the recorded outcome', async () => {
    await renderLoaded(preview({
      already_cancelled: true, allowed: false, refund_status: 'manual_refund_needed',
    }))
    expect(screen.getByText(/already cancelled/i)).toBeInTheDocument()
    expect(screen.getByText('Sky Op will contact you about your refund.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('speaks the language of the booking email (German)', async () => {
    await renderLoaded(preview({ locale: 'de' }))
    expect(screen.getByText('Buchung stornieren?')).toBeInTheDocument()
    expect(textOf('cancel-deadline')).toBe(
      norm(`Kostenlose Stornierung bis ${expectedDeadline('de')}.`),
    )
    expect(textOf('cancel-refund')).toContain(norm(money('de')))
    expect(screen.getByRole('button', { name: 'Ja, Buchung stornieren' })).toBeEnabled()
  })

  it('falls back to English for a locale the page does not ship', async () => {
    await renderLoaded(preview({ locale: 'fr' }))
    expect(screen.getByText(/cancel your booking\?/i)).toBeInTheDocument()
  })

  it('No, keep booking goes back in history and does not cancel', async () => {
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    Object.defineProperty(window.history, 'length', { configurable: true, value: 2 })
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: /no, keep booking/i }))
    expect(backSpy).toHaveBeenCalledOnce()
    expect(mocks.cancelBooking).not.toHaveBeenCalled()
  })

  it('both buttons are disabled while the request is in flight', async () => {
    let resolvePromise!: (value: unknown) => void
    mocks.cancelBooking.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve
      }),
    )
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: /yes, cancel booking/i }))
    expect(screen.getByRole('button', { name: /cancelling/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /no, keep booking/i })).toBeDisabled()
    resolvePromise({ ok: true, booking_id: 'x', message: 'ok', refund_status: 'not_applicable' })
    await waitFor(() => expect(screen.getByText('Booking cancelled')).toBeInTheDocument())
  })
})
