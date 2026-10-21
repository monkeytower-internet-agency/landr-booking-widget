/**
 * landr-d8rg.7: unit tests for the "from €X" price label helper.
 */
import { describe, expect, it } from 'vitest'
import { formatPriceFrom } from './priceFromLabel'

describe('formatPriceFrom', () => {
  it('formats a decimal string with the product currency', () => {
    expect(formatPriceFrom('59.00', 'EUR')).toBe('from €59.00')
  })

  it('defaults to EUR when currency is null/undefined', () => {
    expect(formatPriceFrom('89.00', null)).toBe('from €89.00')
    expect(formatPriceFrom('89.00', undefined)).toBe('from €89.00')
  })

  it('returns null when price_from is null/undefined/blank', () => {
    expect(formatPriceFrom(null, 'EUR')).toBeNull()
    expect(formatPriceFrom(undefined, 'EUR')).toBeNull()
    expect(formatPriceFrom('   ', 'EUR')).toBeNull()
  })

  // landr-bwm91.7: the "from" word + money format follow the locale.
  it('localizes the headline per locale', () => {
    expect(formatPriceFrom('59.00', 'EUR', 'en-US')).toBe('from €59.00')
    expect(formatPriceFrom('59.00', 'EUR', 'de-DE')).toBe('ab 59,00\u00a0€')
    expect(formatPriceFrom('59.00', 'EUR', 'de')).toBe('ab 59,00\u00a0€')
  })

  // landr-8r6oc.4
  it('localizes the headline in Spanish and Turkish', () => {
    expect(formatPriceFrom('59.00', 'EUR', 'es-ES')).toMatch(/^desde /)
    expect(formatPriceFrom('59.00', 'EUR', 'tr-TR')).toMatch(/59,00/)
    expect(formatPriceFrom('59.00', 'EUR', 'tr-TR')).not.toMatch(/^from /)
  })

  it('falls back to English wording for a locale without a bundle', () => {
    expect(formatPriceFrom('59.00', 'EUR', 'pt-PT')).toMatch(/^from /)
  })

  it('still returns null for a blank price in German', () => {
    expect(formatPriceFrom(null, 'EUR', 'de-DE')).toBeNull()
  })
})
