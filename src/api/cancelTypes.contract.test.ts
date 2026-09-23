/**
 * Contract reconciliation for the self-cancel types (landr-5aih0.7).
 *
 * CancelPreview / CancelBookingResponse are hand-written in src/api/client.ts
 * (same decision as approvalReplyTypes.contract.test.ts: the generated
 * schema marks every defaulted field optional, which is noise at every call
 * site). This file fails `tsc -b` the moment the API's
 * CancelPreviewResponse / PublicCancelResponse drift from them: literal
 * unions must be identical, and a fully-populated generated value must
 * type-check as the hand-written type with zero casts.
 */
import { describe, expect, it } from 'vitest'

import type { components } from '@/types/api.gen'
import type {
  CancelBookingResponse,
  CancelPreview,
  CancelRefundMethod,
  CancelRefundStatus,
} from '@/api/client'

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
type Expect<T extends true> = T

type GenPreview = components['schemas']['CancelPreviewResponse']
type GenCancel = components['schemas']['PublicCancelResponse']

export type _MethodMatches = Expect<
  Equal<components['schemas']['CancelRefund']['method'], CancelRefundMethod>
>
export type _PreviewStatusMatches = Expect<
  Equal<NonNullable<GenPreview['refund_status']>, CancelRefundStatus>
>
export type _CancelStatusMatches = Expect<
  Equal<NonNullable<GenCancel['refund_status']>, CancelRefundStatus>
>

const genPreview = {
  booking_id: '11111111-1111-1111-1111-111111111111',
  booking_reference: '11111111',
  allowed: true,
  already_cancelled: false,
  deadline: '2026-07-13T23:00:00+00:00',
  timezone: 'Atlantic/Canary',
  refund: { amount: '75.00', currency: 'EUR', method: 'stripe_auto' },
  operator: { name: 'Sky Op', phone: null, email: 'hello@sky.example' },
  policy_text: null,
  locale: 'en',
  refund_status: null,
} as const satisfies GenPreview
export const _previewMatches: CancelPreview = genPreview

const genCancel = {
  ok: true,
  booking_id: '11111111-1111-1111-1111-111111111111',
  message: 'booking cancelled',
  refund_status: 'refunded',
} as const satisfies GenCancel
export const _cancelMatches: CancelBookingResponse = genCancel

describe('cancel types contract', () => {
  it('is enforced at compile time (see the type assertions above)', () => {
    expect(_previewMatches.refund.method).toBe('stripe_auto')
    expect(_cancelMatches.refund_status).toBe('refunded')
  })
})
