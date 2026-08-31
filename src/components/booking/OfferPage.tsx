import { useEffect, useState } from 'react'

import {
  getBookingByToken,
  initiatePayment,
  type OfferTotals,
  type PublicBookingOffer,
} from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatCurrency } from './accommodationCalc'

/**
 * Customer offer review + Accept & Pay page (landr-uvfg.4b).
 *
 * Rendered when the widget is loaded at /offer/{token}. The token
 * arrives via the custom_offer email sent by the operator's
 * "Send offer to customer" action (landr-uvfg.4a).
 *
 * On mount, fetches GET /api/public/bookings/{token} to display the
 * offer summary (product lines, participants, price breakdown).
 * The "Accept & Pay" button calls POST /api/public/payments/initiate
 * and redirects to the Stripe Checkout URL.
 *
 * After Stripe redirects back, Stripe appends a success indicator to
 * the return_url. We use the same page with ?paid=1 as the return_url —
 * but landr-6l7y: ?paid=1 is only ever the TRIGGER to re-check, never the
 * evidence. It is the exact URL this component itself built before
 * redirecting to Stripe, so anyone can type it onto their own link, and a
 * failed webhook would otherwise leave the customer reading "confirmed"
 * while the booking is still 'pending'. On ?paid=1 we re-fetch
 * GET /api/public/bookings/{token} and render from the SERVER's state: a
 * settled balance shows the confirmation, a still-pending balance shows an
 * honest "confirming your payment" interstitial with a bounded poll (never
 * an unbounded one), and a failed re-fetch shows neutral copy — never a
 * confirmation. A separate cancel_url (?paid=cancelled) lets the customer
 * return here from the Stripe "go back" link; that state is trusted as-is
 * since it asserts nothing about payment success.
 *
 * landr-esd3: added mode="pay", rendered at /pay/{token} by the
 * booking_payment_link email (a booking already sitting at
 * awaiting_payment with balance_due > 0). Only the copy differs from the
 * default "offer" mode — the fetch, totals table, initiatePayment call,
 * and ?paid=1 / ?paid=cancelled return states are all reused untouched.
 *
 * States:
 *   'loading'         — fetching the offer from the API
 *   'ready'           — offer loaded, customer can review + pay
 *   'paying'          — POST /initiate in flight, button disabled
 *   'verifying'       — returned with ?paid=1; re-checking the booking with
 *                        the server (initial check + bounded poll)
 *   'paid'            — server confirms the balance is settled
 *   'paid_pending'    — poll exhausted, server still shows a balance due;
 *                        honest terminal state, never claims confirmation
 *   'paid_unknown'    — the ?paid=1 re-check itself failed; neutral copy,
 *                        never claims confirmation
 *   'cancelled'       — returned from Stripe with ?paid=cancelled
 *   'fetch_error'     — offer fetch failed (token invalid / expired)
 *   'pay_error'       — payment initiation failed
 */

type Status =
  | 'loading'
  | 'ready'
  | 'paying'
  | 'verifying'
  | 'paid'
  | 'paid_pending'
  | 'paid_unknown'
  | 'cancelled'
  | 'fetch_error'
  | 'pay_error'

// landr-6l7y: bounded poll for the ?paid=1 re-check. The first check is
// immediate (attempt 0); these are the delays before each retry if the
// booking still shows a balance due — 4 retries, ~12.5s of real time total.
// Generous versus typical webhook latency (seconds), but bounded so we
// never poll forever — after the last attempt we show an honest terminal
// state instead of continuing to spin.
const VERIFY_POLL_DELAYS_MS = [1500, 2500, 3500, 5000]
const VERIFY_MAX_ATTEMPTS = VERIFY_POLL_DELAYS_MS.length + 1

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// landr-2ll8: balance_due is typed non-null but the API layer has drifted
// from its generated types before — defend against a missing/null value by
// falling back to gross_total (the pre-fix, whole-total behavior) rather
// than treating a broken payload as "nothing owed". Shared by the render
// below and the ?paid=1 settled check so both apply the exact same
// definition of "nothing left to collect".
function chargeRemaining(totals: OfferTotals): number {
  return totals.balance_due ?? totals.gross_total
}

interface Props {
  token: string
  // landr-esd3: 'pay' renders the same page for /pay/{token} (booking
  // already awaiting_payment) with payment-flavored copy. Defaults to the
  // original 'offer' (custom-offer accept-and-pay) copy.
  mode?: 'offer' | 'pay'
}

