import { describe, expect, it } from 'vitest'
import { mockOccupancyStay } from '@/api/mocks'
import {
  inheritLine,
  inlineModulesPending,
  lineNeeds,
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
