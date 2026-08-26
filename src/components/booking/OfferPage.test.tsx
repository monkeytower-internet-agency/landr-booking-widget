import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  it('renders the paid confirmation card when ?paid=1 is in the URL', () => {
    setupQueryParam('paid', '1')
    // getBookingByToken should NOT be called — we're already past the offer.
    render(<OfferPage token={TOKEN} />)
    expect(screen.getByTestId('offer-paid')).toBeInTheDocument()
    expect(screen.getByText(/payment complete/i)).toBeInTheDocument()
    expect(mocks.getBookingByToken).not.toHaveBeenCalled()
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
