import { useEffect, useState } from 'react'

import {
  getBookingByToken,
  initiatePayment,
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
 * the return_url. We use the same page with ?paid=1 as the return_url
 * so the customer sees a "Payment complete" confirmation rather than
 * the offer again. A separate cancel_url (?paid=cancelled) lets them
 * return here from the Stripe "go back" link.
 *
 * landr-esd3: added mode="pay", rendered at /pay/{token} by the
 * booking_payment_link email (a booking already sitting at
 * awaiting_payment with balance_due > 0). Only the copy differs from the
 * default "offer" mode — the fetch, totals table, initiatePayment call,
 * and ?paid=1 / ?paid=cancelled return states are all reused untouched.
 *
 * States:
 *   'loading'    — fetching the offer from the API
 *   'ready'      — offer loaded, customer can review + pay
 *   'paying'     — POST /initiate in flight, button disabled
 *   'paid'       — returned from Stripe with ?paid=1 (success)
 *   'cancelled'  — returned from Stripe with ?paid=cancelled
 *   'fetch_error' — offer fetch failed (token invalid / expired)
 *   'pay_error'  — payment initiation failed
 */

type Status =
  | 'loading'
  | 'ready'
  | 'paying'
  | 'paid'
  | 'cancelled'
  | 'fetch_error'
  | 'pay_error'

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
    if (paidParam === '1') return 'paid'
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
      setErrorMessage(
        err instanceof Error && err.message
          ? 'We could not start the payment. Please try again or contact us.'
          : 'Something went wrong. Please try again later.',
      )
      setStatus('pay_error')
    }
  }

  // ── Stripe return: payment complete ──────────────────────────────────────
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
                  {formatCurrency(totals.net_total, currencyCode)}
                </td>
              </tr>
              {totals.tax_total > 0 && (
                <tr>
                  <td className="py-0.5 pr-4 text-muted-foreground">Tax</td>
                  <td className="py-0.5 text-right" data-testid="offer-tax-total">
                    {formatCurrency(totals.tax_total, currencyCode)}
                  </td>
                </tr>
              )}
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
            </tbody>
          </table>
        </section>

        {/* CTA */}
        <Button
          type="button"
          className="w-full sm:w-auto"
          onClick={() => {
            void onAcceptAndPay()
          }}
          disabled={busy}
          data-testid="offer-accept-pay-btn"
        >
          {busy
            ? 'Redirecting to payment…'
            : mode === 'pay'
              ? 'Pay now'
              : 'Accept & Pay'}
        </Button>

        <p className="text-xs text-muted-foreground">
          {mode === 'pay'
            ? 'This payment link is personal. Do not share it.'
            : 'This offer link is personal. Do not share it.'}
        </p>
      </CardContent>
    </Card>
  )
}
