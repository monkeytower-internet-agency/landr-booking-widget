/**
 * landr-821d6.7: unit tests for the locale-resolution helpers.
 * Covers pickLocalized's exact/base-language fallback chain,
 * configureCustomerLocale()'s whitelist applied by browserLocale(), and
 * resolveCustomerStageLabel's localization of the (server-pre-resolved)
 * stage label.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CustomerStageLabel } from '@/api/types'
import {
  apiLocale,
  browserLocale,
  configureCustomerLocale,
  overrideBookingLocale,
  pickLocalized,
  resolveCustomerStageLabel,
} from './locale'

function setBrowserLanguage(language: string) {
  vi.stubGlobal('navigator', { language })
}

describe('pickLocalized', () => {
  it('returns the exact locale match when present', () => {
    expect(pickLocalized('Room', { es: 'Habitación', de: 'Zimmer' }, 'es')).toBe(
      'Habitación',
    )
  })

  it('falls back to the base language when the exact regional locale is absent', () => {
    expect(pickLocalized('Room', { es: 'Habitación' }, 'es-MX')).toBe('Habitación')
  })

  it('falls back to the base fallback string when no localized match exists', () => {
    expect(pickLocalized('Room', { de: 'Zimmer' }, 'es')).toBe('Room')
    expect(pickLocalized('Room', null, 'es')).toBe('Room')
  })

  it('returns an empty string when both fallback and localized are absent', () => {
    expect(pickLocalized(null, null, 'es')).toBe('')
  })
})

describe('browserLocale / configureCustomerLocale', () => {
  afterEach(() => {
    // Reset the module-level whitelist so tests don't leak into each other.
    configureCustomerLocale(null, null)
    vi.unstubAllGlobals()
  })

  it('returns the raw navigator locale when no whitelist is configured', () => {
    setBrowserLanguage('it')
    configureCustomerLocale(null, null)
    expect(browserLocale()).toBe('it')
  })

  it('returns the raw locale when it is in the operator customer_languages whitelist', () => {
    setBrowserLanguage('es')
    configureCustomerLocale(['en', 'es', 'de'], 'en')
    expect(browserLocale()).toBe('es')
  })

  it('falls back to the base language when the exact regional tag is not whitelisted but the base is', () => {
    setBrowserLanguage('es-MX')
    configureCustomerLocale(['en', 'es'], 'en')
    expect(browserLocale()).toBe('es')
  })

  it('falls back to default_locale when the browser locale is not in the whitelist', () => {
    setBrowserLanguage('it')
    configureCustomerLocale(['en', 'es', 'de'], 'de')
    expect(browserLocale()).toBe('de')
  })

  it('an empty customer_languages array is treated as no whitelist', () => {
    setBrowserLanguage('it')
    configureCustomerLocale([], 'de')
    expect(browserLocale()).toBe('it')
  })

  it('landr-821d6.7 review round: falls back to customer_languages[0] when default_locale is absent (GET .../settings does not return it yet)', () => {
    setBrowserLanguage('it')
    configureCustomerLocale(['de', 'es'], null)
    expect(browserLocale()).toBe('de')
  })

  it('default_locale still wins over customer_languages[0] when both are present', () => {
    setBrowserLanguage('it')
    configureCustomerLocale(['de', 'es'], 'es')
    expect(browserLocale()).toBe('es')
  })
})

describe('overrideBookingLocale (landr-otml0.3 review fix MAJOR 2)', () => {
  afterEach(() => {
    overrideBookingLocale(null)
    configureCustomerLocale(null, null)
    vi.unstubAllGlobals()
  })

  it('wins over the raw navigator locale', () => {
    setBrowserLanguage('it')
    overrideBookingLocale('de')
    expect(browserLocale()).toBe('de')
  })

  it('wins over the operator whitelist too — the invite already told us this specific person’s language', () => {
    setBrowserLanguage('es')
    configureCustomerLocale(['en', 'es'], 'en')
    overrideBookingLocale('de')
    expect(browserLocale()).toBe('de')
  })

  it('a null/undefined override falls back to the normal resolution', () => {
    setBrowserLanguage('it')
    overrideBookingLocale(null)
    expect(browserLocale()).toBe('it')
    overrideBookingLocale(undefined)
    expect(browserLocale()).toBe('it')
  })

  it('clearing the override after it was set restores normal resolution', () => {
    setBrowserLanguage('it')
    overrideBookingLocale('de')
    expect(browserLocale()).toBe('de')
    overrideBookingLocale(null)
    expect(browserLocale()).toBe('it')
  })
})

describe('browserLocale ?lang= host-page hint', () => {
  function setUrl(search: string) {
    window.history.replaceState(null, '', `/${search}`)
  }

  afterEach(() => {
    setUrl('')
    window.sessionStorage.clear()
    overrideBookingLocale(null)
    configureCustomerLocale(null, null)
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('beats the navigator locale', () => {
    setBrowserLanguage('en-US')
    setUrl('?w=tok&lang=de-DE')
    expect(browserLocale()).toBe('de-DE')
  })

  it('normalizes _ to - and lowercases the language subtag', () => {
    setBrowserLanguage('en-US')
    setUrl('?lang=de_DE')
    expect(browserLocale()).toBe('de-DE')
    setUrl('?lang=ES')
    expect(browserLocale()).toBe('es')
  })

  it('still goes through the operator whitelist and default-locale fallback', () => {
    setBrowserLanguage('de')
    configureCustomerLocale(['en', 'es', 'de'], 'en')
    setUrl('?lang=es-ES')
    expect(browserLocale()).toBe('es')
    setUrl('?lang=fr-FR')
    expect(browserLocale()).toBe('en')
  })

  it('loses to an invite override', () => {
    setBrowserLanguage('en-US')
    setUrl('?lang=de-DE')
    overrideBookingLocale('es')
    expect(browserLocale()).toBe('es')
  })

  it('is remembered for the tab and replaced by a new explicit ?lang=', () => {
    setBrowserLanguage('en-US')
    setUrl('?lang=de-DE')
    expect(browserLocale()).toBe('de-DE')
    setUrl('?w=tok')
    expect(browserLocale()).toBe('de-DE')
    setUrl('?lang=es')
    expect(browserLocale()).toBe('es')
    setUrl('')
    expect(browserLocale()).toBe('es')
  })

  it('ignores an invalid value (navigator wins, a remembered hint survives)', () => {
    setBrowserLanguage('it')
    for (const bad of ['', 'd', 'deutsch', 'de-DE-x-phonebook', '<script>', 'de DE']) {
      setUrl(`?lang=${encodeURIComponent(bad)}`)
      expect(browserLocale()).toBe('it')
    }
    setUrl('?lang=de')
    expect(browserLocale()).toBe('de')
    setUrl('?lang=%3Cscript%3E')
    expect(browserLocale()).toBe('de')
  })

  it('still works from the query when sessionStorage throws', () => {
    setBrowserLanguage('en-US')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    setUrl('?lang=de')
    expect(browserLocale()).toBe('de')
    setUrl('')
    expect(browserLocale()).toBe('en-US')
  })

  it('leaves demo mode alone: demo follows its own ?lang=, never the remembered hint', () => {
    setBrowserLanguage('en-US')
    setUrl('?lang=es')
    expect(browserLocale()).toBe('es')
    setUrl('?demo=paragliding&lang=de-DE')
    expect(browserLocale()).toBe('de')
    setUrl('?demo=paragliding')
    expect(browserLocale()).toBe('en')
    setUrl('?demo=paragliding&lang=it')
    expect(browserLocale()).toBe('it')
    // The demo visit did not touch the remembered hint.
    setUrl('')
    expect(browserLocale()).toBe('es')
  })
})

describe('resolveCustomerStageLabel', () => {
  // landr-821d6.7 review round: the customer_label-vs-staff-label choice
  // is made SERVER-SIDE (public_get_booking_by_token / booking_submit.
  // finalize) — the wire payload only ever carries the already-chosen
  // {code, label, label_localized}, no separate customer_label field.
  const stage: CustomerStageLabel = {
    code: 'awaiting_payment',
    label: 'Payment pending',
    label_localized: { es: 'Pago pendiente' },
  }

  it('localizes the server-resolved label', () => {
    expect(resolveCustomerStageLabel(stage, 'es')).toBe('Pago pendiente')
    expect(resolveCustomerStageLabel(stage, 'en')).toBe('Payment pending')
  })

  it('falls back to the base label when no translation matches the locale', () => {
    expect(resolveCustomerStageLabel(stage, 'it')).toBe('Payment pending')
  })
})

// landr-nva1a.4 review round: EstimateRequest.locale is max_length=16 and
// only branches on language[-region] server-side — a longer/extended
// navigator.language value must be shaped down, not sent verbatim (which
// would 422 the estimate request).
describe('apiLocale', () => {
  it('passes through a plain language-region tag unchanged', () => {
    expect(apiLocale('en-US')).toBe('en-US')
    expect(apiLocale('de')).toBe('de')
  })

  it('drops extra subtags past language-region', () => {
    expect(apiLocale('zh-Hans-CN')).toBe('zh-Hans')
    expect(apiLocale('de-DE-u-co-phonebk')).toBe('de-DE')
  })

  it('never exceeds 16 characters', () => {
    const shaped = apiLocale('supercalifragilisticexpialidocious-XX')
    expect(shaped.length).toBeLessThanOrEqual(16)
  })
})
