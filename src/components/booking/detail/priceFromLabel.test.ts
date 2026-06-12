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
})
