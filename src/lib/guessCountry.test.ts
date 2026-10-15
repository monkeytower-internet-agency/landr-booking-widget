import { afterEach, describe, expect, it, vi } from 'vitest'
import { geoCountry, guessCountry, localeCountry, GEO_TIMEOUT_MS } from './guessCountry'
import { countryName, countryOptions, normalizeCountryCode } from './countries'

function stubNav(languages: string[] | undefined, language = languages?.[0] ?? '') {
  vi.stubGlobal('navigator', { languages, language })
}
function stubFetch(impl: () => Promise<unknown>) {
  const f = vi.fn(impl)
  vi.stubGlobal('fetch', f)
  return f
}
const ok = (body: unknown) => async () => ({ ok: true, json: async () => body })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('geoCountry', () => {
  it('reads {country} from <widget origin>/geo and upper-cases it', async () => {
    const f = stubFetch(ok({ country: 'de' }))
    expect(await geoCountry('https://widget.test')).toBe('DE')
    expect(f).toHaveBeenCalledTimes(1)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://widget.test/geo')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
  it('uses window.location.origin by default', async () => {
    const f = stubFetch(ok({ country: 'ES' }))
    await geoCountry()
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe(`${window.location.origin}/geo`)
  })
  it.each([null, 'XX', 'T1', '', 'ZZZ', 5])('treats %p as unknown', async (c) => {
    stubFetch(ok({ country: c }))
    expect(await geoCountry('https://widget.test')).toBeNull()
  })
  it('returns null on network failure, non-2xx, bad JSON', async () => {
    stubFetch(async () => {
      throw new Error('offline')
    })
    expect(await geoCountry('https://widget.test')).toBeNull()
    stubFetch(async () => ({ ok: false, json: async () => ({ country: 'DE' }) }))
    expect(await geoCountry('https://widget.test')).toBeNull()
    stubFetch(async () => ({
      ok: true,
      json: async () => {
        throw new Error('bad json')
      },
    }))
    expect(await geoCountry('https://widget.test')).toBeNull()
  })
  it('gives up after the 1500 ms timeout', async () => {
    expect(GEO_TIMEOUT_MS).toBe(1500)
    const spy = vi.spyOn(AbortSignal, 'timeout')
    stubFetch(ok({ country: 'DE' }))
    await geoCountry('https://widget.test')
    expect(spy).toHaveBeenCalledWith(1500)
    spy.mockRestore()
  })
})

describe('localeCountry', () => {
  it('takes the first languages entry that has a region subtag', () => {
    stubNav(['de-DE', 'en-US'])
    expect(localeCountry()).toBe('DE')
  })
  it('skips bare language tags (de says nothing about the country)', () => {
    stubNav(['de', 'en', 'es-ES'])
    expect(localeCountry()).toBe('ES')
    stubNav(['de'])
    expect(localeCountry()).toBeNull()
  })
  it('handles script subtags and case', () => {
    stubNav(['zh-Hant-TW'])
    expect(localeCountry()).toBe('TW')
    stubNav(['en-gb'])
    expect(localeCountry()).toBe('GB')
  })
  it('falls back to navigator.language when languages is empty/missing', () => {
    stubNav(undefined, 'fr-CH')
    expect(localeCountry()).toBe('CH')
    stubNav([], 'fr-CA')
    expect(localeCountry()).toBe('CA')
  })
  it('ignores region subtags that are not countries (UN M.49 numeric, junk)', () => {
    stubNav(['es-419', 'en-ZZ'])
    expect(localeCountry()).toBeNull()
  })
})

describe('guessCountry chain', () => {
  it('prefers the edge geo answer over locale and operator', async () => {
    stubFetch(ok({ country: 'AT' }))
    stubNav(['de-DE'])
    expect(await guessCountry('ES')).toBe('AT')
  })
  it('falls back to the browser locale when geo fails', async () => {
    stubFetch(async () => {
      throw new Error('x')
    })
    stubNav(['de-CH'])
    expect(await guessCountry('ES')).toBe('CH')
  })
  it('falls back to the operator country when neither geo nor locale know', async () => {
    stubFetch(ok({ country: null }))
    stubNav(['en'])
    expect(await guessCountry('es')).toBe('ES')
  })
  it('returns null when nothing knows (and ignores an invalid operator country)', async () => {
    stubFetch(ok({ country: null }))
    stubNav(['en'])
    expect(await guessCountry(null)).toBeNull()
    expect(await guessCountry('Spain')).toBeNull()
  })
})

describe('countries', () => {
  it('normalizes and validates alpha-2 codes', () => {
    expect(normalizeCountryCode(' de ')).toBe('DE')
    expect(normalizeCountryCode('XX')).toBeNull()
    expect(normalizeCountryCode(undefined)).toBeNull()
  })
  it('localizes names (DE/EN) and sorts by the localized name', () => {
    expect(countryName('DE', 'en')).toBe('Germany')
    expect(countryName('DE', 'de')).toBe('Deutschland')
    const en = countryOptions('en').map((c) => c.code)
    expect(en.indexOf('AT')).toBeLessThan(en.indexOf('DE'))
    expect(new Set(en).size).toBe(en.length)
    expect(en.length).toBeGreaterThan(240)
  })
})
