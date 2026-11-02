/**
 * Offer lines (the guest side of the offers model): the pure cart model.
 *
 * Every cart line can carry offers -- extras another line offers ("the stay
 * offers air conditioning"). The evaluator (POST /api/public/offers/evaluate,
 * `useOffers`) says which offers each line shows this party; this module
 * holds what the guest picked from them and turns it into submit / estimate
 * lines. It never decides price, collection or mode: submit re-resolves every
 * offer line on the server.
 *
 * The cart is a tree of line ids:
 *  - `main`          the main product line (depth 0),
 *  - `r-<productId>` one line per booked room TYPE (depth 0, top level),
 *  - `o1`, `a1`, ... one line per pick (an offer taken), hanging off its
 *                    parent line; a pick is itself a parent for the offers
 *                    of its product (stay -> tour -> water shoes), at most
 *                    MAX_OFFER_DEPTH deep.
 *
 * Who a pick is for (`binding`): `person` = one line per ticked guest,
 * `booking` = one line for the booking, `free` = one line with a quantity.
 * Whose days (`schedule`): `locked` = the parent's days, `subset` = days the
 * guest picks among the parent's, `own` = the line's own dates (booked as an
 * added product, see crossSell.ts ExtraLine).
 */
import type {
  EstimateAddonLine,
  EstimateLineItem,
  EvaluatedLine,
  EvaluatedOffer,
  EligibilityReasonParams,
  GuestAttributeWireValue,
  OfferBinding,
  OfferEvaluateGuest,
  OfferEvaluateLine,
  OfferMode,
  OfferOption,
  OfferSchedule,
  ProductLine,
} from '@/api/types'
import { pickLocalized } from '@/lib/locale'
import { ruleMatches } from '@/lib/offerRules'
import { fmt, tr } from '@/lib/strings'
import { formatMoney } from './priceSidebarHelpers'
import type { ExtraLine } from './crossSell'
import { stayNightIsos, type RoomSelection } from './accommodationCalc'

export const MAIN_LINE_ID = 'main'
/** Depth of a pick counted from the stay line (depth 0); a chain stops here. */
export const MAX_OFFER_DEPTH = 3
/** The evaluator judges at most this many lines per request. */
export const MAX_EVALUATE_LINES = 20

/** The line id of a booked room type (keyed by product, never by position). */
export function roomLineId(roomProductId: string): string {
  return `r-${roomProductId}`
}

/** Option key of a booking / free pick (one line, no guest). */
export const WHOLE_BOOKING = '*'

/** One offer the guest took. */
export interface OfferPick {
  /** `o1`, `o2`, ... (review step) or `a1`, ... (accommodation step). */
  lineId: string
  parentLineId: string
  offerId: string
  productId: string
  binding: OfferBinding
  /** The effective schedule (see effectiveSchedule). */
  schedule: OfferSchedule
  /** UI only: a mandatory pick cannot be removed. */
  mode: OfferMode
  /** `person`: the ticked guests (party member keys). */
  memberIds: string[]
  /** Picked option per member key (`person`) or under WHOLE_BOOKING. */
  options: Record<string, string>
  /** `free`: the quantity; `booking` / `person` lines are always 1. */
  quantity: number
  /** `subset`: the picked days (inside the parent's days). */
  days: string[]
  /** The evaluator's last word on this offer. */
  seen: EvaluatedOffer
}

/** One guest as the offer model sees them. */
export interface PartyMember {
  /** Stable member key (the details step's member id, else the ref). */
  key: string
  /** The person's id inside the request body: `g1`, `g2`, ... in party order. */
  ref: string
  name: string
  attributes: Record<string, GuestAttributeWireValue>
}

interface GuestRow {
  id?: string
  first_name?: string
  last_name?: string
  guest_attributes?: Record<string, string | number>
  occupant_age_band?: 'adult' | 'child' | null
  occupant_age?: number | null
}

/** Per-member age entry (party index -> band + age), as RoomAssignment keeps it. */
export type MemberAgeMap = Readonly<Record<number, { band: 'adult' | 'child'; age: number | null }>>

/** Party order: participants first, then companions. */
export function partyRef(index: number): string {
  return `g${index + 1}`
}

/**
 * The party as offer members: refs `g1..gN` in party order (participants,
 * then companions), the answered guest attributes plus `age` from the
 * occupant age (RoomAssignment / the guest step) when the guest step did not
 * ask it. Submit treats `occupant_age` as `age` too.
 */
