/**
 * Path-based route detection for the customer-self-serve surfaces
 * (landr-sgnd). The widget is otherwise a single-screen SPA driven
 * by appStepMachine, so we don't pull in a router library — a tiny
 * regex check at the top of App is enough.
 *
 * Supported paths:
 *   /cancel/{token}         → renders CancelPage        (preview + cancel-confirm + POST)
 *   /offer/{token}          → renders OfferPage          (review offer + Accept & Pay)
 *   /pay/{token}            → renders OfferPage in mode="pay" (pay outstanding balance_due)
 *   /reply/{token}/{intent} → renders ApprovalReplyPage  (hotel YES/NO/CHANGES reply)
 *   /i/{token}              → the booking flow, as an INVITE (landr-5lrov)
 *
 * Any other path falls through to the normal booking flow.
 *
 * landr-sbhz.4: moved out of App.tsx into its own module so App.tsx
 * only exports a React component. The react-refresh/only-export-components
 * ESLint rule (a required CI gate) blocks files that mix component +
 * non-component exports — the same convention appStepMachine.ts follows.
 *
 * landr-uvfg.4b: added /offer/{token} route for the custom-offer
 * accept-and-pay page.
 *
 * landr-em0r.9: added /reply/{token}/{intent} for the hotel room-request
 * reply loop. The {intent} segment (yes|no|changes) is OPTIONAL and is a
 * PRE-SELECTION only — ApprovalReplyPage lets the hotel change it before
 * confirming. The token is opaque (public_token, 192-bit urlsafe) and lives
 * in the path (never a query param) so security gateways that percent-encode
 * the whole URL into their own `?url=` wrapper (Safe Links, Proofpoint,
 * Mimecast) don't lose it.
 *
 * landr-esd3: added /pay/{token} for the booking_payment_link email — same
 * OfferPage component rendered in mode="pay" (Accept & Pay copy swapped for
 * "Pay now" copy). Match order against the other prefixes doesn't matter;
 * the prefixes are disjoint.
 *
 * landr-5aih0.7: /cancel/{token} carries the SIGNED booking token
 * (`{booking_hex}.{expiry}.{base64url sig}`), no longer the bare booking
 * UUID — hence dots, underscores and mixed case. An old /cancel/{uuid} link
 * still matches and lands on CancelPage, whose preview call then 401s into
 * the "link is no longer valid" state.
 */
const CANCEL_PATH_RE = /^\/cancel\/([A-Za-z0-9._-]+)\/?$/
// HMAC tokens are URL-safe base64 (no padding), typically 43+ chars,
// but we accept any non-empty non-slash sequence so a short test token works.
const OFFER_PATH_RE = /^\/offer\/([^/]+)\/?$/
const PAY_PATH_RE = /^\/pay\/([^/]+)\/?$/
const REPLY_PATH_RE = /^\/reply\/([^/]+)(?:\/(yes|no|changes))?\/?$/
// landr-5lrov: the short invite link. `/i/{token}` is NOT a separate page —
// it is the ordinary booking flow entered through an invite, so it is read by
// readQueryParams (as an alias for `?invite=`) rather than returned as a route
// kind here. The token is in the path for the same reason `/reply/{token}` is:
// link-rewriting security gateways mangle query strings, and it keeps the link
// short enough to paste into WhatsApp without wrapping.
const INVITE_PATH_RE = /^\/i\/([^/]+)\/?$/

/** The invite token of a `/i/{token}` URL, or null for any other path. */
export function invitePathToken(pathname: string): string | null {
  const m = INVITE_PATH_RE.exec(pathname)
  return m ? decodeURIComponent(m[1]) : null
}

export function detectRoute(pathname: string):
  | { kind: 'cancel'; token: string }
  | { kind: 'offer'; token: string }
  | { kind: 'pay'; token: string }
  | { kind: 'reply'; token: string; intent?: 'yes' | 'no' | 'changes' }
  | { kind: 'booking' } {
  const cm = CANCEL_PATH_RE.exec(pathname)
  if (cm) return { kind: 'cancel', token: cm[1] }
  const om = OFFER_PATH_RE.exec(pathname)
  if (om) return { kind: 'offer', token: om[1] }
  const pm = PAY_PATH_RE.exec(pathname)
  if (pm) return { kind: 'pay', token: pm[1] }
  const rm = REPLY_PATH_RE.exec(pathname)
  if (rm) {
    return {
      kind: 'reply',
      token: rm[1],
      ...(rm[2] ? { intent: rm[2] as 'yes' | 'no' | 'changes' } : {}),
    }
  }
  return { kind: 'booking' }
}

/**
 * landr-6eita.1: `?start=dates` — a single-product embed opens straight on the
 * date picker instead of the product-detail (Overview) step, for operators who
 * already describe the product on their own page. Only meaningful together
 * with `?product=<slug>`; ignored (false) otherwise, and any other `start=`
 * value is the default behaviour. Takes the raw search string so it is
 * testable without a window.
 */
export function startsAtDates(search: string): boolean {
  const params = new URLSearchParams(search)
  return params.get('start') === 'dates' && Boolean(params.get('product'))
}