function _returnBase(): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}${window.location.pathname}`
}

export function OfferPage({ token, mode = 'offer' }: Props) {
  // Detect if Stripe redirected back to this page.
  const paidParam =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('paid')
      : null

  const [status, setStatus] = useState<Status>(() => {
    if (paidParam === '1') return 'verifying'
    if (paidParam === 'cancelled') return 'cancelled'
    return 'loading'
  })
  const [offer, setOffer] = useState<PublicBookingOffer | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'loading') return
    let cancelled = false
    void (async () => {
      try {
        const data = await getBookingByToken(token)
        if (!cancelled) {
          setOffer(data)
          setStatus('ready')
        }
      } catch {
        if (!cancelled) {
          setStatus('fetch_error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  // token is stable for the lifetime of this component
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // landr-6l7y: ?paid=1 return from Stripe — re-check with the server
  // instead of trusting the query string. Runs once on mount (mirrors the
  // 'loading' effect above); only actually fires when the initial status
  // was 'verifying'.
  useEffect(() => {
    if (status !== 'verifying') return
    let cancelled = false
    void (async () => {
      for (let attempt = 0; attempt < VERIFY_MAX_ATTEMPTS; attempt++) {
        if (attempt > 0) {
          await sleep(VERIFY_POLL_DELAYS_MS[attempt - 1])
          if (cancelled) return
        }
        try {
          const data = await getBookingByToken(token)
          if (cancelled) return
          if (chargeRemaining(data.totals) <= 0) {
            setOffer(data)
            setStatus('paid')
            return
          }
          // Still pending — loop to the next attempt (or fall through to
          // the terminal 'paid_pending' state once attempts are exhausted).
        } catch {
          if (cancelled) return
          setStatus('paid_unknown')
          return
        }
      }
      if (!cancelled) setStatus('paid_pending')
    })()
    return () => {
      cancelled = true
    }
  // token is stable for the lifetime of this component
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onAcceptAndPay = async () => {
    setStatus('paying')
    setErrorMessage(null)
    const base = _returnBase()
    try {
      const resp = await initiatePayment({
        booking_token: token,
        return_url: `${base}?paid=1`,
        cancel_url: `${base}?paid=cancelled`,
      })
      // Hard-navigate to Stripe Checkout.
      if (typeof window !== 'undefined') {
        window.location.href = resp.checkout_url
      }
    } catch (err) {
      // The thrown Error carries the server's own explanation — e.g.
      // `400 Bad Request: {"detail":"return_url origin not in allowlist:
      // https://bw-dev.landr.de"}`. Swallowing it entirely is what turned a
      // one-line config bug into a blind investigation on 2026-08-31, so log
      // it verbatim: the console is developer-only, the customer still sees
      // the friendly copy below, and no secret is ever in this payload.
      console.error('[landr] initiatePayment failed', err)
      setErrorMessage(
        err instanceof Error && err.message
          ? 'We could not start the payment. Please try again or contact us.'
          : 'Something went wrong. Please try again later.',
      )
      setStatus('pay_error')
    }
  }

  // ── Stripe return: re-checking with the server ────────────────────────────
  if (status === 'verifying') {
    return (
      <Card data-testid="offer-payment-verifying">
        <CardHeader>
          <CardTitle>Confirming your payment…</CardTitle>
          <CardDescription>This usually takes a few seconds.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Please wait while we confirm your payment with our records.
          </p>
        </CardContent>
      </Card>
    )
  }

  // ── Stripe return: payment complete (server-confirmed) ────────────────────
  if (status === 'paid') {
    return (
      <Card data-testid="offer-paid">
        <CardHeader>
          <CardTitle>Payment complete</CardTitle>
          <CardDescription>Your booking is confirmed.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Thank you! We have received your payment and your booking is
            confirmed. You will receive a confirmation email shortly.
          </p>
        </CardContent>
      </Card>
    )
  }

  // ── Stripe return: still pending after the bounded poll ───────────────────
  // landr-6l7y: NEVER claim confirmation here — the server still shows a
  // balance due, most likely because the Stripe webhook hasn't landed yet
  // (or failed). Honest interstitial-turned-terminal state instead.
  if (status === 'paid_pending') {
    return (
      <Card data-testid="offer-payment-pending">
        <CardHeader>
          <CardTitle>Still confirming your payment</CardTitle>
          <CardDescription>
            This is taking longer than usual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            We have not been able to confirm your payment yet. This does not
            necessarily mean anything is wrong — we will email you a
            confirmation as soon as it is processed. If you do not hear from
            us shortly, please contact us.
          </p>
        </CardContent>
      </Card>
    )
  }

  // ── Stripe return: the re-check itself failed ─────────────────────────────
  // landr-6l7y: a network/API failure while verifying is NOT evidence either
  // way — neutral copy, never a confirmation.
  if (status === 'paid_unknown') {
    return (
      <Card data-testid="offer-payment-unknown">
        <CardHeader>
          <CardTitle>We could not check your payment status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            We were unable to reach our records just now. If your payment
            succeeded, you will receive a confirmation email shortly. If
            you are not sure, please contact us.
          </p>
        </CardContent>
      </Card>
    )
  }

  // ── Stripe return: customer clicked "go back" ─────────────────────────────
  if (status === 'cancelled') {
    return (
      <Card data-testid="offer-payment-cancelled">
        <CardHeader>
          <CardTitle>Payment cancelled</CardTitle>
          <CardDescription>Your booking has not been charged.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">
            You left the payment page without completing payment. Your booking
            is still reserved — click below to try again.
          </p>
          <Button
            type="button"
            onClick={() => {
              // Reload to the clean /offer/{token} URL (without ?paid=…).
              if (typeof window !== 'undefined') {
                window.location.href = _returnBase()
              }
            }}
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  // ── Offer fetch failed ────────────────────────────────────────────────────
  if (status === 'fetch_error') {
    return (
      <Card data-testid="offer-error">
        <CardHeader>
          {/* landr-esd3 */}
          <CardTitle>
            {mode === 'pay' ? 'Payment link not found' : 'Offer not found'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            This offer link is invalid or has expired. Please contact the
            operator for a fresh link.
          </p>
        </CardContent>
      </Card>
    )
  }

  // ── Payment initiation failed ─────────────────────────────────────────────
  if (status === 'pay_error') {
    return (
      <Card data-testid="offer-pay-error">
        <CardHeader>
          <CardTitle>Payment failed to start</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">
            {errorMessage ?? 'Something went wrong.'}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setStatus('ready')}
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (status === 'loading' || !offer) {
    return (
      <Card data-testid="offer-loading">
        <CardHeader>
          <CardTitle>Loading your offer…</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Please wait.</p>
        </CardContent>
      </Card>
    )
  }

  // ── Ready / paying ────────────────────────────────────────────────────────
  const { totals, product_lines, participants } = offer
  const busy = status === 'paying'
  const currencyCode = totals.currency

  // landr-yimp: in mode="pay" the prominent figure must be the amount
  // Stripe will actually charge (balance_due) — never gross_total.
  // gross_total is still shown, but only as a secondary line, and — review
  // round 2 — WITHOUT asserting *why* it differs from the charge. The gap
  // between gross_total and balance_due (recompute_booking_balance_due,
  // landr-api migration 20260606100000) is
  //   (gross_total - operator_gross_total)   at-hotel lines, PLUS
  //   - succeeded payments already collected, MINUS
  //   succeeded refunds, PLUS/MINUS
  //   any operator price-override delta
  // — four independent producers. A first-time /pay visit (right after the
  // one-time booking_payment_link send) usually only has the first
  // producer, but the token is valid 30 days and a customer can reopen it
  // after a partial payment or price override, at which point the gap is
  // NOT an at-hotel amount. The widget has no field that isolates the
  // at-hotel portion specifically (OfferTotals only carries
  // gross/tax/net/balance_due/currency — see landr-gkj0, filed to add
  // that split to the API). So the secondary line states only what's
  // always true: this is the full booking value, not the amount being
  // charged now.
  //
  // totals.balance_due is typed non-null, but the API layer has drifted
  // from its generated types before (see landr-2ll8) — defend against a
  // missing/null value at runtime by falling back to gross_total, which
  // reproduces the pre-fix (whole-total) behavior rather than rendering a
  // broken figure. Same definition the ?paid=1 settled check uses (landr-6l7y).
  const chargeAmount = chargeRemaining(totals)

  // landr-gkj0: the API now ships the operator/hotel split, so the breakdown
  // rows can describe the money THIS PAGE collects instead of the whole
  // booking. Before this, a booking with a 180.00 guiding line and 526.00 of
  // pay-at-hotel rooms rendered "Subtotal 659.81 / Tax 46.19 / Amount due
  // 180.00" — three rows that do not add up, mixing money owed to the hotel
  // on arrival into the figure being charged now.
  //
  // Absent (legacy bookings with no persisted per-line breakdown) => fall
  // back to the booking-wide net/tax exactly as before, rather than showing
  // a 0.00 breakdown. `splitAvailable` gates every use.
  const hasSplit =
    totals.operator_net_total != null && totals.operator_tax_total != null
  // Only meaningful in pay mode: the offer ("Accept & Pay") flow quotes the
  // whole booking on purpose, and its Total row is the grand total.
  const splitAvailable = mode === 'pay' && hasSplit
  const breakdownNet = splitAvailable
    ? (totals.operator_net_total as number)
    : totals.net_total
  const breakdownTax = splitAvailable
    ? (totals.operator_tax_total as number)
    : totals.tax_total
  const hotelAmount = totals.hotel_gross_total ?? 0
  // Name the at-hotel money only when we actually read it off the lines.
  const showHotelLine = splitAvailable && hotelAmount > 0
  // The operator share before payments/refunds/overrides. Shown only when it
  // differs from what is being charged now (a partial payment or an operator
  // price override), so the customer can see why the two differ instead of
  // the rows silently not summing.
  const operatorGross = totals.operator_gross_total
  const showOperatorGross =
    splitAvailable &&
    operatorGross != null &&
    Math.abs(operatorGross - chargeAmount) >= 0.005
  // balance_due <= 0 means this card payment is settled (fully paid, or in
  // credit) — there is nothing left for THIS LINK to collect. It does NOT
  // mean the whole booking is settled: at-hotel lines are never reflected
  // in balance_due, so money can still be owed to the hotel directly.
  const alreadySettled = mode === 'pay' && chargeAmount <= 0
  // With the split present the at-hotel row already explains the gap, so the
  // vague "Total booking value" line is only needed as the legacy fallback.
  const showTotalBookingValue =
    mode === 'pay' &&
    !alreadySettled &&
    totals.gross_total !== chargeAmount &&
    !splitAvailable

  return (
    <Card data-testid="offer-ready">
      <CardHeader>
        {/* landr-esd3: pay mode swaps the title/description copy only —
            everything below (totals table, CTA, initiatePayment) is shared. */}
        <CardTitle>
          {mode === 'pay' ? 'Complete your payment' : 'Your custom offer'}
        </CardTitle>
        <CardDescription>
          {mode === 'pay'
            ? 'Your booking is confirmed. Pay the outstanding balance below to secure it.'
            : 'Review the details below and click Accept & Pay to confirm your booking.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">

        {/* Product lines */}
        {product_lines.length > 0 && (
          <section aria-label="Products">
            <h3 className="mb-1 text-sm font-semibold">What you're booking</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {product_lines.map((pl) => (
                <li key={pl.product_id} data-testid="offer-product-line">
                  <span className="font-medium">{pl.name}</span>
                  {pl.selected_days && pl.selected_days.length > 0 && (
                    <span className="ml-1 text-muted-foreground">
                      ({pl.selected_days.join(', ')})
                    </span>
                  )}
                  {pl.quantity > 1 && (
                    <span className="ml-1 text-muted-foreground">
                      &times; {pl.quantity}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Participants */}
        {participants.length > 0 && (
          <section aria-label="Participants">
            <h3 className="mb-1 text-sm font-semibold">Participants</h3>
            <ul className="flex flex-col gap-0.5 text-sm">
              {participants.map((p, i) => (
                <li key={i} data-testid="offer-participant">
                  {p.first_name}
                  {p.last_name ? ` ${p.last_name}` : ''}
                  {p.service_role_label && (
                    <span className="ml-1 text-muted-foreground">
                      ({p.service_role_label})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Price breakdown */}
        <section aria-label="Price breakdown">
          <h3 className="mb-1 text-sm font-semibold">Price breakdown</h3>
          <table className="w-full max-w-xs text-sm">
            <tbody>
              <tr>
                <td className="py-0.5 pr-4 text-muted-foreground">Subtotal</td>
                <td className="py-0.5 text-right" data-testid="offer-net-total">
                  {formatCurrency(breakdownNet, currencyCode)}
                </td>
              </tr>
              {breakdownTax > 0 && (
                <tr>
                  <td className="py-0.5 pr-4 text-muted-foreground">Tax</td>
                  <td className="py-0.5 text-right" data-testid="offer-tax-total">
                    {formatCurrency(breakdownTax, currencyCode)}
                  </td>
                </tr>
              )}
              {mode === 'pay' ? (
                <>
                  {/* landr-yimp: the charged amount is the headline figure
                      in pay mode — mirrors booking_payment_link_en's
                      "Amount due" row word-for-word. */}
                  <tr className="border-t">
                    <td className="py-1 pr-4 font-semibold">Amount due</td>
                    <td
                      className="py-1 text-right font-semibold"
                      data-testid="offer-balance-due"
                    >
                      {alreadySettled
                        ? 'Nothing due now'
                        : formatCurrency(chargeAmount, currencyCode)}
                    </td>
                  </tr>
                  {showOperatorGross && (
                    <tr>
                      <td className="py-0.5 pr-4 text-muted-foreground">
                        Your share of this booking
                      </td>
                      <td
                        className="py-0.5 text-right text-muted-foreground"
                        data-testid="offer-operator-gross-total"
                      >
                        {formatCurrency(
                          operatorGross as number,
                          currencyCode,
                        )}
                      </td>
                    </tr>
                  )}
                  {showTotalBookingValue && (
                    <tr>
                      <td className="py-0.5 pr-4 text-muted-foreground">
                        Total booking value
                      </td>
                      <td
                        className="py-0.5 text-right text-muted-foreground"
                        data-testid="offer-gross-total"
                      >
                        {formatCurrency(totals.gross_total, currencyCode)}
                      </td>
                    </tr>
                  )}
                </>
              ) : (
                <>
                  <tr className="border-t">
                    <td className="py-1 pr-4 font-semibold">Total</td>
                    <td
                      className="py-1 text-right font-semibold"
                      data-testid="offer-gross-total"
                    >
                      {formatCurrency(totals.gross_total, currencyCode)}
                    </td>
                  </tr>
                  {totals.balance_due !== totals.gross_total && (
                    <tr>
                      <td className="py-0.5 pr-4 text-muted-foreground">
                        Amount due now
                      </td>
                      <td
                        className="py-0.5 text-right"
                        data-testid="offer-balance-due"
                      >
                        {formatCurrency(totals.balance_due, currencyCode)}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
          {showTotalBookingValue && (
            <p
              className="mt-1 text-xs text-muted-foreground"
              data-testid="offer-total-booking-value-note"
            >
              This is the full value of the booking — not the amount being
              charged now.
            </p>
          )}
          {/* landr-gkj0: with the per-line split available we can finally
              state the at-hotel amount as a fact rather than hinting at a
              gap. Kept OUT of the table above so it reads as a separate
              obligation, not another row of the sum being charged. */}
          {showHotelLine && (
            <div
              className="mt-3 rounded-md border border-dashed px-3 py-2"
              data-testid="offer-hotel-due"
            >
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span className="text-muted-foreground">
                  Payable directly to the hotel on arrival
                </span>
                <span className="font-medium">
                  {formatCurrency(hotelAmount, currencyCode)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Your accommodation is settled with the hotel at check-in. It is
                not part of the amount charged here.
              </p>
            </div>
          )}
        </section>

        {/* CTA */}
        <Button
          type="button"
          className="w-full sm:w-auto"
          onClick={() => {
            void onAcceptAndPay()
          }}
          disabled={busy || alreadySettled}
          data-testid="offer-accept-pay-btn"
        >
          {alreadySettled
            ? 'Nothing to pay'
            : busy
              ? 'Redirecting to payment…'
              : mode === 'pay'
                ? 'Pay now'
                : 'Accept & Pay'}
        </Button>

        <p className="text-xs text-muted-foreground">
          {alreadySettled
            ? // landr-yimp review round 2: balance_due <= 0 only means this
              // card payment is settled — at-hotel lines never enter
              // balance_due, so the booking as a whole can still have money
              // owed directly to the hotel. Don't claim "paid in full".
              "There's nothing further to pay through this link right now."
            : mode === 'pay'
              ? 'This payment link is personal. Do not share it.'
              : 'This offer link is personal. Do not share it.'}
        </p>
      </CardContent>
    </Card>
  )
}
