/**
 * "Add more to this booking" (cross-sell on the review step): pure helpers.
 *
 * The public submit already takes several product lines (`products[]`), so an
 * added product is just one more line on the SAME booking. This module owns
 * the rules: which catalogue products may be added, how an added line inherits
 * the main line's dates, how its availability is judged, what it sends to the
 * submit, and how the per-line price estimates fold into one sidebar total.
 *
 * Pricing note: the estimate endpoint prices ONE product (plus add-ons sharing
 * its days). Every added line is priced by its own estimate call and the
 * results are summed here. That is exact for the submit too, because the
 * server prices each line on its own (rule engine per line, the party's
 * participant count, times the line quantity) and adds the line totals.
 */
import type {
  AvailabilitySlot,
  EstimateAddonLine,
  EstimateRequestBody,
  EstimateResponse,
  FixedDateWindow,
  OfferEvaluateGuest,
  Product,
  ProductLine,
} from '@/api/types'
import type { FlowFormDef, ProductFlowResponse } from '@/api/flowTypes'
import { isStayKind } from '@/flowPlan'
import { hasFixedStartTimes, toHHMM } from './slotKey'
import { expandWindowDays } from './expandWindowDays'
import {
  productDisplayLanguages,
  pruneLanguageAssignment,
  singleLanguageAssignment,
} from './participantLanguages'

/**
 * How an added line picks its dates:
 *  - 'days'   day / multi-day products: the main line's days, as they are;
 *  - 'nights' a stay: one night per main day (the night after each day on
 *             site; a stay main line's nights map 1:1);
 *  - 'slot'   fixed start times: its own time picker, on the main line's date;
 *  - 'window' a fixed course window: its own window picker.
 */
export type ExtraLineMode = 'days' | 'nights' | 'slot' | 'window'

export interface ExtraLine {
  /** Stable per added line (a product may only be added once). */
  key: string
  /**
   * The line's id in the cart tree (`o1`, ...) when it was added from an
   * offer; its offer and the line it hangs off (absent = the main line).
   */
  lineId?: string
  offerId?: string
  parentLineId?: string
  product: Product
  mode: ExtraLineMode
  /** Booked days ('days'), nights ('nights'), the slot date ('slot') or the window's days. */
  days: string[]
  /** 'slot' mode: the picked time, null until picked. */
  slot: AvailabilitySlot | null
  /** 'window' mode: the picked course window, null until picked. */
  windowId: string | null
  /** The product's flow (custom forms), read when the line was added. */
  flow?: ProductFlowResponse | null
  /** Line multiplier; the line is always priced for the whole party. */
  quantity: number
  /** Days of `days` the availability check found unavailable. */
  unavailableDays: string[]
  /** True while the line's availability is being (re-)checked. */
  checking: boolean
  /**
   * Whole units the last availability read left free over all the line's
   * days ('days' / 'nights' modes); null/absent = unknown (no inventory cap).
   */
  freeUnits?: number | null
}

export function lineMode(product: Product): ExtraLineMode {
  if (isStayKind(product.product_kind)) return 'nights'
  if (hasFixedStartTimes(product) || product.service_time_shape === 'time_slot') return 'slot'
  if (product.service_time_shape === 'fixed_window') return 'window'
  return 'days'
}

/**
 * What the customer already gave on the main flow, which an added product's
 * own required modules can reuse.
 */
export interface CrossSellContext {
  /** Guide language per participant (index 0..participantCount-1), if assigned. */
  participantLanguages: Readonly<Record<number, string>>
  participantCount: number
  /** Guide languages the MAIN product offers; empty = any language / none. */
  mainLanguages: readonly string[]
  /** Form keys the main flow already answered. */
  answeredFormKeys: readonly string[]
  /** A pickup point (or a booked hotel acting as one) is already set. */
  hasPickup: boolean
  /**
   * landr-hfvyc.2: the roster has 2+ guests and the guest step never asked
   * for Adult/Child + age (no occupancy-priced stay was in the cart then).
   */
  agesNeeded?: boolean
}

