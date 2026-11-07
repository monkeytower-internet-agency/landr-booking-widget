import { describe, expect, it } from 'vitest'
import { mockOccupancyStay } from '@/api/mocks'
import { DEFAULT_AGE_BANDS } from './ageBands'
import {
  inheritLine,
  inlineModulesPending,
  lineNeeds,
  refinedAges,
  type CrossSellContext,
  type InlineModuleState,
} from './crossSell'

const CTX: CrossSellContext = {
  participantLanguages: {},
  participantCount: 2,
  mainLanguages: [],
  answeredFormKeys: [],
  hasPickup: true,
  agesNeeded: true,
}
const NONE: InlineModuleState = { languages: null, formKeys: [], pickupLocationId: null }
const FLOW = {
  modules: null,
  age_needed: true,
  age_bands: [
    { key: 'child', min_age: 0, max_age: 17 },
    { key: 'adult', min_age: 18, max_age: 64 },
    { key: 'age_65_plus', min_age: 65, max_age: null },
  ],
}

describe('cross-sell inline ages follow the flow (landr-zcb24.2)', () => {
  const product = { ...mockOccupancyStay, occupancy_pricing: undefined }
  const line = inheritLine(product, ['2026-12-01'], 'l1', FLOW)

  it('an added line whose flow asks ages brings the bands and the booker confirmation', () => {
    const needs = lineNeeds([line], CTX)
    expect(needs.l1.ages).toBe(true)
    expect(needs.l1.ageBands?.map((b) => b.min_age)).toEqual([0, 18, 65])
  })

  it('stays pending until the booker confirms 18+', () => {
    expect(inlineModulesPending([line], CTX, NONE)).toBe(true)
    const confirmed = { ...NONE, ages: { 0: { band: 'adult' as const, age: null, floor: 18, confirmed: true } } }
    expect(inlineModulesPending([line], CTX, confirmed)).toBe(false)
  })
})

describe('cross-sell inline exact ages (landr-zcb24.7)', () => {
  const product = { ...mockOccupancyStay, occupancy_pricing: undefined }
  const line = inheritLine(product, ['2026-12-01'], 'l1', { ...FLOW, age_bands: [], age_collect_as: 'exact' })

  it('an exact-age flow asks a number per guest, the booker 18+', () => {
    expect(lineNeeds([line], CTX).l1.ageExact).toBe(true)
    expect(inlineModulesPending([line], CTX, NONE)).toBe(true)
    const kidOnly = { ...NONE, ages: { 0: { band: 'child' as const, age: 17 }, 1: { band: 'child' as const, age: 9 } } }
    expect(inlineModulesPending([line], CTX, kidOnly)).toBe(true)
    const done = { ...NONE, ages: { 0: { band: 'adult' as const, age: 40 }, 1: { band: 'child' as const, age: 9 } } }
    expect(inlineModulesPending([line], CTX, done)).toBe(false)
  })
})

describe('cross-sell lines refine the ages the party step asked (landr-zcb24.12)', () => {
  const product = { ...mockOccupancyStay, occupancy_pricing: undefined }
  const MAIN_BANDS = [
    { key: 'child', min_age: 0, max_age: 17 },
    { key: 'adult', min_age: 18, max_age: null },
  ]
  const NEW_CUT = {
    modules: null,
    age_needed: true,
    age_bands: [
      { key: 'child', min_age: 0, max_age: 17 },
      { key: 'adult', min_age: 18, max_age: 64 },
      { key: 'age_65_plus', min_age: 65, max_age: null },
    ],
  }
  // the party step asked (agesNeeded false) and stored floors: guests 0 and 1 picked 'Adult 18+', guest 2 is a child
  const ASKED: CrossSellContext = {
    ...CTX,
    participantCount: 3,
    agesNeeded: false,
    ageRefine: { bands: MAIN_BANDS, floors: { 0: 18, 1: 18 } },
  }
  const line = inheritLine(product, ['2026-12-01'], 'l1', NEW_CUT)

  it('re-asks the guests whose band the added line splits, with the refined bands', () => {
    const needs = lineNeeds([line], ASKED).l1
    expect(needs.ages).toBe(true)
    expect(needs.ageGuests).toEqual([0, 1])
    expect(needs.ageBands?.map((b) => b.min_age)).toEqual([0, 18, 65])
  })

  it('asks nothing when the added line brings no new cut, or the party step did not ask bands', () => {
    const same = inheritLine(product, ['2026-12-01'], 'l2', { ...NEW_CUT, age_bands: MAIN_BANDS })
    expect(lineNeeds([same], ASKED).l2.ages).toBeUndefined()
    expect(lineNeeds([line], { ...ASKED, ageRefine: undefined }).l1.ages).toBeUndefined()
    expect(refinedAges({ ...ASKED, ageRefine: { bands: MAIN_BANDS, floors: { 0: undefined } } }, [line])).toBeNull()
    const exact = inheritLine(product, ['2026-12-01'], 'l3', { ...NEW_CUT, age_collect_as: 'exact' })
    expect(lineNeeds([exact], ASKED).l3.ages).toBeUndefined()
  })

  it('stays pending until every re-asked guest picked one of the refined floors', () => {
    const none: InlineModuleState = { ...NONE }
    expect(inlineModulesPending([line], ASKED, none)).toBe(true)
    const one = { ...NONE, ages: { 0: { band: 'adult' as const, age: null, floor: 65 } } }
    expect(inlineModulesPending([line], ASKED, one)).toBe(true)
    const stale = { ...NONE, ages: { 0: { band: 'adult' as const, age: null, floor: 18 }, 1: { band: 'adult' as const, age: null, floor: 33 } } }
    expect(inlineModulesPending([line], ASKED, stale)).toBe(true)
    const both = {
      ...NONE,
      ages: { 0: { band: 'adult' as const, age: null, floor: 18 }, 1: { band: 'adult' as const, age: null, floor: 65 } },
    }
    expect(inlineModulesPending([line], ASKED, both)).toBe(false)
  })

  it('re-asks the unaged adults of an Adult/Child-only party step (floor 18), companions included', () => {
    const base = DEFAULT_AGE_BANDS
    const plain: CrossSellContext = { ...ASKED, ageRefine: { bands: base, floors: { 0: 18, 1: 18, 3: 18 } } }
    const needs = lineNeeds([line], plain).l1
    expect(needs.ageGuests).toEqual([0, 1, 3])
    expect(needs.ageBands?.map((b) => b.min_age)).toEqual([0, 18, 65])
    const single = inheritLine(product, ['2026-12-01'], 'l9', { ...NEW_CUT, age_bands: MAIN_BANDS })
    expect(lineNeeds([single], plain).l9.ages).toBeUndefined()
  })

  it('removing the line takes the question away', () => {
    expect(inlineModulesPending([], ASKED, NONE)).toBe(false)
  })
})
