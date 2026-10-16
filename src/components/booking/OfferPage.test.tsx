import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HttpError } from '@/api/client'

import { formatCurrency } from './accommodationCalc'
import { OfferPage } from './OfferPage'

// ─── Mock API ────────────────────────────────────────────────────────────────
// landr-k9pji.15: HttpError / isPaymentModeNotOnline / paymentModeNotOnlineMode
// stay real (vi.importActual) so the 409 branch below is exercised through
// the same helpers OfferPage itself uses, same pattern as CancelPage.test.tsx.
const { mocks } = vi.hoisted(() => ({
  mocks: {
    getBookingByToken: vi.fn<(token: string) => Promise<unknown>>(),
    initiatePayment: vi.fn<(body: unknown) => Promise<unknown>>(),
    acceptOffer: vi.fn<(token: string) => Promise<unknown>>(),
  },
}))

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return {
    ...actual,
    getBookingByToken: mocks.getBookingByToken,
    initiatePayment: mocks.initiatePayment,
    acceptOffer: mocks.acceptOffer,
  }
})

// ─── Test fixtures ────────────────────────────────────────────────────────────
const TOKEN = 'test-offer-token-abc123'

const OFFER = {
  booking_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  customer_semantic_state: 'confirmed',
  cancellation_deadline: null,
  totals: {
    gross_total: 1190.0,
    tax_total: 190.0,
    net_total: 1000.0,
    balance_due: 1190.0,
    currency: 'EUR',
  },
  customer: {
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@example.com',
  },
  product_lines: [
    {
      product_id: 'p1',
      name: 'Sailing Week',
      name_localized: null,
      date_range_start: '2026-07-01',
      date_range_end: '2026-07-07',
      selected_days: ['2026-07-01', '2026-07-02', '2026-07-03'],
      quantity: 1,
    },
  ],
  participants: [
    { first_name: 'Jane', last_name: 'Doe', service_role_label: 'Skipper' },
    { first_name: 'John', last_name: null, service_role_label: null },
  ],
}

// landr-k9pji.5 review fix — this file mocks `initiatePayment` itself (the
// already-coerced, consumer-facing shape — `InitiatePaymentResponse.amount`
// is a real `number`), so its fixtures use numbers throughout, same as
// below. The wire format (landr-api sends `amount` as a JSON STRING) and
// the string→number coercion boundary are covered separately, at the
// `initiatePayment()` unit level, in src/api/client.test.ts — mocking a
// STRING here instead would test a shape OfferPage never actually receives
// once client.ts does its job.
const INITIATE_RESP = {
  checkout_url: 'https://checkout.stripe.com/pay/cs_test_abc',
  payment_id: 'pay-uuid',
  stripe_payment_intent_id: 'pi_test',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setupQueryParam(param: string, value: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      search: `?${param}=${value}`,
      href: `http://stub.invalid/offer/${TOKEN}?${param}=${value}`,
      origin: 'http://stub.invalid',
      pathname: `/offer/${TOKEN}`,
    },
  })
}

