/**
 * landr-821d6.7: unit tests for the locale-resolution helpers.
 * Covers pickLocalized's exact/base-language fallback chain,
 * configureCustomerLocale()'s whitelist applied by browserLocale(), and
 * resolveCustomerStageLabel's localization of the (server-pre-resolved)
 * stage label.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CustomerStageLabel } from '@/api/types'
import { browserLocale, configureCustomerLocale, pickLocalized, resolveCustomerStageLabel } from './locale'

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
