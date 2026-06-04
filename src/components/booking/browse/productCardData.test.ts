/**
 * landr-d8rg.6: unit tests for the pure catalogue-card presentation helpers.
 */
import { describe, expect, it } from 'vitest'
import type { Product } from '@/api/types'
import {
  hasThumb,
  productKindBadge,
  productMetaChip,
  productPriceLabel,
  thumbAlt,
} from './productCardData'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    product_id: 'p-1',
    slug: 'p-1',
    name: 'Test',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'time_slot',
    is_contiguous: false,
    duration_minutes: 30,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: null,
    group_slug: null,
    group_name: null,
    sort_order: 0,
    sport_subcategory_codes: [],
    location_ids: [],
    needs_pickup: false,
    ...overrides,
  }
}

describe('productPriceLabel', () => {
  it('formats a positive price_from with the EUR symbol', () => {
    const label = productPriceLabel(makeProduct({ price_from: '59.00', currency: 'EUR' }))
    expect(label).toMatch(/^from /)
    expect(label).toMatch(/59/)
  })

  it('returns null for null price_from', () => {
    expect(productPriceLabel(makeProduct({ price_from: null }))).toBeNull()
  })

  it('returns null for undefined price_from (rolling deploy)', () => {
    expect(productPriceLabel(makeProduct({}))).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(productPriceLabel(makeProduct({ price_from: '' }))).toBeNull()
  })

  it('returns null for a non-positive / non-finite value (never "from €0")', () => {
    expect(productPriceLabel(makeProduct({ price_from: '0.00' }))).toBeNull()
    expect(productPriceLabel(makeProduct({ price_from: 'abc' }))).toBeNull()
  })

  it('falls back to EUR when currency is missing', () => {
    const label = productPriceLabel(makeProduct({ price_from: '10.00', currency: null }))
    expect(label).toMatch(/10/)
  })
})

describe('productMetaChip', () => {
  it('shows the duration when present', () => {
    expect(productMetaChip(makeProduct({ duration_minutes: 25 }), false)).toBe('25 min')
  })

  it('shows the generic service label in production (showDateModel=false)', () => {
    expect(
      productMetaChip(
        makeProduct({ duration_minutes: null, service_time_shape: 'days_range' }),
        false,
      ),
    ).toBe('service')
  })

  it('shows the date-model shape in dev/staging (showDateModel=true)', () => {
    expect(
      productMetaChip(
        makeProduct({ duration_minutes: null, service_time_shape: 'days_range' }),
        true,
      ),
    ).toBe('days range')
  })

  it('humanises the kind for non-service shop products', () => {
    expect(
      productMetaChip(
        makeProduct({ product_kind: 'digital_good', duration_minutes: null }),
        false,
      ),
    ).toBe('digital good')
  })
})

describe('productKindBadge', () => {
  it('is null for service products', () => {
    expect(productKindBadge(makeProduct({ product_kind: 'service' }))).toBeNull()
  })

  it('is null for non-service products without a duration (kind is already the meta chip)', () => {
    expect(
      productKindBadge(makeProduct({ product_kind: 'gift_card', duration_minutes: null })),
    ).toBeNull()
  })

  it('returns the humanised kind for a non-service product that also has a duration', () => {
    expect(
      productKindBadge(makeProduct({ product_kind: 'physical_good', duration_minutes: 60 })),
    ).toBe('physical good')
  })
})

describe('hasThumb / thumbAlt', () => {
  it('hasThumb is false for null/empty/missing thumb_url', () => {
    expect(hasThumb(makeProduct({ thumb_url: null }))).toBe(false)
    expect(hasThumb(makeProduct({ thumb_url: '' }))).toBe(false)
    expect(hasThumb(makeProduct({}))).toBe(false)
  })

  it('hasThumb is true for a non-empty thumb_url', () => {
    expect(hasThumb(makeProduct({ thumb_url: 'https://x/y.webp' }))).toBe(true)
  })

  it('thumbAlt prefers the first image alt, else the product name', () => {
    expect(
      thumbAlt(
        makeProduct({
          images: [{ thumb_url: 't', hero_url: 'h', alt: 'Sunset flight' }],
        }),
        'Fallback Name',
      ),
    ).toBe('Sunset flight')
    expect(thumbAlt(makeProduct({ images: [] }), 'Fallback Name')).toBe('Fallback Name')
  })
})
