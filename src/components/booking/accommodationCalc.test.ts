import { describe, expect, it } from 'vitest'
import type { Product, ProductAddon } from '@/api/types'
import {
  applyAssignment,
  autoAssignParticipants,
  autoAssignParty,
  CHIP_HUES,
  chipHue,
  deriveStayWindow,
  expandRoomUnits,
  findBreakfastAddonIds,
  flattenPerRoomAddons,
  formatCurrency,
  hasIncompleteChildAge,
  roomIncludesBreakfast,
  occupancyStatus,
  occupantsOfUnit,
  partySize,
  pruneAssignments,
  roomSubtotal,
  roomUnitKey,
  stayNightIsos,
  totalBreakfastQty,
  totalRoomCapacity,
  totalStayCost,
  type OccupantAgeMap,
  type RoomAssignmentMap,
  type RoomSelection,
  type RoomUnit,
} from './accommodationCalc'

function makeRoom(
  id: string,
  pricePerNight: number | null,
  currency = 'EUR',
  capacityPerUnit: number | null = null,
): Product {
  return {
    product_id: id,
    slug: id,
    name: id,
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'hotel_room',
    service_time_shape: null,
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
    needs_pickup: false,
    hotel_offering: 'none',
    hotel_location_id: 'hotel-1',
    price_per_unit: pricePerNight,
    currency,
    capacity_per_unit: capacityPerUnit,
  }
}

function makeAddon(
  addonProductId: string,
  name: string,
): ProductAddon {
  return {
    product_addon_id: `pa-${addonProductId}`,
    addon_product_id: addonProductId,
    name,
    name_localized: null,
    is_required: false,
    min_qty: 0,
    max_qty: null,
    sort_order: 0,
    price_per_unit: null,
    currency: null,
  }
}

describe('deriveStayWindow', () => {
  it('returns null fields + nights=0 for empty input', () => {
    const win = deriveStayWindow([])
    expect(win.checkInIso).toBeNull()
    expect(win.checkOutIso).toBeNull()
    expect(win.nights).toBe(0)
  })

  it('derives check-in = first-1 and check-out = last+1; nights = days+1', () => {
    const win = deriveStayWindow(['2026-06-10', '2026-06-11', '2026-06-12'])
    expect(win.checkInIso).toBe('2026-06-09')
    expect(win.checkOutIso).toBe('2026-06-13')
    expect(win.nights).toBe(4)
  })

  it('handles a single selected day', () => {
    const win = deriveStayWindow(['2026-06-10'])
    expect(win.checkInIso).toBe('2026-06-09')
    expect(win.checkOutIso).toBe('2026-06-11')
    expect(win.nights).toBe(2)
  })

  it('handles unsorted input by sorting first', () => {
    const win = deriveStayWindow(['2026-06-12', '2026-06-10', '2026-06-11'])
    expect(win.checkInIso).toBe('2026-06-09')
    expect(win.checkOutIso).toBe('2026-06-13')
  })

  it('handles month boundary correctly', () => {
    const win = deriveStayWindow(['2026-05-31'])
    expect(win.checkInIso).toBe('2026-05-30')
    expect(win.checkOutIso).toBe('2026-06-01')
  })

  // landr-ma5n: non-contiguous selections must count nights by SPAN
  // (last - first + 2), not by selectedDays.length + 1. The hotel
  // window is continuous from check-in to check-out — the customer does
  // not vacate the room on the gap day. Pre-fix this returned 3 nights
  // for [25, 27] which under-charged the operator by 1 night.
  it('counts nights by span for non-contiguous selections (landr-ma5n)', () => {
    const win = deriveStayWindow(['2026-05-25', '2026-05-27'])
    expect(win.checkInIso).toBe('2026-05-24')
    expect(win.checkOutIso).toBe('2026-05-28')
    expect(win.nights).toBe(4)
  })

  it('counts nights by span for multi-gap non-contiguous selections (landr-ma5n)', () => {
    // [Mon, Wed, Thu] — gap on Tuesday, then Wed-Thu contiguous. Hotel
    // span = Sun → Fri = 5 nights, NOT 4 (selectedDays.length + 1).
    const win = deriveStayWindow(['2026-05-25', '2026-05-27', '2026-05-28'])
    expect(win.checkInIso).toBe('2026-05-24')
    expect(win.checkOutIso).toBe('2026-05-29')
    expect(win.nights).toBe(5)
  })

  it('keeps deriveStayWindow.nights consistent with stayNightIsos.length (landr-ma5n)', () => {
    // Regression guard: before the fix, deriveStayWindow.nights and
    // stayNightIsos disagreed on non-contiguous input (the latter
    // already walked the full span). Lock them in step.
    const cases: string[][] = [
      ['2026-06-10', '2026-06-11', '2026-06-12'],
      ['2026-06-10'],
      ['2026-05-25', '2026-05-27'],
      ['2026-05-25', '2026-05-27', '2026-05-28'],
      ['2026-05-25', '2026-05-30'],
    ]
    for (const days of cases) {
      const win = deriveStayWindow(days)
      expect(win.nights).toBe(stayNightIsos(days).length)
    }
  })
})

