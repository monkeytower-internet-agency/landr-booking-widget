import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * Stripe return page for the "become a member" checkout flow (landr-1kk.5).
 *
 * Rendered by App.tsx (before the normal booking flow mounts) when
 * `?member=1` or `?member=cancelled` is present on the widget's base URL.
 * MembershipCheckoutStep builds both from the CURRENT location — preserving
 * `?w=`/`?product=` — before redirecting to Stripe Checkout, the same way
 * OfferPage's `_returnBase()` builds its `?paid=1` / `?paid=cancelled` pair
 * for the one-off booking-payment flow.
 *
 * status='success' MUST NOT poll for or assert an active membership:
 * `subscription_holders`
 * is written ASYNCHRONOUSLY by `apply_subscription_billing_event`, off the
 * `checkout.session.completed` webhook — `POST
 * /api/public/subscriptions/checkout` (public_subscriptions.py) itself
 * "WRITES NOTHING TO THE DATABASE" per its own docstring. By the time
 * Stripe redirects the browser back here, the webhook may not have fired
 * yet (it can lag up to Stripe's retry window on a bad day). This page can
 * only honestly say activation is IN PROGRESS.
 */

interface Props {
  status: 'success' | 'cancelled'
}

export function MembershipReturnPage({ status }: Props) {
  if (status === 'success') {
    return (
      <Card data-testid="membership-return-success">
        <CardHeader>
          <CardTitle>You're on your way to becoming a member</CardTitle>
          <CardDescription>
            Your membership is being activated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Thank you! We received your payment and your membership is being
            set up now. You'll get a confirmation email as soon as it's
            active — this is usually quick, but please don't refresh this
            page waiting for it to change.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-testid="membership-return-cancelled">
      <CardHeader>
        <CardTitle>Checkout cancelled</CardTitle>
        <CardDescription>You have not been charged.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm">
          You left checkout without completing your membership. No payment
          was taken — you can try again any time.
        </p>
        <Button
          type="button"
          onClick={() => {
            if (typeof window === 'undefined') return
            // Strip `member` and reload: landr-2mgl's sessionStorage
            // restore (App.tsx) takes it from there, landing back on the
            // exact product view the customer was on.
            const url = new URL(window.location.href)
            url.searchParams.delete('member')
            window.location.href = url.toString()
          }}
          data-testid="membership-return-continue-btn"
        >
          Continue browsing
        </Button>
      </CardContent>
    </Card>
  )
}
