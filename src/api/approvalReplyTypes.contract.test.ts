/**
 * Contract reconciliation test (landr-em0r.13).
 *
 * landr-em0r.9 hand-wrote ApprovalRequestContext / ApprovalReplyRequestBody /
 * ApprovalReplyResult (src/api/types.ts, "Hotel room-request reply loop"
 * section) against the epic's frozen HTTP contract, before the real API
 * router existed. The router (landr-em0r.8) has since landed and its
 * generated types are now available at src/types/api.gen.ts
 * (components["schemas"][...]) — this file is the promised reconciliation.
 *
 * DECISION: keep the hand-written types. Adopting the generated ones
 * verbatim would flip nearly every field from required to optional
 * throughout ApprovalReplyPage.tsx and its tests — openapi-typescript marks
 * a field optional whenever the Pydantic model gives it a default, even
 * though FastAPI always serializes the full response model (no
 * response_model_exclude_unset is used anywhere in
 * public_approval_replies.py) — the exact "codegen gap" pattern already
 * documented for Product / ProductGroup / EstimateResponse etc. elsewhere in
 * src/api/types.ts. Forcing `?? ''` / non-null assertions at every call site
 * for a distinction that never occurs on the wire is not worth the churn.
 *
 * What this file proves, at COMPILE time (so it fails `tsc -b` /
 * `npm run typecheck` — NOT this test's runtime assertions — the moment
 * `npm run gen:api-types` regenerates api.gen.ts from a schema that no
 * longer matches):
 *
 *   1. Every field name + nested type in the hand-written types has a
 *      same-named, same-shaped counterpart in the generated schema — a
 *      fully-populated generated-schema value type-checks as the
 *      hand-written type with ZERO casts.
 *   2. The two shared literal unions (ApprovalRequestState, ApprovalDecision)
 *      are the exact same member sets as the generated unions.
 *   3. The ONE known, deliberate gap: `ApprovalRequestCurrentResponse.decision`
 *      is typed as a bare `string` in the generated schema (landr-api
 *      app/routers/public_approval_replies.py:191), NOT via the shared
 *      `ApprovalDecision = Literal["confirmed", "declined",
 *      "confirmed_with_changes"]` alias that the OTHER two `decision` fields
 *      in the same module use (lines 228 and 243). At runtime this is safe —
 *      the value is read straight off the `booking_approval_responses
 *      .decision` column, which carries a DB CHECK restricting it to the
 *      same 3 values — but the OpenAPI contract does not guarantee it, and
 *      ApprovalReplyPage's `decisionLabel()` (that file, ~line 92) silently
 *      falls back to the "confirmed_with_changes" label for any 4th value
 *      instead of erroring. Flagged to landr-api as a follow-up (tighten
 *      `ApprovalRequestCurrentResponse.decision` to `ApprovalDecision` to
 *      match its two siblings) — not fixed here; this ticket only syncs
 *      contracts into the frontends.
 */
import { describe, expect, it } from 'vitest'

import type { components } from '@/types/api.gen'
import type {
  ApprovalDecision,
  ApprovalReplyRequestBody,
  ApprovalReplyResult,
  ApprovalRequestBooking,
  ApprovalRequestContext,
  ApprovalRequestCurrentResponse,
  ApprovalRequestOperator,
  ApprovalRequestResponder,
  ApprovalRequestRoomLine,
  ApprovalRequestState,
} from '@/api/types'

// ---- compile-time literal-union equality ----------------------------------
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
type Expect<T extends true> = T

type GenState = components['schemas']['ApprovalRequestContext']['state']
type GenDecision = components['schemas']['ApprovalReplyResult']['decision']

// state / decision are the SAME union reused by both endpoints on the API
// side — cross-check that assumption while we're at it.
export type _StateSharedAcrossBothEndpoints = Expect<
  Equal<GenState, components['schemas']['ApprovalReplyResult']['state']>
>
export type _DecisionSharedAcrossBothFields = Expect<
  Equal<GenDecision, components['schemas']['ApprovalReplyRequest']['decision']>
>

export type _StateMatchesHandWritten = Expect<Equal<ApprovalRequestState, GenState>>
export type _DecisionMatchesHandWritten = Expect<Equal<ApprovalDecision, GenDecision>>

