import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { formatCurrency } from './accommodationCalc'
import { OfferPage } from './OfferPage'

// ─── Mock API ────────────────────────────────────────────────────────────────
const { mocks } = vi.hoisted(() => ({
  mocks: {
    getBookingByToken: vi.fn<(token: string) => Promise<unknown>>(),
    initiatePayment: vi.fn<(body: unknown) => Promise<unknown>>(),
  },
}))

vi.mock('@/api/client', () => ({
  getBookingByToken: mocks.getBookingByToken,
  initiatePayment: mocks.initiatePayment,
}))

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
    expect(screen.getByText('Sailing Week')).toBeInTheDocument()
    expect(screen.getByTestId('offer-gross-total')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accept & pay/i })).toBeEnabled()
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
})
