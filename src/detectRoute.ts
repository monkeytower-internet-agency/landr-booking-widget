/**
 * Path-based route detection for the customer-self-serve surfaces
 * (landr-sgnd). The widget is otherwise a single-screen SPA driven
 * by appStepMachine, so we don't pull in a router library — a tiny
 * regex check at the top of App is enough.
 *
 * Currently supported paths:
 *   /cancel/{uuid} → renders CancelPage (cancel-confirm + POST)
 *
 * Any other path falls through to the normal booking flow.
 *
 * landr-sbhz.4: moved out of App.tsx into its own module so App.tsx
 * only exports a React component. The react-refresh/only-export-components
 * ESLint rule (a required CI gate) blocks files that mix component +
 * non-component exports — the same convention appStepMachine.ts follows.
 */
const CANCEL_PATH_RE = /^\/cancel\/([0-9a-fA-F-]+)\/?$/

export function detectRoute(pathname: string):
  | { kind: 'cancel'; bookingId: string }
  | { kind: 'booking' } {
  const m = CANCEL_PATH_RE.exec(pathname)
  if (m) return { kind: 'cancel', bookingId: m[1] }
  return { kind: 'booking' }
}
