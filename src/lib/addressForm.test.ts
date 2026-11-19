/**
 * landr-wm0jv — per-operator address form: du / sen (informal, default) vs
 * Sie / siz (formal) for the German and Turkish catalogs and the page-scoped
 * strings.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { normalizeAddressForm, setAddressForm } from '@/lib/addressForm'
import { pickCancelBundle } from '@/components/booking/cancelStrings'
import { pausedCopy } from '@/components/booking/pausedStrings'
import { verificationStrings } from '@/components/booking/verificationStrings'
import { de } from './locales/de'
import { deInformal } from './locales/de.informal'
import { tr } from './locales/tr'
import { trInformal } from './locales/tr.informal'
import { pickBundle, SUPPORTED_UI_LANGUAGES } from './strings'

afterEach(() => setAddressForm('formal'))

describe('normalizeAddressForm', () => {
  it('is informal for anything but an explicit formal', () => {
    expect(normalizeAddressForm(undefined)).toBe('informal')
    expect(normalizeAddressForm(null)).toBe('informal')
    expect(normalizeAddressForm('casual')).toBe('informal')
    expect(normalizeAddressForm('informal')).toBe('informal')
    expect(normalizeAddressForm('formal')).toBe('formal')
  })
})

describe('catalog selection', () => {
  it('serves the formal German and Turkish catalogs when formal', () => {
    setAddressForm('formal')
    expect(pickBundle('de-DE')).toBe(de)
    expect(pickBundle('tr-TR')).toBe(tr)
    expect(pickBundle('de').enterValidEmail).toBe('Bitte geben Sie eine gültige E-Mail-Adresse ein.')
  })

  it('serves the informal catalogs when informal (and when absent)', () => {
    setAddressForm(undefined)
    expect(pickBundle('de-DE')).toBe(deInformal)
    expect(pickBundle('tr-TR')).toBe(trInformal)
    expect(pickBundle('de').enterValidEmail).toBe('Bitte gib eine gültige E-Mail-Adresse ein.')
    expect(pickBundle('tr').continueLabel).toBe(pickBundle('tr').continueLabel)
  })

  it('leaves es / it / fr / en untouched by the form', () => {
    setAddressForm('formal')
    const before = ['es', 'it', 'fr', 'en'].map((l) => pickBundle(l))
    setAddressForm('informal')
    expect(['es', 'it', 'fr', 'en'].map((l) => pickBundle(l))).toEqual(before)
    expect(SUPPORTED_UI_LANGUAGES).toContain('de')
  })
})

describe('informal catalogs are real du / sen copy', () => {
  const FORMAL_DE = /\b(Sie|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres|Ihnen)\b/
  it('de.informal has the same keys as the formal set and no Sie / Ihr', () => {
    expect(Object.keys(deInformal).sort()).toEqual(Object.keys(de).sort())
    const bad = Object.entries(deInformal).filter(([k, v]) => k !== 'hotelSettledAtCheckin' && FORMAL_DE.test(String(v))) // 'Sie ist' = it is
    expect(bad).toEqual([])
  })

  it('tr.informal has the same keys and no 2nd-person-plural endings or siz pronouns', () => {
    expect(Object.keys(trInformal).sort()).toEqual(Object.keys(tr).sort())
    const FORMAL_TR = /\b(siz|Siz|size|Size|sizi|Sizi|sizin|Sizin|[a-zçğıöşü]+(sınız|siniz|sunuz|sünüz|ınız|iniz|unuz|ünüz))\b/
    // 'Üzgünüz' is the 1st person plural (we are sorry), not a formal ending.
    const bad = Object.entries(trInformal).filter(([, v]) => FORMAL_TR.test(String(v).replace(/Üzgünüz/g, '')))
    expect(bad).toEqual([])
  })

  it('keeps placeholders identical to the formal set', () => {
    const ph = (v: unknown) => [...String(v).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join()
    for (const [set, formal] of [[deInformal, de], [trInformal, tr]] as const) {
      const bad = Object.keys(formal).filter(
        (k) => ph((set as Record<string, string>)[k]) !== ph((formal as Record<string, string>)[k]),
      )
      expect(bad).toEqual([])
    }
  })

  it('spot-checks the voice', () => {
    expect(deInformal.checkBackLater).toBe('Schau bald wieder vorbei.')
    expect(deInformal.readyToContinue).toBe('Du kannst fortfahren.')
    expect(trInformal.multiDayPickerHelp).toBe('Eklemek veya çıkarmak istediğin günlere dokun.')
  })
})

describe('page-scoped strings follow the form', () => {
  it('cancel page', () => {
    setAddressForm('formal')
    expect(pickCancelBundle('de').loadingTitle).toBe('Ihre Buchung wird geladen …')
    setAddressForm('informal')
    expect(pickCancelBundle('de').loadingTitle).toBe('Deine Buchung wird geladen …')
    expect(pickCancelBundle('tr').loadingTitle).toBe('Rezervasyonun yükleniyor…')
    expect(pickCancelBundle('en')).toBe(pickCancelBundle('en'))
  })

  it('verification screens', () => {
    setAddressForm('formal')
    expect(verificationStrings('de').heading).toBe('Ihre Unterlagen')
    expect(verificationStrings('tr').heading).toBe('Belgeleriniz')
    setAddressForm('informal')
    expect(verificationStrings('de').heading).toBe('Deine Unterlagen')
    expect(verificationStrings('tr').heading).toBe('Belgelerin')
  })

  it('paused gate', () => {
    setAddressForm('formal')
    expect(pausedCopy(null, 'de').body).toContain('Schauen Sie')
    setAddressForm('informal')
    expect(pausedCopy(null, 'de').body).toContain('Schau bald')
    expect(pausedCopy(null, 'es').body).toContain('Vuelve')
  })
})
