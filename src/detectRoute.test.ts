import { describe, expect, it } from 'vitest'

import { detectRoute } from './detectRoute'

/**
 * Path-based route detection (landr-sgnd). The widget is otherwise a
 * single-screen SPA so the routing surface is intentionally tiny — a
 * regex inside detectRoute.ts — but we still cover the edges so adding
 * new paths later (e.g. /receipt/{id}) doesn't accidentally regress
 * cancel-link handling.
 *
 * landr-sbhz.4: detectRoute moved out of App.tsx into its own module so
 * App.tsx only exports a React component (react-refresh ESLint gate).
 */
describe('detectRoute', () => {
  it('returns cancel for /cancel/{uuid}', () => {
    expect(
      detectRoute('/cancel/11111111-1111-1111-1111-111111111111'),
    ).toEqual({
      kind: 'cancel',
      bookingId: '11111111-1111-1111-1111-111111111111',
    })
  })

  it('returns cancel even with a trailing slash', () => {
    expect(
      detectRoute('/cancel/11111111-1111-1111-1111-111111111111/'),
    ).toEqual({
      kind: 'cancel',
      bookingId: '11111111-1111-1111-1111-111111111111',
    })
  })

  it('returns booking for the root path', () => {
    expect(detectRoute('/')).toEqual({ kind: 'booking' })
  })

  it('returns booking for /cancel without an id (the API would 404 anyway)', () => {
    expect(detectRoute('/cancel')).toEqual({ kind: 'booking' })
    expect(detectRoute('/cancel/')).toEqual({ kind: 'booking' })
  })

  it('returns booking for /cancel/{garbage} (non-hex / non-uuid chars)', () => {
    expect(detectRoute('/cancel/not-a-valid-uuid$$$')).toEqual({
      kind: 'booking',
    })
  })

  it('returns booking for unrelated paths', () => {
    expect(detectRoute('/booking/abc')).toEqual({ kind: 'booking' })
    expect(detectRoute('/anything/else')).toEqual({ kind: 'booking' })
  })
})
