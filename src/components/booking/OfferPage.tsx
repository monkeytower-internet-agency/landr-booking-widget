import { Fragment, useEffect, useState } from 'react'

import {
  acceptOffer,
  conflictErrorCode,
  getBookingByToken,
  getBookingDetails,
  initiatePayment,
  isCustomerDetailsRequired,
  isPaymentModeNotOnline,
  paymentModeNotOnlineMode,
  putBookingDetails,
  type AcceptOfferResponse,
  type OfferLineItem,
  type OfferPayment,
  type OfferTotals,
  type PublicBookingOffer,
} from '@/api/client'
import type { CustomerDetails } from '@/api/customerDetailsTypes'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { browserLocale, configureCustomerLocale, resolveCustomerStageLabel } from '@/lib/locale'
import { fmt, pickBundle, plural, tr } from '@/lib/strings'
import { formatCurrency } from './accommodationCalc'
import { CustomerDetailsForm } from './CustomerDetailsForm'
import { collectForms } from './customerDetails'
import {
  derivePeriodRows,
  formatRange,
  formatRanges,
  lineRanges,
  periodRowsFromApi,
  type OfferPeriodRow,
} from './offerDates'
import { DescribedLabel } from './DescribedLabel'
import { hasSaving } from './offerPositions'
import { PerformerPaySections } from './PerformerPaySections'
import { groupPerformerLines } from './priceSidebarHelpers'
import { savingLabel, savingRows } from './savingRows'

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
 *   'accept_error'    — accept-offer failed (landr-bo0wd.5)
 *   'pay_mode_not_online' — initiatePayment 409'd payment_mode_not_online:
 *                        the operator switched away from 'online' (Settings
 *                        -> Payments) since this link was sent (landr-k9pji.15)
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
  | 'pay_mode_not_online'
  | 'accept_error'

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

// landr-t63w0: the operator's non-card rails on the /pay page — IBAN/BIC when
// bank transfer is ticked, an "also pay on site" hint when on-site is ticked.
/**
 * landr-1zkp7: trip-page-style section — a small uppercase muted title above
 * a bordered, elevated card. Mimics the briefings site's `.section__title` +
 * `.card` inside the widget's own Tailwind tokens.
 */
function OfferSection({
  title,
  ariaLabel,
  testId,
  children,
}: {
  title: string
  ariaLabel?: string
  testId?: string
  children: React.ReactNode
}) {
  return (
    <section aria-label={ariaLabel ?? title} data-testid={testId}>
      <h3 className="mb-2 ml-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="overflow-hidden rounded-xl border bg-surface-card shadow-elev-2">
        {children}
      </div>
    </section>
  )
}

/** The line item for a product line: same index when it lines up, else the first match by product id. */
function lineItemFor(
  items: readonly OfferLineItem[],
  productId: string,
  index: number,
): OfferLineItem | undefined {
  const same = items[index]
  if (same && same.product_id === productId) return same
  return items.find((li) => li.product_id === productId)
}

