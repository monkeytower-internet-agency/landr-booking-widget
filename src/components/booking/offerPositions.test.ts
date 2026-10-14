import { describe, expect, it } from 'vitest'

import type { OfferPosition } from '@/api/client'

import { hasSaving } from './offerPositions'

describe('hasSaving', () => {
  const p: OfferPosition = {
    label: 'x', units: 1, participants: 1,
    original_unit_price: 100, unit_price: 80, original_total: 100, total: 80,
  }
  it('is true only when savings are on and the totals differ', () => {
    expect(hasSaving(p, true)).toBe(true)
    expect(hasSaving(p, false)).toBe(false)
    expect(hasSaving({ ...p, original_total: 80 }, true)).toBe(false)
  })
})