export function partyMembers(
  participants: readonly GuestRow[],
  companions: readonly GuestRow[],
  ageMap: MemberAgeMap = {},
  fallbackName: (n: number) => string = (n) => `#${n}`,
): PartyMember[] {
  return [...participants, ...companions].map((p, i) => {
    const attributes: Record<string, GuestAttributeWireValue> = { ...(p.guest_attributes ?? {}) }
    const entry = ageMap[i]
    const age =
      entry?.band === 'child'
        ? entry.age
        : p.occupant_age_band === 'child'
          ? (p.occupant_age ?? null)
          : null
    if (attributes.age === undefined && typeof age === 'number') attributes.age = age
    const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
    return {
      key: p.id || partyRef(i),
      ref: partyRef(i),
      name: name || fallbackName(i + 1),
      attributes,
    }
  })
}

/** The evaluate / estimate `guests` body. */
export function guestsWire(members: readonly PartyMember[]): OfferEvaluateGuest[] {
  return members.map((m) => ({ id: m.ref, attributes: { ...m.attributes } }))
}

/**
 * The schedule the guest sees: a legacy day-pickable add-on (a `locked` row
 * whose product is `parent_subset`) picks its days like a `subset` one.
 */
export function effectiveSchedule(
  o: Pick<EvaluatedOffer, 'schedule' | 'day_selection'>,
): OfferSchedule {
  if (o.schedule === 'locked' && o.day_selection === 'parent_subset') return 'subset'
  return o.schedule
}

// ---- the tree ----------------------------------------------------------------

/** A non-pick line of the cart: the main line, a room type, an added product. */
export interface TreeLine {
  lineId: string
  productId: string
  /** null = top level (main, rooms). */
  parentLineId: string | null
  /** Booked days (nights for a room / stay). */
  days: string[]
}

/** The cart tree the picks hang in. */
export interface OfferTreeInput {
  main: TreeLine
  rooms?: readonly TreeLine[]
  /** Products added with their own dates (crossSell ExtraLine with a line id). */
  extras?: readonly TreeLine[]
}

function treeLines(tree: OfferTreeInput): TreeLine[] {
  return [tree.main, ...(tree.rooms ?? []), ...(tree.extras ?? [])]
}

/** The booked days of line `lineId` (a pick's days follow its schedule). */
export function lineDays(
  lineId: string,
  tree: OfferTreeInput,
  picks: readonly OfferPick[],
  seen: ReadonlySet<string> = new Set(),
): string[] {
  const line = treeLines(tree).find((l) => l.lineId === lineId)
  if (line) return line.days
  const pick = picks.find((p) => p.lineId === lineId)
  if (!pick || seen.has(lineId)) return []
  if (pick.schedule === 'subset') return pick.days
  return lineDays(pick.parentLineId, tree, picks, new Set([...seen, lineId]))
}

/** Depth of a line: main / rooms 0, an added product or pick one more than its parent. */
export function depthOf(
  lineId: string,
  tree: OfferTreeInput,
  picks: readonly OfferPick[],
): number {
  let depth = 0
  let cur: string | null = lineId
  const guard = new Set<string>()
  while (cur !== null && !guard.has(cur)) {
    guard.add(cur)
    const id: string = cur
    const line = treeLines(tree).find((l) => l.lineId === id)
    if (line) {
      if (line.parentLineId === null) return depth
      cur = line.parentLineId
      depth += 1
      continue
    }
    const pick = picks.find((p) => p.lineId === id)
    if (!pick) return depth
    cur = pick.parentLineId
    depth += 1
  }
  return depth
}

/** Every line id in the tree (lines and picks). */
export function treeLineIds(tree: OfferTreeInput, picks: readonly OfferPick[]): Set<string> {
  return new Set([...treeLines(tree).map((l) => l.lineId), ...picks.map((p) => p.lineId)])
}

