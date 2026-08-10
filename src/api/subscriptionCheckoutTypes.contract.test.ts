/**
 * Contract reconciliation test for the membership-checkout endpoint
 * (landr-1kk.5).
 *
 * Mirrors `src/api/approvalReplyTypes.contract.test.ts`: the request/response
 * types in `src/api/client.ts` are hand-written (openapi-typescript marks a
 * field optional whenever the Pydantic model gives it a default, which would
 * push `?? ''` into every call site), and THIS file is what stops them drifting
 * from `contracts/openapi.json`.
 *
 * The assertions below are COMPILE-time: they fail `tsc -b` /
 * `npm run typecheck` — not this file's runtime `it` — the moment
 * `npm run gen:api-types` regenerates `api.gen.ts` from a schema that no longer
 * matches. CI runs both, plus a contracts-drift diff, so a landr-api change to
 * POST /api/public/subscriptions/checkout cannot land here silently.
 */
import { describe, expect, it } from 'vitest'

import type { SubscriptionCheckoutRequest } from '@/api/client'
import type { components } from '@/types/api.gen'

type GenCheckoutIn = components['schemas']['SubscriptionCheckoutIn']

type Expect<T extends true> = T

// 1. Every field the widget sends is accepted by the generated schema, with a
//    compatible type. (Direction that matters: we must not send garbage.)
export type _RequestSatisfiesSchema = Expect<
  SubscriptionCheckoutRequest extends GenCheckoutIn ? true : false
>

// 2. Every REQUIRED field of the schema is present-and-required on our type —
//    the direction (1) cannot catch. If landr-api adds a new required field,
//    this breaks the build instead of producing a 422 at runtime.
type RequiredKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? never : K
}[keyof T]
export type _WeSupplyEveryRequiredField = Expect<
  RequiredKeys<GenCheckoutIn> extends RequiredKeys<SubscriptionCheckoutRequest>
    ? true
    : false
>

// 3. A fully-populated wire value type-checks as our request type with ZERO
//    casts — the structural check, same shape as the approval-reply file's.
const genCheckoutIn = {
  widget_token: 'tok_abc',
  product_id: '11111111-2222-3333-4444-555555555555',
  email: 'member@example.com',
  first_name: 'Ada',
  last_name: 'Lovelace',
  return_url: 'https://widget.example.com/?member=1',
  cancel_url: 'https://widget.example.com/?member=cancelled',
} satisfies GenCheckoutIn
export const _requestMatches: SubscriptionCheckoutRequest = genCheckoutIn

describe('membership checkout request type vs generated schema (landr-1kk.5)', () => {
  it('type-checks only — see the compile-time assertions above this block', () => {
    // No meaningful runtime assertion: the point of this file is that it fails
    // `tsc -b`, not `vitest run`. This `it` exists so the suite isn't empty.
    expect(genCheckoutIn.email).toBe('member@example.com')
  })
})