describe('roomSubtotal', () => {
  it('multiplies price × qty × nights', () => {
    const room = makeRoom('r1', 50)
    expect(roomSubtotal(room, 2, 3)).toBe(300)
  })

  it('returns 0 when room has no price_per_unit', () => {
    const room = makeRoom('r1', null)
    expect(roomSubtotal(room, 2, 3)).toBe(0)
  })

  it('returns 0 when qty is zero or negative', () => {
    const room = makeRoom('r1', 50)
    expect(roomSubtotal(room, 0, 3)).toBe(0)
  })

  it('returns 0 when nights is zero', () => {
    const room = makeRoom('r1', 50)
    expect(roomSubtotal(room, 2, 0)).toBe(0)
  })
})

describe('totalStayCost', () => {
  it('sums subtotals across multiple rooms and carries the currency', () => {
    const products = [makeRoom('single', 49), makeRoom('double', 73)]
    const selections: RoomSelection[] = [
      { productId: 'single', quantity: 1 },
      { productId: 'double', quantity: 2 },
    ]
    const result = totalStayCost(selections, products, 3)
    // (49 * 1 + 73 * 2) * 3 = 585
    expect(result.amount).toBe(585)
    expect(result.currency).toBe('EUR')
  })

  it('skips selections whose product_id is unknown', () => {
    const products = [makeRoom('single', 49)]
    const result = totalStayCost(
      [
        { productId: 'single', quantity: 1 },
        { productId: 'ghost', quantity: 2 },
      ],
      products,
      2,
    )
    expect(result.amount).toBe(98)
  })

  it('returns amount=0 for priceless rooms but still carries product currency', () => {
    const products = [makeRoom('priceless', null)]
    const result = totalStayCost(
      [{ productId: 'priceless', quantity: 2 }],
      products,
      3,
    )
    expect(result.amount).toBe(0)
    // currency is carried from the first product that has one — the
    // helper does not gate on subtotal>0 because the caller may still
    // want to format the zero amount in the right currency.
    expect(result.currency).toBe('EUR')
  })

  it('returns currency=null when there are no selections at all', () => {
    const result = totalStayCost([], [makeRoom('r', 50)], 3)
    expect(result.amount).toBe(0)
    expect(result.currency).toBeNull()
  })
})

describe('formatCurrency', () => {
  it('formats with Intl when possible', () => {
    const out = formatCurrency(49.5, 'EUR')
    // Locale-dependent: just assert it contains the digits and a currency hint
    expect(out).toMatch(/49[.,]50/)
  })

  it('falls back gracefully on unknown currency codes', () => {
    const out = formatCurrency(12, 'XYZ')
    // Either Intl prints "12.00 XYZ" / "XYZ 12.00" / similar; just check
    // the amount appears and the code is mentioned somewhere.
    expect(out).toMatch(/12/)
    expect(out).toMatch(/XYZ/)
  })

  it('defaults to EUR when currency is null/undefined', () => {
    expect(formatCurrency(10, null)).toMatch(/10[.,]00/)
    expect(formatCurrency(10, undefined)).toMatch(/10[.,]00/)
  })
})

describe('totalRoomCapacity (landr-qpab)', () => {
  it('sums qty × capacity_per_unit across selections', () => {
    const products = [
      makeRoom('single', 49, 'EUR', 1),
      makeRoom('double', 73, 'EUR', 2),
    ]
    const selections: RoomSelection[] = [
      { productId: 'single', quantity: 2 },
      { productId: 'double', quantity: 1 },
    ]
    // 2*1 + 1*2 = 4
    expect(totalRoomCapacity(selections, products)).toBe(4)
  })

  it('treats missing capacity_per_unit as 1 (lenient default)', () => {
    const products = [makeRoom('legacy', 49, 'EUR', null)]
    expect(
      totalRoomCapacity([{ productId: 'legacy', quantity: 3 }], products),
    ).toBe(3)
  })

  it('returns 0 when no rooms are selected', () => {
    const products = [makeRoom('single', 49, 'EUR', 1)]
    expect(totalRoomCapacity([], products)).toBe(0)
  })

  it('skips selections whose product_id is unknown', () => {
    const products = [makeRoom('single', 49, 'EUR', 1)]
    const selections: RoomSelection[] = [
      { productId: 'single', quantity: 1 },
      { productId: 'ghost', quantity: 5 },
    ]
    expect(totalRoomCapacity(selections, products)).toBe(1)
  })
})

