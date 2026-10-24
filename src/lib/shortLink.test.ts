import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveShortLinkPath } from './shortLink'
import * as client from '../api/client'

afterEach(() => vi.restoreAllMocks())

describe('resolveShortLinkPath', () => {
  it('rewrites /s/<code> to /?<query>', async () => {
    vi.spyOn(client, 'resolveShortLink').mockResolvedValue({ query: 'w=abc&product=p1' })
    const h = { replaceState: vi.fn() }
    await resolveShortLinkPath({ pathname: '/s/k3m9xq' }, h)
    expect(client.resolveShortLink).toHaveBeenCalledWith('k3m9xq')
    expect(h.replaceState).toHaveBeenCalledWith(null, '', '/?w=abc&product=p1')
  })
  it('falls back to the invalid-link flow on a miss', async () => {
    vi.spyOn(client, 'resolveShortLink').mockRejectedValue(new Error('404'))
    const h = { replaceState: vi.fn() }
    await resolveShortLinkPath({ pathname: '/s/nope22' }, h)
    expect(h.replaceState).toHaveBeenCalledWith(null, '', '/?invite=invalid-short-link')
  })
  it('ignores other paths', async () => {
    const spy = vi.spyOn(client, 'resolveShortLink')
    const h = { replaceState: vi.fn() }
    await resolveShortLinkPath({ pathname: '/' }, h)
    expect(spy).not.toHaveBeenCalled()
    expect(h.replaceState).not.toHaveBeenCalled()
  })
})
