/**
 * landr-2mgl: tests for the reload-resilience persistence helpers. Covers
 *   - the step + draft round-trip (write → read restores faithfully),
 *   - the sandboxed-storage guard (read/write/clear must NEVER throw),
 *   - clear (the completed-booking / full-restart drop-point),
 *   - non-restorable steps (entry steps + confirmation) are not restored,
 *   - junk/legacy blobs degrade to a fresh start.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Step, BookingDraft } from './appStepMachine'
import type { Product } from '@/api/types'
import {
  BOOKING_PROGRESS_STORAGE_KEY,
  clearStoredProgress,
  readStoredProgress,
  writeStoredProgress,
} from './bookingPersistence'

afterEach(() => {
  window.sessionStorage.clear()
  vi.restoreAllMocks()
})

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
    service_time_shape: 'days_range',
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

// A mid-funnel, restorable step: the details form with a committed product
// + date selection. This is exactly the kind of progress a pull-to-refresh
// would otherwise wipe.
const detailsStep: Step = {
  name: 'details',
  product: makeProduct(),
  selection: { kind: 'days', selectedDays: ['2026-07-01', '2026-07-02'] },
}

// A draft carrying PII (booker name/email) — the reason sessionStorage
// (same-origin, tab-scoped) is used and the URL is NOT.
const draft: BookingDraft = {
  booker: {
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    phone: '+49 30 1234567',
  },
  participants: [],
}

describe('writeStoredProgress / readStoredProgress', () => {
  it('round-trips a restorable step + draft', () => {
    writeStoredProgress({ step: detailsStep, bookingDraft: draft })

    const restored = readStoredProgress()
    expect(restored).not.toBeNull()
    expect(restored!.step).toEqual(detailsStep)
    expect(restored!.bookingDraft).toEqual(draft)
    // the PII rode through the draft, not into any URL-shaped surface.
    expect(restored!.bookingDraft.booker?.email).toBe('ada@example.com')
  })

  it('returns null when nothing is stored', () => {
    expect(readStoredProgress()).toBeNull()
  })

  it('defaults a missing draft to an empty object', () => {
    // Hand-write a blob with a valid step but no bookingDraft key.
    window.sessionStorage.setItem(
      BOOKING_PROGRESS_STORAGE_KEY,
      JSON.stringify({ step: detailsStep }),
    )
    const restored = readStoredProgress()
    expect(restored).not.toBeNull()
    expect(restored!.bookingDraft).toEqual({})
  })

  it('returns null for an unparseable / legacy blob', () => {
    window.sessionStorage.setItem(BOOKING_PROGRESS_STORAGE_KEY, '{not json')
    expect(readStoredProgress()).toBeNull()
  })

  it('returns null when the stored step has no name', () => {
    window.sessionStorage.setItem(
      BOOKING_PROGRESS_STORAGE_KEY,
      JSON.stringify({ step: { foo: 'bar' }, bookingDraft: {} }),
    )
    expect(readStoredProgress()).toBeNull()
  })
})

describe('non-restorable steps', () => {
  it('does NOT persist the entry pick-product step (and clears any prior snapshot)', () => {
    // Seed a real snapshot first…
    writeStoredProgress({ step: detailsStep, bookingDraft: draft })
    expect(readStoredProgress()).not.toBeNull()
    // …then a write at pick-product must wipe it (reload → clean start).
    writeStoredProgress({ step: { name: 'pick-product' }, bookingDraft: {} })
    expect(window.sessionStorage.getItem(BOOKING_PROGRESS_STORAGE_KEY)).toBeNull()
    expect(readStoredProgress()).toBeNull()
  })

  it('does NOT restore a persisted confirmation step (completed booking)', () => {
    // Even if a `confirmed` blob were somehow present, it must not restore.
    window.sessionStorage.setItem(
      BOOKING_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        step: { name: 'confirmed', response: {}, email: 'ada@example.com' },
        bookingDraft: {},
      }),
    )
    expect(readStoredProgress()).toBeNull()
  })

  it('does NOT persist the pick-category entry step', () => {
    writeStoredProgress({
      step: { name: 'pick-category', groups: [] },
      bookingDraft: {},
    })
    expect(window.sessionStorage.getItem(BOOKING_PROGRESS_STORAGE_KEY)).toBeNull()
  })
})

describe('clearStoredProgress', () => {
  it('removes a persisted snapshot (completed booking / full restart drop-point)', () => {
    writeStoredProgress({ step: detailsStep, bookingDraft: draft })
    expect(readStoredProgress()).not.toBeNull()
    clearStoredProgress()
    expect(window.sessionStorage.getItem(BOOKING_PROGRESS_STORAGE_KEY)).toBeNull()
    expect(readStoredProgress()).toBeNull()
  })
})

describe('sandboxed-storage guard (must never throw)', () => {
  it('readStoredProgress does not throw when getItem throws', () => {
    vi.spyOn(window.sessionStorage.__proto__, 'getItem').mockImplementation(
      () => {
        throw new Error('SecurityError: storage blocked')
      },
    )
    expect(() => readStoredProgress()).not.toThrow()
    expect(readStoredProgress()).toBeNull()
  })

  it('writeStoredProgress does not throw when setItem throws', () => {
    vi.spyOn(window.sessionStorage.__proto__, 'setItem').mockImplementation(
      () => {
        throw new Error('SecurityError: storage blocked')
      },
    )
    expect(() =>
      writeStoredProgress({ step: detailsStep, bookingDraft: draft }),
    ).not.toThrow()
  })

  it('clearStoredProgress does not throw when removeItem throws', () => {
    vi.spyOn(window.sessionStorage.__proto__, 'removeItem').mockImplementation(
      () => {
        throw new Error('SecurityError: storage blocked')
      },
    )
    expect(() => clearStoredProgress()).not.toThrow()
  })
})