describe('findBreakfastAddonIds (landr-qpab)', () => {
  it('matches add-ons whose name contains "breakfast" (case-insensitive)', () => {
    const ids = findBreakfastAddonIds([
      makeAddon('a1', 'Breakfast'),
      makeAddon('a2', 'BREAKFAST'),
      makeAddon('a3', 'Continental breakfast'),
      makeAddon('a4', 'Video Package'),
    ])
    expect(ids.has('a1')).toBe(true)
    expect(ids.has('a2')).toBe(true)
    expect(ids.has('a3')).toBe(true)
    expect(ids.has('a4')).toBe(false)
    expect(ids.size).toBe(3)
  })

  it('returns an empty set when no add-ons match', () => {
    const ids = findBreakfastAddonIds([
      makeAddon('a1', 'Video Package'),
      makeAddon('a2', 'Photo Package'),
    ])
    expect(ids.size).toBe(0)
  })
})

describe('totalBreakfastQty (landr-qpab)', () => {
  it('sums picked qty across matching ids', () => {
    const ids = new Set(['bf-1', 'bf-2'])
    const selection = { 'bf-1': 2, 'bf-2': 3, 'video': 5 }
    expect(totalBreakfastQty(selection, ids)).toBe(5)
  })

  it('returns 0 when no breakfast addon is selected', () => {
    expect(totalBreakfastQty({}, new Set(['bf-1']))).toBe(0)
  })
})

describe('roomIncludesBreakfast (landr-5mvw)', () => {
  function makeProduct(name: string, nameLocalized?: Record<string, string>): Product {
    return {
      product_id: 'p-1',
      slug: 'p-1',
      name,
      name_localized: nameLocalized ?? null,
      short_description: null,
      short_description_localized: null,
      description: null,
      product_kind: 'hotel_room',
      service_time_shape: null,
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
    }
  }

  it('returns true for Para42 "Premium Single Room w/ Breakfast"', () => {
    expect(
      roomIncludesBreakfast(makeProduct('Premium Single Room w/ Breakfast')),
    ).toBe(true)
  })

  it('returns true for Para42 "Premium Double Room w/ Breakfast"', () => {
    expect(
      roomIncludesBreakfast(makeProduct('Premium Double Room w/ Breakfast')),
    ).toBe(true)
  })

  it('returns true when matched in a localised name variant (de: Frühstück)', () => {
    expect(
      roomIncludesBreakfast(
        makeProduct('Premium Einzelzimmer', { de: 'Premium Einzelzimmer mit Frühstück', en: 'Premium Single Room' }),
      ),
    ).toBe(true)
  })

  it('returns true when matched in a localised name variant (es: desayuno)', () => {
    expect(
      roomIncludesBreakfast(
        makeProduct('Habitación individual', { es: 'Habitación individual prémium con desayuno' }),
      ),
    ).toBe(true)
  })

  it('returns false for a plain Double Room', () => {
    expect(
      roomIncludesBreakfast(makeProduct('Double Room')),
    ).toBe(false)
  })

  it('returns false for a plain Single Room', () => {
    expect(
      roomIncludesBreakfast(makeProduct('Single Room')),
    ).toBe(false)
  })

  it('returns true when includes_breakfast=true, regardless of name (landr-5mvw structural flag)', () => {
    const room: Product = { ...makeProduct('Plain Room'), includes_breakfast: true }
    expect(roomIncludesBreakfast(room)).toBe(true)
  })

  it('returns false when includes_breakfast=false, even if name would match heuristic', () => {
    const room: Product = { ...makeProduct('Room with Breakfast'), includes_breakfast: false }
    expect(roomIncludesBreakfast(room)).toBe(false)
  })

  it('falls back to name heuristic when includes_breakfast is absent (legacy API response)', () => {
    const room = makeProduct('Premium Room with Breakfast')
    // makeProduct does not set includes_breakfast, so the key should be absent.
    expect('includes_breakfast' in room).toBe(false)
    expect(roomIncludesBreakfast(room)).toBe(true)
  })
})