// The one deliberate, documented gap (see file header). This assertion
// FAILS TO COMPILE — forcing this comment + the header to be revisited —
// the day landr-api tightens ApprovalRequestCurrentResponse.decision to
// ApprovalDecision. At that point delete this block and fold `decision`
// into the full current_response check below like every other field.
type GenCurrentResponseDecision =
  components['schemas']['ApprovalRequestCurrentResponse']['decision']
export type _CurrentResponseDecisionIsIntentionallyLooseOnTheApiSide = Expect<
  Equal<GenCurrentResponseDecision, string>
>

// ---- compile-time structural equivalence (every OTHER field) -------------
//
// `satisfies` (not `:`) keeps each literal's "key is actually present" shape
// instead of widening to the schema's optional-with-default typing, so this
// only fails on a REAL mismatch (renamed/missing field, wrong primitive,
// wrong nullability) — never on the optional-vs-required looseness the file
// header above already explains away.

const genOperator = {
  name: 'Alpine Peaks Hotel',
  logo_url: null,
  primary_color: '#1d4ed8',
  phone: '+43 512 123456',
} satisfies components['schemas']['ApprovalRequestOperator']
export const _operatorMatches: ApprovalRequestOperator = genOperator

const genResponder = {
  location_name: 'Front desk',
} satisfies components['schemas']['ApprovalRequestResponder']
export const _responderMatches: ApprovalRequestResponder = genResponder

const genRoomLine = {
  qty: 2,
  label: 'Double room',
} satisfies components['schemas']['ApprovalRequestRoomLine']
export const _roomLineMatches: ApprovalRequestRoomLine = genRoomLine

const genBooking = {
  reference: 'BR-1234',
  check_in: '2026-09-01',
  check_out: '2026-09-04',
  nights: 3,
  guests_count: 2,
  room_lines: [genRoomLine],
} satisfies components['schemas']['ApprovalRequestBooking']
export const _bookingMatches: ApprovalRequestBooking = genBooking

// current_response deliberately kept null here — its one incompatible field
// (decision) is isolated + documented above, not swept into this check.
const genContext = {
  state: 'answered',
  can_respond: true,
  locale: 'en',
  request_ref: 'a1b2c3d4',
  confirm_nonce: 'nonce-value',
  operator: genOperator,
  responder: genResponder,
  booking: genBooking,
  current_response: null,
} satisfies components['schemas']['ApprovalRequestContext']
export const _contextMatches: ApprovalRequestContext = genContext

const genReplyRequest = {
  decision: 'confirmed_with_changes',
  comment: 'Only the double room is free that week.',
  responder_name: 'Front desk',
  confirm_nonce: 'nonce-value',
} satisfies components['schemas']['ApprovalReplyRequest']
export const _replyRequestMatches: ApprovalReplyRequestBody = genReplyRequest

const genReplyResult = {
  ok: true,
  state: 'answered',
  decision: 'confirmed',
  recorded_at: '2026-09-01T10:00:00Z',
  already_recorded: false,
  booking_advanced: true,
  superseded_previous: false,
} satisfies components['schemas']['ApprovalReplyResult']
export const _replyResultMatches: ApprovalReplyResult = genReplyResult

// current_response IS present-and-non-null on a real "answered" response —
// prove the rest of it (everything but the documented `decision` gap above)
// also matches exactly.
const genCurrentResponseSansDecision = {
  comment: 'Requesting a later check-in.',
  responder_name: 'Front desk',
  responded_at: '2026-09-01T09:00:00Z',
} satisfies Omit<components['schemas']['ApprovalRequestCurrentResponse'], 'decision'>
export const _currentResponseSansDecisionMatches: Omit<
  ApprovalRequestCurrentResponse,
  'decision'
> = genCurrentResponseSansDecision

describe('widget hand-written approval-reply types vs generated schema (landr-em0r.13)', () => {
  it('type-checks only — see the compile-time assertions above this describe block', () => {
    // No meaningful runtime assertions: the entire point of this file is
    // that it fails `tsc -b` / `npm run typecheck` (not `vitest run`) the
    // moment the hand-written types in src/api/types.ts drift from the
    // generated schema in src/types/api.gen.ts. This `it` exists only so
    // the file isn't reported as an empty test suite.
    expect(genContext.state).toBe('answered')
  })
})