/** The next free pick id with `prefix` (`o` / `a`), unique among `taken`. */
export function nextLineId(prefix: string, taken: Iterable<string>): string {
  let max = 0
  const re = new RegExp(`^${prefix}(\\d+)$`)
  for (const id of taken) {
    const m = re.exec(id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `${prefix}${max + 1}`
}

// ---- cart operations ---------------------------------------------------------

/** A fresh pick of `offer` under `parentLineId` (the guest's first touch). */
export function newPick(
  offer: EvaluatedOffer,
  parentLineId: string,
  lineId: string,
  parentDays: readonly string[],
): OfferPick {
  const schedule = effectiveSchedule(offer)
  const firstOption = offer.mode === 'mandatory' ? offer.options?.[0]?.key : undefined
  return {
    lineId,
    parentLineId,
    offerId: offer.id,
    productId: offer.product_id,
    binding: offer.binding,
    schedule,
    mode: offer.mode,
    memberIds: [],
    options:
      offer.binding !== 'person' && firstOption ? { [WHOLE_BOOKING]: firstOption } : {},
    quantity: offer.binding === 'free' ? clampOfferQty(offer, Math.max(1, offer.min_qty)) : 1,
    days: schedule === 'subset' ? [...parentDays] : [],
    seen: offer,
  }
}

/**
 * Add `pick` unless it would sit deeper than MAX_OFFER_DEPTH, or the same
 * offer is already taken under the same parent. Returns the same array when
 * refused.
 */
export function addPick(
  picks: readonly OfferPick[],
  pick: OfferPick,
  tree: OfferTreeInput,
): OfferPick[] {
  if (depthOf(pick.parentLineId, tree, picks) + 1 > MAX_OFFER_DEPTH) return picks as OfferPick[]
  if (picks.some((p) => p.offerId === pick.offerId && p.parentLineId === pick.parentLineId)) {
    return picks as OfferPick[]
  }
  return [...picks, pick]
}

/** Every line id under `lineId` (children, grandchildren, ...). */
export function descendantIds(
  lineId: string,
  picks: readonly OfferPick[],
  extras: readonly { lineId?: string; parentLineId?: string }[] = [],
): Set<string> {
  const out = new Set<string>()
  const queue = [lineId]
  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const p of picks) {
      if (p.parentLineId === cur && !out.has(p.lineId)) {
        out.add(p.lineId)
        queue.push(p.lineId)
      }
    }
    for (const e of extras) {
      if (e.lineId && e.parentLineId === cur && !out.has(e.lineId)) {
        out.add(e.lineId)
        queue.push(e.lineId)
      }
    }
  }
  return out
}

/** Remove a line and everything hanging off it. */
export function removeLine(picks: readonly OfferPick[], lineId: string): OfferPick[] {
  const gone = descendantIds(lineId, picks)
  gone.add(lineId)
  return picks.filter((p) => !gone.has(p.lineId))
}

function replacePick(
  picks: readonly OfferPick[],
  lineId: string,
  patch: (p: OfferPick) => OfferPick | null,
): OfferPick[] {
  const out: OfferPick[] = []
  let removed: string | null = null
  for (const p of picks) {
    if (p.lineId !== lineId) {
      out.push(p)
      continue
    }
    const next = patch(p)
    if (next) out.push(next)
    else removed = p.lineId
  }
  return removed ? removeLine(out, removed) : out
}

/**
 * Tick / untick a guest on a person pick. The last guest unticked removes
 * an optional pick (and its children); a mandatory pick keeps its row.
 */
export function togglePerson(
  picks: readonly OfferPick[],
  lineId: string,
  memberKey: string,
): OfferPick[] {
  return replacePick(picks, lineId, (p) => {
    const on = p.memberIds.includes(memberKey)
    const memberIds = on ? p.memberIds.filter((k) => k !== memberKey) : [...p.memberIds, memberKey]
    const options = { ...p.options }
    if (on) delete options[memberKey]
    if (memberIds.length === 0 && p.mode !== 'mandatory') return null
    return { ...p, memberIds, options }
  })
}

/** Pick an option for one guest (`person`) or for the line (WHOLE_BOOKING). */
export function setOption(
  picks: readonly OfferPick[],
  lineId: string,
  who: string,
  key: string,
): OfferPick[] {
  return replacePick(picks, lineId, (p) => ({ ...p, options: { ...p.options, [who]: key } }))
}

/** Set a `free` pick's quantity (clamped); 0 removes an optional pick. */
export function setQuantity(
  picks: readonly OfferPick[],
  lineId: string,
  quantity: number,
): OfferPick[] {
  return replacePick(picks, lineId, (p) => {
    const q = clampOfferQty(p.seen, quantity)
    if (q <= 0) return p.mode === 'mandatory' ? { ...p, quantity: Math.max(1, p.seen.min_qty) } : null
    return { ...p, quantity: q }
  })
}

