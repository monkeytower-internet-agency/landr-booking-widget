import { describe, expect, it, vi } from 'vitest'
import { createDevVersionHandler } from './devVersionMiddleware'

function run(handler: ReturnType<typeof createDevVersionHandler>, url: string, method = 'GET') {
  const res = { statusCode: 0, headers: {} as Record<string, string>, body: '', setHeader(k: string, v: string) { this.headers[k] = v }, end(b: string) { this.body = b } }
  const next = vi.fn()
  handler({ url, method }, res, next)
  return { res, next }
}

describe('createDevVersionHandler', () => {
  it('serves live HEAD with no-store + CORS', () => {
    const h = createDevVersionHandler({ getHead: () => 'abc1234def', version: '1.0.0', builtAt: 't' })
    const { res } = run(h, '/version.json?x=1')
    expect(JSON.parse(res.body)).toEqual({ buildId: 'abc1234def', version: '1.0.0', builtAt: 't' })
    expect(res.headers['Cache-Control']).toBe('no-store')
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*')
  })
  it('passes other paths through and keeps last id when git fails', () => {
    let head: string | null = 'a'
    let t = 0
    const h = createDevVersionHandler({ getHead: () => head, version: 'v', builtAt: 't', now: () => t })
    expect(run(h, '/other').next).toHaveBeenCalled()
    run(h, '/version.json')
    head = null
    t = 10_000
    expect(JSON.parse(run(h, '/version.json').res.body).buildId).toBe('a')
  })
})
