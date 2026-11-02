/**
 * The hand-written offer types match the generated API contract: every
 * generated shape assigns to the type the widget reads, without a cast.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { components } from '@/types/api.gen'
import type {
  Companion,
  EstimateAddonLine,
  EvaluatedLine,
  EvaluatedOffer,
  Participant,
  ProductLine,
} from './types'
import { getOffers } from './client'

type S = components['schemas']

// Compile-time: each generated shape is assignable to the widget's own.
export function assignable(
  offer: S['EvaluatedOffer'],
  line: S['EvaluatedLine'],
  product: S['ProductLineIn'],
  estimate: S['EstimateAddonLineIn'],
  participant: S['ParticipantIn'],
  companion: S['CompanionIn'],
): unknown[] {
  const o: Pick<EvaluatedOffer, 'id' | 'binding' | 'schedule' | 'collection' | 'mode' | 'server_attached' | 'stock'> = offer
  const l: Pick<EvaluatedLine, 'line_id' | 'eligible' | 'eligibility_reason_key' | 'eligibility_reason_params'> = line
  const p: Pick<ProductLine, 'line_id' | 'parent_line_id' | 'offer_id' | 'participant_id' | 'option_key'> = {
    line_id: product.line_id ?? undefined,
    parent_line_id: product.parent_line_id ?? undefined,
    offer_id: product.offer_id ?? undefined,
    participant_id: product.participant_id ?? undefined,
    option_key: product.option_key ?? undefined,
  }
  const e: Pick<EstimateAddonLine, 'product_id' | 'qty'> = estimate
  const refs: [Participant['ref'], Companion['ref']] = [
    participant.ref ?? undefined,
    companion.ref ?? undefined,
  ]
  return [o, l, p, e, refs]
}

describe('getOffers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('posts the token and the party in the body, never in the URL', async () => {
    vi.stubEnv('VITE_USE_MOCKS', '0')
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(JSON.stringify({ lines: [] }), { status: 200 }))
    await getOffers({
      widget_token: 'tok',
      lines: [{ line_id: 'main', product_id: 'p' }],
      guests: [{ id: 'g1', attributes: { age: 8 } }],
    })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe('https://api.example.test/api/public/offers/evaluate')
    expect(String(url)).not.toContain('?')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toMatchObject({
      widget_token: 'tok',
      guests: [{ id: 'g1', attributes: { age: 8 } }],
    })
  })
})