/** Add / remove a day of a `subset` pick, inside the parent's days; never empty. */
export function toggleSubsetDay(
  picks: readonly OfferPick[],
  lineId: string,
  day: string,
  parentDays: readonly string[],
): OfferPick[] {
  return replacePick(picks, lineId, (p) => {
    if (!parentDays.includes(day)) return p
    const set = new Set(p.days.filter((d) => parentDays.includes(d)))
    if (set.has(day)) {
      if (set.size === 1) return p
      set.delete(day)
    } else set.add(day)
    return { ...p, days: parentDays.filter((d) => set.has(d)) }
  })
}

// ---- stock -------------------------------------------------------------------

/** The most of this offer the stock still allows (no limit without a verdict). */
export function offerStockCeiling(o: Pick<EvaluatedOffer, 'stock'>): number {
  const r = o.stock?.stock_remaining
  return typeof r === 'number' ? Math.max(0, r) : Number.POSITIVE_INFINITY
}

/** Clamp a quantity to the offer's min..max and its stock (null max = no limit). */
export function clampOfferQty(
  o: Pick<EvaluatedOffer, 'min_qty' | 'max_qty' | 'stock'>,
  qty: number,
): number {
  const ceiling = Math.min(o.max_qty ?? Number.POSITIVE_INFINITY, offerStockCeiling(o))
  if (qty <= 0) return 0
  return Math.max(0, Math.min(ceiling, Math.max(o.min_qty, qty)))
}

/** Sold out on the parent's days (or above what is left for `quantity`). */
export function isOfferSoldOut(o: Pick<EvaluatedOffer, 'stock'>, quantity?: number): boolean {
  if (o.stock?.available === false) return true
  return quantity !== undefined && quantity > offerStockCeiling(o)
}

/** The line under a sold-out offer ("Raft: fully reserved for another group"). */
export function offerUnavailableMessage(o: Pick<EvaluatedOffer, 'stock'>, locale?: string): string {
  if (o.stock?.unavailable_reason === 'unit_taken') {
    const unit = o.stock.stock_unit_label?.trim()
    return unit
      ? fmt(tr('addonUnitTakenTemplate', locale), { unit })
      : tr('addonUnitTaken', locale)
  }
  return tr('addonSoldOut', locale)
}

/** Stock verdict of one offered product on ONE day (the batch per-day lookup). */
export interface DayStockVerdict {
  available: boolean
  remaining: number | null
}

/** day (ISO) -> offered product id -> verdict. */
export type DayStock = Record<string, Record<string, DayStockVerdict>>

/** The day has no unit of the offered product left. */
export function isDayFull(
  stock: DayStock | null | undefined,
  productId: string,
  day: string,
): boolean {
  const v = stock?.[day]?.[productId]
  if (!v) return false
  return !v.available || v.remaining === 0
}

// ---- gating ------------------------------------------------------------------

/** The option a guest still has to choose, if any. */
export function missingOption(p: OfferPick): boolean {
  if ((p.seen.options?.length ?? 0) === 0) return false
  const keys = p.binding === 'person' ? p.memberIds : [WHOLE_BOOKING]
  return keys.some((k) => !p.options[k])
}

/** Picks Confirm must wait for: an option not chosen, a day-pick without a day. */
export function picksBlocking(picks: readonly OfferPick[]): boolean {
  return picks.some(
    (p) =>
      p.mode !== 'info' &&
      (missingOption(p) || (p.schedule === 'subset' && p.days.length === 0)),
  )
}

/**
 * The guest-attribute half of an offer's rules, judged on `members` in the
 * browser while the evaluator's answer for a changed party is in flight. Only
 * ever hides (never shows what the server hid); a rule set it cannot judge
 * here (an `any` set, other conditions) passes.
 */
export function instantGate(
  rules: unknown,
  members: readonly Pick<PartyMember, 'ref' | 'attributes'>[],
): boolean {
  if (!rules || typeof rules !== 'object') return true
  const r = rules as { mode?: unknown; items?: unknown }
  if (r.mode !== 'all' || !Array.isArray(r.items)) return true
  for (const raw of r.items) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as { cond?: unknown; key?: unknown }
    if (item.cond !== 'guest_attr' && item.cond !== 'guest_attr_all') continue
    if (typeof item.key !== 'string') continue
    const key = item.key
    const one = { mode: 'all', items: [raw] }
    const ctx = (ms: readonly Pick<PartyMember, 'ref' | 'attributes'>[]) => ({
      participants: ms.map((m) => ({ id: m.ref, guest_attributes: m.attributes })),
    })
    const answered = members.filter((m) => m.attributes[key] !== undefined)
    // An unanswered key is "maybe": only a guest who answered can fail it.
    if (item.cond === 'guest_attr_all') {
      if (answered.length > 0 && !ruleMatches(one, ctx(answered))) return false
    } else if (answered.length === members.length && !ruleMatches(one, ctx(members))) {
      return false
    }
  }
  return true
}