function resetQueryParams() {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      search: '',
      href: `http://stub.invalid/offer/${TOKEN}`,
      origin: 'http://stub.invalid',
      pathname: `/offer/${TOKEN}`,
    },
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('OfferPage', () => {
  beforeEach(() => {
    mocks.getBookingByToken.mockReset()
    mocks.initiatePayment.mockReset()
    resetQueryParams()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('shows loading card while the API call is in flight', () => {
    // Never resolves — keeps the component in 'loading' state.
    mocks.getBookingByToken.mockReturnValue(new Promise(() => {}))
    render(<OfferPage token={TOKEN} />)
    expect(screen.getByTestId('offer-loading')).toBeInTheDocument()
    expect(screen.getByText(/loading your offer/i)).toBeInTheDocument()
  })

  it('renders the offer details after a successful fetch', async () => {
    mocks.getBookingByToken.mockResolvedValue(OFFER)
    render(<OfferPage token={TOKEN} />)

    await waitFor(() => {
      expect(screen.getByTestId('offer-ready')).toBeInTheDocument()
    })

    expect(mocks.getBookingByToken).toHaveBeenCalledExactlyOnceWith(TOKEN)
    expect(screen.getAllByText('Sailing Week').length).toBeGreaterThan(0)
    expect(screen.getByTestId('offer-gross-total')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accept & pay/i })).toBeEnabled()
  })

  it('landr-821d6.7: shows the resolved customer stage label when the API supplies stage', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...OFFER,
      // landr-821d6.7 review round: the wire shape is pre-resolved
      // server-side ({code, label, label_localized}) — see
      // CustomerStageLabel in api/types.ts.
      stage: {
        code: 'awaiting_payment',
        label: 'Payment pending',
        label_localized: null,
      },
    })
    render(<OfferPage token={TOKEN} />)

    await waitFor(() => {
      expect(screen.getByTestId('offer-ready')).toBeInTheDocument()
    })

    expect(screen.getByTestId('offer-stage-label')).toHaveTextContent(
      'Payment pending',
    )
  })

  it('landr-821d6.7: renders no stage line when the API omits stage (rolling deploy)', async () => {
    mocks.getBookingByToken.mockResolvedValue(OFFER)
    render(<OfferPage token={TOKEN} />)

    await waitFor(() => {
      expect(screen.getByTestId('offer-ready')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('offer-stage-label')).not.toBeInTheDocument()
  })

  it('shows the participant list', async () => {
    mocks.getBookingByToken.mockResolvedValue(OFFER)
    render(<OfferPage token={TOKEN} />)

    await waitFor(() => {
      expect(screen.getByTestId('offer-ready')).toBeInTheDocument()
    })

    const parts = screen.getAllByTestId('offer-participant')
    expect(parts).toHaveLength(2)
    expect(parts[0]).toHaveTextContent('Jane Doe')
    expect(parts[0]).toHaveTextContent('Skipper')
    expect(parts[1]).toHaveTextContent('John')
  })

  it('shows fetch error card when getBookingByToken rejects', async () => {
    mocks.getBookingByToken.mockRejectedValue(new Error('403 Forbidden'))
    render(<OfferPage token={TOKEN} />)

    await waitFor(() => {
      expect(screen.getByTestId('offer-error')).toBeInTheDocument()
    })
    expect(screen.getByText(/offer not found/i)).toBeInTheDocument()
  })

  it('clicking Accept & Pay calls initiatePayment and redirects', async () => {
    mocks.getBookingByToken.mockResolvedValue(OFFER)
    mocks.initiatePayment.mockResolvedValue(INITIATE_RESP)

    // Capture the redirect.
    let navigatedTo = ''
    Object.defineProperty(window.location, 'href', {
      configurable: true,
      set(v: string) {
        navigatedTo = v
      },
      get() {
        return `http://stub.invalid/offer/${TOKEN}`
      },
    })

    render(<OfferPage token={TOKEN} />)
    await waitFor(() =>
      expect(screen.getByTestId('offer-ready')).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole('button', { name: /accept & pay/i }))

    await waitFor(() => {
      expect(mocks.initiatePayment).toHaveBeenCalledOnce()
    })
    const call = mocks.initiatePayment.mock.calls[0][0] as {
      booking_token: string
      return_url: string
      cancel_url: string
    }
    expect(call.booking_token).toBe(TOKEN)
    expect(call.return_url).toContain('paid=1')
    expect(call.cancel_url).toContain('paid=cancelled')
    expect(navigatedTo).toBe(INITIATE_RESP.checkout_url)
  })

  it('disables Accept & Pay button while the POST is in flight', async () => {
    mocks.getBookingByToken.mockResolvedValue(OFFER)
    let resolveInitiate!: (v: unknown) => void
    mocks.initiatePayment.mockReturnValue(
      new Promise((resolve) => {
        resolveInitiate = resolve
      }),
    )

    render(<OfferPage token={TOKEN} />)
    await waitFor(() =>
      expect(screen.getByTestId('offer-ready')).toBeInTheDocument(),
    )

    const btn = screen.getByRole('button', { name: /accept & pay/i })
    fireEvent.click(btn)

    expect(
      screen.getByRole('button', { name: /redirecting to payment/i }),
    ).toBeDisabled()

    // Resolve so the test doesn't leak a pending promise.
    resolveInitiate(INITIATE_RESP)
  })

  it('shows pay-error card when initiatePayment rejects, and Try again resets', async () => {
    mocks.getBookingByToken.mockResolvedValue(OFFER)
    mocks.initiatePayment.mockRejectedValue(new Error('500'))

    render(<OfferPage token={TOKEN} />)
    await waitFor(() =>
      expect(screen.getByTestId('offer-ready')).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole('button', { name: /accept & pay/i }))

    await waitFor(() => {
      expect(screen.getByTestId('offer-pay-error')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(screen.getByTestId('offer-ready')).toBeInTheDocument()
  })

  // landr-k9pji.15: a 30-day-old /pay or /offer link outlives the operator's
  // payment_mode setting — this is a stale-state conflict, not a retryable
  // failure, so it gets its own card with mode-specific instructions instead
  // of the generic pay-error card above.
  it('shows pay-on-site instructions when initiatePayment 409s payment_mode_not_online (on_site)', async () => {
    mocks.getBookingByToken.mockResolvedValue(OFFER)
    mocks.initiatePayment.mockRejectedValue(
      new HttpError(409, 'Conflict', JSON.stringify({
        detail: { error: 'payment_mode_not_online', reason: 'payment_mode=on_site' },
      })),
    )

    render(<OfferPage token={TOKEN} />)
    await waitFor(() =>
      expect(screen.getByTestId('offer-ready')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByRole('button', { name: /accept & pay/i }))

    await waitFor(() => {
      expect(screen.getByTestId('offer-pay-mode-not-online')).toBeInTheDocument()
    })
    expect(screen.getByText(/pay on the day, at the meeting point/i)).toBeInTheDocument()
    expect(screen.queryByTestId('offer-pay-error')).not.toBeInTheDocument()
  })

  it('shows bank-transfer instructions when initiatePayment 409s payment_mode_not_online (bank_transfer)', async () => {
    mocks.getBookingByToken.mockResolvedValue(OFFER)
    mocks.initiatePayment.mockRejectedValue(
      new HttpError(409, 'Conflict', JSON.stringify({
        detail: { error: 'payment_mode_not_online', reason: 'payment_mode=bank_transfer' },
      })),
    )

    render(<OfferPage token={TOKEN} />)
    await waitFor(() =>
      expect(screen.getByTestId('offer-ready')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByRole('button', { name: /accept & pay/i }))

    await waitFor(() => {
      expect(screen.getByTestId('offer-pay-mode-not-online')).toBeInTheDocument()
    })
    expect(screen.getByText(/pay by bank transfer/i)).toBeInTheDocument()
  })

  // ── landr-6l7y: ?paid=1 is a TRIGGER to re-check, never evidence ─────────
  describe('?paid=1 return from Stripe (landr-6l7y)', () => {
    it('shows a verifying interstitial first, then re-fetches the booking', async () => {
      setupQueryParam('paid', '1')
      mocks.getBookingByToken.mockReturnValue(new Promise(() => {})) // never resolves
      render(<OfferPage token={TOKEN} />)

      expect(screen.getByTestId('offer-payment-verifying')).toBeInTheDocument()
      await waitFor(() => {
        expect(mocks.getBookingByToken).toHaveBeenCalledExactlyOnceWith(TOKEN)
      })
    })

    it('renders the paid confirmation card once the server confirms the balance is settled', async () => {
      setupQueryParam('paid', '1')
      mocks.getBookingByToken.mockResolvedValue({
        ...OFFER,
        totals: { ...OFFER.totals, balance_due: 0 },
      })
      render(<OfferPage token={TOKEN} />)

      await waitFor(() => {
        expect(screen.getByTestId('offer-paid')).toBeInTheDocument()
      })
      expect(screen.getByText(/payment complete/i)).toBeInTheDocument()
      expect(mocks.getBookingByToken).toHaveBeenCalledExactlyOnceWith(TOKEN)
    })

    it('renders the paid confirmation card when the balance is in credit (overpaid)', async () => {
      setupQueryParam('paid', '1')
      mocks.getBookingByToken.mockResolvedValue({
        ...OFFER,
        totals: { ...OFFER.totals, balance_due: -5.0 },
      })
      render(<OfferPage token={TOKEN} />)

      await waitFor(() => {
        expect(screen.getByTestId('offer-paid')).toBeInTheDocument()
      })
    })

    it('settles mid-poll: keeps checking until a LATER response reports the balance paid', async () => {
      // The whole point of the retry loop. Review gate on PR #185 found this
      // unpinned: a mutation that fires the retries but only ever evaluates
      // attempt 0's response (e.g. hoisting the settled check out of the loop)
      // passed every other test in this block — the two neighbours settle
      // immediately or never settle, so neither can see the difference. That
      // mutation would make the poll decorative against exactly the late
      // webhook it exists for (landr-jlu5).
      vi.useFakeTimers()
      setupQueryParam('paid', '1')
      const pending = {
        ...OFFER,
        totals: { ...OFFER.totals, balance_due: 1190.0 },
      }
      const settled = {
        ...OFFER,
        totals: { ...OFFER.totals, balance_due: 0 },
      }
      mocks.getBookingByToken
        .mockResolvedValueOnce(pending) // initial check — webhook hasn't landed
        .mockResolvedValueOnce(pending) // retry 1 — still not
        .mockResolvedValue(settled) //    retry 2 — webhook lands here
      render(<OfferPage token={TOKEN} />)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.queryByTestId('offer-paid')).not.toBeInTheDocument()

      // Past the first two backoff delays (1500 + 2500) — the third response
      // is the settled one.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4100)
      })

      expect(screen.getByTestId('offer-paid')).toBeInTheDocument()
      // Stopped as soon as it settled — did NOT run the remaining retries.
      expect(mocks.getBookingByToken).toHaveBeenCalledTimes(3)
    })

    it('does NOT render the confirmation copy while the booking is still pending, and reaches the honest pending-terminal state once the bounded poll is exhausted', async () => {
      vi.useFakeTimers()
      setupQueryParam('paid', '1')
      mocks.getBookingByToken.mockResolvedValue({
        ...OFFER,
        totals: { ...OFFER.totals, balance_due: 1190.0 }, // unchanged — webhook hasn't landed
      })
      render(<OfferPage token={TOKEN} />)

      // Initial (immediate) check.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.queryByTestId('offer-paid')).not.toBeInTheDocument()

      // Walk the full backoff schedule — 4 retries after the initial check —
      // in one advance; advanceTimersByTimeAsync drains microtasks between
      // each timer it fires, so the fetch→setTimeout→fetch chain unrolls.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20000)
      })

      expect(screen.getByTestId('offer-payment-pending')).toBeInTheDocument()
      expect(screen.queryByTestId('offer-paid')).not.toBeInTheDocument()
      expect(screen.queryByText(/payment complete/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/booking is confirmed/i)).not.toBeInTheDocument()
      // Bounded — 1 initial check + 4 retries, then stop.
      expect(mocks.getBookingByToken).toHaveBeenCalledTimes(5)
    })

    it('does NOT render the confirmation copy when the re-check itself fails', async () => {
      setupQueryParam('paid', '1')
      mocks.getBookingByToken.mockRejectedValue(new Error('500'))
      render(<OfferPage token={TOKEN} />)

      await waitFor(() => {
        expect(screen.getByTestId('offer-payment-unknown')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('offer-paid')).not.toBeInTheDocument()
      expect(screen.queryByText(/payment complete/i)).not.toBeInTheDocument()
      // Fails fast — no retry loop on a hard fetch failure.
      expect(mocks.getBookingByToken).toHaveBeenCalledExactlyOnceWith(TOKEN)
    })
  })

  it('renders the payment-cancelled card when ?paid=cancelled is in the URL', () => {
    setupQueryParam('paid', 'cancelled')
    render(<OfferPage token={TOKEN} />)
    expect(screen.getByTestId('offer-payment-cancelled')).toBeInTheDocument()
    expect(screen.getByText(/payment cancelled/i)).toBeInTheDocument()
    expect(mocks.getBookingByToken).not.toHaveBeenCalled()
  })

  it('displays the balance_due row only when it differs from gross_total', async () => {
    const offerWithPartialPayment = {
      ...OFFER,
      totals: {
        ...OFFER.totals,
        balance_due: 500.0, // less than gross_total = 1190
      },
    }
    mocks.getBookingByToken.mockResolvedValue(offerWithPartialPayment)
    render(<OfferPage token={TOKEN} />)

    await waitFor(() =>
      expect(screen.getByTestId('offer-ready')).toBeInTheDocument(),
    )

    expect(screen.getByTestId('offer-balance-due')).toBeInTheDocument()
  })

  it('does not show balance_due row when balance equals gross', async () => {
    mocks.getBookingByToken.mockResolvedValue(OFFER)
    render(<OfferPage token={TOKEN} />)

    await waitFor(() =>
      expect(screen.getByTestId('offer-ready')).toBeInTheDocument(),
    )

    expect(screen.queryByTestId('offer-balance-due')).not.toBeInTheDocument()
  })

  // ── landr-esd3: mode="pay" (rendered at /pay/{token}) ──────────────────────
  describe('mode="pay"', () => {
    const payOffer = {
      ...OFFER,
      totals: {
        ...OFFER.totals,
        balance_due: 1120.0, // less than gross_total = 1190, per the ticket's reference booking
      },
    }

    it('renders the payment title and the balance-due amount', async () => {
      mocks.getBookingByToken.mockResolvedValue(payOffer)
      render(<OfferPage token={TOKEN} mode="pay" />)

      await waitFor(() => {
        expect(screen.getByTestId('offer-ready')).toBeInTheDocument()
      })

      expect(screen.getByText(/complete your payment/i)).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /^pay now$/i }),
      ).toBeEnabled()
      const balanceDue = screen.getByTestId('offer-balance-due')
      expect(balanceDue).toBeInTheDocument()
      expect(balanceDue).toHaveTextContent(formatCurrency(1120.0, 'EUR'))
    })

    // landr-t63w0: the operator's other ticked rails on the /pay page.
    const BANK = {
      iban: 'ES91 2100 0418 4502 0005 1332',
      bic: 'CAIXESBBXXX',
      account_holder: 'Canary Tandem Co SL',
      reference: 'BBBBBBBB',
    }

    it('online + bank + on-site: card button, IBAN/BIC and the on-site hint', async () => {
      mocks.getBookingByToken.mockResolvedValue({
        ...payOffer,
        payment: {
          methods: ['online', 'bank_transfer', 'on_site'],
          online_available: true,
          bank: BANK,
        },
      })
      render(<OfferPage token={TOKEN} mode="pay" />)
      await waitFor(() => expect(screen.getByTestId('offer-ready')).toBeInTheDocument())

      expect(screen.getByRole('button', { name: /^pay now$/i })).toBeEnabled()
      expect(screen.getByTestId('offer-bank-iban')).toHaveTextContent(BANK.iban)
      expect(screen.getByTestId('offer-bank-bic')).toHaveTextContent('CAIXESBBXXX')
      expect(screen.getByTestId('offer-bank-reference')).toHaveTextContent('BBBBBBBB')
      expect(screen.getByTestId('offer-pay-on-site-hint')).toHaveTextContent(
        /also pay on site/i,
      )
    })

    it('bank only: shows IBAN/BIC and no card button', async () => {
      mocks.getBookingByToken.mockResolvedValue({
        ...payOffer,
        payment: { methods: ['bank_transfer'], online_available: false, bank: BANK },
      })
      render(<OfferPage token={TOKEN} mode="pay" />)
      await waitFor(() => expect(screen.getByTestId('offer-ready')).toBeInTheDocument())

      expect(screen.getByTestId('offer-bank-iban')).toBeInTheDocument()
      expect(screen.queryByTestId('offer-accept-pay-btn')).not.toBeInTheDocument()
      expect(screen.queryByTestId('offer-pay-on-site-hint')).not.toBeInTheDocument()
    })

    it('on-site only: no card button, no bank block, on-site note', async () => {
      mocks.getBookingByToken.mockResolvedValue({
        ...payOffer,
        payment: { methods: ['on_site'], online_available: false, bank: null },
      })
      render(<OfferPage token={TOKEN} mode="pay" />)
      await waitFor(() => expect(screen.getByTestId('offer-ready')).toBeInTheDocument())

      expect(screen.queryByTestId('offer-accept-pay-btn')).not.toBeInTheDocument()
      expect(screen.queryByTestId('offer-bank-details')).not.toBeInTheDocument()
      expect(screen.getByTestId('offer-pay-on-site-hint')).toHaveTextContent(/pay on the day/i)
    })

    it('older API without `payment`: card-only page unchanged', async () => {
      mocks.getBookingByToken.mockResolvedValue(payOffer)
      render(<OfferPage token={TOKEN} mode="pay" />)
      await waitFor(() => expect(screen.getByTestId('offer-ready')).toBeInTheDocument())

      expect(screen.getByRole('button', { name: /^pay now$/i })).toBeEnabled()
      expect(screen.queryByTestId('offer-bank-details')).not.toBeInTheDocument()
    })

    it('titles the browser tab "Payment site <operator>"', async () => {
      mocks.getBookingByToken.mockResolvedValue({
        ...payOffer,
        operator_name: 'Canary Tandem Co',
      })
      render(<OfferPage token={TOKEN} mode="pay" />)

      await waitFor(() => {
        expect(document.title).toBe('Payment site Canary Tandem Co')
      })
    })

    it('shows the payment-link-not-found copy on fetch error', async () => {
      mocks.getBookingByToken.mockRejectedValue(new Error('403 Forbidden'))
      render(<OfferPage token={TOKEN} mode="pay" />)

      await waitFor(() => {
        expect(screen.getByTestId('offer-error')).toBeInTheDocument()
      })
      expect(screen.getByText(/payment link not found/i)).toBeInTheDocument()
    })

    it('shows the personal-payment-link copy', async () => {
      mocks.getBookingByToken.mockResolvedValue(payOffer)
      render(<OfferPage token={TOKEN} mode="pay" />)

      await waitFor(() =>
        expect(screen.getByTestId('offer-ready')).toBeInTheDocument(),
      )
      expect(
        screen.getByText(/this payment link is personal/i),
      ).toBeInTheDocument()
    })

    it('clicking Pay now calls initiatePayment with the token and both redirect URLs', async () => {
      mocks.getBookingByToken.mockResolvedValue(payOffer)
      mocks.initiatePayment.mockResolvedValue(INITIATE_RESP)

      let navigatedTo = ''
      Object.defineProperty(window.location, 'href', {
        configurable: true,
        set(v: string) {
          navigatedTo = v
        },
        get() {
          return `http://stub.invalid/pay/${TOKEN}`
        },
      })

      render(<OfferPage token={TOKEN} mode="pay" />)
      await waitFor(() =>
        expect(screen.getByTestId('offer-ready')).toBeInTheDocument(),
      )

      fireEvent.click(screen.getByRole('button', { name: /^pay now$/i }))

      // Busy label is shared with 'offer' mode — unchanged in pay mode.
      expect(
        screen.getByRole('button', { name: /redirecting to payment/i }),
      ).toBeDisabled()

      await waitFor(() => {
        expect(mocks.initiatePayment).toHaveBeenCalledOnce()
      })
      const call = mocks.initiatePayment.mock.calls[0][0] as {
        booking_token: string
        return_url: string
        cancel_url: string
      }
      expect(call.booking_token).toBe(TOKEN)
      expect(call.return_url).toContain('paid=1')
      expect(call.cancel_url).toContain('paid=cancelled')
      expect(navigatedTo).toBe(INITIATE_RESP.checkout_url)
    })

    // ── landr-k9pji.5: deposit_percent operators (API landr-k9pji.4) ───────
    describe('deposit preview', () => {
      it('pauses on this page and shows "Deposit (N %)" when the initiate amount is below balance_due', async () => {
        mocks.getBookingByToken.mockResolvedValue(payOffer)
        // payOffer.totals.balance_due = 1120.0; 336.0 is a 30% deposit.
        mocks.initiatePayment.mockResolvedValue({ ...INITIATE_RESP, amount: 336.0 })

        let navigatedTo = ''
        Object.defineProperty(window.location, 'href', {
          configurable: true,
          set(v: string) {
            navigatedTo = v
          },
          get() {
            return `http://stub.invalid/pay/${TOKEN}`
          },
        })

        render(<OfferPage token={TOKEN} mode="pay" />)
        await waitFor(() =>
          expect(screen.getByTestId('offer-ready')).toBeInTheDocument(),
        )

        fireEvent.click(screen.getByRole('button', { name: /^pay now$/i }))

        await waitFor(() => {
          expect(mocks.initiatePayment).toHaveBeenCalledOnce()
        })
        // No navigation yet — the customer must see the deposit line first.
        expect(navigatedTo).toBe('')
        expect(screen.getByTestId('offer-deposit-amount')).toHaveTextContent(/deposit \(30 %\)/i)
        expect(screen.getByTestId('offer-deposit-amount-value')).toHaveTextContent(
          formatCurrency(336.0, 'EUR'),
        )
        expect(screen.getByTestId('offer-deposit-remainder-note')).toBeInTheDocument()
        // The original "Amount due" row still shows the FULL balance.
        expect(screen.getByTestId('offer-balance-due')).toHaveTextContent(
          formatCurrency(1120.0, 'EUR'),
        )

        const continueBtn = screen.getByRole('button', { name: /continue to payment/i })
        fireEvent.click(continueBtn)
        expect(navigatedTo).toBe(INITIATE_RESP.checkout_url)
        // No second POST /initiate — the same checkout URL is reused.
        expect(mocks.initiatePayment).toHaveBeenCalledOnce()
      })

      it('navigates straight to Stripe when the initiate amount is NOT below balance_due (no deposit configured)', async () => {
        mocks.getBookingByToken.mockResolvedValue(payOffer)
        mocks.initiatePayment.mockResolvedValue({ ...INITIATE_RESP, amount: 1120.0 })

        let navigatedTo = ''
        Object.defineProperty(window.location, 'href', {
          configurable: true,
          set(v: string) {
            navigatedTo = v
          },
          get() {
            return `http://stub.invalid/pay/${TOKEN}`
          },
        })

        render(<OfferPage token={TOKEN} mode="pay" />)
        await waitFor(() =>
          expect(screen.getByTestId('offer-ready')).toBeInTheDocument(),
        )

        fireEvent.click(screen.getByRole('button', { name: /^pay now$/i }))

        await waitFor(() => {
          expect(navigatedTo).toBe(INITIATE_RESP.checkout_url)
        })
        expect(screen.queryByTestId('offer-deposit-amount')).not.toBeInTheDocument()
      })
    })

    // ── landr-yimp: /pay must headline balance_due, not gross_total ────────
    it('headlines balance_due (not gross_total) and shows gross_total as a neutral secondary line', async () => {
      // Ticket's reference booking: email says "Amount due: 90.00 EUR",
      // page bug showed a bold "Total" of 286.00 (gross_total, which here
      // happens to include a 196.00 at-hotel portion) with balance_due
      // muted below it. The page itself has no way to know the gap is
      // specifically a hotel amount (review round 2 — see OfferPage.tsx
      // comment), so it must not assert that; it states only that
      // gross_total is the full booking value, not the charge.
      const referenceOffer = {
        ...OFFER,
        totals: {
          gross_total: 286.0,
          tax_total: 0,
          net_total: 286.0,
          balance_due: 90.0,
          currency: 'EUR',
        },
      }
      mocks.getBookingByToken.mockResolvedValue(referenceOffer)
      render(<OfferPage token={TOKEN} mode="pay" />)

      await waitFor(() =>
        expect(screen.getByTestId('offer-ready')).toBeInTheDocument(),
      )

      // The charged amount is the prominent figure, under the "Amount due"
      // label — matching booking_payment_link_en's wording verbatim.
      expect(screen.getByText('Amount due')).toBeInTheDocument()
      const balanceDue = screen.getByTestId('offer-balance-due')
      expect(balanceDue).toHaveTextContent(formatCurrency(90.0, 'EUR'))
      expect(balanceDue.className).toContain('font-semibold')

      // gross_total is present but demoted to a secondary, muted line —
      // labelled with what's true (the full booking value), never with a
      // claim about *why* it's higher than the charge.
      const grossTotal = screen.getByTestId('offer-gross-total')
      expect(grossTotal).toHaveTextContent(formatCurrency(286.0, 'EUR'))
      expect(grossTotal.className).not.toContain('font-semibold')
      expect(grossTotal.className).toContain('text-muted-foreground')
      const note = screen.getByTestId('offer-total-booking-value-note')
      expect(note).toHaveTextContent(/full value of the booking/i)
      expect(note).not.toHaveTextContent(/hotel/i)
    })

    it('renders no dangling secondary line when balance_due equals gross_total', async () => {
      const noGapOffer = {
        ...OFFER,
        totals: { ...OFFER.totals, balance_due: OFFER.totals.gross_total },
      }
      mocks.getBookingByToken.mockResolvedValue(noGapOffer)
      render(<OfferPage token={TOKEN} mode="pay" />)

      await waitFor(() =>
        expect(screen.getByTestId('offer-ready')).toBeInTheDocument(),
      )

      expect(screen.getByTestId('offer-balance-due')).toHaveTextContent(
        formatCurrency(OFFER.totals.gross_total, 'EUR'),
      )
      expect(screen.queryByTestId('offer-gross-total')).not.toBeInTheDocument()
      expect(
        screen.queryByTestId('offer-total-booking-value-note'),
      ).not.toBeInTheDocument()
    })

    // ── landr-yimp review round 2: gross/balance gap is not always a hotel
    // portion — a partial payment already collected produces the exact
    // same shape and must NOT be mislabelled as at-hotel money.
    it('does not claim an at-hotel portion when the gap is from a partial payment already collected (no hotel line)', async () => {
      const partiallyPaidOffer = {
        ...OFFER,
        totals: {
          gross_total: 286.0,
          tax_total: 0,
          net_total: 286.0,
          // e.g. a 100.00 bank-transfer deposit already recorded via
          // mark-paid — nothing here is owed to a hotel.
          balance_due: 186.0,
          currency: 'EUR',
        },
      }
      mocks.getBookingByToken.mockResolvedValue(partiallyPaidOffer)
      render(<OfferPage token={TOKEN} mode="pay" />)

      await waitFor(() =>
        expect(screen.getByTestId('offer-ready')).toBeInTheDocument(),
      )

      expect(screen.getByTestId('offer-balance-due')).toHaveTextContent(
        formatCurrency(186.0, 'EUR'),
      )
      const grossTotal = screen.getByTestId('offer-gross-total')
      expect(grossTotal).toHaveTextContent(formatCurrency(286.0, 'EUR'))
      // The secondary line is shown (there IS a gap) but must not assert
      // a hotel is involved — this booking has no at-hotel line at all.
      expect(screen.queryByText(/hotel/i)).not.toBeInTheDocument()
      expect(
        screen.getByTestId('offer-total-booking-value-note'),
      ).toHaveTextContent(/full value of the booking/i)
    })

    it('shows a settled state and disables Pay now when balance_due is zero', async () => {
      const settledOffer = {
        ...OFFER,
        totals: { ...OFFER.totals, balance_due: 0 },
      }
      mocks.getBookingByToken.mockResolvedValue(settledOffer)
      render(<OfferPage token={TOKEN} mode="pay" />)

      await waitFor(() =>
        expect(screen.getByTestId('offer-ready')).toBeInTheDocument(),
      )

      expect(screen.getByTestId('offer-balance-due')).toHaveTextContent(
        /nothing due/i,
      )
      expect(screen.queryByTestId('offer-gross-total')).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /nothing to pay/i }),
      ).toBeDisabled()
      // Must NOT claim the whole booking is paid in full — at-hotel money
      // (if any) is never reflected in balance_due, so it can still be owed.
      expect(
        screen.getByText(/nothing further to pay through this link/i),
      ).toBeInTheDocument()
      expect(screen.queryByText(/paid in full/i)).not.toBeInTheDocument()
    })

    it('shows a settled state when balance_due is negative (refund owed)', async () => {
      const overpaidOffer = {
        ...OFFER,
        totals: { ...OFFER.totals, balance_due: -30.0 },
      }
      mocks.getBookingByToken.mockResolvedValue(overpaidOffer)
      render(<OfferPage token={TOKEN} mode="pay" />)

      await waitFor(() =>
        expect(screen.getByTestId('offer-ready')).toBeInTheDocument(),
      )

      expect(screen.getByTestId('offer-balance-due')).toHaveTextContent(
        /nothing due/i,
      )
      expect(
        screen.getByRole('button', { name: /nothing to pay/i }),
      ).toBeDisabled()
    })

    it('falls back to gross_total when balance_due is missing/null', async () => {
      const nullBalanceOffer = {
        ...OFFER,
        totals: { ...OFFER.totals, balance_due: null },
      }
      mocks.getBookingByToken.mockResolvedValue(nullBalanceOffer)
      render(<OfferPage token={TOKEN} mode="pay" />)

      await waitFor(() =>
        expect(screen.getByTestId('offer-ready')).toBeInTheDocument(),
      )

      expect(screen.getByTestId('offer-balance-due')).toHaveTextContent(
        formatCurrency(OFFER.totals.gross_total, 'EUR'),
      )
      // Falls back to charging the full total — no dangling secondary
      // line since there's nothing left to reconcile against.
      expect(screen.queryByTestId('offer-gross-total')).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /^pay now$/i }),
      ).toBeEnabled()
    })

    it('mode omitted keeps every existing "offer" assertion green', async () => {
      // Sanity check that the default param didn't change default behavior:
      // same as the very first "renders the offer details" test above.
      mocks.getBookingByToken.mockResolvedValue(OFFER)
      render(<OfferPage token={TOKEN} />)

      await waitFor(() => {
        expect(screen.getByTestId('offer-ready')).toBeInTheDocument()
      })

      expect(screen.getByText(/your custom offer/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /accept & pay/i })).toBeEnabled()
      expect(
        screen.getByText(/this offer link is personal/i),
      ).toBeInTheDocument()
    })
  })
})

