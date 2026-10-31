import { describe, expect, it } from 'vitest'
import { mockOccupancyStay } from '@/api/mocks'
import {
  childAgesFromRoster,
  hasChildWithoutAge,
  hasOccupancyPricing,
  occupancyBlurb,
} from './occupancyPricing'
import { extraEstimateRequests, type ExtraLine } from './crossSell'

const rule = mockOccupancyStay.occupancy_pricing!

describe('childAgesFromRoster', () => {
  it('maps children with an age, ignores adults', () => {
    const ages = childAgesFromRoster(
      [
        { occupant_age_band: 'adult' },
        { occupant_age_band: 'child', occupant_age: 4 },
        {},
        { occupant_age_band: 'child', occupant_age: 0 },
      ],
      4,
    )
    expect(ages).toEqual([4, 0])
  })

  it('drops a child with no age, out-of-range ages, and caps at count-1', () => {
    expect(
      childAgesFromRoster([{ occupant_age_band: 'child', occupant_age: null }], 2),
    ).toEqual([])
    expect(
      childAgesFromRoster([{ occupant_age_band: 'child', occupant_age: 18 }], 2),
    ).toEqual([])
    const kids = [3, 5, 7].map((a) => ({ occupant_age_band: 'child' as const, occupant_age: a }))
    expect(childAgesFromRoster(kids, 3)).toEqual([3, 5])
  })

  it('flags a child still missing an age', () => {
    expect(hasChildWithoutAge([{ occupant_age_band: 'child', occupant_age: null }])).toBe(true)
    expect(hasChildWithoutAge([{ occupant_age_band: 'child', occupant_age: 6 }])).toBe(false)
    expect(hasChildWithoutAge([{}])).toBe(false)
  })
})

describe('hasOccupancyPricing', () => {
  it('is true when any product carries a rule', () => {
    expect(hasOccupancyPricing({ occupancy_pricing: null }, mockOccupancyStay)).toBe(true)
    expect(hasOccupancyPricing({ occupancy_pricing: null }, undefined)).toBe(false)
  })
})

describe('occupancyBlurb', () => {
  it('describes the model in German', () => {
    const t = occupancyBlurb(rule, 'EUR', 'de')
    expect(t).toContain('inkl. 2 Erwachsene')
    expect(t).toContain('weitere Erwachsene +25')
    expect(t).toContain('Kinder 3-11 +12')
    expect(t).toContain('Kinder 0-2 gratis')
  })
  it('describes the model in English', () => {
    expect(occupancyBlurb({ ...rule, included_adults: 1 }, 'EUR', 'en')).toContain('incl. 1 adult')
  })
})

describe('extraEstimateRequests child_ages', () => {
  const line = (product = mockOccupancyStay): ExtraLine => ({
    key: 'k',
    product,
    mode: 'nights',
    days: ['2026-12-01', '2026-12-02'],
    slot: null,
    windowId: null,
    unavailableDays: [],
    checking: false,
    quantity: 1,
  })
  it('sends child_ages only to occupancy-priced lines', () => {
    const [withRule] = extraEstimateRequests([line()], 3, 'de', [4])
    expect(withRule!.body.child_ages).toEqual([4])
    const [plain] = extraEstimateRequests(
      [line({ ...mockOccupancyStay, occupancy_pricing: null })],
      3,
      'de',
      [4],
    )
    expect(plain!.body.child_ages).toBeUndefined()
  })
})