describe('flattenPerRoomAddons (landr-yybu)', () => {
  function makeAddonFor(id: string, name: string): ProductAddon {
    return makeAddon(id, name)
  }

  it('sums qty per addon across rooms', () => {
    const addonsByRoom: Record<string, ProductAddon[]> = {
      'room-a': [makeAddonFor('bf-1', 'Breakfast')],
      'room-b': [makeAddonFor('bf-1', 'Breakfast')],
    }
    const roomSelection = { 'room-a': 1, 'room-b': 1 }
    const addonSelection = {
      'room-a': { 'bf-1': 1 },
      'room-b': { 'bf-1': 2 },
    }
    const result = flattenPerRoomAddons(addonSelection, roomSelection, addonsByRoom)
    expect(result).toEqual([{ productId: 'bf-1', quantity: 3 }])
  })

  it('skips rooms with qty=0 in roomSelection (dropped rooms)', () => {
    const addonsByRoom: Record<string, ProductAddon[]> = {
      'room-a': [makeAddonFor('bf-1', 'Breakfast')],
      'room-b': [makeAddonFor('bf-1', 'Breakfast')],
    }
    const roomSelection = { 'room-a': 0, 'room-b': 1 }
    const addonSelection = {
      'room-a': { 'bf-1': 3 },  // room-a dropped → should be excluded
      'room-b': { 'bf-1': 2 },
    }
    const result = flattenPerRoomAddons(addonSelection, roomSelection, addonsByRoom)
    expect(result).toEqual([{ productId: 'bf-1', quantity: 2 }])
  })

  it('excludes add-ons not in the room catalogue (guards carry-over)', () => {
    const addonsByRoom: Record<string, ProductAddon[]> = {
      'room-a': [makeAddonFor('bf-1', 'Breakfast')],
    }
    const roomSelection = { 'room-a': 1 }
    const addonSelection = {
      'room-a': { 'bf-1': 1, 'stale-id': 5 },
    }
    const result = flattenPerRoomAddons(addonSelection, roomSelection, addonsByRoom)
    expect(result).toEqual([{ productId: 'bf-1', quantity: 1 }])
  })

  it('returns empty array when addonSelection is empty', () => {
    const addonsByRoom: Record<string, ProductAddon[]> = {
      'room-a': [makeAddonFor('bf-1', 'Breakfast')],
    }
    const roomSelection = { 'room-a': 1 }
    const result = flattenPerRoomAddons({}, roomSelection, addonsByRoom)
    expect(result).toEqual([])
  })

  it('deduplicates the same add-on across multiple rooms and sums', () => {
    // Both single and double rooms link to 'bf-1'.
    const addonsByRoom: Record<string, ProductAddon[]> = {
      'single': [makeAddonFor('bf-1', 'Breakfast'), makeAddonFor('vid-1', 'Video')],
      'double': [makeAddonFor('bf-1', 'Breakfast')],
    }
    const roomSelection = { 'single': 1, 'double': 1 }
    const addonSelection = {
      'single': { 'bf-1': 1, 'vid-1': 2 },
      'double': { 'bf-1': 3 },
    }
    const result = flattenPerRoomAddons(addonSelection, roomSelection, addonsByRoom)
    // Sorted by productId: bf-1(4), vid-1(2)
    expect(result).toEqual([
      { productId: 'bf-1', quantity: 4 },
      { productId: 'vid-1', quantity: 2 },
    ])
  })
})

// ── landr-gb2f.2: participant → room assignment helpers ──────────────

describe('expandRoomUnits (landr-gb2f.2)', () => {
  it('expands each picked room into per-unit slots with capacity + name', () => {
    const products = [
      makeRoom('single', 49, 'EUR', 1),
      makeRoom('double', 73, 'EUR', 2),
    ]
    const rooms: RoomSelection[] = [
      { productId: 'single', quantity: 1 },
      { productId: 'double', quantity: 2 },
    ]
    const units = expandRoomUnits(rooms, products)
    expect(units).toEqual([
      { roomProductId: 'single', unitIndex: 0, capacity: 1, roomName: 'single' },
      { roomProductId: 'double', unitIndex: 0, capacity: 2, roomName: 'double' },
      { roomProductId: 'double', unitIndex: 1, capacity: 2, roomName: 'double' },
    ])
  })

  it('treats missing capacity_per_unit as 1', () => {
    const products = [makeRoom('legacy', 49, 'EUR', null)]
    const units = expandRoomUnits([{ productId: 'legacy', quantity: 2 }], products)
    expect(units.map((u) => u.capacity)).toEqual([1, 1])
  })

  it('skips rooms whose product is not in the catalogue (still loading)', () => {
    const products = [makeRoom('single', 49, 'EUR', 1)]
    const units = expandRoomUnits(
      [
        { productId: 'single', quantity: 1 },
        { productId: 'ghost', quantity: 3 },
      ],
      products,
    )
    expect(units).toHaveLength(1)
    expect(units[0]!.roomProductId).toBe('single')
  })

  it('emits nothing for qty<=0', () => {
    const products = [makeRoom('single', 49, 'EUR', 1)]
    expect(expandRoomUnits([{ productId: 'single', quantity: 0 }], products)).toEqual(
      [],
    )
  })
})

describe('roomUnitKey (landr-gb2f.2)', () => {
  it('builds a stable composite key', () => {
    expect(roomUnitKey('double', 1)).toBe('double::1')
  })
})

