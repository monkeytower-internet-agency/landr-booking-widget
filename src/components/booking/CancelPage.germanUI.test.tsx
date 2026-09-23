/**
 * landr-5aih0.9 — widget German UI.
 *
 * CancelPage renders in German when the browser reports a German locale.
 * No operator whitelist is involved here (see CancelPage's own render
 * path in App.tsx — it never calls configureCustomerLocale), so the plain
 * browser-locale tier of the resolver is what's under test.
 */
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

function setBrowserLanguage(language: string) {
  vi.stubGlobal('navigator', { ...navigator, language })
}

describe('CancelPage — German UI (landr-5aih0.9)', () => {
  beforeEach(() => {
    mocks.cancelBooking.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders the confirm question in German', () => {
    setBrowserLanguage('de-DE')
    render(<CancelPage bookingId={BOOKING_ID} />)

    expect(screen.getByText('Buchung stornieren?')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Ja, Buchung stornieren' }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Nein, Buchung behalten' }),
    ).toBeEnabled()
  })

  it('renders the success card in German after cancelling', async () => {
    setBrowserLanguage('de-DE')
    mocks.cancelBooking.mockResolvedValue({
      ok: true,
      booking_id: BOOKING_ID,
      message: 'booking cancelled',
    })
    render(<CancelPage bookingId={BOOKING_ID} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ja, Buchung stornieren' }))

    await waitFor(() => {
      expect(screen.getByText('Buchung storniert')).toBeInTheDocument()
    })
    expect(screen.getByText('Schade, dass Sie gehen.')).toBeInTheDocument()
  })

  it('renders English on a non-German browser (default)', () => {
    setBrowserLanguage('en-US')
    render(<CancelPage bookingId={BOOKING_ID} />)

    expect(screen.getByText('Cancel your booking?')).toBeInTheDocument()
  })
})