// ─── landr-gkj0: operator/hotel money split on the /pay page ─────────────────
//
// Reported against dev booking fd4daaba on 2026-08-31: the pay page mixed the
// hotel money into the breakdown. A booking of a 180.00 guiding day plus two
// pay-at-hotel rooms totalling 526.00 rendered
//     Subtotal 659.81 / Tax 46.19 / Amount due 180.00
// — the net + tax describe the WHOLE booking while the charge is operator-only,
// so the rows do not add up and imply the customer is being billed for the
// hotel. These pin the real numbers from that booking.
const SPLIT_OFFER = {
  ...OFFER,
  totals: {
    gross_total: 706.0,
    tax_total: 46.19,
    net_total: 659.81,
    balance_due: 180.0,
    currency: 'EUR',
    operator_gross_total: 180.0,
    operator_tax_total: 11.78,
    operator_net_total: 168.22,
    hotel_gross_total: 526.0,
    hotel_tax_total: 34.41,
    hotel_net_total: 491.59,
    has_hotel_lines: true,
  },
}

describe('OfferPage — operator/hotel split (mode="pay")', () => {
  it('breaks down only the operator share, not the whole booking', async () => {
    mocks.getBookingByToken.mockResolvedValue(SPLIT_OFFER)
    render(<OfferPage token={TOKEN} mode="pay" />)

    await waitFor(() => screen.getByTestId('offer-ready'))

    // Subtotal + Tax now describe the 180.00 being charged...
    expect(screen.getByTestId('offer-net-total')).toHaveTextContent(
      formatCurrency(168.22, 'EUR'),
    )
    expect(screen.getByTestId('offer-tax-total')).toHaveTextContent(
      formatCurrency(11.78, 'EUR'),
    )
    expect(screen.getByTestId('offer-balance-due')).toHaveTextContent(
      formatCurrency(180.0, 'EUR'),
    )
    // ...and they add up: 168.22 + 11.78 === 180.00
    expect(168.22 + 11.78).toBeCloseTo(180.0, 2)

    // The booking-wide figures must NOT appear in the breakdown any more.
    expect(screen.getByTestId('offer-net-total')).not.toHaveTextContent(
      formatCurrency(659.81, 'EUR'),
    )
    expect(screen.getByTestId('offer-tax-total')).not.toHaveTextContent(
      formatCurrency(46.19, 'EUR'),
    )
  })

  it('names the at-hotel amount explicitly instead of a vague total', async () => {
    mocks.getBookingByToken.mockResolvedValue(SPLIT_OFFER)
    render(<OfferPage token={TOKEN} mode="pay" />)

    await waitFor(() => screen.getByTestId('offer-ready'))

    const hotel = screen.getByTestId('offer-hotel-due')
    expect(hotel).toHaveTextContent(formatCurrency(526.0, 'EUR'))
    expect(hotel).toHaveTextContent(/hotel on arrival/i)

    // The old "Total booking value" hedge is replaced by the explicit line.
    expect(
      screen.queryByTestId('offer-total-booking-value-note'),
    ).not.toBeInTheDocument()
  })

  it('falls back to booking-wide totals when the split is absent (legacy rows)', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...OFFER,
      totals: {
        gross_total: 706.0,
        tax_total: 46.19,
        net_total: 659.81,
        balance_due: 180.0,
        currency: 'EUR',
      },
    })
    render(<OfferPage token={TOKEN} mode="pay" />)

    await waitFor(() => screen.getByTestId('offer-ready'))

    // Pre-split behaviour preserved exactly — never a 0.00 breakdown.
    expect(screen.getByTestId('offer-net-total')).toHaveTextContent(
      formatCurrency(659.81, 'EUR'),
    )
    expect(screen.queryByTestId('offer-hotel-due')).not.toBeInTheDocument()
    expect(screen.getByTestId('offer-gross-total')).toHaveTextContent(
      formatCurrency(706.0, 'EUR'),
    )
  })

  it('shows the operator share separately once a partial payment lands', async () => {
    // 80.00 already paid against the 180.00 operator share.
    mocks.getBookingByToken.mockResolvedValue({
      ...SPLIT_OFFER,
      totals: { ...SPLIT_OFFER.totals, balance_due: 100.0 },
    })
    render(<OfferPage token={TOKEN} mode="pay" />)

    await waitFor(() => screen.getByTestId('offer-ready'))

    expect(screen.getByTestId('offer-balance-due')).toHaveTextContent(
      formatCurrency(100.0, 'EUR'),
    )
    // Without this row the breakdown would silently fail to sum to the charge.
    expect(
      screen.getByTestId('offer-operator-gross-total'),
    ).toHaveTextContent(formatCurrency(180.0, 'EUR'))
    // The hotel money is still called out, and still not part of the charge.
    expect(screen.getByTestId('offer-hotel-due')).toHaveTextContent(
      formatCurrency(526.0, 'EUR'),
    )
  })

  it('leaves the offer ("Accept & Pay") flow quoting the whole booking', async () => {
    mocks.getBookingByToken.mockResolvedValue(SPLIT_OFFER)
    render(<OfferPage token={TOKEN} />)

    await waitFor(() => screen.getByTestId('offer-ready'))

    // mode="offer" deliberately quotes the grand total — the split only
    // changes the pay link, which charges the operator share alone.
    expect(screen.getByTestId('offer-net-total')).toHaveTextContent(
      formatCurrency(659.81, 'EUR'),
    )
    expect(screen.getByTestId('offer-gross-total')).toHaveTextContent(
      formatCurrency(706.0, 'EUR'),
    )
    expect(screen.queryByTestId('offer-hotel-due')).not.toBeInTheDocument()
  })
  // ── landr-1zkp7: dates table, per-line prices, trip-page look ──────────────
  describe('landr-1zkp7 restyle', () => {
    const LOW_AIR = {
      ...OFFER,
      operator_name: 'Para42',
      totals: { ...OFFER.totals, gross_total: 1580, tax_total: 252.27, net_total: 1327.73, balance_due: 1580 },
      product_lines: [
        {
          product_id: 'p-air',
          name: 'Low air-timers',
          name_localized: null,
          date_range_start: '2027-01-24',
          date_range_end: '2027-01-29',
          selected_days: [
            '2027-01-24', '2027-01-25', '2027-01-26',
            '2027-01-27', '2027-01-28', '2027-01-29',
          ],
          quantity: 1,
        },
      ],
      line_items: [
        {
          product_id: 'p-air',
          label: 'Low air-timers',
          qty: 1,
          units: 6,
          line_total: 1580,
          unit_price: 1580,
          paid_to: 'operator',
          participants: 2,
          per_person_price: 790,
        },
      ],
    }

    it('renders the dates table: one row, collapsed range, length in days', async () => {
      mocks.getBookingByToken.mockResolvedValue(LOW_AIR)
      render(<OfferPage token={TOKEN} mode="pay" />)
      await waitFor(() => screen.getByTestId('offer-ready'))

      const rows = screen.getAllByTestId('offer-product-line')
      expect(rows).toHaveLength(1)
      expect(rows[0]).toHaveTextContent('Low air-timers')
      expect(screen.getByTestId('offer-line-dates')).toHaveTextContent(
        'Sun 24 Jan – Fri 29 Jan 2027',
      )
      expect(screen.getByTestId('offer-line-length')).toHaveTextContent('6 days')
      expect(screen.getByRole('columnheader', { name: 'Dates' })).toBeInTheDocument()
    })

    it('splits non-consecutive days into one row per stretch plus a total, and shows × qty', async () => {
      mocks.getBookingByToken.mockResolvedValue({
        ...LOW_AIR,
        line_items: [],
        product_lines: [
          {
            ...LOW_AIR.product_lines[0],
            quantity: 2,
            selected_days: [
              '2027-01-18',
              '2027-01-20', '2027-01-21', '2027-01-22',
              '2027-01-24', '2027-01-25', '2027-01-26', '2027-01-27',
              '2027-01-28', '2027-01-29', '2027-01-30',
            ],
          },
        ],
      })
      render(<OfferPage token={TOKEN} mode="pay" />)
      await waitFor(() => screen.getByTestId('offer-ready'))

      expect(screen.getByTestId('offer-product-line')).toHaveTextContent('Low air-timers')
      expect(screen.getByTestId('offer-product-line')).toHaveTextContent('× 2')
      expect(screen.queryByTestId('offer-line-dates')).not.toBeInTheDocument()
      const dates = screen.getAllByTestId('offer-stretch-dates').map((el) => el.textContent)
      expect(dates).toEqual(['Mon 18 Jan', 'Wed 20 Jan – Fri 22 Jan', 'Sun 24 Jan – Sat 30 Jan'])
      const lengths = screen.getAllByTestId('offer-stretch-length').map((el) => el.textContent)
      expect(lengths).toEqual(['1 day', '3 days', '7 days'])
      expect(screen.getByTestId('offer-line-length')).toHaveTextContent('11 days')
      expect(screen.getByText('Total')).toBeInTheDocument()
    })

    it('puts the year on each stretch when a line crosses a year boundary', async () => {
      mocks.getBookingByToken.mockResolvedValue({
        ...LOW_AIR,
        line_items: [],
        product_lines: [
          {
            ...LOW_AIR.product_lines[0],
            selected_days: ['2026-12-30', '2027-01-02'],
          },
        ],
      })
      render(<OfferPage token={TOKEN} mode="pay" />)
      await waitFor(() => screen.getByTestId('offer-ready'))

      const dates = screen.getAllByTestId('offer-stretch-dates').map((el) => el.textContent)
      expect(dates).toEqual(['Wed 30 Dec 2026', 'Sat 2 Jan 2027'])
    })

    it('falls back to date_range_start/end when selected_days is empty', async () => {
      mocks.getBookingByToken.mockResolvedValue({
        ...LOW_AIR,
        product_lines: [{ ...LOW_AIR.product_lines[0], selected_days: null }],
      })
      render(<OfferPage token={TOKEN} mode="pay" />)
      await waitFor(() => screen.getByTestId('offer-ready'))

      expect(screen.getByTestId('offer-line-dates')).toHaveTextContent(
        'Sun 24 Jan – Fri 29 Jan 2027',
      )
      expect(screen.getByTestId('offer-line-length')).toHaveTextContent('6 days')
    })

    it('counts hotel lines in nights', async () => {
      mocks.getBookingByToken.mockResolvedValue({
        ...LOW_AIR,
        product_lines: [
          { ...LOW_AIR.product_lines[0], selected_days: ['2027-01-24', '2027-01-25'] },
        ],
        line_items: [{ ...LOW_AIR.line_items[0], paid_to: 'hotel', participants: null, per_person_price: null }],
      })
      render(<OfferPage token={TOKEN} mode="pay" />)
      await waitFor(() => screen.getByTestId('offer-ready'))

      expect(screen.getByTestId('offer-line-length')).toHaveTextContent('2 nights')
      expect(screen.getByTestId('offer-line-hotel')).toHaveTextContent(/payable at the hotel/i)
    })

    it('shows the per-person price × participants and the line total', async () => {
      mocks.getBookingByToken.mockResolvedValue(LOW_AIR)
      render(<OfferPage token={TOKEN} mode="pay" />)
      await waitFor(() => screen.getByTestId('offer-ready'))

      expect(screen.getByTestId('offer-line-per-person')).toHaveTextContent(
        `${formatCurrency(790, 'EUR', 'en-US')} × 2 participants`,
      )
      expect(screen.getByTestId('offer-line-total')).toHaveTextContent(
        formatCurrency(1580, 'EUR', 'en-US'),
      )
      // existing money rows are untouched
      expect(screen.getByTestId('offer-balance-due')).toHaveTextContent(
        formatCurrency(1580, 'EUR', 'en-US'),
      )
    })

    it('omits the per-person row when the API sent nulls (flat line)', async () => {
      mocks.getBookingByToken.mockResolvedValue({
        ...LOW_AIR,
        line_items: [{ ...LOW_AIR.line_items[0], participants: null, per_person_price: null }],
      })
      render(<OfferPage token={TOKEN} mode="pay" />)
      await waitFor(() => screen.getByTestId('offer-ready'))

      expect(screen.getByTestId('offer-line-item')).toBeInTheDocument()
      expect(screen.queryByTestId('offer-line-per-person')).not.toBeInTheDocument()
      expect(screen.getByTestId('offer-line-total')).toBeInTheDocument()
    })

    it('legacy payload without line_items renders no per-line rows', async () => {
      mocks.getBookingByToken.mockResolvedValue(OFFER)
      render(<OfferPage token={TOKEN} mode="pay" />)
      await waitFor(() => screen.getByTestId('offer-ready'))

      expect(screen.queryByTestId('offer-line-item')).not.toBeInTheDocument()
      expect(screen.getByTestId('offer-net-total')).toBeInTheDocument()
      expect(screen.getByTestId('offer-product-line')).toBeInTheDocument()
    })

    it('renders the hero with operator, product and overall dates', async () => {
      mocks.getBookingByToken.mockResolvedValue(LOW_AIR)
      render(<OfferPage token={TOKEN} mode="pay" />)
      await waitFor(() => screen.getByTestId('offer-ready'))

      expect(screen.getByTestId('offer-hero-operator')).toHaveTextContent('Your trip with Para42')
      expect(screen.getByTestId('offer-hero')).toHaveTextContent('Low air-timers')
      expect(screen.getByTestId('offer-hero-dates')).toHaveTextContent(
        'Sun 24 Jan – Fri 29 Jan 2027',
      )
    })
  })
})

