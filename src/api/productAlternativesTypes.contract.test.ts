/**
 * Contract reconciliation for the alternatives endpoint. ProductAlternative /
 * AlternativeWindow are hand-written in src/api/types.ts; this file fails
 * `tsc -b` the moment the API's generated schema drifts from them (a
 * fully-populated generated value must type-check as the hand-written type
 * with zero casts), and checks the client builds the expected request.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { components } from '@/types/api.gen'
import type { AlternativeWindow, ProductAlternative } from '@/api/types'
import { getProductAlternatives } from '@/api/client'

type GenAlt = components['schemas']['ProductAlternative']
type GenWindow = components['schemas']['AlternativeWindow']

const genWindow: GenWindow = {
  id: 'w1',
  start_date: '2027-06-01',
  end_date: '2027-06-07',
  available_seats: 4,
  label: 'Bus 1',
}
const genAlt: GenAlt = {
  product_id: 'p1',
  slug: 'course',
  name: 'Course',
  name_localized: { de: 'Kurs' },
  service_time_shape: 'fixed_window',
  thumb_url: null,
  price_from: '89.00',
  currency: 'EUR',
  available_dates: null,
  windows: [genWindow],
}

describe('ProductAlternative contract', () => {
  it('generated shapes are assignable to the hand-written types', () => {
    const window: AlternativeWindow = genWindow
    const alt: ProductAlternative = genAlt
    expect(alt.windows?.[0]).toEqual(window)
  })
})

describe('getProductAlternatives', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('sends from/to/party and returns the parsed list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([genAlt]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubEnv('VITE_USE_MOCKS', '0')
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    vi.stubGlobal('fetch', fetchMock)
    const rows = await getProductAlternatives('abc', '2027-06-01', '2027-06-30', 2)
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('/api/public/products/abc/alternatives?')
    expect(url).toContain('from=2027-06-01')
    expect(url).toContain('to=2027-06-30')
    expect(url).toContain('party=2')
    expect(rows).toHaveLength(1)
  })
})
