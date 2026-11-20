import { describe, expect, it } from 'vitest'
import type { Product } from '@/api/types'
import { stepForAlternativeBack, type AlternativeBack, type Step } from './appStepMachine'

describe('landr-f210e.5 hint detour: the back button returns to the review untouched', () => {
  it('hands the review step back as it was', () => {
    const product = { product_id: 'main', name: 'Main' } as Product
    const review = {
      name: 'fill-form',
      product,
      selection: { kind: 'days', selectedDays: ['2026-11-02'] },
    } as unknown as Extract<Step, { name: 'fill-form' }>
    const back: AlternativeBack = { from: review, toProductId: 'other', days: ['2026-11-02'], draft: {} }
    expect(stepForAlternativeBack(back)).toBe(review)
  })
})
