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

// ─── landr-uwvl: the pre-identity blob backfill ──────────────────────────────

describe('normalizePartyIdentity backfill (landr-uwvl)', () => {
  // A blob EXACTLY as the pre-landr-uwvl bundle wrote it: party rows with no
  // `id`, and the three party maps keyed by the unified party INDEX
  // ([participants 0..P-1] ++ [companions P..P+C-1]).
  //
  // The customer's arrangement here is deliberately NOT the index-order
  // default, so a backfill that reshuffled anyone would be immediately
  // visible: Grace has the single, Alan and Ada share the double, Marie has
  // the triple.
  const legacyParticipants = [
    {
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      phone: '+34600000001',
      service_role_code: 'participant',
    },
    {
      first_name: 'Grace',
      last_name: 'Hopper',
      email: '',
      phone: '+34600000002',
      service_role_code: 'participant',
    },
    {
      first_name: 'Alan',
      last_name: 'Turing',
      email: '',
      phone: '+34600000003',
      service_role_code: 'participant',
    },
  ]
  const legacyCompanions = [
    {
      first_name: 'Marie',
      last_name: 'Curie',
      email: '',
      phone: '',
      companion_kind: 'guest' as const,
    },
  ]
  const legacyRoomAssignment = {
    0: { roomProductId: 'room-double', unitIndex: 0, slot: 1 }, // Ada
    1: { roomProductId: 'room-single', unitIndex: 0 }, // Grace
    2: { roomProductId: 'room-double', unitIndex: 0, slot: 0 }, // Alan
    3: { roomProductId: 'room-triple', unitIndex: 0 }, // Marie
  }
  const legacyBreakfastMap = { 1: true, 3: true } // Grace + Marie hold a chip
  const legacyOccupantAgeMap = { 3: { band: 'child' as const, age: 9 } } // Marie

  function writeLegacyBlob() {
    const legacyStep = {
      name: 'fill-form',
      product: makeProduct(),
      selection: { kind: 'days', selectedDays: ['2026-07-01', '2026-07-02'] },
      booker: {
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        phone: '+34600000001',
      },
      participants: legacyParticipants,
      companions: legacyCompanions,
      pickupLocationId: null,
      roomAssignment: legacyRoomAssignment,
      occupantAgeMap: legacyOccupantAgeMap,
      breakfastMap: legacyBreakfastMap,
    }
    window.sessionStorage.setItem(
      BOOKING_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        step: legacyStep,
        bookingDraft: {
          participants: legacyParticipants,
          companions: legacyCompanions,
          roomAssignment: legacyRoomAssignment,
          occupantAgeMap: legacyOccupantAgeMap,
          breakfastMap: legacyBreakfastMap,
        },
      }),
    )
  }

  /** Resolve a restored, identity-keyed map back to party-index order the
   *  way App.tsx does at the seam, so the assertions read as "who is where". */
  function byPartyIndex<T>(
    map: Record<string, T> | undefined,
    step: Step,
  ): (T | undefined)[] {
    const container = step as unknown as {
      participants?: { id?: string }[]
      companions?: { id?: string }[]
    }
    const roster = [
      ...(container.participants ?? []),
      ...(container.companions ?? []),
    ].map((m, i) => m.id ?? String(i))
    return roster.map((id) => map?.[id])
  }

  it('mints an id for every party member (booker pinned to the sentinel)', () => {
    writeLegacyBlob()
    const restored = readStoredProgress()!
    const step = restored.step as unknown as {
      participants: { id?: string; first_name: string }[]
      companions: { id?: string; first_name: string }[]
    }
    expect(step.participants.map((p) => p.first_name)).toEqual([
      'Ada',
      'Grace',
      'Alan',
    ])
    expect(step.participants[0]!.id).toBe('booker')
    for (const row of [...step.participants, ...step.companions]) {
      expect(typeof row.id).toBe('string')
      expect(row.id!.length).toBeGreaterThan(0)
    }
    expect(
      new Set(
        [...step.participants, ...step.companions].map((r) => r.id),
      ).size,
    ).toBe(4)
  })

  it('re-keys the three maps WITHOUT moving anybody', () => {
    // The whole point: index → the id minted at the SAME index is the identity
    // permutation. A migration that reshuffled real people's rooms would be
    // the exact bug landr-uwvl exists to fix.
    writeLegacyBlob()
    const restored = readStoredProgress()!
    const step = restored.step as unknown as {
      roomAssignment: Record<string, unknown>
      breakfastMap: Record<string, boolean>
      occupantAgeMap: Record<string, unknown>
    }
    expect(byPartyIndex(step.roomAssignment, restored.step)).toEqual([
      legacyRoomAssignment[0],
      legacyRoomAssignment[1],
      legacyRoomAssignment[2],
      legacyRoomAssignment[3],
    ])
    expect(byPartyIndex(step.breakfastMap, restored.step)).toEqual([
      undefined,
      true,
      undefined,
      true,
    ])
    expect(byPartyIndex(step.occupantAgeMap, restored.step)).toEqual([
      undefined,
      undefined,
      undefined,
      legacyOccupantAgeMap[3],
    ])
    // The maps are no longer index-keyed at all.
    expect(Object.keys(step.roomAssignment)).not.toContain('1')
  })

  it('gives the step and the draft the SAME ids', () => {
    // App.tsx resolves the DRAFT's maps against the STEP's roster (afterDetails
    // seeds pick-accommodation from bookingDraft.roomAssignment while the
    // roster comes from step.participants). Minting independently per container
    // would silently unassign the entire party.
    writeLegacyBlob()
    const restored = readStoredProgress()!
    const step = restored.step as unknown as {
      participants: { id?: string }[]
      companions: { id?: string }[]
    }
    expect(restored.bookingDraft.participants!.map((p) => p.id)).toEqual(
      step.participants.map((p) => p.id),
    )
    expect(restored.bookingDraft.companions!.map((c) => c.id)).toEqual(
      step.companions.map((c) => c.id),
    )
    // …and therefore the two maps agree key-for-key.
    const stepAssignment = (
      restored.step as unknown as { roomAssignment: Record<string, unknown> }
    ).roomAssignment
    expect(restored.bookingDraft.roomAssignment).toEqual(stepAssignment)
    expect(Object.keys(stepAssignment).sort()).toEqual(
      ['booker', ...step.participants.slice(1).map((p) => p.id!), ...step.companions.map((c) => c.id!)].sort(),
    )
  })

  it('leaves an already-identified blob untouched (no re-minting on every reload)', () => {
    const identified: BookingDraft = {
      participants: [
        {
          id: 'booker',
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
          phone: '+34600000001',
          service_role_code: 'participant',
        },
        {
          id: 'stable-uuid-1',
          first_name: 'Grace',
          last_name: 'Hopper',
          email: '',
          phone: '+34600000002',
          service_role_code: 'participant',
        },
      ],
      roomAssignment: {
        booker: { roomProductId: 'room-double', unitIndex: 0 },
        'stable-uuid-1': { roomProductId: 'room-single', unitIndex: 0 },
      },
    }
    writeStoredProgress({
      step: { ...detailsStep, participants: identified.participants } as Step,
      bookingDraft: identified,
    })
    const first = readStoredProgress()!
    const second = readStoredProgress()!
    expect(first.bookingDraft.participants!.map((p) => p.id)).toEqual([
      'booker',
      'stable-uuid-1',
    ])
    expect(second.bookingDraft.roomAssignment).toEqual(
      identified.roomAssignment,
    )
  })

  it('is a no-op for a blob with no party at all', () => {
    writeStoredProgress({ step: detailsStep, bookingDraft: {} })
    expect(readStoredProgress()).toEqual({
      step: detailsStep,
      bookingDraft: {},
    })
  })
})
