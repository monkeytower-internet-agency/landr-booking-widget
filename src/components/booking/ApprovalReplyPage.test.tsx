import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HttpError } from '@/api/client'
import type {
  ApprovalReplyResult,
  ApprovalRequestContext,
} from '@/api/types'
import { ApprovalReplyPage } from './ApprovalReplyPage'

// ─── Mock API ─────────────────────────────────────────────────────────────
// Partial mock: keep the REAL HttpError class (ApprovalReplyPage does an
// `instanceof HttpError` check for the 422 invalid_confirm_nonce retry) and
// only stub the two calls this page makes.
const { mocks } = vi.hoisted(() => ({
  mocks: {
    getApprovalRequest: vi.fn<(token: string) => Promise<unknown>>(),
    submitApprovalReply: vi.fn<(token: string, body: unknown) => Promise<unknown>>(),
  },
}))

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    getApprovalRequest: mocks.getApprovalRequest,
    submitApprovalReply: mocks.submitApprovalReply,
  }
})

// ─── Fixtures ─────────────────────────────────────────────────────────────
const TOKEN = 'test-reply-token-abc123'

function openContext(
  overrides: Partial<ApprovalRequestContext> = {},
): ApprovalRequestContext {
  return {
    state: 'open',
    can_respond: true,
    locale: 'en',
    request_ref: 'a1b2c3d4',
    confirm_nonce: 'nonce-1',
    operator: {
      name: 'Para42',
      logo_url: null,
      primary_color: null,
      phone: '+49 30 1234567',
    },
    responder: { location_name: 'Hotel Alpina' },
    booking: {
      reference: 'B-12345',
      check_in: '2026-09-01',
      check_out: '2026-09-04',
      nights: 3,
      guests_count: 6,
      room_lines: [{ qty: 2, label: 'Double room' }],
    },
    current_response: null,
    ...overrides,
  }
}

function successResult(
  decision: ApprovalReplyResult['decision'],
  overrides: Partial<ApprovalReplyResult> = {},
): ApprovalReplyResult {
  return {
    ok: true,
    state: 'answered',
    decision,
    recorded_at: '2026-03-12T10:00:00Z',
    already_recorded: false,
    booking_advanced: decision === 'confirmed',
    superseded_previous: false,
    ...overrides,
  }
}

