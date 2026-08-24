/**
 * Pure helpers for AccommodationStep (landr-vyaz, landr-qpab). Kept
 * separate from the component file so React Fast Refresh stays happy
 * — the widget deploy pipeline blocks
 * `react-refresh/only-export-components` (see landr-znl history in the
 * CI warning notes).
 */
import type { Product } from '@/api/types'

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

// landr-c53m.7: findBreakfastAddonIds / totalBreakfastQty (landr-qpab) used
// to live here — a case-insensitive English substring match on the add-on
// display name (`/breakfast/i.test(addon.name)`), which would silently
// match nothing for a non-English operator's own add-on names. They powered
// the aggregate breakfast-vs-participants warning, which landr-yybu removed
// in favour of the per-row, add-on-agnostic overbook warning in AddonsList
// (isOverbooked in addonsState.ts, driven by is_required/min_qty/max_qty —
// no name/id matching at all). Both helpers were unused dead code (only
// referenced from their own tests) by the time this ticket landed, so
// rather than inventing a new heuristic (there is still no structural
// "this add-on IS breakfast" flag — includes_breakfast on Product means
// something different: "breakfast is bundled into THIS room's rate") they
// were deleted along with the substring match instead of being preserved.

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
 * Returns an array of { productId, quantity, productKind } sorted by
 * productId for deterministic ordering (stable for tests and submit
 * payloads). landr-fxza.4: `productKind` is threaded through from each
 * addon's own ProductAddon row (its product_kind, e.g. 'hotel_room' for
 * breakfast) so BookingForm.onConfirm can give room-tied add-ons the
 * room's NIGHT window instead of the raw service-day window.
 */
