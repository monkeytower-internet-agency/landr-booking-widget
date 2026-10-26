import { describe, expect, it } from 'vitest'

import { verificationStrings, waiverLocale } from './verificationStrings'

describe('verificationStrings', () => {
  const en = verificationStrings('en')

  it.each(['de', 'es', 'tr', 'de-AT', 'es-MX', 'tr-TR'])('%s has every key filled', (code) => {
    const bundle = verificationStrings(code)
    expect(Object.keys(bundle).sort()).toEqual(Object.keys(en).sort())
    for (const [key, value] of Object.entries(bundle)) {
      expect(value.trim(), key).not.toBe('')
    }
  })

  it.each(['de', 'es', 'tr'])('%s is a real translation, not the English fallback', (code) => {
    const bundle = verificationStrings(code) as unknown as Record<string, string>
    expect(bundle.heading).not.toBe(en.heading)
    expect(bundle.pendingTitle).not.toBe(en.pendingTitle)
  })

  it('falls back to English for other languages', () => {
    expect(verificationStrings('fr')).toBe(en)
    expect(verificationStrings(undefined)).toBe(en)
  })

  it('stores the waiver as de or en only', () => {
    expect(waiverLocale('de-DE')).toBe('de')
    expect(waiverLocale('es')).toBe('en')
    expect(waiverLocale('tr')).toBe('en')
  })
})
