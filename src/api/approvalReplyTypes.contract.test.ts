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
 *   3. `ApprovalRequestCurrentResponse.decision` now matches its two siblings.
 *      HISTORY (landr-1kk.5): this used to be the ONE documented gap — the
 *      generated schema typed it as a bare `string` while the other two
 *      `decision` fields in the same landr-api module used the shared
 *      `ApprovalDecision` literal union, so `decisionLabel()` in
 *      ApprovalReplyPage silently fell back to the "confirmed_with_changes"
 *      label for any 4th value. It was flagged to landr-api as a follow-up and
 *      landr-api HAS since tightened it: the schema now carries
 *      `enum: ["confirmed", "declined", "confirmed_with_changes"]`, identical
 *      to ApprovalReplyResult.decision.
 *
 *      That tightening was surfaced by THIS FILE working exactly as designed —
 *      refreshing contracts/openapi.json for the subscription-checkout endpoint
 *      made the old `Equal<…, string>` assertion fail to compile, as its own
 *      comment promised it would. `decision` is therefore now folded into the
 *      full current_response structural check below, like every other field,
 *      and the isolated assertion is gone.
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

// `decision` on current_response is no longer a special case — landr-api
// tightened it to the shared union (see header note 3), so it is asserted here
// alongside its siblings and folded into the structural check below.
export type _CurrentResponseDecisionMatchesHandWritten = Expect<
  Equal<
    components['schemas']['ApprovalRequestCurrentResponse']['decision'],
    ApprovalDecision
  >
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

// current_response kept null here to exercise the nullable branch; the
// present-and-non-null shape is proven in full further down.
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
// prove ALL of it matches exactly, `decision` included now that landr-api
// tightened it (header note 3). No Omit<> carve-out any more.
const genCurrentResponse = {
  decision: 'confirmed_with_changes',
  comment: 'Requesting a later check-in.',
  responder_name: 'Front desk',
  responded_at: '2026-09-01T09:00:00Z',
} satisfies components['schemas']['ApprovalRequestCurrentResponse']
export const _currentResponseMatches: ApprovalRequestCurrentResponse =
  genCurrentResponse

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
