/**
 * Path-based route detection for the customer-self-serve surfaces
 * (landr-sgnd). The widget is otherwise a single-screen SPA driven
 * by appStepMachine, so we don't pull in a router library — a tiny
 * regex check at the top of App is enough.
 *
 * Supported paths:
 *   /cancel/{uuid}          → renders CancelPage        (cancel-confirm + POST)
 *   /offer/{token}          → renders OfferPage          (review offer + Accept & Pay)
 *   /reply/{token}/{intent} → renders ApprovalReplyPage  (hotel YES/NO/CHANGES reply)
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
 */
const CANCEL_PATH_RE = /^\/cancel\/([0-9a-fA-F-]+)\/?$/
// HMAC tokens are URL-safe base64 (no padding), typically 43+ chars,
// but we accept any non-empty non-slash sequence so a short test token works.
const OFFER_PATH_RE = /^\/offer\/([^/]+)\/?$/
const REPLY_PATH_RE = /^\/reply\/([^/]+)(?:\/(yes|no|changes))?\/?$/

export function detectRoute(pathname: string):
  | { kind: 'cancel'; bookingId: string }
  | { kind: 'offer'; token: string }
  | { kind: 'reply'; token: string; intent?: 'yes' | 'no' | 'changes' }
  | { kind: 'booking' } {
  const cm = CANCEL_PATH_RE.exec(pathname)
  if (cm) return { kind: 'cancel', bookingId: cm[1] }
  const om = OFFER_PATH_RE.exec(pathname)
  if (om) return { kind: 'offer', token: om[1] }
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