describe('autoAssignParticipants (landr-gb2f.2)', () => {
  const single = makeRoom('single', 49, 'EUR', 1)
  const double = makeRoom('double', 73, 'EUR', 2)

  it('auto-assigns 2 participants to a single double room (both fit)', () => {
    const units = expandRoomUnits([{ productId: 'double', quantity: 1 }], [double])
    const result = autoAssignParticipants(units, 2)
    expect(result).toEqual({
      0: { roomProductId: 'double', unitIndex: 0 },
      1: { roomProductId: 'double', unitIndex: 0 },
    })
  })

  it('fills units in order up to capacity_per_unit', () => {
    // two singles → each sleeps 1 → two participants go to separate units.
    const units = expandRoomUnits([{ productId: 'single', quantity: 2 }], [single])
    const result = autoAssignParticipants(units, 2)
    expect(result).toEqual({
      0: { roomProductId: 'single', unitIndex: 0 },
      1: { roomProductId: 'single', unitIndex: 1 },
    })
  })

  it('leaves overflow participants unassigned when units are full', () => {
    const units = expandRoomUnits([{ productId: 'single', quantity: 1 }], [single])
    const result = autoAssignParticipants(units, 3)
    // only 1 bed → only participant 0 placed; 1 and 2 left unassigned.
    expect(result).toEqual({ 0: { roomProductId: 'single', unitIndex: 0 } })
  })

  it('never clobbers an existing manual assignment, and respects its capacity', () => {
    const units = expandRoomUnits([{ productId: 'double', quantity: 1 }], [double])
    // participant 1 manually pinned to the double's only unit (1 of 2 used).
    const existing: RoomAssignmentMap = {
      1: { roomProductId: 'double', unitIndex: 0 },
    }
    const result = autoAssignParticipants(units, 3, existing)
    // participant 0 fills the remaining bed; participant 1 stays put;
    // participant 2 overflows (no beds left) → unassigned.
    expect(result).toEqual({
      0: { roomProductId: 'double', unitIndex: 0 },
      1: { roomProductId: 'double', unitIndex: 0 },
    })
  })

  it('re-runs after a room qty drop, evicting the stranded participant', () => {
    // Start: 2 singles, both participants assigned.
    const before = expandRoomUnits([{ productId: 'single', quantity: 2 }], [single])
    const assigned = autoAssignParticipants(before, 2)
    expect(Object.keys(assigned)).toHaveLength(2)
    // Drop to 1 single → re-run prunes the participant on unit 1 and
    // leaves them unassigned (no remaining bed).
    const after = expandRoomUnits([{ productId: 'single', quantity: 1 }], [single])
    const rerun = autoAssignParticipants(after, 2, assigned)
    expect(rerun).toEqual({ 0: { roomProductId: 'single', unitIndex: 0 } })
  })

  it('tops up newly-added capacity without disturbing assigned participants', () => {
    const oneSingle = expandRoomUnits([{ productId: 'single', quantity: 1 }], [single])
    const first = autoAssignParticipants(oneSingle, 2) // p0 in, p1 overflow
    expect(first).toEqual({ 0: { roomProductId: 'single', unitIndex: 0 } })
    // Add a second single → re-run should place p1 in the new unit, p0 stays.
    const twoSingles = expandRoomUnits(
      [{ productId: 'single', quantity: 2 }],
      [single],
    )
    const second = autoAssignParticipants(twoSingles, 2, first)
    expect(second).toEqual({
      0: { roomProductId: 'single', unitIndex: 0 },
      1: { roomProductId: 'single', unitIndex: 1 },
    })
  })

  it('returns {} when there are no units', () => {
    expect(autoAssignParticipants([], 2)).toEqual({})
  })
})

describe('pruneAssignments (landr-gb2f.2)', () => {
  const single = makeRoom('single', 49, 'EUR', 1)

  it('drops assignments referencing units that no longer exist', () => {
    const units = expandRoomUnits([{ productId: 'single', quantity: 1 }], [single])
    const assignment: RoomAssignmentMap = {
      0: { roomProductId: 'single', unitIndex: 0 }, // valid
      1: { roomProductId: 'single', unitIndex: 1 }, // unit removed
      2: { roomProductId: 'ghost', unitIndex: 0 }, // room gone
    }
    expect(pruneAssignments(assignment, units)).toEqual({
      0: { roomProductId: 'single', unitIndex: 0 },
    })
  })

  it('returns {} when no units remain', () => {
    const assignment: RoomAssignmentMap = {
      0: { roomProductId: 'single', unitIndex: 0 },
    }
    expect(pruneAssignments(assignment, [])).toEqual({})
  })
})

describe('occupantsOfUnit (landr-gb2f.2)', () => {
  it('lists the participant indices assigned to a given unit, sorted', () => {
    const unit: RoomUnit = {
      roomProductId: 'double',
      unitIndex: 0,
      capacity: 2,
      roomName: 'double',
    }
    const assignment: RoomAssignmentMap = {
      2: { roomProductId: 'double', unitIndex: 0 },
      0: { roomProductId: 'double', unitIndex: 0 },
      1: { roomProductId: 'single', unitIndex: 0 }, // different unit
    }
    expect(occupantsOfUnit(assignment, unit)).toEqual([0, 2])
  })
})