/** The members a per-person offer admits, judged one guest at a time. */
export function admittedMembers(
  offer: Pick<EvaluatedOffer, 'rules'>,
  members: readonly PartyMember[],
): PartyMember[] {
  return members.filter((m) => instantGate(offer.rules, [m]))
}

// ---- seeding and reconciling -------------------------------------------------

/** line id -> the evaluator's verdict. */
export type VerdictsByLine = Readonly<Record<string, EvaluatedLine>>

/**
 * Mandatory offers start picked (and cannot be removed): booking / free ones
 * at `max(1, min_qty)` with their first option. A mandatory per-person offer
 * is attached by the server itself (`server_attached`, the default when the
 * API does not say) and is never seeded; a migrated one (`server_attached`
 * false) becomes a read-only pick ticking every guest its rules admit.
 * Idempotent; offers already in the cart (`in_cart`) are left alone.
 */
export function seedMandatory(
  picks: readonly OfferPick[],
  verdicts: VerdictsByLine,
  tree: OfferTreeInput,
  members: readonly PartyMember[],
  prefix = 'o',
  parentFilter?: (parentLineId: string) => boolean,
): OfferPick[] {
  let out = [...picks]
  for (const [parentLineId, line] of Object.entries(verdicts)) {
    if (!treeLineIds(tree, out).has(parentLineId)) continue
    if (parentFilter && !parentFilter(parentLineId)) continue
    for (const offer of line.offers ?? []) {
      if (offer.mode !== 'mandatory' || offer.in_cart) continue
      if (effectiveSchedule(offer) === 'own' || isOfferSoldOut(offer)) continue
      if (out.some((p) => p.offerId === offer.id && p.parentLineId === parentLineId)) continue
      if (offer.binding === 'person' && offer.server_attached !== false) continue
      const id = nextLineId(prefix, treeLineIds(tree, out))
      const pick = newPick(offer, parentLineId, id, lineDays(parentLineId, tree, out))
      if (offer.binding === 'person') {
        const admitted = admittedMembers(offer, members)
        if (admitted.length === 0) continue
        const first = offer.options?.[0]?.key
        pick.memberIds = admitted.map((m) => m.key)
        pick.options = first ? Object.fromEntries(admitted.map((m) => [m.key, first])) : {}
      }
      out = addPick(out, pick, tree)
    }
  }
  return out
}

/**
 * Fold a fresh verdict into the picks: refresh each pick's offer, drop what
 * no longer fits -- an offer its parent stopped showing, a pick the
 * evaluator now refuses, guests who left the party, days outside the
 * parent's, and every pick whose parent line left the cart (a room type set
 * to 0, an added product removed) -- with everything under it. A
 * parent-NULL offer already in the cart is not re-listed by its parent, so
 * it is kept by its own line's verdict. Returns how many picks were dropped.
 */
export function reconcile(
  picks: readonly OfferPick[],
  verdicts: VerdictsByLine,
  tree: OfferTreeInput,
  members: readonly PartyMember[],
): { picks: OfferPick[]; dropped: number } {
  const memberKeys = new Set(members.map((m) => m.key))
  const baseIds = new Set(treeLines(tree).map((l) => l.lineId))
  let out: OfferPick[] = []
  const drop = new Set<string>()
  for (const p of picks) {
    const parentKnown = baseIds.has(p.parentLineId) || picks.some((q) => q.lineId === p.parentLineId)
    if (!parentKnown) {
      drop.add(p.lineId)
      continue
    }
    const parentVerdict = verdicts[p.parentLineId]
    const own = verdicts[p.lineId]
    let seen = p.seen
    if (parentVerdict) {
      const fresh = parentVerdict.offers?.find((o) => o.id === p.offerId)
      if (fresh) seen = fresh
      else if (p.seen.parent_product_id != null) {
        drop.add(p.lineId)
        continue
      }
    }
    if (own && own.eligible === false) {
      drop.add(p.lineId)
      continue
    }
    let next: OfferPick = { ...p, seen }
    if (p.binding === 'person') {
      const memberIds = p.memberIds.filter((k) => memberKeys.has(k))
      if (memberIds.length === 0) {
        drop.add(p.lineId)
        continue
      }
      if (memberIds.length !== p.memberIds.length) {
        const options = Object.fromEntries(
          Object.entries(p.options).filter(([k]) => memberKeys.has(k)),
        )
        next = { ...next, memberIds, options }
      }
    }
    if (p.schedule === 'subset') {
      const parentDays = lineDays(p.parentLineId, tree, picks)
      if (parentDays.length > 0) {
        const days = p.days.filter((d) => parentDays.includes(d))
        next = { ...next, days: days.length > 0 ? days : [...parentDays] }
      }
    }
    if (p.binding === 'free') {
      const q = clampOfferQty(seen, p.quantity)
      if (q !== p.quantity) next = { ...next, quantity: Math.max(1, q) }
    }
    out.push(next)
  }
  // Cascade: whatever hung off a dropped line goes too.
  for (const id of [...drop]) {
    for (const d of descendantIds(id, picks)) drop.add(d)
  }
  out = out.filter((p) => !drop.has(p.lineId))
  return { picks: out, dropped: drop.size }
}