export function flattenPerRoomAddons(
  addonSelection: Record<string, Record<string, number>>,
  roomSelection: Record<string, number>,
  addonsByRoom: Record<string, import('@/api/types').ProductAddon[]>,
): import('./addonsState').AddonSelection[] {
  const totals = new Map<string, number>()
  const kindById = new Map<string, import('@/api/types').ProductKind>()
  for (const [roomId, roomQty] of Object.entries(roomSelection)) {
    if ((roomQty ?? 0) <= 0) continue
    const roomAddons = addonsByRoom[roomId] ?? []
    const roomQtys = addonSelection[roomId] ?? {}
    for (const addon of roomAddons) {
      const id = addon.addon_product_id
      const qty = roomQtys[id] ?? 0
      if (qty <= 0) continue
      totals.set(id, (totals.get(id) ?? 0) + qty)
      if (!kindById.has(id)) kindById.set(id, addon.product_kind)
    }
  }
  return [...totals.entries()]
    .filter(([, qty]) => qty > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([productId, quantity]) => ({
      productId,
      quantity,
      ...(kindById.has(productId)
        ? { productKind: kindById.get(productId) }
        : {}),
    }))
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
 * `participants` array. Absent key (or null entry) → unassigned. The
 * roomProductId + unitIndex pair mirrors the wire contract fields
 * (room_product_id + room_unit_index).
 *
 * landr (breadcrumb/cycling): `slot` is the 0-based position of this occupant
 * WITHIN its unit. It is UI-only — the submit payload never sends it (the wire
 * contract is just room_product_id + room_unit_index, and multiple occupants
 * legitimately share one unit_index). The slot gives the chips a stable,
 * rotatable order so dropping a person onto a FULL unit can push the existing
 * occupants down a position and evict the LAST one — rotating which person is
 * displaced each time instead of always bumping the same one. Absent slot →
 * the occupant is ordered after slotted ones, tie-broken by member index (the
 * legacy behaviour, so old assignment maps still render deterministically).
 */
export interface RoomAssignmentEntry {
  roomProductId: string
  unitIndex: number
  /** 0-based position within the unit (UI-only; never submitted). */
  slot?: number
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

/**
 * Member indices assigned to a given (roomProductId, unitIndex), ordered by
 * `slot` ascending (the in-unit position), falling back to member index for
 * entries without a slot. This ordering is what the chips render in, and what
 * the rotation logic in applyAssignment treats as "first spot … last spot".
 */
function orderedOccupantsByKey(
  assignment: RoomAssignmentMap,
  roomProductId: string,
  unitIndex: number,
): number[] {
  const out: { idx: number; slot: number }[] = []
  for (const [pid, entry] of Object.entries(assignment)) {
    if (entry.roomProductId === roomProductId && entry.unitIndex === unitIndex) {
      out.push({ idx: Number(pid), slot: entry.slot ?? Number.MAX_SAFE_INTEGER })
    }
  }
  out.sort((a, b) => a.slot - b.slot || a.idx - b.idx)
  return out.map((o) => o.idx)
}

/** Member indices currently assigned to a given unit, in display (slot) order. */
export function occupantsOfUnit(
  assignment: RoomAssignmentMap,
  unit: RoomUnit,
): number[] {
  return orderedOccupantsByKey(assignment, unit.roomProductId, unit.unitIndex)
}

/**
 * Re-pack a unit's slots to a contiguous 0..k-1 run in current display order.
 * Mutates `map` in place. Called after any move so "the last slot" is always
 * well-defined for the next rotation. Pure w.r.t. ordering — it only rewrites
 * the slot numbers, never which unit an occupant is in.
 *
 * Returns the ordered member-index list so callers that immediately need the
 * occupant order (e.g. applyAssignment's insert path) can reuse it without a
 * second orderedOccupantsByKey scan.
 */
function renormalizeUnitSlots(
  map: RoomAssignmentMap,
  roomProductId: string,
  unitIndex: number,
): number[] {
  const ordered = orderedOccupantsByKey(map, roomProductId, unitIndex)
  ordered.forEach((idx, position) => {
    const entry = map[idx]
    if (entry) map[idx] = { ...entry, slot: position }
  })
  return ordered
}

/**
 * Apply a single (re)assignment of one member to a target unit (or null to
 * unassign). Pure — returns a NEW map, never mutates the input.
 *
 * Behaviour by case:
 *   • target === null            → unassign the member; re-pack its old unit.
 *   • member already in target   → no-op.
 *   • target has spare capacity  → place the member at the END of the target;
 *                                  re-pack the old + new units.
 *   • target is FULL             → ROTATE: insert the member at the FRONT,
 *                                  shift the existing occupants one slot down,
 *                                  and evict the occupant in the LAST slot to
 *                                  the member's PREVIOUS unit (the swap source),
 *                                  or to the unassigned tray if the member came
 *                                  from there. Repeating cycles the evicted
 *                                  person, so the same two are not endlessly
 *                                  swapped.
 *
 * Worked example (the double-room cycle): single S=[Matthias], double
 * D=[Olaf, Alida]. Drop Matthias → D=[Matthias, Olaf], S=[Alida]. Drop Alida
 * → D=[Alida, Matthias], S=[Olaf]. Drop Olaf → D=[Olaf, Alida], S=[Matthias].
 */
export function applyAssignment(
  assignment: RoomAssignmentMap,
  memberIndex: number,
  target: RoomUnit | null,
): RoomAssignmentMap {
  const next: RoomAssignmentMap = {}
  for (const [pid, entry] of Object.entries(assignment)) {
    next[Number(pid)] = { ...entry }
  }
  const prev = assignment[memberIndex]

  // Unassign.
  if (target === null) {
    if (prev) {
      delete next[memberIndex]
      renormalizeUnitSlots(next, prev.roomProductId, prev.unitIndex)
    }
    return next
  }

  // Already in the target unit → nothing to do.
  if (
    prev &&
    prev.roomProductId === target.roomProductId &&
    prev.unitIndex === target.unitIndex
  ) {
    return assignment
  }

  // Give the target's current occupants contiguous slots (0..k-1) in their
  // existing display order before we insert. This anchors "the last slot" even
  // when the unit was filled by auto-assign (slot-less, index-ordered), so both
  // the append and the rotation below place the mover predictably.
  // Reuse the ordered list returned by renormalizeUnitSlots to avoid a second
  // orderedOccupantsByKey scan (landr-cnk9 #4).
  const occupants = renormalizeUnitSlots(
    next,
    target.roomProductId,
    target.unitIndex,
  ).filter((i) => i !== memberIndex)

  if (occupants.length < target.capacity) {
    // Spare capacity → append the member at the end of the target unit.
    // The new member is placed at slot `occupants.length` (i.e. one past the
    // last existing occupant) so no re-normalisation of the target is needed
    // — the slots are already contiguous 0..k-1 from renormalizeUnitSlots
    // above, and appending at occupants.length keeps them that way (landr-cnk9 #3).
    next[memberIndex] = {
      roomProductId: target.roomProductId,
      unitIndex: target.unitIndex,
      slot: occupants.length,
    }
    if (prev) renormalizeUnitSlots(next, prev.roomProductId, prev.unitIndex)
    return next
  }

  // FULL → rotate the member in at the front and evict the last occupant.
  const evicted = occupants[target.capacity - 1]!
  const kept = occupants.slice(0, target.capacity - 1)
  const newOrder = [memberIndex, ...kept]
  newOrder.forEach((idx, position) => {
    next[idx] = {
      roomProductId: target.roomProductId,
      unitIndex: target.unitIndex,
      slot: position,
    }
  })
  if (prev) {
    // Evicted occupant takes the spot the mover just vacated (swap source).
    next[evicted] = {
      roomProductId: prev.roomProductId,
      unitIndex: prev.unitIndex,
      slot: prev.slot ?? 0,
    }
    renormalizeUnitSlots(next, prev.roomProductId, prev.unitIndex)
  } else {
    // Mover came from the unassigned tray → evicted goes back to the tray.
    delete next[evicted]
  }
  renormalizeUnitSlots(next, target.roomProductId, target.unitIndex)
  return next
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
  // first unit (in expansion order) that still has remaining capacity. Fresh
  // auto-assigned entries carry no explicit slot — occupantsOfUnit falls back
  // to member-index order for them, which is the natural initial layout. Slots
  // are introduced lazily by applyAssignment the first time a unit is edited,
  // so the rotation has a stable order to cycle through from then on.
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
 * Three independent rules must ALL hold:
 *   1. EVERY booked room unit has >= 1 occupant (a truly UNOCCUPIED booked
 *      room blocks — an empty room "for nobody" is wrong).
 *   2. EVERY booked room unit is FILLED TO CAPACITY. A capacity-2 double room
 *      with only one person assigned blocks Continue — the customer must add a
 *      second guest or book a smaller room. (Over-capacity can't happen: every
 *      assignment path caps occupancy at the unit capacity.) This is the rule
 *      that makes "a double needs two people" enforceable.
 *   3. EVERY party member (participant OR companion) is assigned to a unit
 *      (no unassigned person).
 *
 * `complete` is true only when `emptyUnits`, `partialUnits` and
 * `unassignedMembers` are all empty. The arrays let the caller render specific
 * copy ("Room 2 has no guests", "Double Room #1 needs 1 more guest", "Assign
 * everyone to a room") rather than a generic "incomplete" message.
 *
 * Pure: depends only on its inputs. `partyCount` is the unified member
 * count (participants + companions). Member indices below `partyCount` that
 * are absent from `assignment` are reported as unassigned.
 */
export interface OccupancyStatus {
  complete: boolean
  /** Room units with zero occupants (truly unoccupied — blocks Continue). */
  emptyUnits: RoomUnit[]
  /**
   * Room units with at least one but fewer occupants than their capacity
   * (e.g. a double room holding only one person — blocks Continue).
   */
  partialUnits: RoomUnit[]
  /** Party-member indices not assigned to any unit (blocks Continue). */
  unassignedMembers: number[]
}

export function occupancyStatus(
  units: RoomUnit[],
  partyCount: number,
  assignment: RoomAssignmentMap,
): OccupancyStatus {
  // Prune first so an assignment pointing at a no-longer-existing unit
  // (e.g. a room qty was just dropped) doesn't count toward occupancy and
  // its member is reported as unassigned.
  const pruned = pruneAssignments(assignment, units)
  // Rules 1 + 2: classify every booked unit by how full it is.
  const emptyUnits: RoomUnit[] = []
  const partialUnits: RoomUnit[] = []
  for (const unit of units) {
    const count = occupantsOfUnit(pruned, unit).length
    if (count === 0) emptyUnits.push(unit)
    else if (count < unit.capacity) partialUnits.push(unit)
  }
  // Rule 3: any member index without a (valid) assignment is unassigned.
  const assignedSet = new Set(Object.keys(pruned).map(Number))
  const unassignedMembers: number[] = []
  for (let i = 0; i < partyCount; i += 1) {
    if (!assignedSet.has(i)) unassignedMembers.push(i)
  }
  return {
    complete:
      emptyUnits.length === 0 &&
      partialUnits.length === 0 &&
      unassignedMembers.length === 0,
    emptyUnits,
    partialUnits,
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
export function roomIncludesBreakfast(product: Product): boolean {
  // Structural flag is the canonical source of truth (landr-5mvw).
  if (product.includes_breakfast !== undefined) {
    return product.includes_breakfast
  }
  // Fallback: name heuristic for legacy API responses without the field.
  if (/breakfast|frühstück|desayuno|petit-déjeuner/i.test(product.name)) {
    return true
  }
  if (product.name_localized) {
    for (const localeName of Object.values(product.name_localized)) {
      if (/breakfast|frühstück|desayuno|petit-déjeuner/i.test(localeName)) {
        return true
      }
    }
  }
  return false
}

/**
 * landr-a4fy / landr-z59y: per-party-member breakfast flag map
 * (memberIndex → boolean). `breakfastMap[i] === true` means occupant i HOLDS a
 * breakfast chip → they get breakfast (has_breakfast=true on the submit
 * payload + emails). Only assigned occupants ever appear; a missing key means
 * no breakfast.
 *
 * landr-z59y reworked the UX: breakfast is no longer a per-occupant checkbox.
 * Each breakfast add-on is a fixed, DRAGGABLE "Breakfast" chip the customer
 * drops onto a person. The fixed count (= the add-on qty per room product)
 * means chips can only be MOVED between occupants of the same room product,
 * never added or removed — which enforces "exactly N breakfasts" structurally.
 * This map records the result (which occupants currently hold a chip) and is
 * persisted across breadcrumb re-nav so the assignment survives (landr-nmed),
 * being re-clamped whenever the occupants / add-on qty change.
 */
export type BreakfastMap = Record<number, boolean>

/**
 * landr-z59y: total breakfast add-on qty for a single room PRODUCT, summed
 * across all its add-on lines (breakfast is the only per-room add-on today;
 * if more are added we sum all of them, matching BookingForm's
 * perRoomBreakfastRows logic). This is the FIXED number of breakfast chips for
 * that product. Returns 0 when the room has no add-on slice.
 */
export function roomBreakfastQty(
  roomProductId: string,
  perRoomAddons: Record<string, Record<string, number>>,
): number {
  const qtys = perRoomAddons[roomProductId] ?? {}
  return Object.values(qtys).reduce((a, b) => a + b, 0)
}

/**
 * landr-z59y: assigned occupant member-indices grouped by their room PRODUCT
 * (not unit), each list in ascending member-index order. Breakfast chips are a
 * per-product resource (e.g. "this hotel-room type comes with N breakfasts"),
 * so chip distribution + the "(N breakfasts)" label reason at the product
 * level — a double room with 2 people but only 1 breakfast cannot be split
 * into two units, so we count its occupants directly.
 */
export function occupantsByRoomProduct(
  assignment: RoomAssignmentMap,
): Map<string, number[]> {
  const byProduct = new Map<string, number[]>()
  for (const [memberIdxStr, entry] of Object.entries(assignment)) {
    const list = byProduct.get(entry.roomProductId) ?? []
    list.push(Number(memberIdxStr))
    byProduct.set(entry.roomProductId, list)
  }
  for (const list of byProduct.values()) list.sort((a, b) => a - b)
  return byProduct
}

/**
 * landr-z59y: the breakfast UI mode for one room product, given its breakfast
 * add-on qty (B) and how many occupants are assigned to its rooms (occ):
 *
 *   • 'none'    — B === 0: no breakfast add-on → no breakfast UI at all.
 *   • 'all'     — B >= occ > 0: every occupant gets breakfast automatically.
 *                 No draggable chips, just a "(N breakfasts)" label.
 *   • 'partial' — 0 < B < occ: render B draggable chips the customer assigns
 *                 to specific occupants.
 *
 * occ === 0 with B > 0 (breakfast bought but nobody assigned yet) reports
 * 'all' (B >= occ trivially) but yields no chips/flags since there are no
 * occupants — harmless, and it resolves to 'partial' as soon as occ exceeds B.
 */
export type RoomBreakfastMode = 'none' | 'all' | 'partial'

export function roomBreakfastMode(qty: number, occCount: number): RoomBreakfastMode {
  if (qty <= 0) return 'none'
  if (qty >= occCount) return 'all'
  return 'partial'
}

/**
 * landr-z59y: clamp / (re)seed the breakfast-chip holder map against the
 * current room assignment + per-room add-on qtys. This is the single source of
 * truth that keeps the map valid as occupants are moved between rooms or the
 * add-on qty changes, and it provides the deterministic DEFAULT placement.
 *
 * For each room product:
 *   • B = breakfast add-on qty (chip count), occ = its assigned occupants.
 *   • If B >= occ → ALL occupants hold a chip (true).
 *   • Else keep the chips currently held by occupants STILL assigned to this
 *     product (from `prev`), capped at B, preferring lower member indices for
 *     determinism; if fewer than B are held, fill the remainder from the
 *     product's first occupants (ascending) that don't already hold one.
 *
 * Occupants of products with no breakfast (B === 0) never hold a chip.
 * Unassigned members never appear. Returns a NEW map — pure.
 */
export function clampBreakfastMap(
  assignment: RoomAssignmentMap,
  perRoomAddons: Record<string, Record<string, number>>,
  prev: BreakfastMap = {},
): BreakfastMap {
  const out: BreakfastMap = {}
  const byProduct = occupantsByRoomProduct(assignment)
  for (const [roomProductId, occupants] of byProduct.entries()) {
    const qty = roomBreakfastQty(roomProductId, perRoomAddons)
    if (qty <= 0) continue
    if (qty >= occupants.length) {
      // Everyone gets breakfast — no choice to make.
      for (const idx of occupants) out[idx] = true
      continue
    }
    // Partial: keep prior holders (still assigned here), then top up.
    //
    // landr-iiwz: keep ALL prev holders still on the product (capped at qty)
    // EXACTLY as before — this is what makes back-nav restoration and manual
    // choices stick. Only the REMAINING (qty − kept) slots change: instead of
    // filling the product's first occupants in pure ascending order (which
    // clusters every chip onto unit 0 when several physical units share one
    // product, e.g. 3 doubles + 3 breakfasts → 2/1/0), distribute them across
    // the product's UNITS round-robin, preferring units that currently hold
    // the FEWEST chips (tie-break lowest unitIndex, then lowest member-index).
    // Net effect: a fresh 3-doubles/3-breakfasts seeds one chip per room.
    const held = new Set<number>()
    for (const idx of occupants) {
      if (prev[idx] === true && held.size < qty) held.add(idx)
    }
    if (held.size < qty) {
      // Group this product's not-yet-held occupants by physical unit, each
      // unit's candidate list in ascending member-index order.
      const unitOf = (idx: number): number => assignment[idx]?.unitIndex ?? 0
      const unitIndices = Array.from(
        new Set(occupants.map(unitOf)),
      ).sort((a, b) => a - b)
      const candidatesByUnit = new Map<number, number[]>()
      const heldCountByUnit = new Map<number, number>()
      for (const u of unitIndices) {
        candidatesByUnit.set(u, [])
        heldCountByUnit.set(u, 0)
      }
      for (const idx of occupants) {
        const u = unitOf(idx)
        if (held.has(idx)) {
          heldCountByUnit.set(u, (heldCountByUnit.get(u) ?? 0) + 1)
        } else {
          candidatesByUnit.get(u)!.push(idx)
        }
      }
      // Round-robin: each pass pick the eligible unit holding the fewest chips
      // (tie-break lowest unitIndex), take its lowest-member-index candidate.
      while (held.size < qty) {
        let bestUnit = -1
        let bestHeld = Infinity
        for (const u of unitIndices) {
          const candidates = candidatesByUnit.get(u)!
          if (candidates.length === 0) continue
          const heldHere = heldCountByUnit.get(u)!
          if (heldHere < bestHeld) {
            bestHeld = heldHere
            bestUnit = u
          }
        }
        if (bestUnit === -1) break // no candidates left (shouldn't happen: qty < occ)
        const idx = candidatesByUnit.get(bestUnit)!.shift()!
        held.add(idx)
        heldCountByUnit.set(bestUnit, heldCountByUnit.get(bestUnit)! + 1)
      }
    }
    for (const idx of held) out[idx] = true
  }
  return out
}

/**
 * landr-z59y: alias kept for the call-sites that "derive" the breakfast map at
 * confirm time. Identical to clampBreakfastMap with no prior state — it seeds
 * the deterministic default placement from scratch. (Renamed conceptually from
 * the landr-a4fy heuristic; signature preserved so AccommodationStep/BookingForm
 * call-sites stay stable.)
 */
export function deriveBreakfastMap(
  assignment: RoomAssignmentMap,
  perRoomAddons: Record<string, Record<string, number>>,
  prev: BreakfastMap = {},
): BreakfastMap {
  return clampBreakfastMap(assignment, perRoomAddons, prev)
}

/**
 * landr-z59y: move a breakfast chip ONTO `memberIndex` (the occupant the user
 * dropped a chip on, or tapped "+ breakfast"). The target keeps its chip; the
 * count for its room product stays fixed at B by dropping an OTHER holder of
 * the same product when the cap is exceeded. The target's drop always wins.
 * Pure — returns a NEW map.
 *
 * landr-iiwz: `from` is the optional drag SOURCE — the occupant whose chip is
 * being dragged. A drag is a true MOVE: when an excess holder must be dropped
 * to keep B fixed, we prefer dropping `from` if it is a current holder of the
 * SAME room product as the target (i.e. listed in that product's occupants).
 * Without this, displacement always dropped the highest member-index holder,
 * NOT the dragged source — so chips on the lowest-index room (unit 0) could
 * never be displaced and that room stayed permanently stuck. We fall back to
 * the legacy highest-index-first displacement when `from` is absent (the
 * source-less "+ breakfast" tap) or points at a different product.
 *
 * No-op (returns a clamped copy) when the target is unassigned, its product has
 * no breakfast, or the product is in 'all' mode (B >= occ, nobody to displace).
 */
export function assignBreakfastChip(
  assignment: RoomAssignmentMap,
  perRoomAddons: Record<string, Record<string, number>>,
  prev: BreakfastMap,
  memberIndex: number,
  from?: number,
): BreakfastMap {
  const entry = assignment[memberIndex]
  // Start from a clamped baseline so the result is always valid.
  const base = clampBreakfastMap(assignment, perRoomAddons, prev)
  if (!entry) return base
  const roomProductId = entry.roomProductId
  const qty = roomBreakfastQty(roomProductId, perRoomAddons)
  if (qty <= 0) return base
  if (base[memberIndex] === true) return base // already holds one

  const occupants = occupantsByRoomProduct(assignment).get(roomProductId) ?? []
  // Force the target to hold a chip.
  base[memberIndex] = true
  // Current holders of this product (after forcing the target in).
  const holders = occupants.filter((idx) => base[idx] === true)
  // Drop excess holders but never the target. Prefer dropping the drag source
  // `from` when it holds a chip of THIS product (a true move); otherwise fall
  // back to legacy highest-member-index-first displacement.
  const fromIsSameProductHolder =
    from !== undefined &&
    from !== memberIndex &&
    occupants.includes(from) &&
    base[from] === true
  const droppable = holders
    .filter((idx) => idx !== memberIndex)
    .sort((a, b) => {
      if (fromIsSameProductHolder) {
        if (a === from) return -1 // drop the source first
        if (b === from) return 1
      }
      return b - a // then highest member index first
    })
  let excess = holders.length - qty
  for (const idx of droppable) {
    if (excess <= 0) break
    delete base[idx]
    excess -= 1
  }
  return base
}

/**
 * landr-z59y: the breakfast label for ONE room unit, computed from the REAL
 * chip holders among that unit's occupants — NOT the product-total qty. Two
 * units of the same product therefore label independently, and the label can
 * never over-report when B > occ.
 *
 *   • product has no breakfast add-on    → '' (no breakfast concept).
 *   • 0 holders in this unit             → '' (no label).
 *   • 1 holder, single-occupant unit     → '(with breakfast)'.
 *   • 1 holder, multi-occupant unit      → '(1 breakfast)'.
 *   • N holders                          → '(N breakfasts)'.
 *
 * The UI mirror lives in RoomAssignment.tsx (kept there for react-refresh);
 * this pure version exists so the label maths is unit-testable in isolation.
 */
export function unitBreakfastLabel(
  occupantIndices: number[],
  breakfastMap: BreakfastMap,
  productHasBreakfast: boolean,
): string {
  if (!productHasBreakfast) return ''
  const held = occupantIndices.filter((i) => breakfastMap[i] === true).length
  if (held === 0) return ''
  if (held === 1) {
    return occupantIndices.length === 1 ? '(with breakfast)' : '(1 breakfast)'
  }
  return `(${held} breakfasts)`
}

/**
 * landr-z59y: resolve the destination UNIT for a NAME-chip drop, defensively.
 * The room-assignment droppable is `unitData` (carries `.unit`); a near-miss can
 * instead resolve to a nested OCCUPANT droppable (carries `.breakfastTarget`).
 * Without the fallthrough the assignment silently no-ops — the regression this
 * fixes. Given the over-droppable's data, returns the RoomUnit to assign to (the
 * unit itself, or the unit of the occupant that was hit), or null when the drop
 * is over nothing assignable.
 *
 * `unitOfMember` maps an assigned occupant index → its current RoomUnit (or
 * null). Pure — depends only on its inputs.
 */
export function resolveNameDropUnit(
  over:
    | { unit?: RoomUnit | undefined; breakfastTarget?: number | undefined }
    | null
    | undefined,
  unitOfMember: (memberIndex: number) => RoomUnit | null,
): RoomUnit | null {
  if (!over) return null
  if (over.unit) return over.unit
  if (over.breakfastTarget !== undefined) return unitOfMember(over.breakfastTarget)
  return null
}

/**
 * landr-z59y: resolve the TARGET occupant for a BREAKFAST-chip drop,
 * defensively. The intended target is `over.breakfastTarget`; if the chip
 * instead resolves to a UNIT droppable (carries `.unit`), map it to an occupant
 * of that unit — preferring one who doesn't already hold a chip — so a near-miss
 * still reassigns rather than silently failing. Returns the member index to give
 * the breakfast to, or null when there is no sensible target or the resolved
 * target is the source (a no-op move).
 *
 * `occupantsOf` returns the member indices assigned to a unit (display order).
 */
export function resolveBreakfastDropTarget(
  over:
    | { unit?: RoomUnit | undefined; breakfastTarget?: number | undefined }
    | null
    | undefined,
  from: number,
  breakfastMap: BreakfastMap,
  occupantsOf: (unit: RoomUnit) => number[],
): number | null {
  if (!over) return null
  let target = over.breakfastTarget
  if (target === undefined && over.unit) {
    const occ = occupantsOf(over.unit)
    target = occ.find((i) => breakfastMap[i] !== true) ?? occ[0]
  }
  if (target === undefined || target === from) return null
  return target
}

/**
 * landr-sjrd: progressive name disambiguation for party-member chips.
 *
 * The party is the full list of people who will be room-assigned (participants
 * first, companions after — the same index space as the assignment map). Each
 * member is represented as { first, last }; callers that have no last name for
 * a member (or a companion with an empty last_name field) pass ''.
 *
 * Algorithm:
 *   1. Unique first name (case-insensitive, non-empty) → display as `First`.
 *   2. Colliding first name + distinguishing last initial → `First X.`
 *   3. Colliding first name + colliding (first + initial) → `First Last` (full).
 *   4. Colliding first name but NO last name (initial '') → `First` (best-effort;
 *      can't disambiguate a name-only member).
 *   5. Empty first name → '' (let the downstream `Guest N` fallback handle it);
 *      empty firsts must not force OTHER members to disambiguate.
 *
 * Collision detection is always case-insensitive; displayed names use the
 * original casing; last initials are uppercased.
 *
 * Pure — no side effects, no React imports.
 */
export function disambiguatePartyLabels(
  party: { first: string; last: string }[],
): string[] {
  // Build normalised keys once (trim + lowercase) for collision counting.
  const normalised = party.map((m) => ({
    firstKey: m.first.trim().toLowerCase(),
    lastKey: m.last.trim().toLowerCase(),
    firstOrig: m.first.trim(),
    lastOrig: m.last.trim(),
  }))

  // Count first-name occurrences (non-empty only — empty firsts don't count
  // toward collision detection so they don't force others to disambiguate).
  const firstCount = new Map<string, number>()
  for (const n of normalised) {
    if (!n.firstKey) continue
    firstCount.set(n.firstKey, (firstCount.get(n.firstKey) ?? 0) + 1)
  }

  // For members whose first name collides, count (firstKey, initialKey) pairs.
  // The initial is the first char of the last name (or '' when no last name).
  const pairCount = new Map<string, number>()
  for (const n of normalised) {
    if (!n.firstKey) continue
    if ((firstCount.get(n.firstKey) ?? 0) <= 1) continue
    const initial = n.lastKey ? n.lastKey[0]! : ''
    const pairKey = `${n.firstKey}\0${initial}`
    pairCount.set(pairKey, (pairCount.get(pairKey) ?? 0) + 1)
  }

  return normalised.map((n) => {
    // Rule 5: empty first → let the downstream fallback handle it.
    if (!n.firstKey) return ''

    // Rule 1: unique first name.
    if ((firstCount.get(n.firstKey) ?? 0) <= 1) return n.firstOrig

    // First name collides — check if the initial disambiguates.
    const initial = n.lastKey ? n.lastKey[0]! : ''

    if (!initial) {
      // Rule 4: colliding first, no last name → best-effort, show first only.
      return n.firstOrig
    }

    const pairKey = `${n.firstKey}\0${initial}`
    if ((pairCount.get(pairKey) ?? 0) <= 1) {
      // Rule 2: first+initial is unique → show `First X.`
      return `${n.firstOrig} ${initial.toUpperCase()}.`
    }

    // Rule 3: first+initial also collides → full name.
    return `${n.firstOrig} ${n.lastOrig}`
  })
}

/**
 * landr-rc4l: per-party-member accent hues for the room-assignment chips.
 * A fixed palette of evenly-spaced, visually distinct hues (degrees on the
 * HSL wheel) so adjacent chips never read as "the same colour", indexed by
 * the unified party-member index (participants 0..P-1 then companions) and
 * wrapped modulo the palette length once the party is larger than the
 * palette. Order is hand-tuned (blue → green → orange → purple → …) so the
 * first handful of guests — the common case — land on maximally-separated
 * hues rather than neighbouring ones.
 *
 * Kept here rather than in RoomAssignment.tsx so the component file keeps
 * its single named-component export (react-refresh/only-export-components,
 * see the header note in that file) and so the palette stays unit-testable
 * in isolation.
 */
export const CHIP_HUES = [210, 145, 28, 280, 330, 50, 175, 0, 255, 95] as const

/**
 * Stable accent hue (0–359) for a party member by chip index. Deterministic
 * — the same member index always resolves to the same hue across renders so
 * a chip's colour never flickers as the assignment map changes. Defensive
 * double-modulo keeps it in range for any integer input.
 */
export function chipHue(memberIndex: number): number {
  const len = CHIP_HUES.length
  const i = ((memberIndex % len) + len) % len
  return CHIP_HUES[i]!
}
