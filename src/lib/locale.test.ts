/**
 * landr-821d6.7: unit tests for the locale-resolution helpers.
 * Covers pickLocalized's exact/base-language fallback chain,
 * configureCustomerLocale()'s whitelist applied by browserLocale(), and
 * resolveCustomerStageLabel's customer_label -> label fallback.
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
})

describe('resolveCustomerStageLabel', () => {
  const stage: CustomerStageLabel = {
    code: 'awaiting_payment',
    label: 'Awaiting payment',
    label_localized: { es: 'Pendiente de pago' },
    customer_label: 'Payment pending',
    customer_label_localized: { es: 'Pago pendiente' },
  }

  it('prefers the localized customer_label when set', () => {
    expect(resolveCustomerStageLabel(stage, 'es')).toBe('Pago pendiente')
    expect(resolveCustomerStageLabel(stage, 'en')).toBe('Payment pending')
  })

  it('falls back to the staff label when the operator has not set a customer_label', () => {
    const noCustomerLabel: CustomerStageLabel = {
      ...stage,
      customer_label: null,
      customer_label_localized: null,
    }
    expect(resolveCustomerStageLabel(noCustomerLabel, 'es')).toBe('Pendiente de pago')
    expect(resolveCustomerStageLabel(noCustomerLabel, 'en')).toBe('Awaiting payment')
  })
})