function PaymentRails({
  payment,
  locale,
  cardShown,
}: {
  payment: OfferPayment
  locale: string | undefined
  cardShown: boolean
}) {
  const onSite = payment.methods.includes('on_site')
  const bank = payment.bank
  if (!bank && !onSite) return null
  return (
    <>
      {bank && (
        <section
          className="rounded-md border px-3 py-2"
          aria-label={tr('payByBankTransferTitle', locale)}
          data-testid="offer-bank-details"
        >
          <h3 className="mb-1 text-sm font-semibold">
            {tr('payByBankTransferTitle', locale)}
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
            {bank.account_holder ? (
              <>
                <dt className="text-muted-foreground">{tr('bankAccountHolderLabel', locale)}</dt>
                <dd data-testid="offer-bank-holder">{bank.account_holder}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">{tr('bankIbanLabel', locale)}</dt>
            <dd className="font-mono" data-testid="offer-bank-iban">{bank.iban}</dd>
            {bank.bic ? (
              <>
                <dt className="text-muted-foreground">{tr('bankBicLabel', locale)}</dt>
                <dd className="font-mono" data-testid="offer-bank-bic">{bank.bic}</dd>
              </>
            ) : null}
            {bank.reference ? (
              <>
                <dt className="text-muted-foreground">{tr('bankReferenceLabel', locale)}</dt>
                <dd className="font-mono" data-testid="offer-bank-reference">{bank.reference}</dd>
              </>
            ) : null}
          </dl>
          <p className="mt-1 text-xs text-muted-foreground">
            {tr('bankTransferReferenceHint', locale)}
          </p>
        </section>
      )}
      {onSite && (
        <p className="text-sm" data-testid="offer-pay-on-site-hint">
          {cardShown || bank
            ? tr('payOnSiteAlsoHint', locale)
            : tr('payModeNotOnlinePayOnSite', locale)}
        </p>
      )}
    </>
  )
}

export function OfferPage({ token, mode = 'offer' }: Props) {
  // landr-821d6.7 review round: this is a standalone, unauthenticated,
  // pre-BookingFlowApp page (App.tsx never fetches operator/product data
  // for this route) reached via a one-time email link — it never runs
  // configureCustomerLocale() the way BookingFlowApp's settings fetch
  // does. Explicit (null, null) here documents that AND resets any
  // whitelist a same-tab prior page might have configured (defensive —
  // in practice every route here is a fresh page load).
  // PublicBookingOffer carries no operator info at all (no
  // customer_languages/default_locale field to whitelist against) — flagged
  // in the ticket handoff as an API gap; browserLocale() stays raw here.
  configureCustomerLocale(null, null)
  const locale = browserLocale()
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
  // landr-kcxx5.4: the forms the customer still owes before they may accept
  // (GET /details while pending), else null. The offer payload itself does not
  // say; accept-offer's 422 customer_details_required also fills it.
  const [pendingDetails, setPendingDetails] = useState<CustomerDetails | null>(null)
  // landr-bo0wd.5: why accept-offer failed (its 409 code), for the error card.
  const [acceptErrorCode, setAcceptErrorCode] = useState<string | null>(null)
  // landr-k9pji.15: the operator's mode from the 409 payment_mode_not_online
  // body, so the 'pay_mode_not_online' card can show pay-on-site vs.
  // bank-transfer instructions instead of one generic message.
  const [notOnlineMode, setNotOnlineMode] = useState<'bank_transfer' | 'on_site' | null>(null)
  // landr-k9pji.5 — set once POST /initiate comes back with `amount` strictly
  // less than the balance being offered (a deposit_percent operator, API
  // landr-k9pji.4). Rather than hard-navigate straight to Stripe (today's
  // behaviour for a full charge), we pause on THIS page one extra click so
  // the customer can see the "Deposit (N %)" line before being redirected —
  // an older API deploy that omits `amount` never sets this, so the
  // original one-click flow is unchanged for every operator without a
  // deposit configured.
  const [depositPreview, setDepositPreview] = useState<{
    amount: number
    checkoutUrl: string
  } | null>(null)

  // landr-bo0wd.5 — offer v3 flow, derived from the server's flags. All
  // false/legacy when the API sends none of them (older deploy, /pay).
  //   needsAccept — the customer still has to say yes
  //   hotelPending — the hotel step is ahead: Accept only, no payment yet
  //   acceptOnly  — accepting is all this page can do now (hotel step, or the
  //                 operator has no card rail); payment follows elsewhere
  const flagsPresent = mode === 'offer' && offer?.offer_requires_acceptance != null
  const requiresAcceptance = offer?.offer_requires_acceptance !== false
  const accepted = !!offer?.offer_accepted_at
  // landr-xcyh1.3: the hotel declined; the operator is updating the offer.
  // Nothing to click, nothing to pay until the updated offer arrives.
  const hotelDeclined = flagsPresent && offer?.offer_hotel_declined === true
  const hotelPending = flagsPresent && !hotelDeclined && offer?.offer_hotel_pending === true
  // landr-jsu3n.6: "Hotel confirmed" is said ONLY when the API says a hotel
  // yes exists (offer_hotel_confirmed). Having hotel lines and no pending step
  // is not a yes: a hotel that was never asked also has pending=false.
  const hotelConfirmed =
    flagsPresent &&
    !hotelPending &&
    !hotelDeclined &&
    offer?.offer_hotel_confirmed === true
  const needsAccept = flagsPresent && requiresAcceptance && !accepted && !hotelDeclined
  const onlineAvailable = !offer?.payment || offer.payment.online_available
  const acceptOnly = flagsPresent && (hotelPending || !onlineAvailable)

  // The shell's static <title> is the generic "Book — LANDR"; the pay page is
  // reached from an email link, so name the page and the operator in the tab.
  const payTitle = tr('paymentPageTitle', locale)
  const operatorName = offer?.operator_name ?? null
  useEffect(() => {
    if (mode !== 'pay') return
    document.title = operatorName ? `${payTitle} ${operatorName}` : payTitle
  }, [mode, payTitle, operatorName])

  // landr-kcxx5.4: read-only look at the customer's pending forms (offer mode
  // only). Failure is fine: accept-offer's 422 is the authoritative gate.
  useEffect(() => {
    if (mode !== 'offer') return
    let cancelled = false
    void (async () => {
      try {
        const d = await getBookingDetails(token)
        if (!cancelled && d.pending) setPendingDetails(d)
      } catch {
        // gate is enforced server-side on accept
      }
    })()
    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount; token and mode are stable for the component's lifetime
  }, [])

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount; token is stable for the component's lifetime and status is only the mount gate
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run the payment-return poll once on mount; token is stable and status is the output
  }, [])

  // landr-bo0wd.5: record the customer's yes. Folds the answer into `offer`
  // (accepted time, hotel flag) so the page re-renders from the server's
  // state. Returns the response, or null after switching to the error card.
  const runAccept = async (retried = false): Promise<AcceptOfferResponse | null> => {
    try {
      const resp = await acceptOffer(token)
      setOffer((prev) =>
        prev
          ? {
              ...prev,
              offer_accepted_at: resp.offer_accepted_at ?? new Date().toISOString(),
              offer_hotel_pending: resp.offer_hotel_pending,
              offer_hotel_declined: resp.offer_hotel_declined ?? prev.offer_hotel_declined,
              offer_hotel_confirmed: resp.offer_hotel_confirmed ?? prev.offer_hotel_confirmed,
            }
          : prev,
      )
      return resp
    } catch (err) {
      // landr-kcxx5.4: the customer still owes their details -- show the form
      // instead of an error; Save then accepts.
      if (isCustomerDetailsRequired(err)) {
        try {
          const d = await getBookingDetails(token)
          if (d.pending && collectForms(d).length > 0) {
            setPendingDetails(d)
            setStatus('ready')
            return null
          }
          // Pending but no form left (deactivated / removed after the link
          // went out): the empty PUT clears pending, as part of this Accept
          // click; then accept once more.
          if (d.pending && !retried) {
            await putBookingDetails(token, { form_responses: [] })
            setPendingDetails(null)
            return await runAccept(true)
          }
        } catch {
          // fall through to the generic accept error
        }
      }
      console.error('[landr] acceptOffer failed', err)
      setAcceptErrorCode(conflictErrorCode(err))
      setStatus('accept_error')
      return null
    }
  }

  const onAcceptAndPay = async () => {
    setStatus('paying')
    setErrorMessage(null)
    setDepositPreview(null)
    const base = _returnBase()
    // landr-bo0wd.5: a not-yet-accepted offer is accepted first. Accept-only
    // (hotel step ahead, or no card rail) stops here; the payment link
    // arrives by email, or the rails show on the re-rendered page.
    if (needsAccept) {
      const resp = await runAccept()
      if (!resp) return
      if (
        acceptOnly ||
        resp.offer_hotel_pending ||
        resp.offer_hotel_declined ||
        !resp.payment_allowed
      ) {
        setStatus('ready')
        return
      }
    }
    try {
      const resp = await initiatePayment({
        booking_token: token,
        return_url: `${base}?paid=1`,
        cancel_url: `${base}?paid=cancelled`,
      })
      // landr-k9pji.5 — a deposit_percent operator (API landr-k9pji.4):
      // `amount` is strictly less than what's actually owed. Pause here one
      // extra click instead of navigating straight to Stripe, so the
      // customer sees the "Deposit (N %)" line first. Scoped to mode="pay"
      // per the ticket contract — the offer/"Accept & Pay" flow keeps
      // today's one-click behaviour unchanged. The 0.005 slack guards
      // against float noise making a full charge look like a deposit.
      const remaining = mode === 'pay' && offer ? chargeRemaining(offer.totals) : null
      if (resp.amount != null && remaining != null && resp.amount < remaining - 0.005) {
        setDepositPreview({ amount: resp.amount, checkoutUrl: resp.checkout_url })
        setStatus('ready')
        return
      }
      // Hard-navigate to Stripe Checkout. Deliberate imperative side effect
      // inside a click-triggered async handler (not render) — the React
      // Compiler's purity analysis over-flags this call-site (unrelated to
      // the German-UI changes in this file; see landr-5aih0.9's PR
      // description) because it can't distinguish an event handler from
      // render here. Same navigation pattern the 'cancelled' status button
      // a few lines below uses inline, which the compiler does not flag.
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line react-hooks/immutability -- click-handler navigation, not render; the compiler rule over-flags it
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
      // landr-k9pji.15: a /pay or /offer link stays valid 30 days — the
      // operator may have switched payment_mode away from 'online' since it
      // was sent. That is not a failure to retry, it's a stale-state
      // conflict with its own instructions, so branch BEFORE the generic
      // pay_error path below.
      if (isPaymentModeNotOnline(err)) {
        setNotOnlineMode(paymentModeNotOnlineMode(err))
        setStatus('pay_mode_not_online')
        return
      }
      // landr-bo0wd.5: the hotel step started between page load and click --
      // not a failure, the payment link follows by email.
      if (conflictErrorCode(err) === 'hotel_step_pending') {
        setOffer((prev) => (prev ? { ...prev, offer_hotel_pending: true } : prev))
        setStatus('ready')
        return
      }
      // landr-xcyh1.3: the hotel declined between page load and click -- the
      // operator is updating the offer, there is nothing to pay.
      if (conflictErrorCode(err) === 'hotel_declined') {
        setOffer((prev) => (prev ? { ...prev, offer_hotel_declined: true } : prev))
        setStatus('ready')
        return
      }
      // landr-xcyh1.3: the offer is not accepted yet (e.g. an older tab) --
      // fall back to the Accept step instead of an error.
      if (conflictErrorCode(err) === 'offer_not_accepted') {
        setOffer((prev) => (prev ? { ...prev, offer_accepted_at: null } : prev))
        setStatus('ready')
        return
      }
      setErrorMessage(
        err instanceof Error && err.message
          ? tr('couldNotStartPayment', locale)
          : tr('somethingWentWrongRetry', locale),
      )
      setStatus('pay_error')
    }
  }

  // landr-k9pji.5 — the checkout URL from the initiate call the customer
  // already saw the deposit preview for; no second POST /initiate.
  const onContinueToStripe = () => {
    if (!depositPreview) return
    if (typeof window !== 'undefined') {
      window.location.href = depositPreview.checkoutUrl
    }
  }

  // ── Stripe return: re-checking with the server ────────────────────────────
  if (status === 'verifying') {
    return (
      <Card data-testid="offer-payment-verifying">
        <CardHeader>
          <CardTitle>{tr('confirmingYourPayment', locale)}</CardTitle>
          <CardDescription>{tr('usuallyTakesAFewSeconds', locale)}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {tr('pleaseWaitConfirmingPayment', locale)}
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
          <CardTitle>{tr('paymentComplete', locale)}</CardTitle>
          <CardDescription>{tr('yourBookingIsConfirmed', locale)}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            {tr('paymentCompleteBody', locale)}
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
          <CardTitle>{tr('stillConfirmingYourPayment', locale)}</CardTitle>
          <CardDescription>
            {tr('takingLongerThanUsual', locale)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            {tr('paymentPendingBody', locale)}
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
          <CardTitle>{tr('couldNotCheckPaymentStatusTitle', locale)}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            {tr('paymentUnknownBody', locale)}
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
          <CardTitle>{tr('paymentCancelledTitle', locale)}</CardTitle>
          <CardDescription>{tr('yourBookingHasNotBeenCharged', locale)}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">
            {tr('paymentCancelledBody', locale)}
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
            {tr('tryAgain', locale)}
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
            {mode === 'pay' ? tr('paymentLinkNotFoundTitle', locale) : tr('offerNotFoundTitle', locale)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            {tr('offerLinkInvalidBody', locale)}
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
          <CardTitle>{tr('paymentFailedToStartTitle', locale)}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">
            {errorMessage ?? tr('somethingWentWrong', locale)}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setStatus('ready')}
          >
            {tr('tryAgain', locale)}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // ── Accepting the offer failed (landr-bo0wd.5) ───────────────────────────
  if (status === 'accept_error') {
    const body =
      acceptErrorCode === 'offer_changed_since_sent' || acceptErrorCode === 'offer_not_sent'
        ? tr('offerAcceptErrorChanged', locale)
        : acceptErrorCode === 'booking_closed'
          ? tr('offerAcceptErrorClosed', locale)
          : tr('offerAcceptErrorGeneric', locale)
    const retryable = acceptErrorCode == null
    return (
      <Card data-testid="offer-accept-error">
        <CardHeader>
          <CardTitle>{tr('offerAcceptErrorTitle', locale)}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">{body}</p>
          {retryable && (
            <Button type="button" variant="outline" onClick={() => setStatus('ready')}>
              {tr('tryAgain', locale)}
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  // ── Payment mode switched away from 'online' since this link was sent ────
  // landr-k9pji.15
  if (status === 'pay_mode_not_online') {
    const body =
      notOnlineMode === 'bank_transfer'
        ? tr('payModeNotOnlineBankTransfer', locale)
        : notOnlineMode === 'on_site'
          ? tr('payModeNotOnlinePayOnSite', locale)
          : tr('payModeNotOnlineGeneric', locale)
    return (
      <Card data-testid="offer-pay-mode-not-online">
        <CardHeader>
          <CardTitle>{tr('payModeNotOnlineTitle', locale)}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">
            {offer?.payment?.bank ? tr('payModeNotOnlineGeneric', locale) : body}
          </p>
          {offer?.payment ? (
            <PaymentRails payment={offer.payment} locale={locale} cardShown={false} />
          ) : null}
        </CardContent>
      </Card>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (status === 'loading' || !offer) {
    return (
      <Card data-testid="offer-loading">
        <CardHeader>
          <CardTitle>{tr('loadingYourOffer', locale)}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{tr('pleaseWait', locale)}</p>
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
  // The booking-wide gross counts the performer money too; the totals this
  // page quotes (offer-mode Total, "total booking value") leave it out.
  const bookingTotal = totals.gross_total - (totals.performer_gross_total ?? 0)

  // landr-kcxx5.4: accepting is gated on the customer's pending forms.
  const detailsT = pickBundle(locale)
  const detailsGate =
    mode === 'offer' &&
    needsAccept &&
    pendingDetails != null &&
    collectForms(pendingDetails).length > 0

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
    : totals.net_total - (totals.performer_net_total ?? 0)
  const breakdownTax = splitAvailable
    ? (totals.operator_tax_total as number)
    : totals.tax_total - (totals.performer_tax_total ?? 0)
  const hotelAmount = totals.hotel_gross_total ?? 0
  // Name the at-hotel money only when we actually read it off the lines.
  const showHotelLine = splitAvailable && hotelAmount > 0
  // The operator share before payments/refunds/overrides. Shown only when it
  // differs from what is being charged now (a partial payment or an operator
  // price override), so the customer can see why the two differ instead of
  // the rows silently not summing.
  const operatorGross = totals.operator_gross_total
  // landr-1l6hl.5: a genuine split share only. With a special price / offer /
  // legacy override (`price_source`) the operator figures ARE the price and
  // the savings rows explain the gap, and a booking with no hotel lines has
  // no one to split with -- the row would only contradict "Amount due".
  const showOperatorGross =
    splitAvailable &&
    totals.has_hotel_lines === true &&
    !offer.price_source &&
    operatorGross != null &&
    Math.abs(operatorGross - chargeAmount) >= 0.005
  // balance_due <= 0 means this card payment is settled (fully paid, or in
  // credit) — there is nothing left for THIS LINK to collect. It does NOT
  // mean the whole booking is settled: at-hotel lines are never reflected
  // in balance_due, so money can still be owed to the hotel directly.
  const alreadySettled = mode === 'pay' && chargeAmount <= 0
  // landr-t63w0: on /pay the card button only shows when online checkout is
  // actually available. An older API (no `payment`) keeps today's button.
  const payment = mode === 'pay' || flagsPresent ? (offer.payment ?? null) : null
  const showCardCta = !payment || payment.online_available
  // landr-bo0wd.5: which action the page offers. Legacy / pay pages keep the
  // single card button; the v3 offer page adds an accept-only button and, while
  // the hotel step is pending (or the yes is still missing), no payment.
  const ctaKind: 'card' | 'accept' | 'none' = !flagsPresent
    ? showCardCta
      ? 'card'
      : 'none'
    : hotelDeclined
      ? 'none'
      : needsAccept
      ? acceptOnly
        ? 'accept'
        : 'card'
      : hotelPending
        ? 'none'
        : showCardCta
          ? 'card'
          : 'none'
  // With the split present the at-hotel row already explains the gap, so the
  // vague "Total booking value" line is only needed as the legacy fallback.
  const showTotalBookingValue =
    mode === 'pay' &&
    !alreadySettled &&
    bookingTotal !== chargeAmount &&
    !splitAvailable &&
    !offer.price_source

  // landr-1zkp7: per-line prices (absent on an older API => today's rendering)
  const allLineItems = offer.line_items ?? []
  // landr-hzovu.14: performer (pilot / guide) lines are paid on the day, never
  // part of the amount charged here -- they get their own "Paid to your
  // {payee}" block below the breakdown and stay out of every row above it.
  const performerItems = allLineItems.filter((li) => li.paid_to === 'performer')
  const lineItems = allLineItems.filter((li) => li.paid_to !== 'performer')
  const operatorLines = lineItems.filter((li) => li.paid_to !== 'hotel')
  const performerGroups = groupPerformerLines(
    performerItems.map((li) => ({
      product_id: li.product_id,
      label: li.label,
      qty: li.qty,
      units: li.units,
      unit_price: li.unit_price.toFixed(2),
      line_total: li.line_total.toFixed(2),
      paid_to: 'performer' as const,
      payee_label: li.payee_label,
      payment_note: li.payment_note,
    })),
  )
  // landr-8f1sh.4: custom offer v2. With positions the breakdown lists the
  // OFFER (not the engine's line_items, which are the regular prices) and the
  // dates table follows the booking periods. No positions => today's page.
  const positions = offer.offer_positions ?? []
  const hasPositions = positions.length > 0
  const showSavings = hasPositions && offer.show_savings !== false
  const offerDiscount = showSavings ? (offer.offer_discount ?? null) : null
  const adjustments = hasPositions ? (offer.offer_adjustments ?? null) : null
  const groupDiscountAmount = adjustments?.group_discount_amount ?? 0
  const freeSpotCount = adjustments?.free_spot_count ?? 0
  // The operator-paid lines are replaced by the positions; the hotel part
  // (read-only, never discounted) stays as its own rows.
  // landr-1l6hl.5: when the API explains the price (special price, offer
  // discount, group discount, free spots, or a legacy override), /pay shows
  // list price -> "- reason" rows -> Amount due instead of an unexplained gap.
  // `line_items` are LIST-priced; with offer positions the same list prices
  // come from `original_total`. An offer that hides its savings keeps the
  // redacted positions layout (nothing to explain, and its rows would not add
  // up against list-priced lines).
  const explained = savingRows(offer)
  const operatorListLines: OfferLineItem[] = hasPositions
    ? positions.map((p, i) => ({
        product_id: `position-${i}`,
        label: p.label,
        qty: 1,
        units: p.units,
        line_total: p.original_total,
        unit_price: p.original_total,
        paid_to: 'operator',
        participants: null,
        per_person_price: null,
      }))
    : operatorLines
  const savingsLayout =
    mode === 'pay' &&
    explained != null &&
    offer.amount_due != null &&
    operatorListLines.length > 0 &&
    !(hasPositions && !showSavings)
  const hotelListLines = lineItems.filter((li) => li.paid_to === 'hotel')
  const amountDueOffer = Number(offer.amount_due ?? 0)
  // The savings rows end at the offer price; a partial payment makes the
  // amount still due smaller, so the offer price gets its own row first.
  const showOfferPriceRow = savingsLayout && Math.abs(amountDueOffer - chargeAmount) >= 0.005
  const breakdownLines = savingsLayout
    ? operatorListLines
    : hasPositions
      ? hotelListLines
      : lineItems
  const periodRows: OfferPeriodRow[] = !hasPositions
    ? []
    : offer.periods && offer.periods.length > 0
      ? periodRowsFromApi(offer.periods)
      : derivePeriodRows(
          product_lines.map((pl, i) => ({
            name: pl.name,
            hotel: lineItemFor(lineItems, pl.product_id, i)?.paid_to === 'hotel',
            selected_days: pl.selected_days,
            date_range_start: pl.date_range_start,
            date_range_end: pl.date_range_end,
          })),
        )
  const showPeriods = periodRows.length > 0
  const lengthLabel = (count: number, nights: boolean) =>
    count > 0
      ? (nights
          ? plural(count, tr('offerLengthNightSingular', locale), tr('offerLengthNightPlural', locale))
          : plural(count, tr('offerLengthDaySingular', locale), tr('offerLengthDayPlural', locale))
        ).replace('{n}', String(count))
      : ''
  // Dates table rows: one per product line, dates collapsed into stretches.
  const itemRows = product_lines.map((pl, i) => {
    const li = lineItemFor(lineItems, pl.product_id, i)
    const ranges = lineRanges(pl)
    const hasDays = !!pl.selected_days && pl.selected_days.length > 0
    // Hotel lines carry the NIGHT window as selected_days, so count nights
    // there; nothing else on the payload identifies a room line.
    const nights = li?.paid_to === 'hotel'
    const lengthOf = (count: number) => lengthLabel(count, nights)
    let count = ranges.reduce((sum, r) => sum + r.days, 0)
    if (nights && !hasDays) count = Math.max(1, count - 1)
    // Booked on non-consecutive days: one row per stretch with its own
    // length (year only when the stretches cross a year boundary — the hero
    // already carries it), then a total row.
    const multiYear = new Set(ranges.map((r) => r.end.slice(0, 4))).size > 1
    const stretches =
      ranges.length > 1
        ? ranges.map((r) => ({
            key: r.start,
            dates: formatRange(r, locale, multiYear),
            length: lengthOf(r.days),
          }))
        : null
    return {
      pl,
      ranges,
      dates: formatRanges(ranges, locale),
      length: lengthOf(count),
      stretches,
    }
  })
  const allRanges = itemRows.flatMap((r) => r.ranges)
  const overallRange =
    allRanges.length > 0
      ? formatRanges(
          [
            {
              start: allRanges.map((r) => r.start).sort()[0]!,
              end: allRanges.map((r) => r.end).sort().slice(-1)[0]!,
            },
          ],
          locale,
        )
      : ''
  // The hero names what the customer is doing (the activity), never the room:
  // hotel lines are left out of the headline and surface as "with
  // accommodation". An older API sends no paid_to, so nothing is hotel and the
  // first line still leads; a hotel-only booking falls back to the room name.
  const isHotelLine = (pl: (typeof product_lines)[number], i: number) =>
    lineItemFor(lineItems, pl.product_id, i)?.paid_to === 'hotel'
  const heroLines = product_lines.filter((pl, i) => !isHotelLine(pl, i))
  const hasHotelLine = heroLines.length < product_lines.length
  const headlineLines = heroLines.length > 0 ? heroLines : product_lines
  const heroName = headlineLines[0]?.name ?? null
  const heroTitle =
    heroName && hasHotelLine && heroLines.length > 0
      ? `${heroName} ${tr('offerHeroWithAccommodation', locale)}`
      : heroName
  const heroSecondary =
    headlineLines.length > 1 ? headlineLines.slice(1).map((pl) => pl.name).join(' · ') : null
  const thClass =
    'px-4 py-2 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground'

  // landr-bo0wd.5: the transparent offer layout (Regular price / − Your
  // discount / Your price, free spots "on us", tax, pay-at-hotel line) for the
  // offer page. Same arithmetic as the offer email (landr-api
  // custom_offer_positions.offer_email_context): a free spot saves ONE
  // participant at the regular prices of all positions; the group discount
  // folds into "Your discount" while savings are shown.
  const EPS = 0.005
  const v3Totals = mode === 'offer' && hasPositions
  const sumOf = (f: (p: (typeof positions)[number]) => number) =>
    positions.reduce((n, p) => n + f(p), 0)
  // Position prices after the group discount: GROSS when prices include tax,
  // NET on a net-entry offer (tax added on top).
  const positionsPrice = Math.max(sumOf((p) => p.total) - groupDiscountAmount, 0)
  // "Your price" is what the customer pays online (what Stripe charges): the
  // booking's operator gross, never the position sum -- on a net-entry offer
  // that sum is net and lacks the tax. Falls back to the sum on a legacy
  // payload without the operator split.
  const opGross = totals.operator_gross_total ?? 0
  const yourPrice = opGross > 0 ? opGross : positionsPrice
  const perHeadRegular = showSavings ? sumOf((p) => p.original_unit_price * p.units) : 0
  const regularTotal = showSavings
    ? sumOf((p) => p.original_total) + freeSpotCount * perHeadRegular
    : 0
  // Regular price and discount sit on the positions' basis, so
  // Regular − Discount = positionsPrice (+ tax when it is added).
  const discountTotal = showSavings ? Math.max(regularTotal - positionsPrice, 0) : 0
  const showDiscountRows = showSavings && discountTotal > EPS
  const opNet = totals.operator_net_total ?? 0
  const opTax = totals.operator_tax_total ?? 0
  // landr-bo0wd.7: the API says whether the typed prices include tax
  // (`offer_prices_include_tax`); a net-entry offer adds the tax on top of
  // positionsPrice. An older API sends no flag: a net-entry offer is then the
  // one whose positions add up to the NET total (within a cent) while gross is
  // higher.
  const pricesIncludeTax = offer.offer_prices_include_tax
  const taxAdded =
    pricesIncludeTax === true || pricesIncludeTax === false
      ? !pricesIncludeTax && opGross - opNet > EPS
      : opGross - opNet > EPS && Math.abs(positionsPrice - opNet) < 0.015
  const taxAmount = taxAdded ? Math.max(yourPrice - positionsPrice, 0) : opTax
  const taxBase = taxAdded ? positionsPrice : opNet
  const derivedTaxPct =
    taxBase > 0 && taxAmount > 0 ? Math.round((taxAmount / taxBase) * 1000) / 10 : 0
  // The tax the operator PICKED (exact rate + name) beats the derived one.
  const offerTax = offer.offer_tax
  const taxPct = taxAmount > 0 && offerTax ? Math.round(offerTax.pct * 100) / 100 : derivedTaxPct
  const taxName = taxAmount > 0 ? (offerTax?.label ?? '').trim() : ''
  // "IVA 7%" already says the percentage: don't repeat it as "(7 %)".
  const taxShowPct =
    !taxName || !new RegExp(`(^|[^\\d.,])${String(taxPct).replace('.', '\\.')}(?!\\d)`).test(taxName)
  const taxLine = (kind: 'incl' | 'added', amount: number): string => {
    const key = taxName
      ? kind === 'incl' ? 'offerInclTaxNamedTemplate' : 'offerTaxAddedNamedTemplate'
      : kind === 'incl' ? 'offerInclTaxTemplate' : 'offerTaxAddedTemplate'
    const line = tr(key, locale)
      .replace('{a}', formatCurrency(amount, currencyCode, locale))
      .replace('{n}', taxName)
    return taxShowPct ? line.replace('{p}', String(taxPct)) : line.replace(/\s*\(\{p\} %\)/, '')
  }
  const hotelAtArrival =
    totals.hotel_gross_total ??
    lineItems.filter((li) => li.paid_to === 'hotel').reduce((n, li) => n + li.line_total, 0)

  const renderLineRow = (li: OfferLineItem, i: number, muted = false) => (
                <tr
                  key={`${li.product_id}-${i}`}
                  className={muted ? 'border-b align-top text-muted-foreground' : 'border-b align-top'}
                  data-testid="offer-line-item"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium">
                      {li.label}
                      {li.qty > 1 && (
                        <span className="ml-1 font-normal text-muted-foreground">
                          &times; {li.qty}
                        </span>
                      )}
                    </div>
                    {li.per_person_price != null && li.participants != null && li.participants > 0 && (
                      <div
                        className="text-xs text-muted-foreground tabular-nums"
                        data-testid="offer-line-per-person"
                      >
                        {formatCurrency(li.per_person_price, currencyCode, locale)}{' '}
                        {plural(
                          li.participants,
                          tr('participantSuffixSingular', locale),
                          tr('participantSuffixPlural', locale),
                        ).replace('{n}', String(li.participants))}
                      </div>
                    )}
                    {li.paid_to === 'hotel' && (
                      <div
                        className="text-xs text-muted-foreground"
                        data-testid="offer-line-hotel"
                      >
                        {tr('offerPayableAtHotelShort', locale)}
                      </div>
                    )}
                  </td>
                  <td
                    className="px-4 py-2.5 text-right tabular-nums"
                    data-testid="offer-line-total"
                  >
                    {formatCurrency(li.line_total, currencyCode, locale)}
                  </td>
                </tr>
  )

  return (
    <div data-testid="offer-ready" className="flex flex-col gap-5">
      {/* landr-1zkp7: trip-page-style hero — operator, product, overall dates */}
      {(operatorName || heroTitle) && (
        <header className="px-1" data-testid="offer-hero">
          {operatorName && (
            <p
              className="text-sm font-semibold text-muted-foreground"
              data-testid="offer-hero-operator"
            >
              {tr('offerYourTripWithTemplate', locale).replace('{operator}', operatorName)}
            </p>
          )}
          {heroTitle && (
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{heroTitle}</h1>
          )}
          {overallRange && (
            <p
              className="mt-1 font-semibold text-muted-foreground tabular-nums"
              data-testid="offer-hero-dates"
            >
              {overallRange}
            </p>
          )}
          {heroSecondary && (
            <p className="mt-1 text-sm text-muted-foreground">{heroSecondary}</p>
          )}
        </header>
      )}

        {/* landr-bo0wd.5: what the offer saves, up front */}
        {v3Totals && showDiscountRows && (
          <p
            className="px-1 text-sm font-medium text-emerald-700 dark:text-emerald-400"
            data-testid="offer-savings-intro"
          >
            {tr('offerSavingsIntroTemplate', locale).replace(
              '{x}',
              formatCurrency(discountTotal, currencyCode, locale),
            )}
          </p>
        )}

        {/* Product lines — landr-1zkp7: Item | Dates | Length table */}
        {showPeriods && (
          <OfferSection
            title={tr('whatYoureBooking', locale)}
            ariaLabel={tr('productsAria', locale)}
          >
            <table className="w-full text-sm" data-testid="offer-periods-table">
              <thead>
                <tr className="border-b">
                  <th scope="col" className={thClass}>{tr('offerColPeriod', locale)}</th>
                  <th scope="col" className={thClass}>{tr('offerColDates', locale)}</th>
                  <th scope="col" className={thClass}>{tr('offerColLength', locale)}</th>
                </tr>
              </thead>
              <tbody>
                {periodRows.map((row, i) => (
                  <tr
                    key={`${row.kind}-${row.start}-${i}`}
                    data-testid="offer-period-row"
                    data-kind={row.kind}
                    className="border-b align-top last:border-b-0"
                  >
                    <th scope="row" className="px-4 py-3 text-left font-semibold">
                      {row.kind === 'arrival'
                        ? tr('offerPeriodArrival', locale)
                        : row.kind === 'departure'
                          ? tr('offerPeriodDeparture', locale)
                          : row.name}
                    </th>
                    <td
                      className="px-4 py-3 text-muted-foreground tabular-nums"
                      data-testid="offer-period-dates"
                    >
                      {formatRanges([row], locale)}
                    </td>
                    <td
                      className="whitespace-nowrap px-4 py-3 text-muted-foreground tabular-nums"
                      data-testid="offer-period-length"
                    >
                      {lengthLabel(row.count, row.nights) || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </OfferSection>
        )}

        {product_lines.length > 0 && !showPeriods && (
          <OfferSection
            title={tr('whatYoureBooking', locale)}
            ariaLabel={tr('productsAria', locale)}
          >
            <table className="w-full text-sm" data-testid="offer-items-table">
              <thead>
                <tr className="border-b">
                  <th scope="col" className={thClass}>{tr('offerColItem', locale)}</th>
                  <th scope="col" className={thClass}>{tr('offerColDates', locale)}</th>
                  <th scope="col" className={thClass}>{tr('offerColLength', locale)}</th>
                </tr>
              </thead>
              <tbody>
                {itemRows.map(({ pl, dates, length, stretches }, i) => {
                  const name = (
                    <>
                      {pl.name}
                      {pl.quantity > 1 && (
                        <span className="ml-1 font-normal text-muted-foreground">
                          &times; {pl.quantity}
                        </span>
                      )}
                    </>
                  )
                  if (stretches) {
                    return (
                      <Fragment key={`${pl.product_id}-${i}`}>
                        <tr data-testid="offer-product-line">
                          <th
                            scope="rowgroup"
                            colSpan={3}
                            className="px-4 pt-3 pb-1 text-left font-semibold"
                          >
                            {name}
                          </th>
                        </tr>
                        {stretches.map((st) => (
                          <tr key={st.key} data-testid="offer-line-stretch">
                            <td aria-hidden="true" className="px-4 py-1" />
                            <td
                              className="px-4 py-1 text-muted-foreground tabular-nums"
                              data-testid="offer-stretch-dates"
                            >
                              {st.dates}
                            </td>
                            <td
                              className="whitespace-nowrap px-4 py-1 text-muted-foreground tabular-nums"
                              data-testid="offer-stretch-length"
                            >
                              {st.length}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-b last:border-b-0">
                          <td aria-hidden="true" className="px-4 pt-1 pb-3" />
                          <td className="px-4 pt-1 pb-3 font-semibold">
                            {tr('offerLengthTotalLabel', locale)}
                          </td>
                          <td
                            className="whitespace-nowrap px-4 pt-1 pb-3 font-semibold tabular-nums"
                            data-testid="offer-line-length"
                          >
                            {length || '—'}
                          </td>
                        </tr>
                      </Fragment>
                    )
                  }
                  return (
                    <tr
                      key={`${pl.product_id}-${i}`}
                      data-testid="offer-product-line"
                      className="border-b align-top last:border-b-0"
                    >
                      <th scope="row" className="px-4 py-3 text-left font-semibold">
                        {name}
                      </th>
                      <td className="px-4 py-3 text-muted-foreground" data-testid="offer-line-dates">
                        {dates || '—'}
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-3 text-muted-foreground tabular-nums"
                        data-testid="offer-line-length"
                      >
                        {length || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </OfferSection>
        )}

        {/* Participants */}
        {participants.length > 0 && (
          <OfferSection title={tr('offerParticipantsTitle', locale)}>
            <ul className="flex flex-col divide-y text-sm">
              {participants.map((p, i) => (
                <li key={i} data-testid="offer-participant" className="px-4 py-2.5">
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
          </OfferSection>
        )}

        {/* Price breakdown */}
        <OfferSection title={tr('offerPriceBreakdownTitle', locale)}>
          <table className="w-full text-sm">
            <tbody>
              {/* landr-1zkp7: one row per priced line — label, per-person
                  price × participants when the API priced it per head, line
                  total. Money semantics below (subtotal / tax / amount due)
                  are untouched. Absent line_items => today's rendering. */}
              {/* landr-8f1sh.4: the OFFER's positions — label, €/day × people
                  (the offer price; the regular one struck through when the
                  operator shows the discount), line total. */}
              {(savingsLayout ? [] : positions).map((p, i) => {
                const saved = hasSaving(p, showSavings)
                return (
                  <tr
                    key={`position-${i}`}
                    className="border-b align-top"
                    data-testid="offer-position"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{p.label}</div>
                      {/* A flat 1 × 1 position (e.g. a video package) needs
                          no "€50/day × 1 day × 1 participant" sub-line — the
                          total column already says it all. */}
                      {p.units > 1 || p.participants > 1 ? (
                      <div
                        className="text-xs text-muted-foreground tabular-nums"
                        data-testid="offer-position-per-day"
                      >
                        {saved && (
                          <span
                            className="mr-1 line-through"
                            data-testid="offer-position-original-unit"
                          >
                            {formatCurrency(p.original_unit_price, currencyCode, locale)}
                          </span>
                        )}
                        {formatCurrency(p.unit_price, currencyCode, locale)}
                        {tr('offerPerDaySuffix', locale)} ×{' '}
                        {plural(
                          p.units,
                          tr('offerLengthDaySingular', locale),
                          tr('offerLengthDayPlural', locale),
                        ).replace('{n}', String(p.units))}{' '}
                        {plural(
                          p.participants,
                          tr('participantSuffixSingular', locale),
                          tr('participantSuffixPlural', locale),
                        ).replace('{n}', String(p.participants))}
                      </div>
                      ) : null}
                      {saved && (
                        <div
                          className="mt-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                          data-testid="offer-position-saving"
                        >
                          {p.units > 1 || p.participants > 1
                            ? tr('offerYouSavePerDayTemplate', locale)
                                .replace(
                                  '{a}',
                                  formatCurrency(p.original_unit_price - p.unit_price, currencyCode, locale),
                                )
                                .replace(
                                  '{b}',
                                  formatCurrency(p.original_total - p.total, currencyCode, locale),
                                )
                            : tr('offerYouSaveTemplate', locale).replace(
                                '{b}',
                                formatCurrency(p.original_total - p.total, currencyCode, locale),
                              )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {saved && (
                        <div
                          className="text-xs text-muted-foreground line-through"
                          data-testid="offer-position-original-total"
                        >
                          {formatCurrency(p.original_total, currencyCode, locale)}
                        </div>
                      )}
                      <div data-testid="offer-position-total">
                        {formatCurrency(p.total, currencyCode, locale)}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {v3Totals ? (
                <>
                  {Array.from({ length: freeSpotCount }, (_, i) => (
                    <tr
                      key={`free-spot-${i}`}
                      className="border-b bg-emerald-50/70 align-top dark:bg-emerald-950/30"
                      data-testid="offer-free-spot"
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{tr('offerFreeSpotLabel', locale)}</div>
                        <div
                          className="text-xs text-emerald-700 dark:text-emerald-400"
                          data-testid="offer-free-spot-note"
                        >
                          {perHeadRegular > 0
                            ? tr('offerRegularOnUsTemplate', locale).replace(
                                '{x}',
                                formatCurrency(perHeadRegular, currencyCode, locale),
                              )
                            : tr('offerOnUs', locale)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatCurrency(0, currencyCode, locale)}
                      </td>
                    </tr>
                  ))}
                  {showDiscountRows ? (
                    <>
                      <tr>
                        <td className="px-4 pt-2 pb-1 text-muted-foreground">
                          {tr('offerRegularPriceLabel', locale)}
                        </td>
                        <td
                          className="px-4 pt-2 pb-1 text-right tabular-nums text-muted-foreground"
                          data-testid="offer-regular-total"
                        >
                          {formatCurrency(regularTotal, currencyCode, locale)}
                        </td>
                      </tr>
                      <tr
                        className="font-medium text-emerald-700 dark:text-emerald-400"
                        data-testid="offer-discount"
                      >
                        <td className="px-4 py-1">− {offer.price_source === 'special_price'
                            ? tr('savingSpecialPriceLabel', locale)
                            : tr('offerDiscountLabel', locale)}</td>
                        <td
                          className="px-4 py-1 text-right tabular-nums"
                          data-testid="offer-discount-amount"
                        >
                          −{formatCurrency(discountTotal, currencyCode, locale)}
                        </td>
                      </tr>
                    </>
                  ) : groupDiscountAmount > 0 ? (
                    <tr
                      className="text-emerald-700 dark:text-emerald-400"
                      data-testid="offer-group-discount"
                    >
                      <td className="px-4 py-1">
                        −{' '}
                        {tr('offerGroupDiscountTemplate', locale).replace(
                          '{pct}',
                          String(Math.round((adjustments?.group_discount_pct ?? 0) * 1000) / 10),
                        )}
                      </td>
                      <td className="px-4 py-1 text-right tabular-nums">
                        −{formatCurrency(groupDiscountAmount, currencyCode, locale)}
                      </td>
                    </tr>
                  ) : null}
                  {taxAdded && taxPct > 0 && (
                    <>
                      <tr>
                        <td className="px-4 pt-2 pb-1 text-muted-foreground">
                          {tr('offerPriceExclTaxLabel', locale)}
                        </td>
                        <td
                          className="px-4 pt-2 pb-1 text-right tabular-nums text-muted-foreground"
                          data-testid="offer-net-price"
                        >
                          {formatCurrency(positionsPrice, currencyCode, locale)}
                        </td>
                      </tr>
                      <tr>
                        <td
                          colSpan={2}
                          className="px-4 pb-1 text-right text-muted-foreground tabular-nums"
                          data-testid="offer-tax-added"
                        >
                          {taxLine('added', taxAmount)}
                        </td>
                      </tr>
                    </>
                  )}
                  <tr className="border-t">
                    <td className="px-4 py-2 text-base font-semibold">
                      {tr('offerYourPriceLabel', locale)}
                    </td>
                    <td
                      className="px-4 py-2 text-right text-base font-bold tabular-nums"
                      data-testid="offer-gross-total"
                    >
                      {formatCurrency(yourPrice, currencyCode, locale)}
                    </td>
                  </tr>
                  {!taxAdded && taxPct > 0 && (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-4 pb-1 text-right text-xs text-muted-foreground tabular-nums"
                        data-testid="offer-tax-included"
                      >
                        {taxLine('incl', taxAmount)}
                      </td>
                    </tr>
                  )}
                  {hotelAtArrival > 0 && (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-4 pb-3 text-right text-sm text-muted-foreground tabular-nums"
                        data-testid="offer-hotel-due"
                      >
                        {tr('offerPaidAtHotelTemplate', locale).replace(
                          '{a}',
                          formatCurrency(hotelAtArrival, currencyCode, locale),
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ) : (
                <>
              {!savingsLayout && offerDiscount && offerDiscount.amount > 0 && (
                <tr
                  className="text-emerald-700 dark:text-emerald-400"
                  data-testid="offer-discount"
                >
                  <td className="px-4 py-1">− {tr('offerDiscountLabel', locale)}</td>
                  <td
                    className="px-4 py-1 text-right tabular-nums"
                    data-testid="offer-discount-amount"
                  >
                    −{formatCurrency(offerDiscount.amount, currencyCode, locale)}
                  </td>
                </tr>
              )}
              {!savingsLayout && groupDiscountAmount > 0 && (
                <tr
                  className="text-emerald-700 dark:text-emerald-400"
                  data-testid="offer-group-discount"
                >
                  <td className="px-4 py-1">
                    −{' '}
                    {tr('offerGroupDiscountTemplate', locale).replace(
                      '{pct}',
                      String(Math.round((adjustments?.group_discount_pct ?? 0) * 1000) / 10),
                    )}
                  </td>
                  <td className="px-4 py-1 text-right tabular-nums">
                    −{formatCurrency(groupDiscountAmount, currencyCode, locale)}
                  </td>
                </tr>
              )}
              {!savingsLayout && freeSpotCount > 0 && (
                <tr data-testid="offer-free-spots">
                  <td className="px-4 py-1 text-muted-foreground">
                    {tr('offerFreeSpotsTemplate', locale).replace('{n}', String(freeSpotCount))}
                  </td>
                  <td className="px-4 py-1 text-right tabular-nums text-muted-foreground">
                    {tr('offerFreeLabel', locale)}
                  </td>
                </tr>
              )}
              {breakdownLines.map((li, i) => renderLineRow(li, i))}
              {savingsLayout && explained ? (
                <>
                  {operatorListLines.length > 1 && (
                    <tr data-testid="offer-subtotal">
                      <td className="px-4 py-1 text-muted-foreground">
                        {tr('offerSubtotalLabel', locale)}
                      </td>
                      <td className="px-4 py-1 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(Number(explained.subtotal), currencyCode, locale)}
                      </td>
                    </tr>
                  )}
                  {explained.rows.map((row, i) => (
                    <tr
                      key={`${row.kind}-${i}`}
                      className="text-emerald-700 dark:text-emerald-400"
                      data-testid="offer-saving"
                      data-kind={row.kind}
                    >
                      <td className="px-4 py-1">
                        <DescribedLabel
                          text={savingLabel(row, locale)}
                          description={row.description}
                          testId="offer-saving-label"
                        />
                      </td>
                      <td
                        className="px-4 py-1 text-right tabular-nums"
                        data-testid="offer-saving-amount"
                      >
                        −{formatCurrency(Number(row.amount), currencyCode, locale)}
                      </td>
                    </tr>
                  ))}
                  {showOfferPriceRow && (
                    <tr className="border-t" data-testid="offer-price-after-savings">
                      <td className="px-4 py-1 text-muted-foreground">
                        {tr('offerTotalLabel', locale)}
                      </td>
                      <td className="px-4 py-1 text-right tabular-nums">
                        {formatCurrency(amountDueOffer, currencyCode, locale)}
                      </td>
                    </tr>
                  )}
                </>
              ) : (
                <>
                  <tr>
                    <td className="px-4 py-1 text-muted-foreground">{tr('offerSubtotalLabel', locale)}</td>
                    <td className="px-4 py-1 text-right tabular-nums" data-testid="offer-net-total">
                      {formatCurrency(breakdownNet, currencyCode, locale)}
                    </td>
                  </tr>
                  {breakdownTax > 0 && (
                    <tr>
                      <td className="px-4 py-1 text-muted-foreground">{tr('taxLabel', locale)}</td>
                      <td className="px-4 py-1 text-right tabular-nums" data-testid="offer-tax-total">
                        {formatCurrency(breakdownTax, currencyCode, locale)}
                      </td>
                    </tr>
                  )}
                </>
              )}
              {mode === 'pay' ? (
                <>
                  {/* landr-yimp: the charged amount is the headline figure
                      in pay mode — mirrors booking_payment_link_en's
                      "Amount due" row word-for-word. */}
                  <tr className="border-t">
                    <td className="px-4 py-1.5 font-semibold">{tr('amountDueLabel', locale)}</td>
                    <td
                      className="px-4 py-1.5 text-right tabular-nums font-semibold"
                      data-testid="offer-balance-due"
                    >
                      {alreadySettled
                        ? tr('nothingDueNow', locale)
                        : formatCurrency(chargeAmount, currencyCode, locale)}
                    </td>
                  </tr>
                  {/* landr-k9pji.5 — deposit_percent operators: `amount` from
                      the initiate call the customer just previewed, below
                      the full balance above it (which stays visible as the
                      whole booking's due amount, unchanged). */}
                  {depositPreview && (
                    <tr data-testid="offer-deposit-amount">
                      <td className="px-4 py-1 text-muted-foreground">
                        {tr('depositLabelTemplate', locale).replace(
                          '{n}',
                          String(Math.round((depositPreview.amount / chargeAmount) * 100)),
                        )}
                      </td>
                      <td
                        className="px-4 py-1 text-right tabular-nums"
                        data-testid="offer-deposit-amount-value"
                      >
                        {formatCurrency(depositPreview.amount, currencyCode, locale)}
                      </td>
                    </tr>
                  )}
                  {showOperatorGross && (
                    <tr>
                      <td className="px-4 py-1 text-muted-foreground">
                        {tr('yourShareOfThisBooking', locale)}
                      </td>
                      <td
                        className="px-4 py-1 text-right tabular-nums text-muted-foreground"
                        data-testid="offer-operator-gross-total"
                      >
                        {formatCurrency(
                          operatorGross as number,
                          currencyCode,
                          locale,
                        )}
                      </td>
                    </tr>
                  )}
                  {savingsLayout && taxAmount > 0 && taxPct > 0 && (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-4 pb-1 text-right text-xs text-muted-foreground tabular-nums"
                        data-testid="offer-tax-included"
                      >
                        {taxLine('incl', taxAmount)}
                      </td>
                    </tr>
                  )}
                  {savingsLayout &&
                    hotelListLines.map((li, i) => renderLineRow(li, i, true))}
                  {showTotalBookingValue && (
                    <tr>
                      <td className="px-4 py-1 text-muted-foreground">
                        {tr('totalBookingValueLabel', locale)}
                      </td>
                      <td
                        className="px-4 py-1 text-right tabular-nums text-muted-foreground"
                        data-testid="offer-gross-total"
                      >
                        {formatCurrency(bookingTotal, currencyCode, locale)}
                      </td>
                    </tr>
                  )}
                </>
              ) : (
                <>
                  <tr className="border-t">
                    <td className="px-4 py-1.5 font-semibold">{tr('offerTotalLabel', locale)}</td>
                    <td
                      className="px-4 py-1.5 text-right tabular-nums font-semibold"
                      data-testid="offer-gross-total"
                    >
                      {formatCurrency(bookingTotal, currencyCode, locale)}
                    </td>
                  </tr>
                  {totals.balance_due !== bookingTotal && (
                    <tr>
                      <td className="px-4 py-1 text-muted-foreground">
                        {tr('amountDueNowLabel', locale)}
                      </td>
                      <td
                        className="px-4 py-1 text-right tabular-nums"
                        data-testid="offer-balance-due"
                      >
                        {formatCurrency(totals.balance_due, currencyCode, locale)}
                      </td>
                    </tr>
                  )}
                </>
              )}
                </>
              )}
            </tbody>
          </table>
          {showTotalBookingValue && (
            <p
              className="px-4 pb-3 text-xs text-muted-foreground"
              data-testid="offer-total-booking-value-note"
            >
              {tr('totalBookingValueNote', locale)}
            </p>
          )}
          {/* landr-gkj0: with the per-line split available we can finally
              state the at-hotel amount as a fact rather than hinting at a
              gap. Kept OUT of the table above so it reads as a separate
              obligation, not another row of the sum being charged. */}
          {showHotelLine && (
            <div
              className="mx-4 mb-4 mt-3 rounded-md border border-dashed px-3 py-2"
              data-testid="offer-hotel-due"
            >
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span className="text-muted-foreground">
                  {tr('payableDirectlyToHotel', locale)}
                </span>
                <span className="font-medium">
                  {formatCurrency(hotelAmount, currencyCode, locale)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {tr('hotelSettledAtCheckin', locale)}
              </p>
            </div>
          )}
          {/* landr-hzovu.14: money handed to the pilot / guide on the day --
              outside the amount charged here, like the at-hotel block. */}
          {performerGroups.length > 0 && (
            <div className="mx-4 mb-4 mt-3 flex flex-col gap-2" data-testid="offer-performer-due">
              <PerformerPaySections
                groups={performerGroups}
                currency={currencyCode}
                testIdPrefix="offer"
              />
            </div>
          )}
        </OfferSection>

        <OfferSection
          title={
            mode === 'pay'
              ? tr('completeYourPayment', locale)
              : flagsPresent && !requiresAcceptance
                ? tr('offerAgreedTitle', locale)
                : tr('yourCustomOffer', locale)
          }
          testId="offer-payment-section"
        >
          <div className="flex flex-col gap-4 p-4">
            {/* landr-esd3: pay mode swaps the title/description copy only —
                everything else (totals table, CTA, initiatePayment) is shared. */}
            <p className="text-sm text-muted-foreground" data-testid="offer-description">
              {mode === 'pay'
                ? tr('payModeDescription', locale)
                : !flagsPresent
                  ? tr('offerModeDescription', locale)
                  : !requiresAcceptance
                    ? tr('offerAgreedDescription', locale)
                    : hotelDeclined
                      ? tr('offerHotelDeclinedBody', locale)
                      : accepted
                      ? tr('offerAcceptedDescription', locale)
                      : hotelPending
                        ? tr('offerReviewHotelDescription', locale)
                        : acceptOnly
                          ? tr('offerReviewAcceptDescription', locale)
                          : tr('offerModeDescription', locale)}
            </p>
            {/* landr-bo0wd.5: the hotel step is never skipped -- say so, and
                when the payment link follows. */}
            {hotelPending && (
              <div
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
                data-testid="offer-hotel-note"
              >
                <p className="font-semibold">{tr('offerHotelNote', locale)}</p>
                <p className="mt-0.5">
                  {needsAccept
                    ? tr('offerHotelNoteAfterAccept', locale)
                    : tr('offerHotelNoteNow', locale)}
                </p>
              </div>
            )}
            {/* landr-xcyh1.3: the hotel said yes -- "Hotel confirmed". */}
            {hotelConfirmed && (
              <div
                className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-100"
                data-testid="offer-hotel-confirmed"
              >
                <p className="font-semibold">{tr('offerHotelConfirmed', locale)}</p>
                <p className="mt-0.5">
                  {needsAccept
                    ? tr('offerHotelConfirmedAfterAccept', locale)
                    : tr('offerHotelConfirmedAccepted', locale)}
                </p>
              </div>
            )}
            {/* landr-xcyh1.3: the hotel declined; the operator updates the offer. */}
            {hotelDeclined && (
              <div
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
                data-testid="offer-hotel-declined"
              >
                <p className="font-semibold">{tr('offerHotelDeclined', locale)}</p>
              </div>
            )}
            {offer.stage ? (
              <p
                className="text-sm text-muted-foreground"
                data-testid="offer-stage-label"
              >
                {tr('statusLabel', locale)} {resolveCustomerStageLabel(offer.stage, locale)}
              </p>
            ) : null}

        {/* landr-k9pji.5 — only reachable once depositPreview is set (see
            onAcceptAndPay); explains why the CTA below no longer says the
            full "Amount due" figure. */}
        {depositPreview && (
          <p
            className="text-xs text-muted-foreground"
            data-testid="offer-deposit-remainder-note"
          >
            {tr('depositRemainderNote', locale)}
          </p>
        )}

        {/* landr-t63w0: bank details + pay-on-site hint (pay mode only) */}
        {payment && !alreadySettled && !hotelPending && !hotelDeclined && !needsAccept ? (
          <PaymentRails
            payment={payment}
            locale={locale}
            cardShown={showCardCta}
          />
        ) : null}

        {/* landr-kcxx5.4: details first -- Save PUTs them, then accepts. */}
        {detailsGate && pendingDetails ? (
          <div className="flex flex-col gap-3" data-testid="offer-details-gate">
            <p className="text-sm text-muted-foreground">
              {operatorName
                ? fmt(detailsT.detailsInlineIntro, { operator: operatorName })
                : detailsT.detailsInlineIntroNoOperator}
            </p>
            <CustomerDetailsForm
              token={token}
              details={pendingDetails}
              submitLabel={detailsT.detailsSubmitAndAccept}
              onSaved={() => {
                setPendingDetails(null)
                void onAcceptAndPay()
              }}
            />
          </div>
        ) : null}

        {/* CTA */}
        {ctaKind !== 'none' && !detailsGate && (
        <Button
          type="button"
          className="w-full sm:w-auto"
          onClick={() => {
            if (depositPreview) {
              onContinueToStripe()
              return
            }
            void onAcceptAndPay()
          }}
          disabled={busy || alreadySettled}
          data-testid="offer-accept-pay-btn"
        >
          {alreadySettled
            ? tr('nothingToPay', locale)
            : ctaKind === 'accept'
              ? busy
                ? tr('offerAcceptingEllipsis', locale)
                : tr('offerAcceptLabel', locale)
              : busy
                ? tr('redirectingToPaymentEllipsis', locale)
                : depositPreview
                  ? tr('continueToStripeLabel', locale)
                  : mode === 'pay' || (flagsPresent && !needsAccept)
                    ? tr('payNowLabel', locale)
                    : tr('acceptAndPayLabel', locale)}
        </Button>
        )}

        {ctaKind !== 'none' && !detailsGate && (
        <p className="text-xs text-muted-foreground">
          {alreadySettled
            ? // landr-yimp review round 2: balance_due <= 0 only means this
              // card payment is settled — at-hotel lines never enter
              // balance_due, so the booking as a whole can still have money
              // owed directly to the hotel. Don't claim "paid in full".
              tr('nothingFurtherToPay', locale)
            : mode === 'pay'
              ? tr('paymentLinkPersonal', locale)
              : tr('offerLinkPersonal', locale)}
        </p>
        )}
          </div>
        </OfferSection>
    </div>
  )
}
