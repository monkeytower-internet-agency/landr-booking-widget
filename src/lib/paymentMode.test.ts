import { describe, expect, it } from 'vitest'

import { paysDirectly } from './paymentMode'

describe('paysDirectly', () => {
  it('is true when no online method is accepted', () => {
    expect(paysDirectly(['on_site'])).toBe(true)
    expect(paysDirectly(['bank_transfer', 'on_site'])).toBe(true)
  })

  it('is false when online is accepted', () => {
    expect(paysDirectly(['online'])).toBe(false)
    expect(paysDirectly(['online', 'on_site'])).toBe(false)
  })

  it('is false when the config says nothing (older API)', () => {
    expect(paysDirectly(undefined)).toBe(false)
    expect(paysDirectly(null)).toBe(false)
    expect(paysDirectly([])).toBe(false)
  })
})