/** One guest's Adult/Child band (+ age 0-17 for a child). */
export interface GuestAgeEntry {
  band: 'adult' | 'child'
  age: number | null
}

/**
 * What the customer answered inline on the review step for the added lines.
 * Shared across lines: the submit takes ONE language per participant, ONE
 * pickup point and ONE answer per form key for the whole booking.
 */
export interface InlineModuleState {
  languages: Readonly<Record<number, string>> | null
  /** Form keys answered inline (their entries live in the booking form). */
  formKeys: readonly string[]
  pickupLocationId: string | null
  /** landr-hfvyc.2: inline guest ages by roster index (0 = first guest, always adult). */
  ages?: Readonly<Record<number, GuestAgeEntry>> | null
}

export const EMPTY_INLINE_MODULES: InlineModuleState = {
  languages: null,
  formKeys: [],
  pickupLocationId: null,
}

/** The guide languages a product restricts to; empty = no restriction (any language, or a stay). */
export function productOfferedLanguages(product: Product): string[] {
  if (isStayKind(product.product_kind)) return []
  // No default fallback: a product without a language list (a tier that
  // predates guide languages) is not narrowed here, as before.
  return productDisplayLanguages(product.guide_languages)
}

/** The languages every restricted set allows at once; null when none restricts. */
function intersectOffers(sets: ReadonlyArray<readonly string[]>): string[] | null {
  const restricted = sets.filter((s) => s.length > 0)
  if (restricted.length === 0) return null
  return restricted[0]!.filter((code) => restricted.every((s) => s.includes(code)))
}

/**
 * The language set the whole booking must stay inside once an added line
 * restricts it (the submit checks the intersection over every service line).
 * Null when no ADDED line restricts: the main flow's own language handling
 * then stands untouched.
 */
export function bookingLanguageOffer(
  mainLanguages: readonly string[],
  lines: readonly ExtraLine[],
): string[] | null {
  const added = lines.map((l) => productOfferedLanguages(l.product))
  if (!added.some((s) => s.length > 0)) return null
  return intersectOffers([mainLanguages, ...added])
}

/** Why an added product cannot be offered at all: no language every line could share. */
export type CrossSellExclusion = 'language'

/**
 * A language/custom-form/pickup module of an added product is rendered inline
 * on the review step (see lineNeeds), so the only product left out of the
 * list is one whose guide languages share nothing with the booking's: no
 * single language per participant could satisfy both.
 */
export function crossSellExclusion(
  product: Product,
  ctx: CrossSellContext,
  lines: readonly ExtraLine[],
): CrossSellExclusion | null {
  const own = productOfferedLanguages(product)
  if (own.length === 0) return null
  const sets = [ctx.mainLanguages, ...lines.map((l) => productOfferedLanguages(l.product)), own]
  const shared = intersectOffers(sets)
  return shared !== null && shared.length === 0 ? 'language' : null
}

/**
 * The language map the submit sends: the main flow's, narrowed to what every
 * added line allows. One shared language is applied to the whole roster (the
 * customer has no choice to make); otherwise the inline picks win, and a pick
 * outside the shared set is dropped so the picker asks again.
 */
export function effectiveLanguages(
  main: Readonly<Record<number, string>>,
  inline: Readonly<Record<number, string>> | null,
  offer: readonly string[] | null,
  rosterCount: number,
): Record<number, string> {
  if (offer === null) return { ...main }
  const only = singleLanguageAssignment(offer, rosterCount)
  if (only) return only
  return pruneLanguageAssignment({ ...(inline ?? main) }, offer, rosterCount)
}

export function languagesCover(
  map: Readonly<Record<number, string>>,
  count: number,
  offer: readonly string[],
): boolean {
  for (let i = 0; i < Math.max(1, count); i++) {
    const code = map[i]
    if (!code || !offer.includes(code)) return false
  }
  return true
}

