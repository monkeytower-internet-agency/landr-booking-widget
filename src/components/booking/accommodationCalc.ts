/**
 * Pure helpers for AccommodationStep (landr-vyaz, landr-qpab). Kept
 * separate from the component file so React Fast Refresh stays happy
 * — the widget deploy pipeline blocks
 * `react-refresh/only-export-components` (see landr-znl history in the
 * CI warning notes).
 */
import type { Product, ProductAddon } from '@/api/types'

/** ISO date helpers — UTC-only to avoid TZ drift in derived dates. */
function isoToUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function utcDateToIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function shiftDays(iso: string, delta: number): string {
  const d = isoToUtcDate(iso)
  d.setUTCDate(d.getUTCDate() + delta)
  return utcDateToIso(d)
}

/**
 * Derived check-in/check-out + nights for a stay aligned with a multi-day
 * service. Per the spec: check-in = first selected day - 1, check-out =
 * last selected day + 1, nights = (check-out - check-in).
 *
 * Nights are computed from the day span (last - first + 2), NOT from
 * selectedDays.length, because non-contiguous service selections still
 * occupy the hotel continuously across the gap. Example: selecting
 * [Mon, Wed] for the service means check-in Sun, check-out Thu, the
 * customer does not check out on Tuesday and return — that would be a
 * second booking. Pre-2026-05-21 (landr-ma5n) this used
 * `selectedDays.length + 1`, which under-counted non-contiguous spans
 * (e.g. [25, 27] returned 3 nights instead of 4).
 *
 * Returns null fields + nights=0 when selectedDays is empty so the
 * caller can render an empty-state without crashing.
 */
export interface StayWindow {
  checkInIso: string | null
  checkOutIso: string | null
  nights: number
}

export function deriveStayWindow(selectedDays: string[]): StayWindow {
  if (selectedDays.length === 0) {
    return { checkInIso: null, checkOutIso: null, nights: 0 }
  }
  const sorted = [...selectedDays].sort()
  const checkInIso = shiftDays(sorted[0]!, -1)
  const checkOutIso = shiftDays(sorted[sorted.length - 1]!, 1)
  // Span-based night count: difference (in days) between check-out and
  // check-in. Works for both contiguous and non-contiguous selections
  // because the hotel window is continuous from first-1 to last+1.
  const checkInUtc = isoToUtcDate(checkInIso)
  const checkOutUtc = isoToUtcDate(checkOutIso)
  const msPerDay = 24 * 60 * 60 * 1000
  const nights = Math.round((checkOutUtc.getTime() - checkInUtc.getTime()) / msPerDay)
  return {
    checkInIso,
    checkOutIso,
    nights,
  }
}

/**
 * Array of ISO night dates for a stay, inclusive of check-in and
 * exclusive of check-out (one entry per night the room is occupied).
 * Mirrors hotel-industry convention: a 4-night stay from Mon→Fri
 * occupies Mon, Tue, Wed, Thu (4 entries). Returned in ascending order.
 *
 * Used by BookingForm to populate `selected_days` on hotel_room
 * ProductLineIn entries (landr-piyv) so the server-side pricing engine
 * computes per-night totals against the right window. Returns [] for
 * empty input — callers should skip emitting the line item in that case.
 */
export function stayNightIsos(selectedDays: string[]): string[] {
  const win = deriveStayWindow(selectedDays)
  if (!win.checkInIso || !win.checkOutIso) return []
  const out: string[] = []
  let cursor = win.checkInIso
  // walk from check-in (inclusive) to check-out (exclusive)
  while (cursor < win.checkOutIso) {
    out.push(cursor)
    cursor = shiftDays(cursor, 1)
  }
  return out
}

/** Single line item: a hotel_room product + how many of it the customer picked. */
export interface RoomSelection {
  productId: string
  quantity: number
}

/**
 * Format a number as a currency amount. Falls back to bare number with
 * the currency suffix when Intl is unavailable or the currency code is
 * unrecognised — never throws.
 */
