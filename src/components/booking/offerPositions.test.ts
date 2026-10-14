import { describe, expect, it } from 'vitest'

import type { OfferPosition } from '@/api/client'

import { hasSaving, splitPositionLabel } from './offerPositions'

describe('splitPositionLabel (landr-8f1sh.4)', () => {
  it('strips the baked-in regular per-day price tail', () => {
    expect(
      splitPositionLabel('Guided Paragliding Day · 2 consecutive days · €90.00/day × 1 participant'),
    ).toEqual({ title: 'Guided Paragliding Day · 2 consecutive days', perDay: true })
    expect(
      splitPositionLabel('Tandem · 3 days · EUR 90.00/day × 4 participants'),
    ).toEqual({ title: 'Tandem · 3 days', perDay: true })
  })

  it('leaves a flat line label alone', () => {
    expect(splitPositionLabel('Video package')).toEqual({ title: 'Video package', perDay: false })
    expect(splitPositionLabel('Sailing × 2')).toEqual({ title: 'Sailing × 2', perDay: false })
  })
})

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