/** The modules one added line needs the customer to fill in on this step. */
export interface LineNeeds {
  /** Guide-language picker: the main flow's languages do not fit this line. */
  language: boolean
  /** Pickup-point picker: the line needs a pickup and the main flow set none. */
  pickup: boolean
  /** Custom forms of this line the main flow has not answered. */
  forms: FlowFormDef[]
  /** landr-hfvyc.2: Adult/Child + age per guest (owned by the first occupancy-priced line). */
  ages?: boolean
}

/**
 * Per added line, the modules the review step must collect (verification is
 * rendered separately, once for the whole booking). A module several lines
 * share (the language, the pickup, a form key) is owned by the FIRST line that
 * needs it, so it renders once and satisfies the rest.
 */
export function lineNeeds(
  lines: readonly ExtraLine[],
  ctx: CrossSellContext,
): Record<string, LineNeeds> {
  const out: Record<string, LineNeeds> = {}
  const offer = bookingLanguageOffer(ctx.mainLanguages, lines)
  const languageMissing =
    offer !== null &&
    offer.length > 1 &&
    !languagesCover(ctx.participantLanguages, ctx.participantCount, offer)
  const answered = new Set(ctx.answeredFormKeys)
  const claimed = new Set<string>()
  let languageClaimed = false
  let pickupClaimed = false
  let agesClaimed = false
  for (const line of lines) {
    const needs: LineNeeds = { language: false, pickup: false, forms: [] }
    if (languageMissing && !languageClaimed && productOfferedLanguages(line.product).length > 0) {
      needs.language = true
      languageClaimed = true
    }
    if (
      !pickupClaimed &&
      !ctx.hasPickup &&
      line.product.needs_pickup &&
      !line.product.auto_pickup_location_id &&
      !isStayKind(line.product.product_kind)
    ) {
      needs.pickup = true
      pickupClaimed = true
    }
    if (ctx.agesNeeded && !agesClaimed && line.product.occupancy_pricing) {
      needs.ages = true
      agesClaimed = true
    }
    for (const m of line.flow?.modules ?? []) {
      if (m.kind !== 'custom_form' || m.form == null) continue
      const key = m.form.key
      if (answered.has(key) || claimed.has(key)) continue
      claimed.add(key)
      needs.forms.push(m.form)
    }
    out[line.key] = needs
  }
  return out
}

/** True when a guest is marked child with no age yet. */
export function hasChildWithoutAgeEntry(
  ages: Readonly<Record<number, GuestAgeEntry>> | null | undefined,
): boolean {
  return Object.values(ages ?? {}).some((e) => e.band === 'child' && e.age === null)
}

/** `child_ages` for the estimate from inline entries (first guest is never a child). */
export function childAgesFromEntries(
  ages: Readonly<Record<number, GuestAgeEntry>> | null | undefined,
  participantCount: number,
): number[] {
  const out: number[] = []
  for (const [k, e] of Object.entries(ages ?? {})) {
    if (Number(k) > 0 && e.band === 'child' && e.age !== null) out.push(e.age)
  }
  return out.slice(0, Math.max(0, participantCount - 1))
}

/** True while an inline module of an added line still waits for the customer. */
export function inlineModulesPending(
  lines: readonly ExtraLine[],
  ctx: CrossSellContext,
  inline: InlineModuleState,
): boolean {
  const needs = lineNeeds(lines, ctx)
  const offer = bookingLanguageOffer(ctx.mainLanguages, lines)
  const answered = new Set(inline.formKeys)
  return Object.values(needs).some(
    (n) =>
      (n.language &&
        !(offer && languagesCover(inline.languages ?? {}, ctx.participantCount, offer))) ||
      (n.pickup && inline.pickupLocationId === null) ||
      (n.ages === true && hasChildWithoutAgeEntry(inline.ages)) ||
      n.forms.some((f) => !answered.has(f.key)),
  )
}

