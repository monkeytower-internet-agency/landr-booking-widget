import { describe, expect, it } from 'vitest'

import type { EstimateLineItem } from '@/api/types'
import { mergeSameLines } from './priceSidebarHelpers'

const line = (over: Partial<EstimateLineItem> = {}): EstimateLineItem => ({
  product_id: 'bf-1',
  label: 'Breakfast',
  qty: 1,
  units: 7,
  unit_price: '12.00',
  line_total: '84.00',
  paid_to: 'hotel',
  price_unit: 'guest_night',
  ...over,
})

describe('mergeSameLines (landr-ey8fx)', () => {
  it('folds the per-guest lines of one extra into one: 2 x 7 nights = 168.00', () => {
    const out = mergeSameLines([
      line({ participant_ids: ['g1'] }),
      line({ participant_ids: ['g2'] }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ label: 'Breakfast', qty: 2, units: 7, line_total: '168.00' })
    expect(out[0]!.participant_ids).toEqual(['g1', 'g2'])
  })

  it('keeps different products and different rates apart, in order', () => {
    const room = line({ product_id: 'room', label: 'Single', units: 7, unit_price: '80.00', line_total: '560.00', price_unit: null })
    const out = mergeSameLines([room, line(), line({ unit_price: '15.00', line_total: '105.00' }), line()])
    expect(out.map((l) => [l.label, l.qty, l.line_total])).toEqual([
      ['Single', 1, '560.00'],
      ['Breakfast', 2, '168.00'],
      ['Breakfast', 1, '105.00'],
    ])
  })

  it('leaves unique lines untouched', () => {
    const only = line()
    expect(mergeSameLines([only])[0]).toBe(only)
  })
})