// ---- builders ----------------------------------------------------------------

/**
 * The evaluate request lines, the same tree submit gets: main, the room
 * types, the added products, one node per pick. At most MAX_EVALUATE_LINES;
 * the deepest picks are dropped first.
 */
export function evaluateLines(
  tree: OfferTreeInput,
  picks: readonly OfferPick[],
): OfferEvaluateLine[] {
  const base: OfferEvaluateLine[] = treeLines(tree).map((l) => ({
    line_id: l.lineId,
    product_id: l.productId,
    ...(l.parentLineId ? { parent_line_id: l.parentLineId } : {}),
    ...(l.days.length > 0 ? { selected_days: [...l.days].sort() } : {}),
  }))
  const room = MAX_EVALUATE_LINES - base.length
  const sorted = [...picks].sort(
    (a, b) => depthOf(a.parentLineId, tree, picks) - depthOf(b.parentLineId, tree, picks),
  )
  const kept = new Set<string>()
  const out = [...base]
  for (const p of sorted) {
    if (kept.size >= room) break
    if (!treeLineIds(tree, []).has(p.parentLineId) && !kept.has(p.parentLineId)) continue
    kept.add(p.lineId)
    const days = lineDays(p.lineId, tree, picks)
    out.push({
      line_id: p.lineId,
      product_id: p.productId,
      parent_line_id: p.parentLineId,
      ...(days.length > 0 ? { selected_days: [...days].sort() } : {}),
    })
  }
  return out
}

/** One wire line of a pick, before it becomes a submit or an estimate line. */
interface PickWireLine {
  line_id: string
  parent_line_id: string
  offer_id: string
  product_id: string
  qty: number
  participant_id?: string
  option_key?: string
  selected_days?: string[]
}

function pickWireLines(
  picks: readonly OfferPick[],
  tree: OfferTreeInput,
  members: readonly PartyMember[],
): PickWireLine[] {
  const refOf = new Map(members.map((m) => [m.key, m.ref]))
  const out: PickWireLine[] = []
  for (const p of picks) {
    if (p.mode === 'info') continue
    if (p.binding === 'person' && p.seen.server_attached !== false && p.mode === 'mandatory') {
      continue
    }
    const days = lineDays(p.lineId, tree, picks)
    const common = {
      parent_line_id: p.parentLineId,
      offer_id: p.offerId,
      product_id: p.productId,
      ...(days.length > 0 ? { selected_days: [...days].sort() } : {}),
    }
    if (p.binding === 'person') {
      p.memberIds.forEach((key, i) => {
        const ref = refOf.get(key)
        if (!ref) return
        const option = p.options[key]
        out.push({
          ...common,
          // The first guest's line keeps the pick's id: children hang off it.
          line_id: i === 0 ? p.lineId : `${p.lineId}-${ref}`,
          qty: 1,
          participant_id: ref,
          ...(option ? { option_key: option } : {}),
        })
      })
      continue
    }
    const option = p.options[WHOLE_BOOKING]
    out.push({
      ...common,
      line_id: p.lineId,
      qty: p.binding === 'free' ? Math.max(1, p.quantity) : 1,
      ...(option ? { option_key: option } : {}),
    })
  }
  return out
}