describe('partySize (landr-87n9.3)', () => {
  it('sums participants + companions', () => {
    expect(partySize(6, 6)).toBe(12)
    expect(partySize(1, 0)).toBe(1)
    expect(partySize(0, 3)).toBe(3)
  })
})

describe('autoAssignParty (landr-87n9.3)', () => {
  const single = makeRoom('single', 49, 'EUR', 1)
  const double = makeRoom('double', 73, 'EUR', 2)

  it('assigns participants first (0..P-1) then companions (P..P+C-1) by capacity', () => {
    // 1 participant + 1 companion, two single units → participant gets unit
    // 0, companion gets unit 1 (companion index = P = 1).
    const units = expandRoomUnits([{ productId: 'single', quantity: 2 }], [single])
    const result = autoAssignParty(units, 1, 1)
    expect(result).toEqual({
      0: { roomProductId: 'single', unitIndex: 0 },
      1: { roomProductId: 'single', unitIndex: 1 },
    })
  })

  it('packs a participant + companion into one double (capacity 2)', () => {
    const units = expandRoomUnits([{ productId: 'double', quantity: 1 }], [double])
    const result = autoAssignParty(units, 1, 1)
    expect(result).toEqual({
      0: { roomProductId: 'double', unitIndex: 0 },
      1: { roomProductId: 'double', unitIndex: 0 },
    })
  })

  it('supports a party LARGER than the 6-participant cap (6 + 6 = 12)', () => {
    // 6 doubles → 6 units capacity 2 = 12 beds. 6 participants + 6
    // companions all fit, two per unit (one participant + ... greedy pack).
    const units = expandRoomUnits([{ productId: 'double', quantity: 6 }], [double])
    const result = autoAssignParty(units, 6, 6)
    // every one of the 12 members is assigned.
    expect(Object.keys(result)).toHaveLength(12)
    // each unit has exactly 2 occupants.
    for (let u = 0; u < 6; u += 1) {
      const occ = occupantsOfUnit(result, {
        roomProductId: 'double',
        unitIndex: u,
        capacity: 2,
        roomName: 'double',
      })
      expect(occ).toHaveLength(2)
    }
  })

  it('never clobbers a manual assignment of a companion', () => {
    const units = expandRoomUnits([{ productId: 'single', quantity: 2 }], [single])
    // companion (index 1) manually pinned to unit 1.
    const existing: RoomAssignmentMap = {
      1: { roomProductId: 'single', unitIndex: 1 },
    }
    const result = autoAssignParty(units, 1, 1, existing)
    expect(result).toEqual({
      1: { roomProductId: 'single', unitIndex: 1 }, // stays put
      0: { roomProductId: 'single', unitIndex: 0 }, // participant fills the other
    })
  })

  it('leaves overflow members unassigned when beds run out', () => {
    const units = expandRoomUnits([{ productId: 'single', quantity: 1 }], [single])
    // 1 participant + 2 companions, 1 bed → only the participant is placed.
    const result = autoAssignParty(units, 1, 2)
    expect(result).toEqual({ 0: { roomProductId: 'single', unitIndex: 0 } })
  })
})

