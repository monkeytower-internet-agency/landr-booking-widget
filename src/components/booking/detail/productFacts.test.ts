/**
 * landr-d8rg.7: unit tests for the pure facts-derivation helper.
 * Covers the conditional rules (duration/hotel/pickup/kind) and the
 * min/hour humaniser boundaries.
 */
import { describe, expect, it } from 'vitest'
import type { Product } from '@/api/types'
import { deriveProductFacts, formatDuration } from './productFacts'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    product_id: 'p-1',
    slug: 'p-1',
    name: 'Test Product',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'time_slot',
    is_contiguous: false,
    duration_minutes: null,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: null,
    group_slug: null,
    group_name: null,
    sort_order: 0,
    sport_subcategory_codes: [],
    location_ids: [],
    ...overrides,
  }
}

describe('formatDuration', () => {
  it('renders minutes under an hour as "N min"', () => {
    expect(formatDuration(25)).toBe('25 min')
    expect(formatDuration(59)).toBe('59 min')
  })

  it('renders whole hours without a trailing decimal', () => {
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(120)).toBe('2 h')
  })

  it('renders fractional hours with one decimal', () => {
    expect(formatDuration(90)).toBe('1.5 h')
  })
})

describe('deriveProductFacts', () => {
  it('returns a duration chip when duration_minutes is set', () => {
    const facts = deriveProductFacts(makeProduct({ duration_minutes: 25 }), 'en')
    expect(facts).toContainEqual({ icon: 'duration', label: '25 min' })
  })

  it('omits the duration chip when duration_minutes is null or zero', () => {
    expect(deriveProductFacts(makeProduct({ duration_minutes: null }), 'en')).toEqual([])
    expect(deriveProductFacts(makeProduct({ duration_minutes: 0 }), 'en')).toEqual([])
  })

  it('maps hotel_offering optional/mandatory to the right label', () => {
    expect(
      deriveProductFacts(makeProduct({ hotel_offering: 'optional' }), 'en'),
    ).toContainEqual({ icon: 'hotel', label: 'Hotel optional' })
    expect(
      deriveProductFacts(makeProduct({ hotel_offering: 'mandatory' }), 'en'),
    ).toContainEqual({ icon: 'hotel', label: 'Hotel included' })
  })

  it('omits the hotel chip when hotel_offering is none/absent', () => {
    expect(deriveProductFacts(makeProduct({ hotel_offering: 'none' }), 'en')).toEqual([])
    expect(deriveProductFacts(makeProduct({}), 'en')).toEqual([])
  })

  it('adds a pickup chip when needs_pickup is true', () => {
    expect(
      deriveProductFacts(makeProduct({ needs_pickup: true }), 'en'),
    ).toContainEqual({ icon: 'pickup', label: 'Pickup available' })
  })

  it('adds a humanised kind chip for non-service kinds only, when no category_name is set', () => {
    expect(
      deriveProductFacts(makeProduct({ product_kind: 'gift_card' }), 'en'),
    ).toContainEqual({ icon: 'kind', label: 'Gift card' })
    expect(
      deriveProductFacts(makeProduct({ product_kind: 'service' }), 'en').some(
        (f) => f.icon === 'kind',
      ),
    ).toBe(false)
  })

  it('landr-821d6.7: prefers the operator category name, localized, over the humanised kind', () => {
    const product = makeProduct({
      product_kind: 'hotel_room',
      category_name: 'Cabin',
      category_name_localized: { es: 'Cabaña' },
    })
    expect(deriveProductFacts(product, 'en')).toContainEqual({
      icon: 'kind',
      label: 'Cabin',
    })
    expect(deriveProductFacts(product, 'es')).toContainEqual({
      icon: 'kind',
      label: 'Cabaña',
    })
    // No es translation configured -> falls back to the base category_name.
    expect(deriveProductFacts(product, 'it')).toContainEqual({
      icon: 'kind',
      label: 'Cabin',
    })
  })

  it('landr-821d6.7: falls back to the humanised kind when category_name is absent (rolling deploy)', () => {
    const product = makeProduct({ product_kind: 'digital_good' })
    expect(deriveProductFacts(product, 'en')).toContainEqual({
      icon: 'kind',
      label: 'Digital good',
    })
  })
})
