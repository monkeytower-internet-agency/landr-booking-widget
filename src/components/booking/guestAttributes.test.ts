import { describe, expect, it } from 'vitest'
import type { FlowGuestAttribute } from '@/api/flowTypes'
import {
  allAnswered,
  applyAttributes,
  checkAttribute,
  guestAttributesWire,
  initialText,
  unansweredCount,
} from './guestAttributes'

const AGE: FlowGuestAttribute = { key: 'age', label: 'Age', value_type: 'integer', unit: 'years' }
const WEIGHT: FlowGuestAttribute = { key: 'weight_kg', label: 'Weight', value_type: 'number', unit: 'kg' }
const SIZE: FlowGuestAttribute = {
  key: 'clothing_size', label: 'Size', value_type: 'choice', choices: ['S', 'M', 'L'],
}
const NOTE: FlowGuestAttribute = { key: 'note', label: 'Note', value_type: 'text' }
const CUSTOM: FlowGuestAttribute = {
  key: 'ski_level', label: 'Level', value_type: 'integer', min_value: 1, max_value: 5,
}

describe('checkAttribute', () => {
  it('requires a value', () => {
    expect(checkAttribute(AGE, '  ')).toEqual({ problem: 'required' })
  })

  it('parses numbers (comma decimals) and keeps integers whole', () => {
    expect(checkAttribute(WEIGHT, '62,5')).toEqual({ value: 62.5 })
    expect(checkAttribute(AGE, '8')).toEqual({ value: 8 })
    expect(checkAttribute(AGE, '8.5')).toEqual({ problem: 'not_whole' })
    expect(checkAttribute(AGE, 'abc')).toEqual({ problem: 'not_a_number' })
  })

  it('enforces the fixed bounds of the well-known keys, inclusive', () => {
    expect(checkAttribute(AGE, '0').value).toBe(0)
    expect(checkAttribute(AGE, '120').value).toBe(120)
    expect(checkAttribute(AGE, '121')).toEqual({ problem: 'range' })
    expect(checkAttribute(AGE, '-1')).toEqual({ problem: 'range' })
    expect(checkAttribute(WEIGHT, '0')).toEqual({ problem: 'range' })
    expect(checkAttribute(WEIGHT, '301')).toEqual({ problem: 'range' })
    expect(checkAttribute({ ...WEIGHT, key: 'height_cm' }, '29')).toEqual({ problem: 'range' })
    expect(checkAttribute({ ...WEIGHT, key: 'shoe_size_eu' }, '61')).toEqual({ problem: 'range' })
  })

  it('uses the definition bounds of a custom key', () => {
    expect(checkAttribute(CUSTOM, '6')).toEqual({ problem: 'range' })
    expect(checkAttribute(CUSTOM, '5').value).toBe(5)
  })

  it('checks choice membership and text length', () => {
    expect(checkAttribute(SIZE, 'M')).toEqual({ value: 'M' })
    expect(checkAttribute(SIZE, 'XXL')).toEqual({ problem: 'choice' })
    expect(checkAttribute(NOTE, 'x'.repeat(65))).toEqual({ problem: 'too_long' })
    expect(checkAttribute(NOTE, ' hi ')).toEqual({ value: 'hi' })
  })
})

const ada = { first_name: 'Ada', last_name: 'L', occupant_age_band: 'adult' as const }
const kid = { first_name: 'Kid', last_name: 'L', occupant_age_band: 'child' as const, occupant_age: 8 }

describe('prefill and completeness', () => {
  it('prefills age from the roster age', () => {
    expect(initialText(kid, 'age')).toBe('8')
    expect(initialText(ada, 'age')).toBe('')
    expect(initialText({ ...kid, guest_attributes: { age: 9 } }, 'age')).toBe('9')
  })

  it('counts what is still missing', () => {
    const guests = [ada, kid]
    expect(unansweredCount([AGE, WEIGHT], guests, {})).toBe(3)
    expect(unansweredCount([AGE, WEIGHT], guests, { 0: { age: '30', weight_kg: '70' }, 1: { weight_kg: '25' } })).toBe(0)
    expect(allAnswered([AGE], guests, { 0: { age: '30' } })).toBe(true)
    expect(allAnswered([AGE], guests, { 0: { age: '300' } })).toBe(false)
  })
})

describe('applyAttributes', () => {
  it('writes the answers and keeps age and occupant_age as one value', () => {
    const out = applyAttributes(ada, [AGE, WEIGHT], { age: '30', weight_kg: '70' })
    expect(out.guest_attributes).toEqual({ age: 30, weight_kg: 70 })
    expect(out.occupant_age).toBe(30)
    expect(out.occupant_age_band).toBe('adult')
  })

  it('derives the child band from an age under 18 and uses the prefilled roster age', () => {
    const out = applyAttributes({ ...ada }, [AGE], { age: '12' })
    expect(out.occupant_age_band).toBe('child')
    const prefilled = applyAttributes(kid, [AGE], undefined)
    expect(prefilled.guest_attributes).toEqual({ age: 8 })
    expect(prefilled.occupant_age).toBe(8)
  })

  it('does not touch occupant fields when age is not asked, and keeps other keys', () => {
    const out = applyAttributes({ ...kid, guest_attributes: { note: 'x' } }, [WEIGHT], { weight_kg: '25' })
    expect(out.guest_attributes).toEqual({ note: 'x', weight_kg: 25 })
    expect(out.occupant_age).toBe(8)
  })

  it('works for a companion (no occupant fields)', () => {
    const out = applyAttributes({ first_name: 'C', last_name: '' }, [SIZE], { clothing_size: 'L' })
    expect(out.guest_attributes).toEqual({ clothing_size: 'L' })
  })
})

describe('guestAttributesWire', () => {
  it('omits an empty map and sends a filled one', () => {
    expect(guestAttributesWire({})).toEqual({})
    expect(guestAttributesWire({ guest_attributes: {} })).toEqual({})
    expect(guestAttributesWire({ guest_attributes: { age: 8 } })).toEqual({ guest_attributes: { age: 8 } })
  })
})
