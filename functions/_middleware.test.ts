// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequest } from './_middleware'

const HTML =
  '<html><body><img id="landr-boot-logo" src="/landr-mark.svg"></body></html>'

// Node has no HTMLRewriter (a Workers runtime global) — minimal stand-in that
// supports the one `on(selector, {element})` + `transform` shape the middleware uses.
class FakeRewriter {
  private handler?: {
    element(el: { setAttribute(k: string, v: string): void }): void
  }
  on(_sel: string, h: FakeRewriter['handler']) {
    this.handler = h
    return this
  }
  transform(res: Response) {
    const handler = this.handler
    return {
      text: async () => {
        let out = await res.text()
        handler?.element({
          setAttribute: (k, v) => {
            out = out.replace(new RegExp(`${k}="[^"]*"`), `${k}="${v}"`)
          },
        })
        return out
      },
    } as unknown as Response
  }
}

function run(url: string, settings: unknown, ok = true) {
  vi.stubGlobal('HTMLRewriter', FakeRewriter)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok, json: async () => settings })),
  )
  const ctx = {
    request: new Request(url),
    next: async () =>
      new Response(HTML, { headers: { 'content-type': 'text/html' } }),
  }
  return (onRequest as unknown as (c: typeof ctx) => Promise<Response>)(ctx)
}

afterEach(() => vi.unstubAllGlobals())

describe('splash logo middleware', () => {
  it('bakes the operator logo into the splash img', async () => {
    const res = await run('https://w.test/?w=abc', {
      logo_url: 'https://cdn.test/l.png',
    })
    expect(await res.text()).toContain('src="https://cdn.test/l.png"')
  })
  it('keeps the Landr mark when the logo is missing or the lookup fails', async () => {
    for (const [s, ok] of [
      [{ logo_url: null }, true],
      [{}, false],
    ] as const) {
      const res = await run('https://w.test/?w=abc', s, ok)
      expect(await res.text()).toContain('/landr-mark.svg')
    }
  })
  it('still bakes the logo when the in-widget header logo is switched off', async () => {
    const res = await run('https://w.test/?w=abc', {
      logo_url: 'https://cdn.test/l.png',
      widget_show_logo: false,
    })
    expect(await res.text()).toContain('src="https://cdn.test/l.png"')
  })
  it('does nothing without a token', async () => {
    const res = await run('https://w.test/', {
      logo_url: 'https://cdn.test/l.png',
    })
    expect(await res.text()).toContain('/landr-mark.svg')
  })
})
