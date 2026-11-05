import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InlineGuestAges } from './InlineGuestAges'
import { mockOccupancyStay } from '@/api/mocks'
import {
  childAgesFromRoster,
  hasChildWithoutAge,
  hasOccupancyPricing,
  occupancyBlurb,
} from './occupancyPricing'
import {
  EMPTY_INLINE_MODULES,
  childAgesFromEntries,
  extraEstimateRequests,
  inheritLine,
  inlineModulesPending,
  lineNeeds,
  type ExtraLine,
} from './crossSell'

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

describe('inline guest ages on added lines', () => {
  const ctx = {
    participantLanguages: {},
    participantCount: 3,
    mainLanguages: [],
    answeredFormKeys: [],
    hasPickup: true,
    agesNeeded: true,
  }
  const lines = [
    inheritLine({ ...mockOccupancyStay, product_id: 'a' }, ['2026-12-01', '2026-12-02'], 'a'),
    inheritLine({ ...mockOccupancyStay, product_id: 'b' }, ['2026-12-01', '2026-12-02'], 'b'),
  ]

  it('is owned by the first occupancy-priced line only', () => {
    const needs = lineNeeds(lines, ctx)
    expect(needs.a!.ages).toBe(true)
    expect(needs.b!.ages).toBeUndefined()
  })

  it('is not needed when ages were collected or the line has no rule', () => {
    expect(lineNeeds(lines, { ...ctx, agesNeeded: false }).a!.ages).toBeUndefined()
    const plain = [inheritLine({ ...mockOccupancyStay, occupancy_pricing: null }, ['2026-12-01'], 'p')]
    expect(lineNeeds(plain, ctx).p!.ages).toBeUndefined()
  })

  it('blocks confirm until a child has an age, then maps child_ages', () => {
    const state = { ...EMPTY_INLINE_MODULES }
    const open = { ...state, ages: { 1: { band: 'child' as const, age: null } } }
    expect(inlineModulesPending(lines, ctx, open)).toBe(true)
    const done = { ...state, ages: { 1: { band: 'child' as const, age: 6 }, 2: { band: 'adult' as const, age: null } } }
    expect(inlineModulesPending(lines, ctx, done)).toBe(false)
    expect(childAgesFromEntries(done.ages, 3)).toEqual([6])
    expect(childAgesFromEntries({ 0: { band: 'child', age: 5 } }, 3)).toEqual([])
  })

  it('renders controls for every guest but the first', () => {
    const onChange = vi.fn()
    render(<InlineGuestAges labels={['Ada', 'Bo', 'Cy']} value={{}} onChange={onChange} locale="en" />)
    expect(screen.queryByTestId('inline-age-band-0')).not.toBeInTheDocument()
    fireEvent.change(screen.getByTestId('inline-age-band-1'), { target: { value: 'child' } })
    expect(onChange).toHaveBeenCalledWith({ 1: { band: 'child', age: null } })
    expect(screen.getByTestId('inline-age-band-2')).toBeInTheDocument()
  })
})
