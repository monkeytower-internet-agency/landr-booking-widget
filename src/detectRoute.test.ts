import { describe, expect, it } from 'vitest'

import { detectRoute } from './detectRoute'

/**
 * Path-based route detection (landr-sgnd). The widget is otherwise a
 * single-screen SPA so the routing surface is intentionally tiny — a
 * regex inside detectRoute.ts — but we still cover the edges so adding
 * new paths later doesn't accidentally regress cancel/offer-link handling.
 *
 * landr-sbhz.4: detectRoute moved out of App.tsx into its own module so
 * App.tsx only exports a React component (react-refresh ESLint gate).
 *
 * landr-uvfg.4b: added /offer/{token} tests.
 *
 * landr-em0r.9: added /reply/{token}/{intent} tests. The intent segment is
 * optional and a pre-selection only, so both /reply/{token} and
 * /reply/{token}/{yes|no|changes} are valid routes.
 *
 * landr-esd3: added /pay/{token} tests for the booking_payment_link route.
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

  it('returns offer for /offer/{token}', () => {
    expect(detectRoute('/offer/abc123XYZ-tok')).toEqual({
      kind: 'offer',
      token: 'abc123XYZ-tok',
    })
  })

  it('returns offer for /offer/{token} with trailing slash', () => {
    expect(detectRoute('/offer/mytoken/')).toEqual({
      kind: 'offer',
      token: 'mytoken',
    })
  })

  it('returns offer for /offer/{long-hmac-token}', () => {
    const hmac = 'abc123_-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij'
    expect(detectRoute(`/offer/${hmac}`)).toEqual({
      kind: 'offer',
      token: hmac,
    })
  })

  it('returns booking for /offer without a token', () => {
    expect(detectRoute('/offer')).toEqual({ kind: 'booking' })
    expect(detectRoute('/offer/')).toEqual({ kind: 'booking' })
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

  // ── landr-em0r.9: /reply/{token}/{intent} ──────────────────────────────
  it('returns reply with intent for /reply/{token}/yes', () => {
    expect(detectRoute('/reply/abc123/yes')).toEqual({
      kind: 'reply',
      token: 'abc123',
      intent: 'yes',
    })
  })

  it('returns reply with intent for /reply/{token}/no', () => {
    expect(detectRoute('/reply/abc123/no')).toEqual({
      kind: 'reply',
      token: 'abc123',
      intent: 'no',
    })
  })

  it('returns reply with intent for /reply/{token}/changes', () => {
    expect(detectRoute('/reply/abc123/changes')).toEqual({
      kind: 'reply',
      token: 'abc123',
      intent: 'changes',
    })
  })

  it('returns reply with no intent for /reply/{token}', () => {
    expect(detectRoute('/reply/abc123')).toEqual({
      kind: 'reply',
      token: 'abc123',
    })
  })

  it('returns reply with a trailing slash on the intent-less form', () => {
    expect(detectRoute('/reply/abc123/')).toEqual({
      kind: 'reply',
      token: 'abc123',
    })
  })

  it('returns reply with a trailing slash on each intent', () => {
    expect(detectRoute('/reply/abc123/yes/')).toEqual({
      kind: 'reply',
      token: 'abc123',
      intent: 'yes',
    })
    expect(detectRoute('/reply/abc123/no/')).toEqual({
      kind: 'reply',
      token: 'abc123',
      intent: 'no',
    })
    expect(detectRoute('/reply/abc123/changes/')).toEqual({
      kind: 'reply',
      token: 'abc123',
      intent: 'changes',
    })
  })

  it('returns booking for /reply/ without a token', () => {
    expect(detectRoute('/reply/')).toEqual({ kind: 'booking' })
    expect(detectRoute('/reply')).toEqual({ kind: 'booking' })
  })

  it('returns booking for /reply/{token}/{bogus intent}', () => {
    expect(detectRoute('/reply/abc/bogus')).toEqual({ kind: 'booking' })
  })

  it('accepts a realistic opaque 192-bit reply token', () => {
    const token = 'Qh3zK9pL2mN7vR4tYw8sXb1cJd6fGa5e_-AbCdEfGh'
    expect(detectRoute(`/reply/${token}/yes`)).toEqual({
      kind: 'reply',
      token,
      intent: 'yes',
    })
  })

  // ── landr-esd3: /pay/{token} ───────────────────────────────────────────
  it('returns pay for /pay/{token}', () => {
    expect(detectRoute('/pay/abc.123.def')).toEqual({
      kind: 'pay',
      token: 'abc.123.def',
    })
  })

  it('returns pay for /pay/{token} with trailing slash', () => {
    expect(detectRoute('/pay/abc.123.def/')).toEqual({
      kind: 'pay',
      token: 'abc.123.def',
    })
  })

  it('returns booking for /pay without a token', () => {
    expect(detectRoute('/pay')).toEqual({ kind: 'booking' })
  })

  it('returns booking for /paying (prefix collision)', () => {
    expect(detectRoute('/paying')).toEqual({ kind: 'booking' })
  })

  it('does not regress /cancel/{uuid} or /offer/{token} routing', () => {
    expect(
      detectRoute('/cancel/11111111-1111-1111-1111-111111111111'),
    ).toEqual({
      kind: 'cancel',
      bookingId: '11111111-1111-1111-1111-111111111111',
    })
    expect(detectRoute('/offer/abc123XYZ-tok')).toEqual({
      kind: 'offer',
      token: 'abc123XYZ-tok',
    })
  })
})