/** A new added line, its dates inherited from the main line's days. */
export function inheritLine(
  product: Product,
  mainDays: readonly string[],
  key: string,
  flow: ProductFlowResponse | null = null,
): ExtraLine {
  const mode = lineMode(product)
  const sorted = [...new Set(mainDays)].sort()
  const days = mode === 'window' ? [] : mode === 'slot' ? sorted.slice(0, 1) : sorted
  return {
    key,
    product,
    mode,
    days,
    slot: null,
    windowId: null,
    flow,
    quantity: 1,
    unavailableDays: [],
    checking: false,
  }
}

/** The course window to preselect: the first one covering (or else following) the main date. */
export function preferredWindow(
  windows: readonly FixedDateWindow[],
  mainDays: readonly string[],
): FixedDateWindow | null {
  const open = windows.filter((w) => w.capacity_reserved < w.capacity)
  const first = [...mainDays].sort()[0]
  if (!first) return open[0] ?? null
  return (
    open.find((w) => w.start_date <= first && first <= w.end_date) ??
    open.find((w) => w.start_date >= first) ??
    null
  )
}

export function withWindow(line: ExtraLine, dateWindow: FixedDateWindow): ExtraLine {
  return { ...line, windowId: dateWindow.id, days: expandWindowDays(dateWindow), unavailableDays: [] }
}

/**
 * Days among `days` the availability rows rule out for `need` seats: a day
 * with rows but none open with room. A day without rows is not judged here
 * (an on-request day has none; the submit re-checks every line).
 */
export function unavailableDaysFor(
  slots: readonly AvailabilitySlot[],
  days: readonly string[],
  need: number,
): string[] {
  const byDate = new Map<string, AvailabilitySlot[]>()
  for (const s of slots) {
    const list = byDate.get(s.date) ?? []
    list.push(s)
    byDate.set(s.date, list)
  }
  return [...days].sort().filter((d) => {
    const rows = byDate.get(d)
    if (!rows || rows.length === 0) return false
    return !rows.some(
      (r) => r.status !== 'closed' && r.activity_bookable !== false && r.available_seats >= need,
    )
  })
}

/** Seats one added line needs per day: a stay sells a unit, a service seats the party. */
export function seatsForLine(line: Pick<ExtraLine, 'mode'>, partySize: number): number {
  return line.mode === 'nights' ? 1 : Math.max(1, partySize)
}

/**
 * Free units for 'days' / 'nights' lines: the lowest free count over the
 * days that have availability rows (a stay sells units, so `need` is 1; a
 * service divides by the seats one unit takes). Null when no day has rows.
 */
export function freeUnitsFor(
  slots: readonly AvailabilitySlot[],
  days: readonly string[],
  need: number,
): number | null {
  let min: number | null = null
  for (const d of days) {
    const rows = slots.filter(
      (s) => s.date === d && s.status !== 'closed' && s.activity_bookable !== false,
    )
    if (rows.length === 0) continue
    const best = Math.max(...rows.map((r) => r.available_seats))
    min = min === null ? best : Math.min(min, best)
  }
  return min === null ? null : Math.max(0, Math.floor(min / Math.max(1, need)))
}

/** Free units of a picked slot / window for a line needing `need` seats per unit. */
export function freeUnitsOfSeats(freeSeats: number, need: number): number {
  return Math.max(0, Math.floor(freeSeats / Math.max(1, need)))
}

/**
 * Upper bound of a cross-sell line's quantity stepper. A stay is always one
 * unit (the API refuses more), so its cap is 1; a service is capped at the
 * free inventory, never below 1. `freeUnits` null = unknown, no cap (the API
 * re-checks).
 */
