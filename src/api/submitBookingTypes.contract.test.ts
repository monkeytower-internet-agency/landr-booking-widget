/**
 * Contract reconciliation test (landr-k9pji.15).
 *
 * SubmitBookingResponse (src/api/types.ts) is a large hand-written interface
 * built up field-by-field across many tickets (payment_mode/deposit_percent
 * most recently, landr-k9pji.15), always against the real
 * `public_submit_booking` response rather than a generated schema — the
 * generated one has existed only since `openapi.json` gained real
 * `response_model`s across the API. This file is the same reconciliation
 * approvalReplyTypes.contract.test.ts already does for the approval-reply
 * types, applied here.
 *
 * DECISION (same as approvalReplyTypes.contract.test.ts, cancelTypes.contract
 * .test.ts and subscriptionCheckoutTypes.contract.test.ts): keep the
 * hand-written interface rather than switching every consumer
 * (Confirmation.tsx and its tests, App.tsx) to the generated
 * `components['schemas']['SubmitBookingResponse']` directly. Two concrete
 * reasons this codebase's usual "adopt it verbatim" option is wrong here:
 *
 *   1. openapi-typescript marks a field optional whenever the Pydantic model
 *      gives it a default, even though the router always serializes it — the
 *      documented "codegen gap" this repo already carries for
 *      Product/ProductGroup/EstimateResponse etc. Adopting the generated
 *      type verbatim would flip fields like `semantic_state` from required
 *      to a form every call site has to re-guard.
 *   2. Several fields are genuinely richer on the hand-written side than the
 *      generated schema can express: `stage` is `CustomerStageLabel | null`
 *      here vs. a same-named generated object (fine, checked below); but
 *      `summary`, `group`, `invites`, `calendar_event` and `join_error` are
 *      either typed `{[key: string]: unknown}` or (join_error) a bare
 *      `string` in the generated schema — Pydantic models the API itself
 *      never widens on the wire, but openapi-typescript's generic-object
 *      fallback can't express. Structurally checking those against the
 *      generated shape would immediately fail to compile for a mismatch
 *      that is a codegen limitation, not a real contract drift — so this
 *      file checks every PRIMITIVE/nullable top-level field (the part that
 *      genuinely can drift silently) and leaves the nested object fields to
 *      the dedicated tests that already build and assert their exact shape
 *      (Confirmation.test.tsx, App.test.tsx).
 *
 *      `confirmation_email_status` is the SAME gap, one level down: the
 *      Python field really is `str | None` (`app/routers/public_bookings.py`
 *      — no `Literal[...]`, unlike `payment_mode`, which the API DOES type
 *      as a Literal and which this file's `_PaymentModeMatchesHandWritten`
 *      check above holds to the exact union), so the generated schema
 *      widens it to a bare `string` and `satisfies
 *      Partial<components[...]>` below infers `genResponse
 *      .confirmation_email_status` as `string`, not the literal `'sent'` it
 *      is written as — `tsc -b` (this repo's actual `npm run typecheck`,
 *      not a bare `tsc --noEmit`) then correctly refuses to narrow that
 *      back to the hand-written union in the `Pick<>` assignment below.
 *      Left OUT of that assignment for the same reason `join_error` is:
 *      a real (Python-side) API tightening, not a widget contract to lock
 *      here — `genResponse` still includes it so the wire shape is visible.
 *
 * What this file proves, at COMPILE time (fails `tsc -b` / `npm run
 * typecheck` the moment `npm run gen:api-types` regenerates api.gen.ts from
 * a schema where one of these field names, primitive types or nullability
 * changes — not this test's runtime assertion):
 *
 *   Every primitive/nullable top-level field of the hand-written
 *   SubmitBookingResponse has a same-named, same-typed counterpart in the
 *   generated schema, and `payment_mode`'s literal union is the exact same
 *   member set on both sides (the field this ticket, landr-k9pji.15, added
 *   alongside deposit_percent).
 */
import { describe, expect, it } from 'vitest'

import type { components } from '@/types/api.gen'
import type { SubmitBookingResponse } from '@/api/types'

// ---- compile-time literal-union equality ----------------------------------
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
type Expect<T extends true> = T

type GenPaymentMode = NonNullable<
  components['schemas']['SubmitBookingResponse']['payment_mode']
>
type HandPaymentMode = NonNullable<SubmitBookingResponse['payment_mode']>

export type _PaymentModeMatchesHandWritten = Expect<
  Equal<HandPaymentMode, GenPaymentMode>
>

// ---- compile-time structural equivalence, primitive/nullable fields only --
//
// `satisfies` (not `:`) keeps each literal's "key is actually present" shape
// instead of widening to the schema's optional-with-default typing — see
// approvalReplyTypes.contract.test.ts for the full rationale, identical here.
// Deliberately OMITS: stage, summary, group, invites, join_error,
// calendar_event — see the file header's DECISION note 2.
const genResponse = {
  booking_id: 'b1b1b1b1-1111-1111-1111-111111111111',
  semantic_state: 'confirmed',
  stage_code: 'confirmed',
  next_steps: 'Nothing further is needed from you.',
  approval_outcome: 'auto_approved',
  payment_link_sent: true,
  payment_mode: 'online',
  deposit_percent: 30,
  token: 'share-token-abc',
  ical_url: 'https://api.landr.de/ical/abc.ics',
  confirmation_email_status: 'sent',
  share_secret: 'secret-abc',
  customer_page_url: 'https://landr.de/t/abc',
} satisfies Partial<components['schemas']['SubmitBookingResponse']>

export const _responseMatches: Pick<
  SubmitBookingResponse,
  | 'booking_id'
  | 'semantic_state'
  | 'stage_code'
  | 'next_steps'
  | 'approval_outcome'
  | 'payment_link_sent'
  | 'payment_mode'
  | 'deposit_percent'
  | 'token'
  | 'ical_url'
  | 'share_secret'
  | 'customer_page_url'
  // confirmation_email_status deliberately excluded — see the file header's
  // DECISION note 2 (Python-side str | None, not a Literal; the generated
  // schema is correct, the hand-written literal union is a widget-side
  // narrowing that has never been part of the wire contract).
> = genResponse

describe('widget hand-written SubmitBookingResponse vs generated schema (landr-k9pji.15)', () => {
  it('type-checks only — see the compile-time assertions above this describe block', () => {
    // No meaningful runtime assertions: the entire point of this file is
    // that it fails `tsc -b` / `npm run typecheck` (not `vitest run`) the
    // moment SubmitBookingResponse's primitive/nullable fields in
    // src/api/types.ts drift from the generated schema in
    // src/types/api.gen.ts.
    expect(genResponse.payment_mode).toBe('online')
  })
})
