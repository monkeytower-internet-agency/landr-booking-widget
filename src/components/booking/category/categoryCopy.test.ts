import { describe, expect, it } from 'vitest'
import { offerCountLabel } from './categoryCopy'

describe('offerCountLabel (landr-d8rg.5)', () => {
  it('uses the singular noun for exactly one offer', () => {
    expect(offerCountLabel(1)).toBe('1 offer')
  })

  it('uses the plural noun for more than one offer', () => {
    expect(offerCountLabel(2)).toBe('2 offers')
    expect(offerCountLabel(4)).toBe('4 offers')
  })

  it('pluralises zero (English "0 offers")', () => {
    expect(offerCountLabel(0)).toBe('0 offers')
  })
})