describe('occupancyStatus (landr-87n9.3)', () => {
  const single = makeRoom('single', 49, 'EUR', 1)
  const double = makeRoom('double', 73, 'EUR', 2)

  it('is complete when every unit has an occupant AND everyone is assigned', () => {
    const units = expandRoomUnits([{ productId: 'single', quantity: 2 }], [single])
    const assignment = autoAssignParty(units, 2, 0)
    const status = occupancyStatus(units, 2, assignment)
    expect(status.complete).toBe(true)
    expect(status.emptyUnits).toEqual([])
    expect(status.unassignedMembers).toEqual([])
  })

  it('flags a truly UNOCCUPIED booked room (empty room blocks)', () => {
    // 2 single units but only 1 person → unit 1 is empty.
    const units = expandRoomUnits([{ productId: 'single', quantity: 2 }], [single])
    const assignment: RoomAssignmentMap = {
      0: { roomProductId: 'single', unitIndex: 0 },
    }
    const status = occupancyStatus(units, 1, assignment)
    expect(status.complete).toBe(false)
    expect(status.emptyUnits).toHaveLength(1)
    expect(status.emptyUnits[0]!.unitIndex).toBe(1)
    // the one person IS assigned, so no unassigned members.
    expect(status.unassignedMembers).toEqual([])
  })

  it('flags an unassigned person (someone with no room blocks)', () => {
    // 1 double (capacity 2) occupied by 1 person; a 2nd person unassigned.
    const units = expandRoomUnits([{ productId: 'double', quantity: 1 }], [double])
    const assignment: RoomAssignmentMap = {
      0: { roomProductId: 'double', unitIndex: 0 },
    }
    const status = occupancyStatus(units, 2, assignment)
    expect(status.complete).toBe(false)
    expect(status.emptyUnits).toEqual([]) // the room HAS an occupant
    expect(status.unassignedMembers).toEqual([1])
  })

  it('the "room booked for a companion" case is valid once she is assigned', () => {
    // 1 participant in a single, 1 companion in a second single booked "for
    // her". Both units occupied, both members assigned → complete.
    const units = expandRoomUnits([{ productId: 'single', quantity: 2 }], [single])
    const assignment: RoomAssignmentMap = {
      0: { roomProductId: 'single', unitIndex: 0 }, // participant
      1: { roomProductId: 'single', unitIndex: 1 }, // companion (index P=1)
    }
    const status = occupancyStatus(units, 2, assignment)
    expect(status.complete).toBe(true)
  })

  it('treats an assignment to a no-longer-existing unit as unassigned', () => {
    // room qty dropped from 2→1; member 1 still references the gone unit 1.
    const units = expandRoomUnits([{ productId: 'single', quantity: 1 }], [single])
    const assignment: RoomAssignmentMap = {
      0: { roomProductId: 'single', unitIndex: 0 },
      1: { roomProductId: 'single', unitIndex: 1 }, // gone
    }
    const status = occupancyStatus(units, 2, assignment)
    expect(status.complete).toBe(false)
    expect(status.unassignedMembers).toEqual([1])
  })

  it('is complete (vacuously) when there are no units and no members', () => {
    expect(occupancyStatus([], 0, {}).complete).toBe(true)
  })

  it('blocks a double room that holds only one person (partial unit)', () => {
    // 1 double (capacity 2) with a single occupant and no one else in the
    // party → the room is under-filled, so Continue must stay disabled.
    const units = expandRoomUnits([{ productId: 'double', quantity: 1 }], [double])
    const assignment: RoomAssignmentMap = {
      0: { roomProductId: 'double', unitIndex: 0 },
    }
    const status = occupancyStatus(units, 1, assignment)
    expect(status.complete).toBe(false)
    expect(status.emptyUnits).toEqual([])
    expect(status.partialUnits).toHaveLength(1)
    expect(status.partialUnits[0]!.roomProductId).toBe('double')
    expect(status.unassignedMembers).toEqual([])
  })

  it('is complete once the double room is filled to capacity', () => {
    const units = expandRoomUnits([{ productId: 'double', quantity: 1 }], [double])
    const assignment: RoomAssignmentMap = {
      0: { roomProductId: 'double', unitIndex: 0 },
      1: { roomProductId: 'double', unitIndex: 0 },
    }
    const status = occupancyStatus(units, 2, assignment)
    expect(status.complete).toBe(true)
    expect(status.partialUnits).toEqual([])
  })
})

describe('applyAssignment — cycling on a full unit (landr)', () => {
  const single = makeRoom('single', 49, 'EUR', 1)
  const double = makeRoom('double', 73, 'EUR', 2)
  // One single + one double → unit keys single::0, double::0.
  const units = expandRoomUnits(
    [
      { productId: 'single', quantity: 1 },
      { productId: 'double', quantity: 1 },
    ],
    [single, double],
  )
  const singleUnit = units.find((u) => u.roomProductId === 'single')!
  const doubleUnit = units.find((u) => u.roomProductId === 'double')!

  // Party: Matthias = 0 (single), Olaf = 1, Alida = 2 (double).
  const start: RoomAssignmentMap = {
    0: { roomProductId: 'single', unitIndex: 0 },
    1: { roomProductId: 'double', unitIndex: 0 },
    2: { roomProductId: 'double', unitIndex: 0 },
  }

  it('rotates: dropping Matthias onto a full double evicts Alida to the single', () => {
    const next = applyAssignment(start, 0, doubleUnit)
    // Matthias takes the first slot, Olaf the second; Alida moves to the single.
    expect(occupantsOfUnit(next, doubleUnit)).toEqual([0, 1])
    expect(occupantsOfUnit(next, singleUnit)).toEqual([2])
  })

  it('cycles a different person out each repeat (Alida, then Olaf, then Matthias)', () => {
    // Round 1: drop Matthias (in single) onto the full double.
    const r1 = applyAssignment(start, 0, doubleUnit)
    expect(occupantsOfUnit(r1, doubleUnit)).toEqual([0, 1]) // Matthias, Olaf
    expect(occupantsOfUnit(r1, singleUnit)).toEqual([2]) // Alida bumped out

    // Round 2: drop Alida (now in single) onto the full double.
    const r2 = applyAssignment(r1, 2, doubleUnit)
    expect(occupantsOfUnit(r2, doubleUnit)).toEqual([2, 0]) // Alida, Matthias
    expect(occupantsOfUnit(r2, singleUnit)).toEqual([1]) // Olaf bumped out

    // Round 3: drop Olaf onto the full double → Matthias bumped out (full cycle).
    const r3 = applyAssignment(r2, 1, doubleUnit)
    expect(occupantsOfUnit(r3, doubleUnit)).toEqual([1, 2]) // Olaf, Alida
    expect(occupantsOfUnit(r3, singleUnit)).toEqual([0]) // Matthias bumped out
  })

  it('never exceeds the unit capacity through a rotation', () => {
    const next = applyAssignment(start, 0, doubleUnit)
    expect(occupantsOfUnit(next, doubleUnit).length).toBeLessThanOrEqual(
      doubleUnit.capacity,
    )
  })

  it('appends (no rotation) when the target has spare capacity', () => {
    // Double holds only Olaf (1); dropping Matthias appends him at the end.
    const partial: RoomAssignmentMap = {
      0: { roomProductId: 'single', unitIndex: 0 },
      1: { roomProductId: 'double', unitIndex: 0 },
    }
    const next = applyAssignment(partial, 0, doubleUnit)
    expect(occupantsOfUnit(next, doubleUnit)).toEqual([1, 0]) // Olaf first, Matthias second
    expect(occupantsOfUnit(next, singleUnit)).toEqual([])
  })

  it('evicts to the unassigned tray when the mover came from the tray', () => {
    // Matthias (0) is unassigned; the double is full with Olaf + Alida.
    const fromTray: RoomAssignmentMap = {
      1: { roomProductId: 'double', unitIndex: 0 },
      2: { roomProductId: 'double', unitIndex: 0 },
    }
    const next = applyAssignment(fromTray, 0, doubleUnit)
    expect(occupantsOfUnit(next, doubleUnit)).toEqual([0, 1]) // Matthias, Olaf
    // Alida (2) is evicted to the tray → no assignment entry for her.
    expect(next[2]).toBeUndefined()
  })

  it('unassigns a member when the target is null', () => {
    const next = applyAssignment(start, 1, null)
    expect(next[1]).toBeUndefined()
    expect(occupantsOfUnit(next, doubleUnit)).toEqual([2])
  })

  it('is a no-op when dropping a member onto its own unit', () => {
    const next = applyAssignment(start, 1, doubleUnit)
    expect(next).toBe(start)
  })

  it('does not mutate the input map', () => {
    const snapshot = JSON.parse(JSON.stringify(start))
    applyAssignment(start, 0, doubleUnit)
    expect(start).toEqual(snapshot)
  })
})