describe('OfferPage — custom offer v2 positions (landr-8f1sh.4)', () => {
  const POSITION = {
    label: 'Guided Paragliding Day · 3 consecutive days',
    units: 3,
    participants: 2,
    original_unit_price: 90,
    unit_price: 70,
    original_total: 540,
    total: 420,
    excluded: false,
  }
  const VIDEO = {
    label: 'Video package',
    units: 1,
    participants: 1,
    original_unit_price: 50,
    unit_price: 50,
    original_total: 50,
    total: 50,
    excluded: true,
  }
  const WITH_OFFER = {
    ...OFFER,
    operator_name: 'Para42',
    totals: { ...OFFER.totals, gross_total: 470, tax_total: 75.04, net_total: 394.96, balance_due: 470 },
    product_lines: [
      {
        product_id: 'p-guide',
        name: 'Guided Paragliding Day',
        name_localized: null,
        date_range_start: '2027-01-25',
        date_range_end: '2027-01-27',
        selected_days: ['2027-01-25', '2027-01-26', '2027-01-27'],
        quantity: 1,
      },
      {
        product_id: 'p-hotel',
        name: 'Hotel Alpenblick',
        name_localized: null,
        date_range_start: '2027-01-24',
        date_range_end: '2027-01-29',
        selected_days: ['2027-01-24', '2027-01-25', '2027-01-26', '2027-01-27', '2027-01-28'],
        quantity: 1,
      },
    ],
    line_items: [
      {
        product_id: 'p-guide', label: 'Guided Paragliding Day', qty: 1, units: 3,
        line_total: 590, unit_price: 590, paid_to: 'operator', participants: 2, per_person_price: 295,
      },
      {
        product_id: 'p-hotel', label: 'Hotel Alpenblick', qty: 1, units: 5,
        line_total: 500, unit_price: 500, paid_to: 'hotel', participants: null, per_person_price: null,
      },
    ],
    offer_positions: [POSITION, VIDEO],
    offer_discount: { amount: 120, per_day: 20, pct: 20.34 },
    show_savings: true,
    offer_adjustments: {
      free_spot_count: 0, group_threshold: null, group_discount_pct: null, group_discount_amount: 0,
    },
  }
  const fmt = (n: number) => formatCurrency(n, 'EUR', 'en-US')

  beforeEach(() => {
    mocks.getBookingByToken.mockReset()
    resetQueryParams()
  })

  it('hero names the activity, not the hotel room, and adds "with accommodation" (hotel line listed first)', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...WITH_OFFER,
      product_lines: [...WITH_OFFER.product_lines].reverse(),
      line_items: [...WITH_OFFER.line_items].reverse(),
    })
    render(<OfferPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('offer-ready'))
    const hero = screen.getByTestId('offer-hero')
    expect(hero.querySelector('h1')).toHaveTextContent('Guided Paragliding Day with accommodation')
    expect(hero).not.toHaveTextContent('Hotel Alpenblick')
  })

  it('lists the offer positions with the regular price struck and a discount row (show_savings on)', async () => {
    mocks.getBookingByToken.mockResolvedValue(WITH_OFFER)
    render(<OfferPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('offer-ready'))

    const rows = screen.getAllByTestId('offer-position')
    expect(rows).toHaveLength(2)
    // the label is price-free (landr-8f1sh.5); the sub-line comes from the numeric fields
    expect(rows[0]).toHaveTextContent('Guided Paragliding Day · 3 consecutive days')
    expect(screen.getByTestId('offer-position-original-unit')).toHaveTextContent(fmt(90))
    expect(screen.getAllByTestId('offer-position-per-day')[0]).toHaveTextContent(
      `${fmt(70)}/day × 3 days × 2 participants`,
    )
    expect(screen.getByTestId('offer-position-original-total')).toHaveTextContent(fmt(540))
    expect(screen.getAllByTestId('offer-position-total')[0]).toHaveTextContent(fmt(420))
    // excluded flat 1 × 1 position: no struck original and no per-day sub-line
    expect(rows[1]).toHaveTextContent('Video package')
    expect(rows[1]).toHaveTextContent(fmt(50))
    expect(rows[1].querySelector('[data-testid="offer-position-original-total"]')).toBeNull()
    expect(rows[1].querySelector('[data-testid="offer-position-original-unit"]')).toBeNull()
    expect(rows[1].querySelector('[data-testid="offer-position-per-day"]')).toBeNull()

    expect(screen.getByTestId('offer-discount')).toHaveTextContent('Your discount')
    expect(screen.getByTestId('offer-discount-amount')).toHaveTextContent(`−${fmt(120)}`)
    // landr-bo0wd.5: green savings line, Regular price / − Your discount / Your price
    expect(screen.getAllByTestId('offer-position-saving')).toHaveLength(1)
    expect(screen.getByTestId('offer-position-saving')).toHaveTextContent(
      `You save ${fmt(20)} per day · ${fmt(120)}`,
    )
    expect(screen.getByTestId('offer-savings-intro')).toHaveTextContent(
      `You save ${fmt(120)} compared to our regular prices.`,
    )
    expect(screen.getByTestId('offer-regular-total')).toHaveTextContent(fmt(590))
    expect(screen.getByTestId('offer-gross-total')).toHaveTextContent(fmt(470))
    // the engine's regular-price line items are not listed next to the offer;
    // the hotel part is one "+ paid at the hotel" line
    expect(screen.queryByTestId('offer-line-item')).not.toBeInTheDocument()
    expect(screen.getByTestId('offer-hotel-due')).toHaveTextContent(
      `+ ${fmt(500)} paid at the hotel on arrival`,
    )
  })

  it('hides regular prices and the discount row when show_savings is off', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...WITH_OFFER,
      show_savings: false,
      offer_discount: null,
      // the API redacts original_* to the offer prices server-side
      offer_positions: [
        { ...POSITION, original_unit_price: 70, original_total: 420 },
        VIDEO,
      ],
    })
    render(<OfferPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('offer-ready'))

    expect(screen.getAllByTestId('offer-position')).toHaveLength(2)
    expect(screen.queryByTestId('offer-discount')).not.toBeInTheDocument()
    expect(screen.queryByTestId('offer-position-original-unit')).not.toBeInTheDocument()
    expect(screen.queryByTestId('offer-position-original-total')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('offer-position-per-day')[0]).toHaveTextContent(`${fmt(70)}/day × 3 days × 2 participants`)
    expect(document.body).not.toHaveTextContent('€90.00')
    expect(document.body).not.toHaveTextContent(fmt(540))
  })

  it('never shows savings when show_savings is false even if the payload still carries them', async () => {
    mocks.getBookingByToken.mockResolvedValue({ ...WITH_OFFER, show_savings: false })
    render(<OfferPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('offer-ready'))

    expect(screen.queryByTestId('offer-discount')).not.toBeInTheDocument()
    expect(screen.queryByTestId('offer-position-original-total')).not.toBeInTheDocument()
  })

  it('shows group discount and free spots below the positions', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...WITH_OFFER,
      offer_adjustments: {
        free_spot_count: 2, group_threshold: 8, group_discount_pct: 0.1, group_discount_amount: 47,
      },
    })
    render(<OfferPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('offer-ready'))

    // landr-bo0wd.5: free spots are rows "on us" with the regular price of one
    // participant across all positions (90 × 3 + 50 × 1 = 320); the group
    // discount folds into "Your discount" while savings are shown.
    const spots = screen.getAllByTestId('offer-free-spot')
    expect(spots).toHaveLength(2)
    expect(spots[0]).toHaveTextContent('Free spot')
    expect(screen.getAllByTestId('offer-free-spot-note')[0]).toHaveTextContent(
      `Regular price ${fmt(320)} — on us`,
    )
    expect(screen.getByTestId('offer-regular-total')).toHaveTextContent(fmt(590 + 640))
    expect(screen.getByTestId('offer-discount-amount')).toHaveTextContent(`−${fmt(1230 - 423)}`)
    expect(screen.getByTestId('offer-gross-total')).toHaveTextContent(fmt(423))
    expect(screen.queryByTestId('offer-group-discount')).not.toBeInTheDocument()
  })

  it('keeps the group discount row and says "on us" without a price when savings are hidden', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...WITH_OFFER,
      show_savings: false,
      offer_discount: null,
      offer_positions: [{ ...POSITION, original_unit_price: 70, original_total: 420 }, VIDEO],
      offer_adjustments: {
        free_spot_count: 1, group_threshold: 8, group_discount_pct: 0.1, group_discount_amount: 47,
      },
    })
    render(<OfferPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('offer-ready'))

    expect(screen.getByTestId('offer-group-discount')).toHaveTextContent('Group discount (10 %)')
    expect(screen.getByTestId('offer-group-discount')).toHaveTextContent(`−${fmt(47)}`)
    expect(screen.getByTestId('offer-free-spot-note')).toHaveTextContent(/^On us$/)
    expect(screen.queryByTestId('offer-regular-total')).not.toBeInTheDocument()
    expect(screen.queryByTestId('offer-savings-intro')).not.toBeInTheDocument()
    expect(screen.queryByTestId('offer-position-saving')).not.toBeInTheDocument()
    expect(screen.getByTestId('offer-gross-total')).toHaveTextContent(fmt(423))
  })

  it('shows the tax included in Your price', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...WITH_OFFER,
      totals: {
        ...WITH_OFFER.totals,
        operator_net_total: 439.25,
        operator_tax_total: 30.75,
        operator_gross_total: 470,
        hotel_gross_total: 500,
      },
    })
    render(<OfferPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('offer-ready'))
    expect(screen.getByTestId('offer-tax-included')).toHaveTextContent(`incl. ${fmt(30.75)} tax (7 %)`)
    expect(screen.getByTestId('offer-gross-total')).toHaveTextContent(fmt(470))
    expect(screen.queryByTestId('offer-tax-added')).not.toBeInTheDocument()
    expect(screen.queryByTestId('offer-net-price')).not.toBeInTheDocument()
  })

  it('net-entry offer: positions are NET, the tax is added and Your price is the gross', async () => {
    // positions 420 + 50 = 470 net; 7 % added = 502.90 gross (what Stripe charges)
    mocks.getBookingByToken.mockResolvedValue({
      ...WITH_OFFER,
      totals: {
        ...WITH_OFFER.totals,
        gross_total: 1002.9,
        operator_net_total: 470,
        operator_tax_total: 32.9,
        operator_gross_total: 502.9,
        hotel_gross_total: 500,
      },
    })
    render(<OfferPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('offer-ready'))
    expect(screen.getByTestId('offer-regular-total')).toHaveTextContent(fmt(590))
    expect(screen.getByTestId('offer-discount-amount')).toHaveTextContent(`−${fmt(120)}`)
    expect(screen.getByTestId('offer-net-price')).toHaveTextContent(fmt(470))
    expect(screen.getByTestId('offer-tax-added')).toHaveTextContent(`+ ${fmt(32.9)} tax (7 %)`)
    expect(screen.getByTestId('offer-gross-total')).toHaveTextContent(fmt(502.9))
    expect(screen.queryByTestId('offer-tax-included')).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/incl\. .* tax/)
  })

  it('names the tax the operator picked (landr-bo0wd.7)', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...WITH_OFFER,
      offer_prices_include_tax: true,
      offer_tax: { pct: 7, label: 'IVA' },
      totals: {
        ...WITH_OFFER.totals,
        operator_net_total: 439.25,
        operator_tax_total: 30.75,
        operator_gross_total: 470,
        hotel_gross_total: 500,
      },
    })
    render(<OfferPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('offer-ready'))
    expect(screen.getByTestId('offer-tax-included')).toHaveTextContent(`incl. ${fmt(30.75)} IVA (7 %)`)
    expect(document.body).not.toHaveTextContent(/incl\. .* tax/)
  })

  it('does not repeat the percentage when the tax name already carries it', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...WITH_OFFER,
      offer_prices_include_tax: true,
      offer_tax: { pct: 7, label: 'IVA 7%' },
      totals: {
        ...WITH_OFFER.totals,
        operator_net_total: 439.25,
        operator_tax_total: 30.75,
        operator_gross_total: 470,
        hotel_gross_total: 500,
      },
    })
    render(<OfferPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('offer-ready'))
    const line = screen.getByTestId('offer-tax-included')
    expect(line).toHaveTextContent(`incl. ${fmt(30.75)} IVA 7%`)
    expect(line).not.toHaveTextContent('(7 %)')
  })

  it('net entry is read from offer_prices_include_tax, not inferred from the totals', async () => {
    // net entry with a name; the picked 7 % wins over the derived rate
    mocks.getBookingByToken.mockResolvedValue({
      ...WITH_OFFER,
      offer_prices_include_tax: false,
      offer_tax: { pct: 7, label: 'IGIC' },
      totals: {
        ...WITH_OFFER.totals,
        gross_total: 1002.9,
        operator_net_total: 470,
        operator_tax_total: 32.9,
        operator_gross_total: 502.9,
        hotel_gross_total: 500,
      },
    })
    render(<OfferPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('offer-ready'))
    expect(screen.getByTestId('offer-tax-added')).toHaveTextContent(`+ ${fmt(32.9)} IGIC (7 %)`)
    expect(screen.getByTestId('offer-net-price')).toHaveTextContent(fmt(470))
  })

  it('a gross-entry flag wins over a net-looking total', async () => {
    // positions add up to the net total, which the old inference read as net entry
    mocks.getBookingByToken.mockResolvedValue({
      ...WITH_OFFER,
      offer_prices_include_tax: true,
      totals: {
        ...WITH_OFFER.totals,
        gross_total: 1002.9,
        operator_net_total: 470,
        operator_tax_total: 32.9,
        operator_gross_total: 502.9,
        hotel_gross_total: 500,
      },
    })
    render(<OfferPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('offer-ready'))
    expect(screen.queryByTestId('offer-tax-added')).not.toBeInTheDocument()
    expect(screen.getByTestId('offer-tax-included')).toBeInTheDocument()
  })

  it('renders the booking periods: Arrival / product range / Departure with nights and days', async () => {
    mocks.getBookingByToken.mockResolvedValue(WITH_OFFER)
    render(<OfferPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('offer-ready'))

    expect(screen.queryByTestId('offer-items-table')).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Period' })).toBeInTheDocument()
    const rows = screen.getAllByTestId('offer-period-row')
    expect(rows.map((r) => r.getAttribute('data-kind'))).toEqual(['arrival', 'activity', 'departure'])
    expect(rows[0]).toHaveTextContent('Arrival')
    expect(rows[0]).toHaveTextContent('Sun 24 Jan 2027')
    expect(rows[0]).toHaveTextContent('5 nights')
    expect(rows[1]).toHaveTextContent('Guided Paragliding Day')
    expect(rows[1]).toHaveTextContent('Mon 25 Jan – Wed 27 Jan 2027')
    expect(rows[1]).toHaveTextContent('3 days')
    expect(rows[2]).toHaveTextContent('Departure')
    expect(rows[2]).toHaveTextContent('Fri 29 Jan 2027')
  })

  it('prefers server-sent periods when the payload carries them', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...WITH_OFFER,
      periods: [
        { kind: 'arrival', start_date: '2027-02-01', end_date: '2027-02-01', label: 'Anreise', product_name: null, days: 1, meta: {} },
        { kind: 'activity', start_date: '2027-02-02', end_date: '2027-02-03', label: 'Activity', product_name: 'Tandem', days: 2, meta: {} },
        { kind: 'departure', start_date: '2027-02-04', end_date: '2027-02-04', label: 'Abreise', product_name: null, days: 1, meta: {} },
      ],
    })
    render(<OfferPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('offer-ready'))

    const rows = screen.getAllByTestId('offer-period-row')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('3 nights')
    expect(rows[1]).toHaveTextContent('Tandem')
    expect(rows[1]).toHaveTextContent('2 days')
  })

  it('legacy booking without offer_positions keeps today\'s rendering', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...WITH_OFFER,
      offer_positions: undefined,
      offer_discount: undefined,
      show_savings: undefined,
      offer_adjustments: undefined,
    })
    render(<OfferPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('offer-ready'))

    expect(screen.queryByTestId('offer-position')).not.toBeInTheDocument()
    expect(screen.queryByTestId('offer-discount')).not.toBeInTheDocument()
    expect(screen.queryByTestId('offer-periods-table')).not.toBeInTheDocument()
    expect(screen.getByTestId('offer-items-table')).toBeInTheDocument()
    expect(screen.getAllByTestId('offer-product-line')).toHaveLength(2)
    expect(screen.getAllByTestId('offer-line-item')).toHaveLength(2)
  })

  it('treats an empty offer_positions list like no offer', async () => {
    mocks.getBookingByToken.mockResolvedValue({ ...WITH_OFFER, offer_positions: [] })
    render(<OfferPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('offer-ready'))

    expect(screen.queryByTestId('offer-position')).not.toBeInTheDocument()
    expect(screen.getByTestId('offer-items-table')).toBeInTheDocument()
  })
})

