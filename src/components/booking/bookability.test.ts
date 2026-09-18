import { describe, expect, it } from 'vitest'
import {
  accommodationBookability,
  isActivityBookable,
  isBookable,
  isCategoryFullySoldOut,
} from './bookability'

describe('isBookable', () => {
  it('treats bookable=false as not bookable', () => {
    expect(isBookable({ bookable: false })).toBe(false)
  })
  it('treats bookable=true as bookable', () => {
    expect(isBookable({ bookable: true })).toBe(true)
  })
  it('fails open on an absent flag', () => {
    expect(isBookable({})).toBe(true)
  })
})

describe('isCategoryFullySoldOut', () => {
  it('is fully sold out when product_count > 0 and bookable_count === 0', () => {
    expect(
      isCategoryFullySoldOut({ product_count: 3, bookable_count: 0 }),
    ).toBe(true)
  })
  it('is not fully sold out when some products are bookable', () => {
    expect(
      isCategoryFullySoldOut({ product_count: 3, bookable_count: 1 }),
    ).toBe(false)
  })
  it('an empty category (product_count=0) is never fully sold out', () => {
    expect(
      isCategoryFullySoldOut({ product_count: 0, bookable_count: 0 }),
    ).toBe(false)
  })
})

// landr-t869m.2
describe('isActivityBookable', () => {
  it('treats activity_bookable=false as not bookable', () => {
    expect(isActivityBookable({ activity_bookable: false })).toBe(false)
  })
  it('treats activity_bookable=true as bookable', () => {
    expect(isActivityBookable({ activity_bookable: true })).toBe(true)
  })
  it('fails open on an absent flag (older API / mock data)', () => {
    expect(isActivityBookable({})).toBe(true)
  })
})

describe('accommodationBookability', () => {
  it('returns true when the API says the stay is bookable', () => {
    expect(accommodationBookability({ accommodation_bookable: true })).toBe(
      true,
    )
  })
  it('returns false when the stay is too late (activity still bookable)', () => {
    expect(accommodationBookability({ accommodation_bookable: false })).toBe(
      false,
    )
  })
  it('returns null (not false!) for hotel_offering=none — "not evaluated"', () => {
    expect(accommodationBookability({ accommodation_bookable: null })).toBeNull()
  })
  it('returns null on an absent field (older API) rather than false', () => {
    expect(accommodationBookability({})).toBeNull()
  })
  it('returns null when the row itself is undefined (no matching day found)', () => {
    expect(accommodationBookability(undefined)).toBeNull()
  })
})