describe('hasIncompleteChildAge (landr-doam.1)', () => {
  const assignment: RoomAssignmentMap = {
    0: { roomProductId: 'double', unitIndex: 0 },
    1: { roomProductId: 'double', unitIndex: 0 },
  }

  it('returns false when all assigned occupants are adults (empty ageMap)', () => {
    expect(hasIncompleteChildAge(assignment, {})).toBe(false)
  })

  it('returns false when all children have a valid age', () => {
    const ageMap: OccupantAgeMap = {
      0: { band: 'child', age: 8 },
      1: { band: 'adult', age: null },
    }
    expect(hasIncompleteChildAge(assignment, ageMap)).toBe(false)
  })

  it('returns true when a child occupant has no age (null)', () => {
    const ageMap: OccupantAgeMap = {
      0: { band: 'child', age: null },
    }
    expect(hasIncompleteChildAge(assignment, ageMap)).toBe(true)
  })

  it('returns true when a child occupant has negative age (invalid sentinel)', () => {
    const ageMap: OccupantAgeMap = {
      1: { band: 'child', age: -1 },
    }
    expect(hasIncompleteChildAge(assignment, ageMap)).toBe(true)
  })

  it('ignores unassigned members — they have no ageMap entry', () => {
    // member 99 is NOT in the assignment map, so the age entry is irrelevant.
    const ageMap: OccupantAgeMap = {
      99: { band: 'child', age: null },
    }
    expect(hasIncompleteChildAge(assignment, ageMap)).toBe(false)
  })

  it('returns false for an empty assignment (no occupants to check)', () => {
    const ageMap: OccupantAgeMap = { 0: { band: 'child', age: null } }
    expect(hasIncompleteChildAge({}, ageMap)).toBe(false)
  })
})

describe('chipHue (landr-rc4l — colourful assignment chips)', () => {
  it('gives the first several members distinct hues', () => {
    // The common case (a handful of guests) must never collide.
    const hues = [0, 1, 2, 3, 4].map(chipHue)
    expect(new Set(hues).size).toBe(hues.length)
  })

  it('is deterministic — same index always maps to the same hue', () => {
    expect(chipHue(2)).toBe(chipHue(2))
    expect(chipHue(0)).toBe(CHIP_HUES[0])
  })

  it('wraps modulo the palette length for large parties', () => {
    expect(chipHue(CHIP_HUES.length)).toBe(chipHue(0))
    expect(chipHue(CHIP_HUES.length + 3)).toBe(chipHue(3))
  })

  it('always returns a valid hue (0–359) for any index', () => {
    for (const i of [0, 1, 7, 13, 99]) {
      const h = chipHue(i)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(360)
    }
  })
})