export function formatCurrency(amount: number, currency: string | null | undefined): string {
  const ccy = currency ?? 'EUR'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: ccy,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${ccy}`
  }
}

/**
 * Per-room subtotal: qty * pricePerUnit * nights. Returns 0 when the
 * product has no price_per_unit (the widget then shows a "—" instead
 * of a number).
 */
export function roomSubtotal(
  product: Product,
  quantity: number,
  nights: number,
): number {
  if (!product.price_per_unit || quantity <= 0 || nights <= 0) return 0
  return Number(product.price_per_unit) * quantity * nights
}

/** Sum subtotals for every selected room. */
export function totalStayCost(
  rooms: RoomSelection[],
  products: Product[],
  nights: number,
): { amount: number; currency: string | null } {
  let amount = 0
  let currency: string | null = null
  const byId = new Map(products.map((p) => [p.product_id, p]))
  for (const room of rooms) {
    const product = byId.get(room.productId)
    if (!product) continue
    amount += roomSubtotal(product, room.quantity, nights)
    if (!currency && product.currency) currency = product.currency
  }
  return { amount, currency }
}

/**
 * Total bed capacity across the selected rooms (landr-qpab). For each
 * picked room we multiply quantity × capacity_per_unit. NULL/missing
 * capacity is treated as 1 — the lenient default while landr-knm0
 * backfills seeds; once every operator sets a value this fallback
 * still keeps legacy rooms bookable rather than asserting an invariant.
 */
export function totalRoomCapacity(
  rooms: RoomSelection[],
  products: Product[],
): number {
  const byId = new Map(products.map((p) => [p.product_id, p]))
  let total = 0
  for (const room of rooms) {
    const product = byId.get(room.productId)
    if (!product) continue
    const capacity = product.capacity_per_unit ?? 1
    total += capacity * room.quantity
  }
  return total
}

/**
 * Identify the set of add-on product ids that look like "breakfast"
 * line items (landr-qpab). Today we use a case-insensitive substring
 * match on the add-on display name because ProductAddon does not carry
 * a slug or a structural flag — see TODO. The Para42 seed names the
 * row 'Breakfast' across locales, so the heuristic catches it without
 * tripping on unrelated add-ons (Video Package etc.).
 *
 * TODO(landr-qpab): replace with a structural flag once add-ons grow
 * a category/kind field; the name match is a pragmatic starter that
 * keeps the overbook warning scoped to the obvious case without
 * blocking the wider epic on a schema migration.
 */
export function findBreakfastAddonIds(addons: ProductAddon[]): Set<string> {
  const ids = new Set<string>()
  for (const addon of addons) {
    if (/breakfast/i.test(addon.name)) {
      ids.add(addon.addon_product_id)
    }
  }
  return ids
}

/**
 * Sum the picked quantity across every add-on whose addon_product_id
 * is in `breakfastIds` (landr-qpab). Callers normally build the id
 * set via findBreakfastAddonIds(addonsForRoom).
 */
export function totalBreakfastQty(
  addonSelection: Record<string, number>,
  breakfastIds: Set<string>,
): number {
  let total = 0
  for (const id of breakfastIds) {
    total += addonSelection[id] ?? 0
  }
  return total
}

/**
 * Flatten a per-room add-on selection map back to the AddonSelection[] shape
 * expected by the onConfirm contract (landr-yybu).
 *
 * The per-room map is `Record<roomProductId, Record<addon_product_id, qty>>`.
 * This helper:
 *   1. Only considers rooms still in the cart (roomSelection[roomId] > 0).
 *   2. Only includes add-ons that appear in that room's catalogue
 *      (addonsByRoom[roomId]), so dropped-room add-ons don't leak.
 *   3. Sums qty per addon_product_id across rooms, deduplicating add-ons
 *      that are linked to multiple rooms (e.g. Para42 Breakfast on Single +
 *      Double). The resulting line items are unique by productId.
 *   4. Omits entries with a summed qty of 0.
 *
 * Returns an array of { productId, quantity } sorted by productId for
 * deterministic ordering (stable for tests and submit payloads).
 */
export function flattenPerRoomAddons(
  addonSelection: Record<string, Record<string, number>>,
  roomSelection: Record<string, number>,
  addonsByRoom: Record<string, import('@/api/types').ProductAddon[]>,
): import('./addonsState').AddonSelection[] {
  const totals = new Map<string, number>()
  for (const [roomId, roomQty] of Object.entries(roomSelection)) {
    if ((roomQty ?? 0) <= 0) continue
    const roomAddons = addonsByRoom[roomId] ?? []
    const roomQtys = addonSelection[roomId] ?? {}
    for (const addon of roomAddons) {
      const id = addon.addon_product_id
      const qty = roomQtys[id] ?? 0
      if (qty <= 0) continue
      totals.set(id, (totals.get(id) ?? 0) + qty)
    }
  }
  return [...totals.entries()]
    .filter(([, qty]) => qty > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([productId, quantity]) => ({ productId, quantity }))
}

/**
 * landr-gb2f.2: participant → room assignment helpers.
 *
 * A picked room with qty>1 is expanded into per-UNIT slots — a qty=2
 * double room becomes 2 separately-assignable units. Each unit sleeps
 * `capacity` people (the room's capacity_per_unit, lenient default 1).
 *
 * RoomUnit identifies a single physical unit by (roomProductId, unitIndex)
 * where unitIndex is 0-based WITHIN that room product. This pair is exactly
 * the wire contract the submit payload carries per participant
 * (room_product_id + room_unit_index), so the assignment map round-trips
 * 1:1 to the API without translation.
 */
export interface RoomUnit {
  /** The hotel_room product this unit belongs to. */
  roomProductId: string
  /** 0-based index of this unit within its room product (0..qty-1). */
  unitIndex: number
  /** How many people the unit sleeps (capacity_per_unit, default 1). */
  capacity: number
  /** Display name of the room product (for the drop-zone label). */
  roomName: string
}

/**
 * A participant's room assignment, keyed by the participant's index in the
 * `participants` array. Absent key (or null entry) → unassigned. The pair
 * mirrors the wire contract fields (room_product_id + room_unit_index).
 */
export interface RoomAssignmentEntry {
  roomProductId: string
  unitIndex: number
}
export type RoomAssignmentMap = Record<number, RoomAssignmentEntry>

/** Stable string key for a unit — handy for React keys + drop-zone ids. */
export function roomUnitKey(roomProductId: string, unitIndex: number): string {
  return `${roomProductId}::${unitIndex}`
}

/**
 * Expand the picked rooms into per-unit slots. For each RoomSelection we
 * emit `quantity` units (unitIndex 0..quantity-1), each carrying the room's
 * capacity_per_unit (NULL → 1, the lenient default used elsewhere in this
 * file). Rooms whose product_id isn't found in `products` are skipped (the
 * catalogue may still be loading); rooms with qty<=0 emit nothing.
 *
 * Output order is stable: rooms in the order they appear in `rooms`, units
 * ascending by unitIndex. Auto-assign fills units in exactly this order.
 */
export function expandRoomUnits(
  rooms: RoomSelection[],
  products: Product[],
): RoomUnit[] {
  const byId = new Map(products.map((p) => [p.product_id, p]))
  const units: RoomUnit[] = []
  for (const room of rooms) {
    const product = byId.get(room.productId)
    if (!product) continue
    const capacity = product.capacity_per_unit ?? 1
    const roomName = product.name
    for (let unitIndex = 0; unitIndex < room.quantity; unitIndex += 1) {
      units.push({ roomProductId: room.productId, unitIndex, capacity, roomName })
    }
  }
  return units
}

/**
 * Drop any assignment that no longer maps onto an existing unit. Called
 * before auto-assign when room quantities change so that, e.g., dropping a
 * room qty from 2→1 evicts the participant who was on unitIndex 1 (now gone)
 * instead of stranding a dangling reference. Returns a NEW map (pure).
 */
export function pruneAssignments(
  assignment: RoomAssignmentMap,
  units: RoomUnit[],
): RoomAssignmentMap {
  const valid = new Set(units.map((u) => roomUnitKey(u.roomProductId, u.unitIndex)))
  const out: RoomAssignmentMap = {}
  for (const [pid, entry] of Object.entries(assignment)) {
    if (valid.has(roomUnitKey(entry.roomProductId, entry.unitIndex))) {
      out[Number(pid)] = entry
    }
  }
  return out
}

/** Count how many participants are currently assigned to a given unit. */
export function occupantsOfUnit(
  assignment: RoomAssignmentMap,
  unit: RoomUnit,
): number[] {
  const out: number[] = []
  for (const [pid, entry] of Object.entries(assignment)) {
    if (
      entry.roomProductId === unit.roomProductId &&
      entry.unitIndex === unit.unitIndex
    ) {
      out.push(Number(pid))
    }
  }
  return out.sort((a, b) => a - b)
}

/**
 * Auto-assign unassigned participants to units by capacity, filling units in
 * order up to each unit's capacity. NEVER clobbers an explicit assignment
 * already present in `existing` — those participants keep their unit and the
 * capacity they occupy is respected. Re-runnable: pass the current map after
 * a room-qty change and it tops up the still-unassigned participants without
 * disturbing the assigned ones.
 *
 * `participantCount` is the number of people (participants array length).
 * Participants are referenced by their 0-based index. Any participant index
 * that can't fit (units full) is simply left unassigned — the UI then shows
 * them as a leftover chip; this is non-blocking by design.
 *
 * Returns a NEW map (pure). The input `existing` is first pruned to the
 * given units so stale references don't consume capacity.
 */
export function autoAssignParticipants(
  units: RoomUnit[],
  participantCount: number,
  existing: RoomAssignmentMap = {},
): RoomAssignmentMap {
  const next = pruneAssignments(existing, units)
  // Remaining capacity per unit after honouring existing assignments.
  const remaining = new Map<string, number>()
  for (const unit of units) {
    remaining.set(roomUnitKey(unit.roomProductId, unit.unitIndex), unit.capacity)
  }
  const assignedParticipants = new Set<number>()
  for (const [pid, entry] of Object.entries(next)) {
    assignedParticipants.add(Number(pid))
    const key = roomUnitKey(entry.roomProductId, entry.unitIndex)
    remaining.set(key, (remaining.get(key) ?? 0) - 1)
  }
  // Walk participants in index order; place each unassigned one into the
  // first unit (in expansion order) that still has remaining capacity.
  let unitCursor = 0
  for (let pIdx = 0; pIdx < participantCount; pIdx += 1) {
    if (assignedParticipants.has(pIdx)) continue
    while (unitCursor < units.length) {
      const unit = units[unitCursor]!
      const key = roomUnitKey(unit.roomProductId, unit.unitIndex)
      if ((remaining.get(key) ?? 0) > 0) {
        next[pIdx] = { roomProductId: unit.roomProductId, unitIndex: unit.unitIndex }
        remaining.set(key, (remaining.get(key) ?? 0) - 1)
        break
      }
      unitCursor += 1
    }
    if (unitCursor >= units.length) break // units exhausted — leave the rest unassigned
  }
  return next
}

/**
 * landr-87n9.3: whole-party assignment + occupancy gating.
 *
 * The assignment map is keyed by a UNIFIED party-member index. The party
 * is laid out as [guiding participants (0..P-1)] followed by [companions
 * (P..P+C-1)], where P = participantCount and C = companionCount. This lets
 * autoAssignParticipants / occupantsOfUnit / pruneAssignments operate on a
 * single integer index space without distinguishing the two kinds — the
 * caller folds the result back to the two arrays via the P boundary.
 *
 * `partySize(P, C)` is just `P + C`, named for readability at call-sites.
 */
export function partySize(participantCount: number, companionCount: number): number {
  return participantCount + companionCount
}

/**
 * Auto-assign the WHOLE PARTY (participants + companions) to room units by
 * capacity. Thin wrapper over autoAssignParticipants using the unified
 * index space (P + C members). Participants fill first (indices 0..P-1),
 * then companions (P..P+C-1), in expansion order across the units — never
 * over-filling a unit beyond its capacity, never clobbering an existing
 * manual assignment (the `existing` map is honoured + pruned to the units).
 *
 * Pure + re-runnable: pass the current map after a room-qty / party-size
 * change and it tops up the still-unassigned members without disturbing the
 * assigned ones. Members that don't fit (units full) stay unassigned.
 */
export function autoAssignParty(
  units: RoomUnit[],
  participantCount: number,
  companionCount: number,
  existing: RoomAssignmentMap = {},
): RoomAssignmentMap {
  return autoAssignParticipants(
    units,
    partySize(participantCount, companionCount),
    existing,
  )
}

/**
 * Occupancy-completeness check (landr-87n9.3) — the gate that enables
 * Continue in package mode. Returns a structured result so the UI can show
 * a precise inline hint of exactly what's blocking.
 *
 * Two independent rules must BOTH hold:
 *   1. EVERY booked room unit has >= 1 occupant (a truly UNOCCUPIED booked
 *      room blocks — an empty room "for nobody" is wrong). A room booked
 *      "for a companion" is fine the moment she's assigned to it.
 *   2. EVERY party member (participant OR companion) is assigned to a unit
 *      (no unassigned person).
 *
 * `complete` is true only when both `emptyUnits` and `unassignedMembers`
 * are empty. The two arrays let the caller render specific copy
 * ("Room 2 has no guests", "Assign everyone to a room") rather than a
 * generic "incomplete" message.
 *
 * Pure: depends only on its inputs. `partyCount` is the unified member
 * count (participants + companions). Member indices below `partyCount` that
 * are absent from `assignment` are reported as unassigned.
 */
export interface OccupancyStatus {
  complete: boolean
  /** Room units with zero occupants (truly unoccupied — blocks Continue). */
  emptyUnits: RoomUnit[]
  /** Party-member indices not assigned to any unit (blocks Continue). */
  unassignedMembers: number[]
}

export function occupancyStatus(
  units: RoomUnit[],
  partyCount: number,
  assignment: RoomAssignmentMap,
): OccupancyStatus {
  // Rule 1: any unit with zero occupants is an empty booked room.
  const emptyUnits = units.filter(
    (unit) => occupantsOfUnit(assignment, unit).length === 0,
  )
  // Rule 2: any member index without a (valid) assignment is unassigned.
  // Prune first so an assignment pointing at a no-longer-existing unit
  // (e.g. a room qty was just dropped) counts the member as unassigned.
  const pruned = pruneAssignments(assignment, units)
  const assignedSet = new Set(Object.keys(pruned).map(Number))
  const unassignedMembers: number[] = []
  for (let i = 0; i < partyCount; i += 1) {
    if (!assignedSet.has(i)) unassignedMembers.push(i)
  }
  return {
    complete: emptyUnits.length === 0 && unassignedMembers.length === 0,
    emptyUnits,
    unassignedMembers,
  }
}

// ─── Per-occupant age band (landr-doam.1) ────────────────────────────────────

/**
 * Age-band value for an assigned room occupant. 'adult' is the default and
 * requires no further input. 'child' requires a numeric age (0-17) in the
 * companion field. null is treated as 'adult' at submit time.
 *
 * WIRE CONTRACT (PINNED — landr-doam.2 on the API builds the same shape).
 */
export type OccupantAgeBand = 'adult' | 'child'

/**
 * Per-party-member age band + age, keyed by the UNIFIED party-member index
 * (participants 0..P-1, companions P..P+C-1). Only assigned occupants ever
 * appear in this map — unassigned members are always considered adult (no
 * input shown in the unassigned tray).
 *
 * A missing key means the occupant is adult (the default). A key with band
 * 'child' and age===null means the child age is still required.
 */
export interface OccupantAgeEntry {
  band: OccupantAgeBand
  /** The child's age in years (0-17). Required when band==='child'. */
  age: number | null
}
export type OccupantAgeMap = Record<number, OccupantAgeEntry>

/**
 * Check that every assigned CHILD occupant has a valid age entered (0-17).
 * Adults need no age. Members absent from the map default to adult → pass.
 *
 * Returns true when Continue should be blocked (there is at least one child
 * with a missing age). Pure — depends only on the assignment + age map.
 *
 * Only assigned occupants (present in `assignment`) can ever be child —
 * unassigned members show no control and are always adult.
 */
export function hasIncompleteChildAge(
  assignment: RoomAssignmentMap,
  ageMap: OccupantAgeMap,
): boolean {
  for (const pidStr of Object.keys(assignment)) {
    const pid = Number(pidStr)
    const entry = ageMap[pid]
    if (entry?.band === 'child' && (entry.age === null || entry.age < 0)) {
      return true
    }
  }
  return false
}

/**
 * Returns true when a hotel_room product is a "premium-includes-breakfast"
 * variant — i.e. the room price already bundles breakfast (landr-sbhz.4).
 *
 * Detection strategy: case-insensitive substring match on the product
 * name for "breakfast", "frühstück", "desayuno" or "petit-déjeuner".
 * Para42 names these rooms "Premium Single Room w/ Breakfast" /
 * "Premium Double Room w/ Breakfast" so the match fires correctly.
 *
 * Callers (AccommodationStep) use this to suppress the breakfast add-on
 * row for these rooms so the customer isn't offered a separate breakfast
 * charge on top of one already included in the room rate.
 *
 * TODO(landr-sbhz.4): replace with a structural flag (e.g. a product tag
 * or a 'includes_breakfast' boolean) once the data model grows it. The
 * name heuristic is a pragmatic starter that keeps the widget correct for
 * Para42 without blocking on a schema migration.
 */
export function isPremiumIncludesBreakfast(product: Product): boolean {
  // Check the default display name first.
  if (/breakfast|frühstück|desayuno|petit-déjeuner/i.test(product.name)) {
    return true
  }
  // Also check any localised variants stored in name_localized.
  if (product.name_localized) {
    for (const localeName of Object.values(product.name_localized)) {
      if (/breakfast|frühstück|desayuno|petit-déjeuner/i.test(localeName)) {
        return true
      }
    }
  }
  return false
}