export function maxQuantityFor(
  line: Pick<ExtraLine, 'mode'>,
  _partySize: number,
  freeUnits: number | null | undefined,
): number {
  if (line.mode === 'nights') return 1
  if (freeUnits === null || freeUnits === undefined) return Number.POSITIVE_INFINITY
  return Math.max(1, freeUnits)
}

/** Why an added line cannot be submitted yet, or null when it is ready. */
export type ExtraLineIssue = 'checking' | 'needs_time' | 'needs_window' | 'no_days' | 'unavailable'

export function lineIssue(line: ExtraLine): ExtraLineIssue | null {
  if (line.checking) return 'checking'
  if (line.mode === 'slot' && !line.slot) return 'needs_time'
  if (line.mode === 'window' && !line.windowId) return 'needs_window'
  if (line.days.length === 0) return 'no_days'
  if (line.unavailableDays.length > 0) return 'unavailable'
  return null
}

export function extraLinesBlocking(lines: readonly ExtraLine[]): boolean {
  return lines.some((l) => lineIssue(l) !== null)
}

/** The submit line for an added product (same contract as the main line). */
export function extraProductLine(line: ExtraLine): ProductLine {
  const out: ProductLine = {
    product_id: line.product.product_id,
    quantity: line.quantity,
    selected_days: [...line.days].sort(),
  }
  if (line.mode === 'slot' && line.slot) {
    if (line.slot.availability_id) {
      out.product_availability_id = line.slot.availability_id
    } else {
      const hhmm = toHHMM(line.slot.start_time)
      if (hhmm) out.slot_start_time = hhmm
    }
  }
  if (line.mode === 'window' && line.windowId) out.fixed_date_window_id = line.windowId
  if (line.lineId && line.offerId) {
    out.line_id = line.lineId
    out.offer_id = line.offerId
    out.parent_line_id = line.parentLineId ?? 'main'
  }
  return out
}

export function extraProductLines(lines: readonly ExtraLine[]): ProductLine[] {
  return lines.filter((l) => l.days.length > 0).map(extraProductLine)
}

/** One estimate call for an added line. */
export interface ExtraEstimateRequest {
  key: string
  productId: string
  quantity: number
  body: EstimateRequestBody
}

export function extraEstimateRequests(
  lines: readonly ExtraLine[],
  participantCount: number,
  locale?: string,
  childAges?: readonly number[],
  /**
   * The offers taken under an added line (offerCart extraOfferEstimateLines,
   * keyed by the line's tree id) and the party they name: priced on that
   * line's own estimate.
   */
  offers?: {
    linesFor: (lineId: string) => EstimateAddonLine[]
    guests?: readonly OfferEvaluateGuest[]
  },
): ExtraEstimateRequest[] {
  return lines
    .filter((l) => l.days.length > 0 && (l.mode !== 'slot' || l.slot))
    .map((l) => {
      const pl = extraProductLine(l)
      const offerLines = l.lineId && offers ? offers.linesFor(l.lineId) : []
      return {
        key: l.key,
        productId: l.product.product_id,
        quantity: l.quantity,
        body: {
          selected_days: pl.selected_days ?? [],
          participants_count: Math.max(1, participantCount),
          addon_lines: offerLines,
          ...(offerLines.length > 0 ? { main_line_id: 'main' } : {}),
          ...(offers?.guests && offers.guests.length > 0 ? { guests: [...offers.guests] } : {}),
          ...(locale ? { locale } : {}),
          ...(childAges && childAges.length > 0 && l.product.occupancy_pricing
            ? { child_ages: [...childAges] }
            : {}),
          ...(pl.product_availability_id
            ? { product_availability_id: pl.product_availability_id }
            : {}),
          ...(pl.slot_start_time ? { slot_start_time: pl.slot_start_time } : {}),
        },
      }
    })
}

const toCents = (v: string | null | undefined): number => Math.round(Number(v ?? 0) * 100)
const fromCents = (c: number): string => (c / 100).toFixed(2)
const scale = (v: string | null | undefined, q: number): string => fromCents(toCents(v) * q)

