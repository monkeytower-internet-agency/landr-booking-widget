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
import { HelpDisclosure } from './HelpDisclosure'
import { NextAction } from './NextAction'
import { OptionalReveal } from './OptionalReveal'
import { StepBackButton } from './StepBackButton'
import { browserLocale } from '@/lib/locale'
import { tr } from '@/lib/strings'

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
  /** Absent → no Back affordance (landr-6eita.1: start=dates entry). */
  onBack?: () => void
  widgetToken: string
}

function errorCopy(kind: ErrorKind, locale?: string): { title: string; body: string } {
  switch (kind) {
    case 'not_found':
      return { title: tr('membershipUnavailableTitle', locale), body: tr('membershipUnavailableBody', locale) }
    case 'rate_limited':
      return { title: tr('tooManyAttemptsTitle', locale), body: tr('tooManyAttemptsBody', locale) }
    case 'generic':
      return { title: tr('somethingWentWrong', locale).replace(/\.$/, ''), body: tr('membershipGenericErrorBody', locale) }
  }
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

  const locale = browserLocale()
  const trimmedEmail = email.trim()
  const emailInvalid = !trimmedEmail || !trimmedEmail.includes('@')
  const emailError =
    emailTouched && emailInvalid ? tr('enterValidEmail', locale) : undefined

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
    const { title, body } = errorCopy(errorKind, locale)
    return (
      <Card data-testid="membership-checkout-error">
        <StepBackButton onBack={onBack} label={tr('backToProductsLabel', locale)} />
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
            {tr('tryAgain', locale)}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const busy = status === 'submitting'

  return (
    <Card data-testid="membership-checkout-form">
      <StepBackButton onBack={onBack} label={tr('backToProductsLabel', locale)} />
      <CardHeader>
        <CardTitle>{tr('becomeAMember', locale)}</CardTitle>
        <CardDescription>{product.name}</CardDescription>
      </CardHeader>
      <CardContent>
        <HelpDisclosure>
          <p>{tr('membershipRedirectHelp', locale)}</p>
        </HelpDisclosure>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            void onSubmit(e)
          }}
        >
          <NextAction active={emailInvalid} cue={tr('enterYourEmailCue', locale)}>
            <div className="flex flex-col gap-1">
              <Label htmlFor="membership-email" className="text-xs">
                {tr('emailLabel', locale)}
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
          </NextAction>

          <OptionalReveal
            thing={tr('yourNameThing', locale)}
            hasValue={firstName.trim() !== '' || lastName.trim() !== ''}
            data-testid="membership-name-reveal"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="membership-first-name" className="text-xs">
                  {tr('firstNameLabel', locale)} {tr('optionalSuffix', locale)}
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
                  {tr('lastNameLabel', locale)} {tr('optionalSuffix', locale)}
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
          </OptionalReveal>

          <NextAction active={!emailInvalid && !busy} cue={tr('becomeAMemberCue', locale)} className="mt-2">
            <Button
              type="submit"
              disabled={busy}
              data-testid="membership-checkout-submit-btn"
            >
              {busy ? tr('redirectingToPaymentDots', locale) : tr('becomeAMember', locale)}
            </Button>
          </NextAction>
        </form>
      </CardContent>
    </Card>
  )
}
