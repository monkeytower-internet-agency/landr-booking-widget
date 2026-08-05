import { describe, expect, it } from 'vitest'
import { offerCountLabel } from './categoryCopy'

describe('offerCountLabel (landr-d8rg.5)', () => {
  it('uses the singular noun for exactly one offer', () => {
    expect(offerCountLabel({ product_count: 1, bookable_count: 1 })).toBe('1 offer')
  })

  it('uses the plural noun for more than one offer', () => {
    expect(offerCountLabel({ product_count: 2, bookable_count: 2 })).toBe('2 offers')
    expect(offerCountLabel({ product_count: 4, bookable_count: 4 })).toBe('4 offers')
  })

  it('pluralises zero (English "0 offers") for a genuinely empty group', () => {
    expect(offerCountLabel({ product_count: 0, bookable_count: 0 })).toBe('0 offers')
  })
})

// landr-872c: FULLY SOLD-OUT (product_count > 0, bookable_count === 0) reads
// "Fully booked" instead of "0 offers" — reusing FullyBookedNotice's exact
// copy rather than a second string for the same concept.
describe('offerCountLabel — landr-872c FULLY SOLD-OUT', () => {
  it('reads "Fully booked" when product_count > 0 and bookable_count === 0', () => {
    expect(offerCountLabel({ product_count: 3, bookable_count: 0 })).toBe('Fully booked')
  })

  it('reads the normal offer count for a MIXED category (some bookable)', () => {
    expect(offerCountLabel({ product_count: 3, bookable_count: 1 })).toBe('3 offers')
  })

  it('FAILS OPEN on an absent bookable_count — never "Fully booked"', () => {
    expect(offerCountLabel({ product_count: 3, bookable_count: undefined })).toBe('3 offers')
  })

  it('a genuinely empty group (product_count = 0) is never "Fully booked"', () => {
    expect(offerCountLabel({ product_count: 0, bookable_count: 0 })).toBe('0 offers')
  })
})
