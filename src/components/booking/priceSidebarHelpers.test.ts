import { describe, expect, it } from 'vitest'
import type { EstimateAppliedRule, EstimateLineItem } from '@/api/types'
import {
  buildAddonLines,
  buildDiscountExplanation,
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

describe('buildDiscountExplanation — per_streak_tier (landr-8s6c)', () => {
  it('explains a single 3-day consecutive run at €75/day', () => {
    const rule: EstimateAppliedRule = {
      kind: 'per_streak_tier',
      detail: {
        streaks: [[3, 75.0]],
        per_participant: false,
        participants: null,
      },
    }
    const lines = buildDiscountExplanation(rule, 'EUR')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/3 consecutive days/)
    expect(lines[0]).toMatch(/75/)
    expect(lines[0]).toMatch(/€|EUR/)
    expect(lines[0]).toMatch(/\/day/)
    // No participant multiplier when per_participant is false.
    expect(lines[0]).not.toMatch(/participant/)
  })

  it('lists one line per run for multiple streaks', () => {
    const rule: EstimateAppliedRule = {
      kind: 'per_streak_tier',
      detail: {
        // 3-day run at 75/day + a separate 2-day run at 90/day.
        streaks: [
          [3, 75.0],
          [2, 90.0],
        ],
        per_participant: false,
        participants: null,
      },
    }
    const lines = buildDiscountExplanation(rule, 'EUR')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(/3 consecutive days/)
    expect(lines[0]).toMatch(/75/)
    expect(lines[1]).toMatch(/2 consecutive days/)
    expect(lines[1]).toMatch(/90/)
  })

  it('notes the participant multiplier when per_participant is set', () => {
    const rule: EstimateAppliedRule = {
      kind: 'per_streak_tier',
      detail: {
        streaks: [[3, 75.0]],
        per_participant: true,
        participants: 2,
      },
    }
    const lines = buildDiscountExplanation(rule, 'EUR')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/3 consecutive days/)
    expect(lines[0]).toMatch(/× 2 participants/)
  })

  it('uses singular "1 day" (no "consecutive") and singular participant noun (landr-gm29)', () => {
    const rule: EstimateAppliedRule = {
      kind: 'per_streak_tier',
      detail: {
        streaks: [[1, 90.0]],
        per_participant: true,
        participants: 1,
      },
    }
    const lines = buildDiscountExplanation(rule, 'EUR')
    expect(lines[0]).toMatch(/^1 day ·/)
    expect(lines[0]).not.toMatch(/consecutive/)
    expect(lines[0]).toMatch(/× 1 participant\b/)
  })

  it('returns [] when the streaks detail is missing or empty', () => {
    expect(
      buildDiscountExplanation({ kind: 'per_streak_tier' }, 'EUR'),
    ).toEqual([])
    expect(
      buildDiscountExplanation(
        { kind: 'per_streak_tier', detail: { streaks: [] } },
        'EUR',
      ),
    ).toEqual([])
  })
})

describe('buildDiscountExplanation — per_total_days_tier (landr-8s6c)', () => {
  it('explains a 4-day tier priced per unit', () => {
    const rule: EstimateAppliedRule = {
      kind: 'per_total_days_tier',
      detail: {
        days: 4,
        per_participant: false,
        participants: null,
        tier: {
          threshold_min: 4,
          threshold_max: null,
          amount_per_unit: 70.0,
          amount_total: null,
        },
      },
    }
    const lines = buildDiscountExplanation(rule, 'EUR')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/4 days/)
    expect(lines[0]).toMatch(/70/)
    expect(lines[0]).toMatch(/\/day/)
  })

  it('derives a per-day rate from amount_total when amount_per_unit is null', () => {
    const rule: EstimateAppliedRule = {
      kind: 'per_total_days_tier',
      detail: {
        days: 5,
        per_participant: false,
        participants: null,
        // 350 total over 5 days → 70/day.
        tier: {
          threshold_min: 5,
          threshold_max: null,
          amount_per_unit: null,
          amount_total: 350.0,
        },
      },
    }
    const lines = buildDiscountExplanation(rule, 'EUR')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/5 days/)
    expect(lines[0]).toMatch(/70/)
  })

  it('reflects the participant multiplier', () => {
    const rule: EstimateAppliedRule = {
      kind: 'per_total_days_tier',
      detail: {
        days: 3,
        per_participant: true,
        participants: 3,
        tier: {
          threshold_min: 3,
          threshold_max: null,
          amount_per_unit: 75.0,
          amount_total: null,
        },
      },
    }
    const lines = buildDiscountExplanation(rule, 'EUR')
    expect(lines[0]).toMatch(/3 days/)
    expect(lines[0]).toMatch(/× 3 participants/)
  })

  it('returns [] when no tier matched or no rate is present', () => {
    expect(
      buildDiscountExplanation(
        { kind: 'per_total_days_tier', detail: { days: 3, matched: false } },
        'EUR',
      ),
    ).toEqual([])
    // A tier with neither per-unit nor total can't yield a per-day rate.
    expect(
      buildDiscountExplanation(
        {
          kind: 'per_total_days_tier',
          detail: { days: 3, tier: { threshold_min: 3 } },
        },
        'EUR',
      ),
    ).toEqual([])
  })
})