/** One added line's estimate times its quantity. */
function scaled(est: EstimateResponse, q: number): EstimateResponse {
  if (q === 1) return est
  return {
    ...est,
    line_items: est.line_items.map((li) => ({
      ...li,
      qty: li.qty * q,
      line_total: scale(li.line_total, q),
    })),
    operator_total: scale(est.operator_total, q),
    hotel_total: scale(est.hotel_total, q),
    ...(est.performer_total != null ? { performer_total: scale(est.performer_total, q) } : {}),
    grand_total: scale(est.grand_total, q),
    ...(est.amount_due != null ? { amount_due: scale(est.amount_due, q) } : {}),
    ...(est.on_site_total != null ? { on_site_total: scale(est.on_site_total, q) } : {}),
    ...(est.subtotal_before_savings != null
      ? { subtotal_before_savings: scale(est.subtotal_before_savings, q) }
      : {}),
    ...(est.savings_total != null ? { savings_total: scale(est.savings_total, q) } : {}),
    savings: est.savings?.map((s) => ({ ...s, amount: scale(s.amount, q) })) ?? est.savings,
    surcharges:
      est.surcharges?.map((s) => ({ ...s, amount: scale(s.amount, q) })) ?? est.surcharges,
    ...(est.surcharges_total != null ? { surcharges_total: scale(est.surcharges_total, q) } : {}),
    ...(est.subtotal_before_surcharges != null
      ? { subtotal_before_surcharges: scale(est.subtotal_before_surcharges, q) }
      : {}),
  }
}

/**
 * Fold the added lines' estimates into the main estimate: one breakdown, one
 * total. Line items, savings and warnings are concatenated; every money
 * figure is summed in cents. The main estimate's currency and stay details
 * are kept (an operator prices in one currency).
 */
export function mergeEstimates(
  main: EstimateResponse,
  extras: ReadonlyArray<{ estimate: EstimateResponse; quantity: number }>,
): EstimateResponse {
  if (extras.length === 0) return main
  const all = [main, ...extras.map((e) => scaled(e.estimate, Math.max(1, e.quantity)))]
  const sum = (pick: (e: EstimateResponse) => string | null | undefined) =>
    fromCents(all.reduce((acc, e) => acc + toCents(pick(e)), 0))
  const anySavings = all.some((e) => (e.savings?.length ?? 0) > 0)
  return {
    ...main,
    line_items: all.flatMap((e) => e.line_items),
    operator_total: sum((e) => e.operator_total),
    hotel_total: sum((e) => e.hotel_total),
    ...(all.some((e) => e.performer_total != null)
      ? { performer_total: sum((e) => e.performer_total) }
      : {}),
    grand_total: sum((e) => e.grand_total),
    applied_rules: all.flatMap((e) => e.applied_rules),
    warnings: all.flatMap((e) => e.warnings),
    un_priceable: all.some((e) => e.un_priceable),
    amount_due: sum((e) => e.amount_due ?? e.operator_total),
    ...(all.some((e) => e.on_site_total != null) ? { on_site_total: sum((e) => e.on_site_total) } : {}),
    ...(anySavings
      ? {
          savings: all.flatMap((e) => e.savings ?? []),
          savings_total: sum((e) => e.savings_total),
          subtotal_before_savings: sum(
            (e) => e.subtotal_before_savings ?? e.amount_due ?? e.operator_total,
          ),
        }
      : {}),
    ...(all.some((e) => (e.surcharges?.length ?? 0) > 0)
      ? {
          surcharges: all.flatMap((e) => e.surcharges ?? []),
          surcharges_total: sum((e) => e.surcharges_total),
          subtotal_before_surcharges: sum(
            (e) =>
              e.subtotal_before_surcharges ??
              e.subtotal_before_savings ??
              e.amount_due ??
              e.operator_total,
          ),
        }
      : {}),
  }
}
