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
  EstimateRequestBody,
  EstimateResponse,
  FixedDateWindow,
  Product,
  ProductLine,
} from '@/api/types'
import { isBookable } from './bookability'
import { isBookableKind, isStayKind } from '@/flowPlan'
import { hasFixedStartTimes, toHHMM } from './slotKey'
import { expandWindowDays } from './expandWindowDays'

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
  product: Product
  mode: ExtraLineMode
  /** Booked days ('days'), nights ('nights'), the slot date ('slot') or the window's days. */
  days: string[]
  /** 'slot' mode: the picked time, null until picked. */
  slot: AvailabilitySlot | null
  /** 'window' mode: the picked course window, null until picked. */
  windowId: string | null
  /** Line multiplier; the line is always priced for the whole party. */
  quantity: number
  /** Days of `days` the availability check found unavailable. */
  unavailableDays: string[]
  /** True while the line's availability is being (re-)checked. */
  checking: boolean
}

export function lineMode(product: Product): ExtraLineMode {
  if (isStayKind(product.product_kind)) return 'nights'
  if (hasFixedStartTimes(product) || product.service_time_shape === 'time_slot') return 'slot'
  if (product.service_time_shape === 'fixed_window') return 'window'
  return 'days'
}

/**
 * Products the customer may add: published, bookable, a kind the funnel books
 * (a service with a time shape, or a stay) and not already in the cart. The
 * public catalogue already leaves out add-on-only products (they are booked
 * through their parent's add-on step).
 */
export function crossSellCandidates(
  catalogue: readonly Product[],
  cartProductIds: readonly string[],
): Product[] {
  const inCart = new Set(cartProductIds)
  return catalogue.filter(
    (p) =>
      !inCart.has(p.product_id) &&
      p.is_publicly_listed !== false &&
      isBookable(p) &&
      isBookableKind(p.product_kind) &&
      (isStayKind(p.product_kind) || p.service_time_shape !== null),
  )
}

/** A new added line, its dates inherited from the main line's days. */
export function inheritLine(product: Product, mainDays: readonly string[], key: string): ExtraLine {
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

export function withWindow(line: ExtraLine, window: FixedDateWindow): ExtraLine {
  return { ...line, windowId: window.id, days: expandWindowDays(window), unavailableDays: [] }
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
): ExtraEstimateRequest[] {
  return lines
    .filter((l) => l.days.length > 0 && (l.mode !== 'slot' || l.slot))
    .map((l) => {
      const pl = extraProductLine(l)
      return {
        key: l.key,
        productId: l.product.product_id,
        quantity: l.quantity,
        body: {
          selected_days: pl.selected_days ?? [],
          participants_count: Math.max(1, participantCount),
          addon_lines: [],
          ...(locale ? { locale } : {}),
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
