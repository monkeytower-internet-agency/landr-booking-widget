import { describe, expect, it } from 'vitest'
import type { Product } from '@/api/types'
import { isBookableKind, isStayKind, buildFlowPlan } from '@/flowPlan'
import { addonUnitSuffix, addonUnitsTimesRate } from '@/lib/strings'
import { stayGuestLanguages, stayPartyCap, withStayPartyCap } from './stayFlow'

const base = { product_kind: 'stay', max_party_size: null, stay: { sleeps: 4 } } as unknown as Product

describe('stay flow helpers', () => {
  it('caps the party at what the unit sleeps, never above max_party_size', () => {
    expect(stayPartyCap(base)).toBe(4)
    expect(stayPartyCap({ ...base, max_party_size: 3 })).toBe(3)
    expect(stayPartyCap({ ...base, max_party_size: 9 })).toBe(4)
    expect(stayPartyCap({ ...base, product_kind: 'service' })).toBeNull()
    expect(withStayPartyCap(base).max_party_size).toBe(4)
    const service = { ...base, product_kind: 'service' } as Product
    expect(withStayPartyCap(service)).toBe(service)
  })

  it('gives guests the customer language, English when unusable', () => {
    expect(stayGuestLanguages('de-DE')).toEqual(['de'])
    expect(stayGuestLanguages('')).toEqual(['en'])
  })

  it('books services and stays; a stay never has a pickup step', () => {
    expect(isBookableKind('stay')).toBe(true)
    expect(isBookableKind('service')).toBe(true)
    expect(isBookableKind('gift_card')).toBe(false)
    expect(isStayKind('stay')).toBe(true)
    const plan = buildFlowPlan({ product_kind: 'stay', needs_pickup: true }, {}, null)
    expect(plan.map((m) => m.kind)).not.toContain('pickup')
  })

  it('words an add-on price by its unit', () => {
    expect(addonUnitSuffix('guest_night', 'en')).toBe('/ guest / night')
    expect(addonUnitSuffix(null, 'en')).toBe('each')
    expect(addonUnitsTimesRate(6, '€12.00', 'guest_night', 'en')).toBe('6 × €12.00 / guest / night')
  })
})
