import { describe, expect, it } from 'vitest'
import type { FlowAgeBand } from '@/api/flowTypes'
import { askedAttributes } from './guestAttributes'
import {
  adultAgeWire,
  ageChoice,
  bandLabel,
  DEFAULT_AGE_BANDS,
  mergeBands,
  resolveBands,
  stampAge,
  withAgeChoice,
} from './ageBands'

const SENIOR: FlowAgeBand[] = [
  { key: 'child', min_age: 0, max_age: 17 },
  { key: 'adult', min_age: 18, max_age: 64, label_localized: { en: 'Adult 18-64', de: 'Erwachsene 18-64' } },
  { key: 'age_65_plus', min_age: 65, max_age: null, label_localized: { en: 'Senior 65+', de: 'Senior 65+' } },
]

describe('age bands (landr-zcb24.2)', () => {
  it('falls back to Child / Adult when the flow names no bands', () => {
    expect(resolveBands(undefined)).toBe(DEFAULT_AGE_BANDS)
    expect(resolveBands([])).toBe(DEFAULT_AGE_BANDS)
    expect(resolveBands(SENIOR)).toBe(SENIOR)
  })

  it('labels: translated Child / Adult for the plain pair, the flow label for split bands', () => {
    expect(bandLabel(DEFAULT_AGE_BANDS[1], DEFAULT_AGE_BANDS, 'en')).toBe('Adult')
    expect(bandLabel(DEFAULT_AGE_BANDS[0], DEFAULT_AGE_BANDS, 'de')).toBe('Kind')
    expect(bandLabel(SENIOR[2], SENIOR, 'en')).toBe('Senior 65+')
    expect(bandLabel(SENIOR[1], SENIOR, 'de')).toBe('Erwachsene 18-64')
    expect(bandLabel({ key: 'age_40_plus', min_age: 40, max_age: null }, SENIOR, 'en')).toBe('Adult 40+')
  })

  it('an adult band is stored as its floor with age_exact=false', () => {
    const g = withAgeChoice({}, SENIOR, 'age_65_plus', null, true)
    expect(g).toMatchObject({ occupant_age_band: 'adult', occupant_age: 65, guest_attributes: { age_exact: false } })
    expect(ageChoice(g, SENIOR)).toEqual({ bandKey: 'age_65_plus', age: null })
  })

  it('without the flow asking age an adult carries no age (today)', () => {
    const g = withAgeChoice({}, DEFAULT_AGE_BANDS, 'adult', null, false)
    expect(g).toMatchObject({ occupant_age_band: 'adult', occupant_age: null, guest_attributes: {} })
  })

  it('a child keeps the exact age and drops any floor flag or stale age copy', () => {
    const adult = withAgeChoice({ guest_attributes: { weight_kg: 60, age: 30 } }, SENIOR, 'adult', null, true)
    expect(adult.guest_attributes).toEqual({ weight_kg: 60, age_exact: false })
    const child = withAgeChoice(adult, SENIOR, 'child', 7, true)
    expect(child).toMatchObject({ occupant_age_band: 'child', occupant_age: 7, guest_attributes: { weight_kg: 60 } })
  })

  it('an exact age restored from an older draft lands in the band that contains it', () => {
    expect(ageChoice({ occupant_age: 70 }, SENIOR).bandKey).toBe('age_65_plus')
    expect(ageChoice({ occupant_age: 30 }, SENIOR).bandKey).toBe('adult')
    expect(stampAge({ occupant_age: 70 }, SENIOR, true)).toMatchObject({ occupant_age: 65 })
  })

  it('merges the bands of several lines on the union of their floors', () => {
    const only65 = [SENIOR[0], { key: 'adult', min_age: 18, max_age: 64 }, SENIOR[2]]
    const only30: FlowAgeBand[] = [
      { key: 'child', min_age: 0, max_age: 17 },
      { key: 'adult', min_age: 18, max_age: 29 },
      { key: 'age_30_plus', min_age: 30, max_age: null },
    ]
    const merged = mergeBands([only65, only30, undefined])
    expect(merged.map((b) => [b.min_age, b.max_age ?? null])).toEqual([
      [0, 17],
      [18, 29],
      [30, 64],
      [65, null],
    ])
    expect(mergeBands([undefined, []])).toBe(DEFAULT_AGE_BANDS)
  })

  it('wire: a floor rides as occupant_age + age_exact=false, a child never carries the flag', () => {
    const adult = withAgeChoice({}, SENIOR, 'age_65_plus', null, true)
    expect(adultAgeWire(adult, false)).toEqual({ occupant_age: 65, guest_attributes: { age_exact: false } })
    expect(adultAgeWire(adult, true)).toEqual({})
    expect(adultAgeWire({ guest_attributes: { weight_kg: 60 } }, false)).toEqual({ guest_attributes: { weight_kg: 60 } })
    expect(adultAgeWire({}, false, 18)).toEqual({ occupant_age: 18, guest_attributes: { age_exact: false } })
  })

  it('About your guests no longer asks age once the party step collected it', () => {
    const age = { key: 'age', label: 'Age', value_type: 'integer' as const }
    const weight = { key: 'weight_kg', label: 'Weight', value_type: 'number' as const }
    expect(askedAttributes({ guest_attributes: [age, weight], age_needed: true })).toEqual([weight])
    expect(askedAttributes({ guest_attributes: [age, weight] })).toEqual([age, weight])
    expect(askedAttributes(null)).toEqual([])
  })
})
