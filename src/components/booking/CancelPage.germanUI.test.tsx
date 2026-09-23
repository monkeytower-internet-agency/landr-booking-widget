/**
 * landr-5aih0.9 — widget German UI, for CancelPage.
 *
 * Since landr-5aih0.7 the page speaks the BOOKING EMAIL's language once the
 * cancel-preview has loaded (preview.locale — the customer just clicked that
 * email). The browser locale is the tier that applies before that: while the
 * preview loads, and for a dead link that never yields a preview. Both tiers
 * are covered here; the per-locale copy itself is in CancelPage.test.tsx.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HttpError } from '@/api/client'

import { CancelPage } from './CancelPage'

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

const TOKEN = '11111111111111111111111111111111.1790000000.sig'

function preview(locale: string) {
  return {
    booking_id: '11111111-1111-1111-1111-111111111111',
    booking_reference: '11111111',
    allowed: true,
    already_cancelled: false,
    deadline: '2026-07-13T23:00:00+00:00',
    timezone: 'Atlantic/Canary',
    refund: { amount: '0.00', currency: 'EUR', method: 'none' },
    operator: { name: 'Sky Op', phone: null, email: null },
    policy_text: null,
    locale,
    refund_status: null,
  }
}

function setBrowserLanguage(language: string) {
  vi.stubGlobal('navigator', { ...navigator, language })
}

describe('CancelPage — German UI (landr-5aih0.9)', () => {
  beforeEach(() => {
    mocks.getCancelPreview.mockReset()
    mocks.cancelBooking.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows the loading state in German on a German browser', () => {
    setBrowserLanguage('de-DE')
    mocks.getCancelPreview.mockReturnValue(new Promise(() => {}))
    render(<CancelPage token={TOKEN} />)
    expect(screen.getByText('Deine Buchung wird geladen …')).toBeInTheDocument()
  })

  it('shows a dead link in German on a German browser', async () => {
    setBrowserLanguage('de-DE')
    mocks.getCancelPreview.mockRejectedValue(new HttpError(401, 'Unauthorized', ''))
    render(<CancelPage token={TOKEN} />)
    await waitFor(() =>
      expect(screen.getByText('Dieser Link ist nicht mehr gültig')).toBeInTheDocument(),
    )
  })

  it('renders the confirm question and success card in German for a German booking', async () => {
    setBrowserLanguage('en-US')
    mocks.getCancelPreview.mockResolvedValue(preview('de'))
    mocks.cancelBooking.mockResolvedValue({
      ok: true, booking_id: 'x', message: 'booking cancelled', refund_status: 'not_applicable',
    })
    render(<CancelPage token={TOKEN} />)

    await waitFor(() => expect(screen.getByText('Buchung stornieren?')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Nein, Buchung behalten' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Ja, Buchung stornieren' }))
    await waitFor(() => expect(screen.getByText('Buchung storniert')).toBeInTheDocument())
  })

  it('an English booking stays English on a German browser', async () => {
    setBrowserLanguage('de-DE')
    mocks.getCancelPreview.mockResolvedValue(preview('en'))
    render(<CancelPage token={TOKEN} />)
    await waitFor(() => expect(screen.getByText('Cancel your booking?')).toBeInTheDocument())
  })

  it('renders English on a non-German browser while loading (default)', () => {
    setBrowserLanguage('en-US')
    mocks.getCancelPreview.mockReturnValue(new Promise(() => {}))
    render(<CancelPage token={TOKEN} />)
    expect(screen.getByText('Loading your booking…')).toBeInTheDocument()
  })
})