/** Submit lines of the picks (allow-listed keys only: never a price, collection or mode). */
export function toProductLines(
  picks: readonly OfferPick[],
  tree: OfferTreeInput,
  members: readonly PartyMember[],
): ProductLine[] {
  return pickWireLines(picks, tree, members).map((l) => ({
    product_id: l.product_id,
    quantity: l.qty,
    line_id: l.line_id,
    parent_line_id: l.parent_line_id,
    offer_id: l.offer_id,
    ...(l.participant_id ? { participant_id: l.participant_id } : {}),
    ...(l.option_key ? { option_key: l.option_key } : {}),
    ...(l.selected_days ? { selected_days: l.selected_days } : {}),
  }))
}

/** Estimate add-on lines of the picks (same allow-list as submit). */
export function toEstimateLines(
  picks: readonly OfferPick[],
  tree: OfferTreeInput,
  members: readonly PartyMember[],
): EstimateAddonLine[] {
  return pickWireLines(picks, tree, members).map((l) => ({
    product_id: l.product_id,
    qty: l.qty,
    line_id: l.line_id,
    parent_line_id: l.parent_line_id,
    offer_id: l.offer_id,
    ...(l.participant_id ? { participant_id: l.participant_id } : {}),
    ...(l.option_key ? { option_key: l.option_key } : {}),
    ...(l.selected_days ? { selected_days: l.selected_days } : {}),
  }))
}

/**
 * Room-type picks folded to `{roomProductId: {productId: qty}}`, the shape
 * RoomAssignment's breakfast chips and the review's room rows read. A person
 * pick counts its ticked guests.
 */
