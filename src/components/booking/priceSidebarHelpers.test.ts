import { describe, expect, it } from 'vitest'
import type { EstimateLineItem } from '@/api/types'
import {
  buildAddonLines,
  formatMoney,
  isDiscountRule,
  splitLineItems,
} from './priceSidebarHelpers'

describe('buildAddonLines (landr-qez0)', () => {
  it('merges rooms and addons into a single qty>0 list', () => {
    expect(
      buildAddonLines(
        [
          { productId: 'room-1', quantity: 2 },
          { productId: 'room-2', quantity: 0 },
        ],
        [
          { productId: 'bf', quantity: 4 },
          { productId: 'video', quantity: 0 },
        ],
      ),
    ).toEqual([
      { product_id: 'room-1', qty: 2 },
      { product_id: 'bf', qty: 4 },
    ])
  })

  it('returns an empty array when nothing is selected', () => {
    expect(buildAddonLines([], [])).toEqual([])
  })
})

describe('formatMoney (landr-qez0)', () => {
  it('formats a decimal string with the currency symbol', () => {
    const result = formatMoney('180.00', 'EUR')
    expect(result).toMatch(/180/)
    expect(result).toMatch(/€|EUR/)
  })

  it('falls back to "amount currency" when Intl rejects the code', () => {
    // Use a deliberately bogus currency code to exercise the fallback.
    const result = formatMoney('180.00', 'NOTACURRENCY')
    expect(result).toContain('180')
    expect(result).toContain('NOTACURRENCY')
  })

  it('passes through unparseable amounts without throwing', () => {
    expect(formatMoney('not-a-number', 'EUR')).toContain('EUR')
  })
})

describe('splitLineItems (landr-qez0)', () => {
  const items: EstimateLineItem[] = [
    {
      product_id: 'a',
      label: 'A',
      qty: 1,
      units: 1,
      unit_price: '10.00',
      line_total: '10.00',
      paid_to: 'operator',
    },
    {
      product_id: 'b',
      label: 'B',
      qty: 1,
      units: 1,
      unit_price: '20.00',
      line_total: '20.00',
      paid_to: 'hotel',
    },
  ]
  it('partitions on paid_to', () => {
    const split = splitLineItems(items)
    expect(split.operator.map((i) => i.product_id)).toEqual(['a'])
    expect(split.hotel.map((i) => i.product_id)).toEqual(['b'])
  })
})

describe('isDiscountRule (landr-qez0)', () => {
  it('flags tier and voucher rules as discount-worthy', () => {
    expect(isDiscountRule('per_total_days_tier')).toBe(true)
    expect(isDiscountRule('per_streak_tier')).toBe(true)
    expect(isDiscountRule('voucher_percent')).toBe(true)
    expect(isDiscountRule('voucher_fixed')).toBe(true)
  })

  it('does not flag base/audit rules', () => {
    expect(isDiscountRule('per_day_base')).toBe(false)
    expect(isDiscountRule('tax_split')).toBe(false)
  })
})