describe('buildDiscountExplanation — non-explainable kinds (landr-8s6c)', () => {
  it('returns [] for voucher / unknown kinds', () => {
    expect(
      buildDiscountExplanation({ kind: 'voucher_percent' }, 'EUR'),
    ).toEqual([])
    expect(buildDiscountExplanation({ kind: 'per_day_base' }, 'EUR')).toEqual(
      [],
    )
  })
})

describe('buildDiscountExplanation — savings line (landr-qj1g)', () => {
  it('appends a savings line for per_streak_tier when base_tier is present', () => {
    const rule: EstimateAppliedRule = {
      kind: 'per_streak_tier',
      detail: {
        streaks: [[3, 75.0]],
        per_participant: false,
        participants: null,
        base_tier: { threshold_min: 1, amount_per_unit: 90.0 },
      },
    }
    const lines = buildDiscountExplanation(rule, 'EUR')
    // Line 0: the applied rate explanation.
    expect(lines[0]).toMatch(/3 consecutive days/)
    expect(lines[0]).toMatch(/75/)
    // Line 1: the savings line (90 − 75 = 15).
    expect(lines).toHaveLength(2)
    expect(lines[1]).toMatch(/save/)
    expect(lines[1]).toMatch(/15/)
    expect(lines[1]).toMatch(/vs standard rate/)
  })

  it('does not append a savings line for per_streak_tier when base_tier is absent', () => {
    const rule: EstimateAppliedRule = {
      kind: 'per_streak_tier',
      detail: {
        streaks: [[1, 90.0]],
        per_participant: false,
        participants: null,
        // no base_tier — customer is on the base tier already
      },
    }
    const lines = buildDiscountExplanation(rule, 'EUR')
    expect(lines).toHaveLength(1)
    expect(lines[0]).not.toMatch(/save/)
  })

  it('appends a savings line for per_total_days_tier when base_tier is present', () => {
    const rule: EstimateAppliedRule = {
      kind: 'per_total_days_tier',
      detail: {
        days: 3,
        per_participant: false,
        participants: null,
        tier: {
          threshold_min: 3,
          threshold_max: null,
          amount_per_unit: 80.0,
          amount_total: null,
        },
        base_tier: { threshold_min: 1, amount_per_unit: 100.0 },
      },
    }
    const lines = buildDiscountExplanation(rule, 'EUR')
    // Line 0: the applied rate explanation.
    expect(lines[0]).toMatch(/3 days/)
    expect(lines[0]).toMatch(/80/)
    // Line 1: the savings line (100 − 80 = 20).
    expect(lines).toHaveLength(2)
    expect(lines[1]).toMatch(/save/)
    expect(lines[1]).toMatch(/20/)
    expect(lines[1]).toMatch(/vs standard rate/)
  })

  it('does not append a savings line for per_total_days_tier when base_tier absent', () => {
    const rule: EstimateAppliedRule = {
      kind: 'per_total_days_tier',
      detail: {
        days: 1,
        per_participant: false,
        participants: null,
        tier: {
          threshold_min: 1,
          threshold_max: 2,
          amount_per_unit: 100.0,
          amount_total: null,
        },
        // no base_tier — customer is already on the base tier
      },
    }
    const lines = buildDiscountExplanation(rule, 'EUR')
    expect(lines).toHaveLength(1)
    expect(lines[0]).not.toMatch(/save/)
  })
})
