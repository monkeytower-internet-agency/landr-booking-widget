// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { cleanCountry, onRequest } from './geo'

type Ctx = { request: Request }
const call = (method: string, cf?: unknown) => {
  const request = new Request('https://widget.test/geo', { method })
  if (cf !== undefined) Object.defineProperty(request, 'cf', { value: cf })
  return (onRequest as unknown as (c: Ctx) => Promise<Response>)({ request })
}

describe('GET /geo (landr-uuntm.3)', () => {
  it('returns the visitor country from request.cf, uncached, with CORS', async () => {
    const res = await call('GET', { country: 'DE' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ country: 'DE' })
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('content-type')).toContain('application/json')
  })
  it.each(['XX', 'T1', 'xx', '', 'DEU', undefined, 42])('maps %p to null', async (c) => {
    const res = await call('GET', { country: c })
    expect(await res.json()).toEqual({ country: null })
  })
  it('returns null when request.cf is absent (local dev)', async () => {
    const res = await call('GET')
    expect(await res.json()).toEqual({ country: null })
  })
  it('answers the CORS preflight', async () => {
    const res = await call('OPTIONS')
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-methods')).toContain('GET')
  })
  it('rejects writes', async () => {
    expect((await call('POST')).status).toBe(405)
  })
  it('cleanCountry upper-cases a valid code', () => {
    expect(cleanCountry('es')).toBe('ES')
  })
})