describe('OfferPage — offer v3 flow: acceptance + hotel step (landr-bo0wd.5)', () => {
  const BASE = {
    ...OFFER,
    operator_name: 'Para42',
    offer_positions: [
      {
        label: 'Guided Day · 3 consecutive days', units: 3, participants: 2,
        original_unit_price: 90, unit_price: 70, original_total: 540, total: 420, excluded: false,
      },
    ],
    offer_discount: { amount: 120, per_day: 20, pct: 22.2 },
    show_savings: true,
    offer_adjustments: { free_spot_count: 0, group_threshold: null, group_discount_pct: null, group_discount_amount: 0 },
  }
  const ACCEPTED = {
    accepted: true, already_accepted: false, offer_accepted_at: '2026-10-14T10:00:00Z',
    advanced: true, stage_code: 'awaiting_payment', offer_hotel_pending: false, payment_allowed: true,
  }
  const conflict = (code: string) =>
    new HttpError(409, 'Conflict', JSON.stringify({ detail: { error: code } }))

  beforeEach(() => {
    mocks.getBookingByToken.mockReset()
    mocks.initiatePayment.mockReset()
    mocks.acceptOffer.mockReset()
    resetQueryParams()
  })

  const ready = async () => {
    render(<OfferPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('offer-ready'))
  }

  it('acceptance required, no hotel step: Accept & Pay accepts first, then starts the payment', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...BASE, offer_requires_acceptance: true, offer_accepted_at: null, offer_hotel_pending: false,
    })
    mocks.acceptOffer.mockResolvedValue(ACCEPTED)
    mocks.initiatePayment.mockResolvedValue(INITIATE_RESP)
    let navigatedTo = ''
    Object.defineProperty(window.location, 'href', {
      configurable: true,
      set(v: string) { navigatedTo = v },
      get() { return `http://stub.invalid/offer/${TOKEN}` },
    })
    await ready()
    expect(screen.queryByTestId('offer-hotel-note')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /accept & pay/i }))
    await waitFor(() => expect(mocks.initiatePayment).toHaveBeenCalledOnce())
    expect(mocks.acceptOffer).toHaveBeenCalledWith(TOKEN)
    expect(mocks.acceptOffer.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.initiatePayment.mock.invocationCallOrder[0],
    )
    expect(navigatedTo).toBe(INITIATE_RESP.checkout_url)
  })

  it('hotel step pending: Accept only, hotel note, no payment', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...BASE, offer_requires_acceptance: true, offer_accepted_at: null, offer_hotel_pending: true,
      payment: { methods: ['online', 'bank_transfer'], online_available: false, bank: null },
    })
    mocks.acceptOffer.mockResolvedValue({
      ...ACCEPTED, offer_hotel_pending: true, payment_allowed: false, stage_code: 'awaiting_hotel_approval',
    })
    await ready()
    expect(screen.getByTestId('offer-hotel-note')).toHaveTextContent(
      'Your offer becomes valid once the hotel confirms your dates.',
    )
    expect(screen.getByTestId('offer-hotel-note')).toHaveTextContent(
      'You can accept now — we send your confirmation and payment link as soon as the hotel confirms.',
    )
    expect(screen.queryByTestId('offer-hotel-confirmed')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /accept & pay|pay now/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('offer-bank-details')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^accept offer$/i }))
    await waitFor(() => expect(mocks.acceptOffer).toHaveBeenCalledOnce())
    // accepted: the button is gone, the note now says the hotel is being asked
    await waitFor(() =>
      expect(screen.queryByTestId('offer-accept-pay-btn')).not.toBeInTheDocument(),
    )
    expect(mocks.initiatePayment).not.toHaveBeenCalled()
    expect(screen.getByTestId('offer-hotel-note')).toHaveTextContent('We are waiting for the hotel')
    expect(screen.getByTestId('offer-description')).toHaveTextContent('You have accepted this offer.')
  })

  it('already accepted while the hotel step runs: no button, no payment', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...BASE, offer_requires_acceptance: true, offer_accepted_at: '2026-10-14T10:00:00Z',
      offer_hotel_pending: true,
      payment: { methods: ['online'], online_available: false, bank: null },
    })
    await ready()
    expect(screen.queryByTestId('offer-accept-pay-btn')).not.toBeInTheDocument()
    expect(screen.getByTestId('offer-hotel-note')).toHaveTextContent('We are waiting for the hotel')
  })

  it('acceptance not required: confirmation wording, no accept button, Pay now when the hotel step is done', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...BASE, offer_requires_acceptance: false, offer_accepted_at: '2026-10-14T09:00:00Z',
      offer_hotel_pending: false,
    })
    mocks.initiatePayment.mockResolvedValue(INITIATE_RESP)
    await ready()
    expect(screen.getByText('Your booking as agreed')).toBeInTheDocument()
    expect(screen.getByTestId('offer-description')).toHaveTextContent(/nothing for you to accept/i)
    expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /pay now/i }))
    await waitFor(() => expect(mocks.initiatePayment).toHaveBeenCalledOnce())
    expect(mocks.acceptOffer).not.toHaveBeenCalled()
  })

  it('acceptance not required + hotel step pending: just the note', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...BASE, offer_requires_acceptance: false, offer_accepted_at: '2026-10-14T09:00:00Z',
      offer_hotel_pending: true,
      payment: { methods: ['online'], online_available: false, bank: null },
    })
    await ready()
    expect(screen.queryByTestId('offer-accept-pay-btn')).not.toBeInTheDocument()
    expect(screen.getByTestId('offer-hotel-note')).toHaveTextContent('becomes valid once the hotel confirms your dates')
  })

  it('shows the error card when the offer was changed after the link was sent (no retry)', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...BASE, offer_requires_acceptance: true, offer_accepted_at: null, offer_hotel_pending: false,
    })
    mocks.acceptOffer.mockRejectedValue(conflict('offer_changed_since_sent'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await ready()
    fireEvent.click(screen.getByRole('button', { name: /accept & pay/i }))
    await waitFor(() => screen.getByTestId('offer-accept-error'))
    expect(screen.getByTestId('offer-accept-error')).toHaveTextContent(/changed this offer/i)
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
    expect(mocks.initiatePayment).not.toHaveBeenCalled()
  })

  it('a network failure on accept offers Try again', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...BASE, offer_requires_acceptance: true, offer_accepted_at: null, offer_hotel_pending: false,
    })
    mocks.acceptOffer.mockRejectedValue(new Error('network'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await ready()
    fireEvent.click(screen.getByRole('button', { name: /accept & pay/i }))
    await waitFor(() => screen.getByTestId('offer-accept-error'))
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await waitFor(() => screen.getByTestId('offer-ready'))
  })

  it('the hotel step starting between load and click turns the 409 into the hotel state', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...BASE, offer_requires_acceptance: false, offer_accepted_at: '2026-10-14T09:00:00Z',
      offer_hotel_pending: false,
    })
    mocks.initiatePayment.mockRejectedValue(conflict('hotel_step_pending'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await ready()
    fireEvent.click(screen.getByRole('button', { name: /pay now/i }))
    await waitFor(() => screen.getByTestId('offer-hotel-note'))
    expect(screen.queryByTestId('offer-payment-section')?.textContent).not.toMatch(/pay now/i)
    expect(screen.queryByTestId('offer-pay-error')).not.toBeInTheDocument()
  })

  // ── landr-xcyh1.3 ──────────────────────────────────────────────────────────
  const HOTEL_LINE = {
    product_id: 'p-hotel', label: 'Hotel Alpenblick', qty: 1, units: 5,
    line_total: 500, unit_price: 500, paid_to: 'hotel', participants: null, per_person_price: null,
  }

  it('hotel confirmed, customer not accepted yet: "Hotel confirmed" note, Accept & Pay accepts then pays', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...BASE, line_items: [HOTEL_LINE],
      offer_requires_acceptance: true, offer_accepted_at: null, offer_hotel_pending: false,
      offer_hotel_confirmed: true,
    })
    mocks.acceptOffer.mockResolvedValue({ ...ACCEPTED, confirmation_sent: true })
    mocks.initiatePayment.mockResolvedValue(INITIATE_RESP)
    Object.defineProperty(window.location, 'href', {
      configurable: true,
      set() {},
      get() { return `http://stub.invalid/offer/${TOKEN}` },
    })
    await ready()
    expect(screen.getByTestId('offer-hotel-confirmed')).toHaveTextContent('Hotel confirmed')
    expect(screen.queryByTestId('offer-hotel-note')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /accept & pay/i }))
    await waitFor(() => expect(mocks.initiatePayment).toHaveBeenCalledOnce())
  })

  it('hotel rooms but no hotel yes (offer_hotel_confirmed false): no "Hotel confirmed" banner', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...BASE, line_items: [HOTEL_LINE],
      offer_requires_acceptance: true, offer_accepted_at: null, offer_hotel_pending: false,
      offer_hotel_confirmed: false,
    })
    await ready()
    expect(screen.queryByTestId('offer-hotel-confirmed')).not.toBeInTheDocument()
  })

  it('hotel pending: accepting never starts a payment, even if the accept response were to allow it', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...BASE, line_items: [HOTEL_LINE],
      offer_requires_acceptance: true, offer_accepted_at: null, offer_hotel_pending: true,
      offer_hotel_confirmed: false,
      payment: { methods: ['online'], online_available: true, bank: null },
    })
    mocks.acceptOffer.mockResolvedValue({ ...ACCEPTED, offer_hotel_pending: true, payment_allowed: true })
    await ready()
    fireEvent.click(screen.getByRole('button', { name: /^accept offer$/i }))
    await waitFor(() => expect(mocks.acceptOffer).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.queryByTestId('offer-accept-pay-btn')).not.toBeInTheDocument())
    expect(mocks.initiatePayment).not.toHaveBeenCalled()
    expect(screen.queryByTestId('offer-hotel-confirmed')).not.toBeInTheDocument()
  })

  it('hotel confirmed after accept: banner and Pay now', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...BASE, line_items: [HOTEL_LINE],
      offer_requires_acceptance: true, offer_accepted_at: '2026-10-14T09:00:00Z',
      offer_hotel_pending: false, offer_hotel_confirmed: true,
    })
    await ready()
    expect(screen.getByTestId('offer-hotel-confirmed')).toHaveTextContent('Hotel confirmed')
    expect(screen.getByRole('button', { name: /pay now/i })).toBeInTheDocument()
  })

  it('no "Hotel confirmed" note while the hotel step is pending or without hotel rooms', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...BASE, line_items: [HOTEL_LINE],
      offer_requires_acceptance: true, offer_accepted_at: null, offer_hotel_pending: true,
      payment: { methods: ['online'], online_available: false, bank: null },
    })
    await ready()
    expect(screen.queryByTestId('offer-hotel-confirmed')).not.toBeInTheDocument()
  })

  it('hotel declined: update note, no button, no payment rails', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...BASE, offer_requires_acceptance: true, offer_accepted_at: null,
      offer_hotel_pending: true, offer_hotel_declined: true,
      payment: { methods: ['online', 'bank_transfer'], online_available: false, bank: null },
    })
    await ready()
    expect(screen.getByTestId('offer-hotel-declined')).toHaveTextContent('We are updating your offer.')
    expect(screen.getByTestId('offer-description')).toHaveTextContent(/could not confirm these rooms/i)
    expect(screen.queryByTestId('offer-hotel-note')).not.toBeInTheDocument()
    expect(screen.queryByTestId('offer-accept-pay-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('offer-bank-details')).not.toBeInTheDocument()
  })

  it('initiate 409 hotel_declined turns the page into the declined state', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...BASE, offer_requires_acceptance: false, offer_accepted_at: '2026-10-14T09:00:00Z',
      offer_hotel_pending: false,
    })
    mocks.initiatePayment.mockRejectedValue(conflict('hotel_declined'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await ready()
    fireEvent.click(screen.getByRole('button', { name: /pay now/i }))
    await waitFor(() => screen.getByTestId('offer-hotel-declined'))
    expect(screen.queryByTestId('offer-pay-error')).not.toBeInTheDocument()
    expect(screen.queryByTestId('offer-accept-pay-btn')).not.toBeInTheDocument()
  })

  it('initiate 409 offer_not_accepted falls back to the Accept step', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...BASE, offer_requires_acceptance: true, offer_accepted_at: '2026-10-14T09:00:00Z',
      offer_hotel_pending: false,
    })
    mocks.initiatePayment.mockRejectedValue(conflict('offer_not_accepted'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await ready()
    fireEvent.click(screen.getByRole('button', { name: /pay now/i }))
    await waitFor(() => screen.getByRole('button', { name: /accept & pay/i }))
    expect(screen.queryByTestId('offer-pay-error')).not.toBeInTheDocument()
  })

  it('a yes while the hotel has declined records it and shows the declined state', async () => {
    mocks.getBookingByToken.mockResolvedValue({
      ...BASE, offer_requires_acceptance: true, offer_accepted_at: null, offer_hotel_pending: false,
    })
    mocks.acceptOffer.mockResolvedValue({
      ...ACCEPTED, payment_allowed: false, offer_hotel_declined: true,
    })
    await ready()
    fireEvent.click(screen.getByRole('button', { name: /accept & pay/i }))
    await waitFor(() => screen.getByTestId('offer-hotel-declined'))
    expect(mocks.initiatePayment).not.toHaveBeenCalled()
  })

  it('no card rail (bank only): Accept offer, then the bank details show', async () => {
    const payment = {
      methods: ['bank_transfer'],
      online_available: false,
      bank: { iban: 'ES00 0000 0000 0000', bic: null, account_holder: 'Para42', reference: 'B-1' },
    }
    mocks.getBookingByToken.mockResolvedValue({
      ...BASE, offer_requires_acceptance: true, offer_accepted_at: null, offer_hotel_pending: false,
      payment,
    })
    mocks.acceptOffer.mockResolvedValue(ACCEPTED)
    await ready()
    // not before the yes
    expect(screen.queryByTestId('offer-bank-details')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^accept offer$/i }))
    await waitFor(() => screen.getByTestId('offer-bank-details'))
    expect(mocks.initiatePayment).not.toHaveBeenCalled()
    expect(screen.queryByTestId('offer-accept-pay-btn')).not.toBeInTheDocument()
  })
})
