import { useState, type FormEvent } from 'react'

import { HttpError, initiateSubscriptionCheckout } from '@/api/client'
import type { Product } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StepBackButton } from './StepBackButton'

/**
 * "Become a member" checkout CTA for subscription-kind products (landr-1kk.5).
 *
 * Rendered instead of ShopComingSoonStub when product.product_kind ===
 * 'subscription' — the one non-service kind the widget DOES take checkout
 * for. Collects email (+ optional name), calls
 * POST /api/public/subscriptions/checkout
 * (landr-api app/routers/public_subscriptions.py), and hard-navigates to the
 * returned Stripe Checkout URL — the same caller-redirects-to-checkout_url
 * contract OfferPage's Accept & Pay already uses for one-off booking
 * payments.
 *
 * Gating (AC #1): there is deliberately NO package/feature check in this
 * component. A subscription-kind product can only exist at all if the
 * operator's subscription_package.allowed_product_kinds included
 * 'subscription' at PRODUCT-CREATE time — landr-api's
 * app/routers/staff_products.py enforces that server-side (defence-in-depth
 * comment there). So any subscription product this component ever receives
 * already belongs to an entitled operator; that IS "gated the same way as
 * the existing product-listing gate."
 *
 * Return handling: return_url/cancel_url both point back at THIS widget
 * instance's CURRENT url (preserving ?w=/?product=/etc — see
 * `memberReturnUrl` below), the way OfferPage's `_returnBase()` does for the
 * booking-payment flow, just query-flagged with `member=` instead of
 * `paid=` since this isn't a token-addressed page. App.tsx intercepts BOTH
 * `member=1` (return_url) and `member=cancelled` (cancel_url) before the
 * normal booking flow mounts and renders MembershipReturnPage — mirrors
 * OfferPage's `?paid=1` / `?paid=cancelled` pair exactly. Its "Continue
 * browsing" button (cancelled state) strips `member` and reloads; landr-2mgl's
 * sessionStorage restore (App.tsx's `writeStoredProgress` effect, which
 * persists this exact pick-selection step on every render) then lands the
 * customer back on the SAME product view — which is precisely the ticket's
 * "cancel_url back to the product view, no error state" requirement, with no
 * bespoke navigation needed beyond that one param strip.
 *
 * Failure modes (AC #4), mapped from the endpoint's documented responses:
 *   - 404 `{"error": "subscription_not_found"}` — deliberately generic
 *     (unknown widget_token OR no such subscription product for this
 *     operator; anti-enumeration). Shown as a plain "unavailable" card, body
 *     never echoed.
 *   - 429 — rate limited (`subcheckout:` namespaced quota). Shown as a
 *     "try again in a few minutes" card.
 *   - 422 — bad email / missing field. Caught client-side FIRST by the
 *     email-format check below; a 422 that still reaches the network (e.g. a
 *     race with a field the client doesn't validate) falls into the same
 *     generic error card as any other unexpected status — never leaks the
 *     response body.
 */

type Status = 'form' | 'submitting' | 'error'
type ErrorKind = 'not_found' | 'rate_limited' | 'generic'

interface Props {
  product: Product
  onBack: () => void
  widgetToken: string
}

const ERROR_COPY: Record<ErrorKind, { title: string; body: string }> = {
  not_found: {
    title: 'Membership unavailable',
    body: 'This membership option is not available right now. Please contact the operator directly.',
  },
  rate_limited: {
    title: 'Too many attempts',
    body: 'Please wait a few minutes and try again.',
  },
  generic: {
    title: 'Something went wrong',
    body: 'We could not start checkout. Please try again or contact the operator.',
  },
}

/** Current widget URL + `member=<flag>`, preserving every other query param
 * (?w=, ?product=, …) the same way OfferPage's `_returnBase()` preserves the
 * token-bearing path. */
function memberReturnUrl(flag: '1' | 'cancelled'): string {
  if (typeof window === 'undefined') return ''
  const url = new URL(window.location.href)
  url.searchParams.set('member', flag)
  return url.toString()
}

export function MembershipCheckoutStep({ product, onBack, widgetToken }: Props) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [status, setStatus] = useState<Status>('form')
  const [errorKind, setErrorKind] = useState<ErrorKind>('generic')

  const trimmedEmail = email.trim()
  const emailInvalid = !trimmedEmail || !trimmedEmail.includes('@')
  const emailError =
    emailTouched && emailInvalid ? 'Enter a valid email address' : undefined

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setEmailTouched(true)
    if (emailInvalid) return

    setStatus('submitting')
    try {
      const resp = await initiateSubscriptionCheckout({
        widget_token: widgetToken,
        product_id: product.product_id,
        email: trimmedEmail,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        return_url: memberReturnUrl('1'),
        cancel_url: memberReturnUrl('cancelled'),
      })
      // Hard-navigate to Stripe Checkout.
      if (typeof window !== 'undefined') {
        window.location.href = resp.checkout_url
      }
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) {
        setErrorKind('not_found')
      } else if (err instanceof HttpError && err.status === 429) {
        setErrorKind('rate_limited')
      } else {
        setErrorKind('generic')
      }
      setStatus('error')
    }
  }

  if (status === 'error') {
    const { title, body } = ERROR_COPY[errorKind]
    return (
      <Card data-testid="membership-checkout-error">
        <StepBackButton onBack={onBack} label="Back to products" />
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{body}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => setStatus('form')}
            data-testid="membership-checkout-retry-btn"
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  const busy = status === 'submitting'

  return (
    <Card data-testid="membership-checkout-form">
      <StepBackButton onBack={onBack} label="Back to products" />
      <CardHeader>
        <CardTitle>Become a member</CardTitle>
        <CardDescription>
          Join {product.name} — you'll be redirected to our secure payment
          provider to complete your membership.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            void onSubmit(e)
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="membership-email" className="text-xs">
              Email
            </Label>
            <Input
              id="membership-email"
              name="membership_email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              aria-invalid={!!emailError}
              disabled={busy}
            />
            {emailError ? (
              <p className="text-xs text-destructive" data-testid="membership-email-error">
                {emailError}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="membership-first-name" className="text-xs">
                First name (optional)
              </Label>
              <Input
                id="membership-first-name"
                name="membership_first_name"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="membership-last-name" className="text-xs">
                Last name (optional)
              </Label>
              <Input
                id="membership-last-name"
                name="membership_last_name"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={busy}
            data-testid="membership-checkout-submit-btn"
          >
            {busy ? 'Redirecting to payment…' : 'Become a member'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
