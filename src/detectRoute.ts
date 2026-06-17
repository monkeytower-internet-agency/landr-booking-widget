/**
 * Path-based route detection for the customer-self-serve surfaces
 * (landr-sgnd). The widget is otherwise a single-screen SPA driven
 * by appStepMachine, so we don't pull in a router library — a tiny
 * regex check at the top of App is enough.
 *
 * Supported paths:
 *   /cancel/{uuid}  → renders CancelPage (cancel-confirm + POST)
 *   /offer/{token}  → renders OfferPage  (review offer + Accept & Pay)
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
 */
const CANCEL_PATH_RE = /^\/cancel\/([0-9a-fA-F-]+)\/?$/
// HMAC tokens are URL-safe base64 (no padding), typically 43+ chars,
// but we accept any non-empty non-slash sequence so a short test token works.
const OFFER_PATH_RE = /^\/offer\/([^/]+)\/?$/

export function detectRoute(pathname: string):
  | { kind: 'cancel'; bookingId: string }
  | { kind: 'offer'; token: string }
  | { kind: 'booking' } {
  const cm = CANCEL_PATH_RE.exec(pathname)
  if (cm) return { kind: 'cancel', bookingId: cm[1] }
  const om = OFFER_PATH_RE.exec(pathname)
  if (om) return { kind: 'offer', token: om[1] }
  return { kind: 'booking' }
}