export function roomExtraQty(picks: readonly OfferPick[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {}
  for (const p of picks) {
    if (!p.parentLineId.startsWith('r-')) continue
    const room = p.parentLineId.slice(2)
    const q = p.binding === 'person' ? p.memberIds.length : p.binding === 'free' ? p.quantity : 1
    if (q <= 0) continue
    const slot = (out[room] ??= {})
    slot[p.productId] = (slot[p.productId] ?? 0) + q
  }
  return out
}

/** The extra line (own dates) as a tree line, when it was added from an offer. */
export function extraTreeLine(l: ExtraLine): TreeLine | null {
  if (!l.lineId) return null
  return {
    lineId: l.lineId,
    productId: l.product.product_id,
    parentLineId: l.parentLineId ?? MAIN_LINE_ID,
    days: [...l.days].sort(),
  }
}

/**
 * The cart tree of a booking: the main line on its days, one line per booked
 * room type on the stay's nights, the products added from own-dated offers.
 */
export function cartTree(
  product: { product_id: string; accommodation_checkin_offset_days?: number | null },
  mainDays: readonly string[],
  rooms: readonly RoomSelection[] = [],
  extras: readonly ExtraLine[] = [],
): OfferTreeInput {
  const booked = rooms.filter((r) => r.quantity > 0)
  const nights =
    booked.length > 0
      ? stayNightIsos([...mainDays], product.accommodation_checkin_offset_days ?? undefined)
      : []
  return {
    main: {
      lineId: MAIN_LINE_ID,
      productId: product.product_id,
      parentLineId: null,
      days: [...mainDays].sort(),
    },
    rooms: booked.map((r) => ({
      lineId: roomLineId(r.productId),
      productId: r.productId,
      parentLineId: null,
      days: nights,
    })),
    extras: extras.flatMap((l) => {
      const t = extraTreeLine(l)
      return t ? [t] : []
    }),
  }
}

/** The tree line (main, a room type, an added product) a pick hangs under. */
export function ownerLineOf(pick: OfferPick, picks: readonly OfferPick[]): string {
  let cur = pick
  const seen = new Set<string>()
  while (!seen.has(cur.lineId)) {
    seen.add(cur.lineId)
    const parent = picks.find((p) => p.lineId === cur.parentLineId)
    if (!parent) return cur.parentLineId
    cur = parent
  }
  return cur.parentLineId
}

/**
 * The estimate lines of the main estimate: every pick except those under an
 * added product (each added product is priced by its own estimate, see
 * extraOfferEstimateLines).
 */
export function mainEstimateLines(
  picks: readonly OfferPick[],
  tree: OfferTreeInput,
  members: readonly PartyMember[],
): EstimateAddonLine[] {
  const extraIds = new Set((tree.extras ?? []).map((e) => e.lineId))
  return toEstimateLines(
    picks.filter((p) => !extraIds.has(ownerLineOf(p, picks))),
    tree,
    members,
  )
}

/**
 * The offer lines of an added product's own estimate: its picks, the ones
 * hanging off it directly re-parented to that estimate's main line.
 */
export function extraOfferEstimateLines(
  extraLineId: string,
  picks: readonly OfferPick[],
  tree: OfferTreeInput,
  members: readonly PartyMember[],
): EstimateAddonLine[] {
  return toEstimateLines(
    picks.filter((p) => ownerLineOf(p, picks) === extraLineId),
    tree,
    members,
  ).map((l) => (l.parent_line_id === extraLineId ? { ...l, parent_line_id: MAIN_LINE_ID } : l))
}

// ---- display -----------------------------------------------------------------

/** The estimate line(s) a pick produced (its id, or its per-guest ids). */
export function estimateLinesFor(
  lineId: string,
  items: readonly EstimateLineItem[] | undefined,
): EstimateLineItem[] {
  if (!items) return []
  return items.filter(
    (li) => li.line_id === lineId || (typeof li.line_id === 'string' && li.line_id.startsWith(`${lineId}-g`)),
  )
}

export type PriceTone = 'online' | 'on_site' | 'free' | 'tbd'

/**
 * What a row's price reads: "€40.00", "€20.00 · Pay on arrival", "Free", or
 * "Price on your dates" when it cannot be quoted yet. The estimate's line
 * total wins over the evaluator's preview once the pick is priced.
 */
export function priceLabel(
  o: Pick<EvaluatedOffer, 'collection' | 'price_preview'>,
  locale: string,
  estimate?: readonly EstimateLineItem[],
  currency?: string,
): { text: string; tone: PriceTone } {
  if (o.collection === 'free') return { text: tr('offerPriceFree', locale), tone: 'free' }
  let amount: string | null = null
  let ccy = o.price_preview?.currency ?? currency ?? null
  if (estimate && estimate.length > 0) {
    const cents = estimate.reduce(
      (acc, li) =>
        acc +
        Math.round(
          Number(o.collection === 'on_site' ? (li.collection_amount ?? li.line_total) : li.line_total) *
            100,
        ),
      0,
    )
    amount = (cents / 100).toFixed(2)
    ccy = currency ?? ccy
  } else if (typeof o.price_preview?.total_cents === 'number') {
    amount = (o.price_preview.total_cents / 100).toFixed(2)
  }
  if (amount === null || !ccy) return { text: tr('offerPriceOnDates', locale), tone: 'tbd' }
  const money = formatMoney(amount, ccy, locale)
  if (o.collection === 'on_site') {
    return { text: `${money} · ${tr('offerPayOnArrival', locale)}`, tone: 'on_site' }
  }
  return { text: money, tone: 'online' }
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * The guest-facing reason a line cannot be booked, from the evaluator's
 * `eligibility_reason_key` (+ the failing bound): "No guests under 10".
 */
export function reasonText(
  key: string | null | undefined,
  params: EligibilityReasonParams | null | undefined,
  locale: string,
): string {
  if (!key) return tr('eligGeneric', locale)
  if (key.startsWith('attribute_missing.')) return tr('eligAnswerNeeded', locale)
  if (key === 'guest_attr_all.age' || key === 'guest_attr.age') {
    const op = params?.op
    const value = params?.value
    if (op === 'gte' && num(value) !== null) {
      return fmt(tr('eligNoGuestsUnder', locale), { n: num(value)! })
    }
    if (op === 'lte' && num(value) !== null) {
      return fmt(tr('eligGuestsUpTo', locale), { n: num(value)! })
    }
    if (op === 'between' && Array.isArray(value) && num(value[0]) !== null && num(value[1]) !== null) {
      return fmt(tr('eligGuestsBetween', locale), { min: num(value[0])!, max: num(value[1])! })
    }
    return tr('eligAgeGeneric', locale)
  }
  if (key === 'date_window' || key === 'season_in') return tr('eligNotOnDates', locale)
  if (key === 'stay_nights') return tr('eligNights', locale)
  if (key === 'parent_unavailable') return tr('eligSoldOut', locale)
  return tr('eligGeneric', locale)
}

/** An option as the select shows it: "Both ways (+€10.00)". */
export function optionLabel(o: OfferOption, currency: string, locale: string): string {
  const name = pickLocalized(o.label, o.label_localized ?? null, locale)
  if (!o.price_delta_cents) return name
  return `${name} (+${formatMoney((o.price_delta_cents / 100).toFixed(2), currency, locale)})`
}