function nonceError() {
  return new HttpError(
    422,
    'Unprocessable Entity',
    JSON.stringify({ detail: 'invalid_confirm_nonce' }),
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────
describe('ApprovalReplyPage', () => {
  beforeEach(() => {
    mocks.getApprovalRequest.mockReset()
    mocks.submitApprovalReply.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── THE ANTI-PREFETCHER TEST ──────────────────────────────────────────
  it('THE ANTI-PREFETCHER TEST: mere render never calls submitApprovalReply, and GET fires exactly once', async () => {
    mocks.getApprovalRequest.mockResolvedValue(openContext())
    render(<ApprovalReplyPage token={TOKEN} intent="yes" />)

    await waitFor(() => {
      expect(screen.getByTestId('reply-form')).toBeInTheDocument()
    })

    expect(mocks.getApprovalRequest).toHaveBeenCalledExactlyOnceWith(TOKEN)
    expect(mocks.submitApprovalReply).not.toHaveBeenCalled()
  })

  it('shows a loading card while the GET is in flight', () => {
    mocks.getApprovalRequest.mockReturnValue(new Promise(() => {}))
    render(<ApprovalReplyPage token={TOKEN} />)
    expect(screen.getByTestId('reply-loading')).toBeInTheDocument()
  })

  it('pre-selects the decision from the URL intent but leaves it changeable', async () => {
    mocks.getApprovalRequest.mockResolvedValue(openContext())
    render(<ApprovalReplyPage token={TOKEN} intent="no" />)
    await waitFor(() => screen.getByTestId('reply-form'))

    expect(
      screen.getByRole('radio', { name: /can't take this booking/i }),
    ).toHaveAttribute('aria-checked', 'true')
    expect(
      screen.getByRole('radio', { name: /rooms confirmed/i }),
    ).toHaveAttribute('aria-checked', 'false')
  })

  // ── Confirm submits the selected (possibly changed) decision ──────────
  it('clicking confirm calls submitApprovalReply exactly once with the decision, comment and nonce', async () => {
    mocks.getApprovalRequest.mockResolvedValue(openContext())
    mocks.submitApprovalReply.mockResolvedValue(successResult('confirmed'))
    render(<ApprovalReplyPage token={TOKEN} intent="yes" />)
    await waitFor(() => screen.getByTestId('reply-form'))

    fireEvent.change(screen.getByLabelText(/comment/i), {
      target: { value: 'Rooms are ready for you.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }))

    await waitFor(() =>
      expect(mocks.submitApprovalReply).toHaveBeenCalledExactlyOnceWith(TOKEN, {
        decision: 'confirmed',
        comment: 'Rooms are ready for you.',
        responder_name: null,
        confirm_nonce: 'nonce-1',
      }),
    )
  })

  it('changing the selection away from the URL intent submits the changed decision', async () => {
    mocks.getApprovalRequest.mockResolvedValue(openContext())
    mocks.submitApprovalReply.mockResolvedValue(successResult('declined'))
    render(<ApprovalReplyPage token={TOKEN} intent="yes" />)
    await waitFor(() => screen.getByTestId('reply-form'))

    fireEvent.click(screen.getByRole('radio', { name: /can't take this booking/i }))
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }))

    await waitFor(() => expect(mocks.submitApprovalReply).toHaveBeenCalledOnce())
    const [, body] = mocks.submitApprovalReply.mock.calls[0] as [string, { decision: string }]
    expect(body.decision).toBe('declined')
  })

  // ── Required-comment client-side guard ─────────────────────────────────
  it('confirmed_with_changes with an empty comment disables the confirm button client-side', async () => {
    mocks.getApprovalRequest.mockResolvedValue(openContext())
    render(<ApprovalReplyPage token={TOKEN} intent="changes" />)
    await waitFor(() => screen.getByTestId('reply-form'))

    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/comment/i), { target: { value: 'ok' } })
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/comment/i), {
      target: { value: 'Please switch to a twin room.' },
    })
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeEnabled()
    expect(mocks.submitApprovalReply).not.toHaveBeenCalled()
  })

  it('a declined reason chip populates the comment field', async () => {
    mocks.getApprovalRequest.mockResolvedValue(openContext())
    render(<ApprovalReplyPage token={TOKEN} intent="no" />)
    await waitFor(() => screen.getByTestId('reply-form'))

    fireEvent.click(screen.getByRole('button', { name: /fully booked/i }))
    expect(screen.getByLabelText(/comment/i)).toHaveValue('Fully booked')
  })

  // ── 422 invalid_confirm_nonce: silent retry ────────────────────────────
  it('a 422 invalid_confirm_nonce triggers exactly one silent re-GET + one retry, then success', async () => {
    mocks.getApprovalRequest
      .mockResolvedValueOnce(openContext({ confirm_nonce: 'nonce-1' }))
      .mockResolvedValueOnce(openContext({ confirm_nonce: 'nonce-2' }))
    mocks.submitApprovalReply
      .mockRejectedValueOnce(nonceError())
      .mockResolvedValueOnce(successResult('confirmed'))

    render(<ApprovalReplyPage token={TOKEN} intent="yes" />)
    await waitFor(() => screen.getByTestId('reply-form'))

    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }))

    await waitFor(() =>
      expect(screen.getByTestId('reply-success')).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('reply-error')).not.toBeInTheDocument()
    expect(mocks.getApprovalRequest).toHaveBeenCalledTimes(2)
    expect(mocks.submitApprovalReply).toHaveBeenCalledTimes(2)
    const secondCallBody = mocks.submitApprovalReply.mock.calls[1][1] as {
      confirm_nonce: string
    }
    expect(secondCallBody.confirm_nonce).toBe('nonce-2')
  })

  it('a second 422 invalid_confirm_nonce renders the error card', async () => {
    mocks.getApprovalRequest.mockResolvedValue(openContext())
    mocks.submitApprovalReply.mockRejectedValue(nonceError())

    render(<ApprovalReplyPage token={TOKEN} intent="yes" />)
    await waitFor(() => screen.getByTestId('reply-form'))

    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }))

    await waitFor(() => expect(screen.getByTestId('reply-error')).toBeInTheDocument())
    expect(mocks.getApprovalRequest).toHaveBeenCalledTimes(2)
    expect(mocks.submitApprovalReply).toHaveBeenCalledTimes(2)
  })

  it("submit error's Try again returns to the form WITHOUT re-calling the API", async () => {
    mocks.getApprovalRequest.mockResolvedValue(openContext())
    mocks.submitApprovalReply.mockRejectedValue(new Error('network down'))

    render(<ApprovalReplyPage token={TOKEN} intent="yes" />)
    await waitFor(() => screen.getByTestId('reply-form'))
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }))
    await waitFor(() => expect(screen.getByTestId('reply-error')).toBeInTheDocument())

    expect(mocks.getApprovalRequest).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(screen.getByTestId('reply-form')).toBeInTheDocument()
    // Still only the one initial GET — the retry-form does not re-fetch.
    expect(mocks.getApprovalRequest).toHaveBeenCalledOnce()
  })

  // ── Terminal named cards (never a bare error) ──────────────────────────
  it.each([
    ['closed_confirmed' as const, 'reply-closed-confirmed'],
    ['closed_cancelled' as const, 'reply-closed-cancelled'],
    ['superseded' as const, 'reply-superseded'],
    ['expired' as const, 'reply-expired'],
  ])('renders the named %s card, not the raw error card', async (state, testId) => {
    mocks.getApprovalRequest.mockResolvedValue(openContext({ state }))
    render(<ApprovalReplyPage token={TOKEN} />)

    await waitFor(() => expect(screen.getByTestId(testId)).toBeInTheDocument())
    expect(screen.queryByTestId('reply-error')).not.toBeInTheDocument()
    // Branding still shows even on terminal cards.
    expect(screen.getByText('Para42')).toBeInTheDocument()
  })

  it("'answered' renders the recorded answer with a working Change my answer affordance", async () => {
    mocks.getApprovalRequest.mockResolvedValue(
      openContext({
        state: 'answered',
        current_response: {
          decision: 'confirmed',
          comment: 'All set for the group.',
          responder_name: 'Marta',
          responded_at: '2026-03-12T10:00:00Z',
        },
      }),
    )
    render(<ApprovalReplyPage token={TOKEN} />)

    await waitFor(() => expect(screen.getByTestId('reply-answered')).toBeInTheDocument())
    expect(screen.queryByTestId('reply-error')).not.toBeInTheDocument()
    expect(screen.getByText(/all set for the group/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /change my answer/i }))

    await waitFor(() => expect(screen.getByTestId('reply-form')).toBeInTheDocument())
    expect(
      screen.getByRole('radio', { name: /rooms confirmed/i }),
    ).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText(/comment/i)).toHaveValue('All set for the group.')
    // No API call was made just to reveal the form.
    expect(mocks.submitApprovalReply).not.toHaveBeenCalled()
  })

  // ── Opaque GET failure ──────────────────────────────────────────────────
  it('a rejected GET renders the opaque error card without leaking status or booking details', async () => {
    mocks.getApprovalRequest.mockRejectedValue(new Error('404 Not Found: {"detail":"not found"}'))
    render(<ApprovalReplyPage token={TOKEN} />)

    await waitFor(() => expect(screen.getByTestId('reply-error')).toBeInTheDocument())
    expect(screen.queryByText(/B-12345/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Hotel Alpina/)).not.toBeInTheDocument()
    expect(screen.queryByText(/404/)).not.toBeInTheDocument()
    expect(screen.queryByText(/not found/i)).not.toBeInTheDocument()
  })

  // ── In-flight disables everything ───────────────────────────────────────
  it('disables all controls while the confirm POST is in flight', async () => {
    mocks.getApprovalRequest.mockResolvedValue(openContext())
    let resolveSubmit!: (v: unknown) => void
    mocks.submitApprovalReply.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve
      }),
    )
    render(<ApprovalReplyPage token={TOKEN} intent="yes" />)
    await waitFor(() => screen.getByTestId('reply-form'))

    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }))

    const busyButton = await screen.findByRole('button', { name: /confirming/i })
    expect(busyButton).toBeDisabled()
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled()
    }
    expect(screen.getByLabelText(/comment/i)).toBeDisabled()
    expect(screen.getByLabelText(/your name/i)).toBeDisabled()

    resolveSubmit(successResult('confirmed'))
    await waitFor(() => expect(screen.getByTestId('reply-success')).toBeInTheDocument())
  })

  // ── i18n: ?lang= override + language switcher ───────────────────────────
  it('a ?lang=de query override renders the German bundle regardless of the GET locale', async () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, search: '?lang=de' },
    })
    mocks.getApprovalRequest.mockResolvedValue(openContext({ locale: 'en' }))
    render(<ApprovalReplyPage token={TOKEN} intent="yes" />)

    await waitFor(() => screen.getByTestId('reply-form'))
    expect(screen.getByText(/Zimmeranfrage/)).toBeInTheDocument()

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  it('the footer language switcher changes the rendered locale', async () => {
    mocks.getApprovalRequest.mockResolvedValue(openContext({ locale: 'en' }))
    render(<ApprovalReplyPage token={TOKEN} intent="yes" />)
    await waitFor(() => screen.getByTestId('reply-form'))

    fireEvent.click(screen.getByRole('button', { name: 'ES' }))
    expect(screen.getByText(/Solicitud de habitaciones/)).toBeInTheDocument()
  })
})
