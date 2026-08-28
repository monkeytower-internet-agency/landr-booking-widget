/**
 * Pure helpers for PriceSidebar (landr-qez0). Kept in a sibling .ts
 * file so the react-refresh/only-export-components ESLint rule stays
 * happy — see accommodationCalc.ts / dateLabel.ts for the same pattern.
 */
import type {
  EstimateAddonLine,
  EstimateAppliedRule,
  EstimateLineItem,
} from '@/api/types'
import type { RoomSelection } from './accommodationCalc'
import type { AddonSelection } from './addonsState'

/**
 * Merge the room selections (hotel_room products) and add-on selections
 * (services like Breakfast / Video Package) into the single addon_lines
 * array the estimate endpoint expects. Rooms and add-ons are equivalent
 * on the wire — both become extra booking_products rows under the
 * parent service line — so the estimate just takes a flat list with
 * `{product_id, qty}` per entry.
 *
 * Filters out qty <= 0 to avoid sending opt-outs as zero-qty rows
 * (the FastAPI request schema rejects qty < 1, and the route would
 * 400 the entire estimate if even one line had qty=0).
 */
export function buildAddonLines(
  rooms: RoomSelection[],
  addons: AddonSelection[],
): EstimateAddonLine[] {
  const lines: EstimateAddonLine[] = []
  for (const room of rooms) {
    if (room.quantity > 0) {
      lines.push({ product_id: room.productId, qty: room.quantity })
    }
  }
  for (const addon of addons) {
    if (addon.quantity > 0) {
      lines.push({ product_id: addon.productId, qty: addon.quantity })
    }
  }
  return lines
}

/**
 * Format a decimal-string amount (e.g. "180.00") as a currency string
 * (e.g. "€180.00"). The estimate endpoint returns line totals + grand
 * totals as decimal strings to avoid float precision drift; the
 * sidebar converts them for display only. Falls back to "{amount} {ccy}"
 * when Intl.NumberFormat can't handle the currency code (never throws).
 */
export function formatMoney(amount: string, currency: string): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return `${amount} ${currency}`
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `${n.toFixed(2)} ${currency}`
  }
}

/**
 * landr-zenj.1: shown instead of a price breakdown whenever the API flags
 * un_priceable=true — an operator price-list misconfiguration (a tier gap,
 * a scheme with no active rules, a deleted-in-use scheme), NOT a real €0
 * price. Shared verbatim between PriceSidebar (pre-emptive block on the
 * estimate) and BookingForm (defensive mapping of the submit endpoint's
 * 422 {"error":"un_priceable"}, for the rare case an estimate goes stale)
 * so the customer sees identical wording whichever path catches it.
 */
export const UN_PRICEABLE_MESSAGE =
  "Pricing for this selection isn't available right now — please contact us."

/** Partition the line items into operator-paid vs hotel-paid groups. */
export function splitLineItems(items: EstimateLineItem[]): {
  operator: EstimateLineItem[]
  hotel: EstimateLineItem[]
} {
  const operator: EstimateLineItem[] = []
  const hotel: EstimateLineItem[] = []
  for (const li of items) {
    if (li.paid_to === 'hotel') hotel.push(li)
    else operator.push(li)
  }
  return { operator, hotel }
}

/** rule kinds that the sidebar surfaces as little discount tags. */
const DISCOUNT_RULE_KINDS = new Set([
  'per_total_days_tier',
  'per_streak_tier',
  'voucher_percent',
  'voucher_fixed',
])

/** True when this applied_rules entry should render as a sidebar tag. */
export function isDiscountRule(kind: string): boolean {
  return DISCOUNT_RULE_KINDS.has(kind)
}

/**
 * Human-readable explanation lines for a discount rule (landr-8s6c).
 * The sidebar already renders a terse tag per discount rule (e.g.
 * "Streak discount"); these lines spell out WHY the price dropped —
 * the consecutive-day count and the per-day rate that was applied —
 * so the customer can see the multi-day rate working for them.
 *
 * Returns one string per "reason" (a streak run, or a single
 * total-days tier). An empty array means the rule carried no
 * explainable detail (e.g. a non-matching tier) and the caller
 * should fall back to the bare tag alone.
 *
 * Deliberately does NOT compute savings ("€75/day instead of
 * €90/day"): a single applied_rules entry only carries the tier that
 * matched, not the higher short-stay baseline, so any "instead of"
 * figure would be fabricated. Surfacing the applied per-day rate +
 * the consecutive-days reason is the honest maximum here. (Returning
 * the base tier would need an estimate-endpoint change — see the
 * landr-8s6c follow-up.)
 */
export function buildDiscountExplanation(
  rule: EstimateAppliedRule,
  currency: string,
): string[] {
  switch (rule.kind) {
    case 'per_streak_tier':
      return buildStreakTierExplanation(rule.detail, currency)
    case 'per_total_days_tier':
      return buildTotalDaysTierExplanation(rule.detail, currency)
    default:
      return []
  }
}

/**
 * Format a per-day rate ("€75.00/day"). Reuses formatMoney so the
 * currency symbol + decimals match every other figure in the sidebar,
 * then appends the per-unit suffix the multi-day rates are quoted in.
 */
function formatPerDay(amount: number, currency: string): string {
  return `${formatMoney(amount.toFixed(2), currency)}/day`
}

/**
 * Append a "× N participants" suffix when the rule priced per head.
 * per_participant rules (Para42 guided-day) multiply the per-day rate
 * by the participant count, so we name that multiplier explicitly.
 */
function withParticipantSuffix(
  line: string,
  perParticipant: boolean,
  participants: number | null,
): string {
  if (!perParticipant || !participants || participants < 1) return line
  const noun = participants === 1 ? 'participant' : 'participants'
  return `${line} × ${participants} ${noun}`
}

/**
 * per_streak_tier detail = { streaks: [[length, perDay], ...],
 * per_participant, participants, base_tier? }. One line per consecutive
 * run, e.g. "3 consecutive days · €75.00/day". When base_tier is present
 * (landr-qj1g), appends a savings line: "save €15.00/day vs standard rate".
 * A booking with two separate runs (25–27 + 29–30) yields two run lines.
 */
function buildStreakTierExplanation(
  detail: Record<string, unknown> | undefined,
  currency: string,
): string[] {
  if (!detail) return []
  const streaks = detail.streaks
  if (!Array.isArray(streaks)) return []
  const perParticipant = Boolean(detail.per_participant)
  const participants =
    typeof detail.participants === 'number' ? detail.participants : null
  const lines: string[] = []
  for (const entry of streaks) {
    if (!Array.isArray(entry) || entry.length < 2) continue
    const length = Number(entry[0])
    const perDay = Number(entry[1])
    if (!Number.isFinite(length) || !Number.isFinite(perDay)) continue
    const base =
      length === 1
        ? `${length} day · ${formatPerDay(perDay, currency)}`
        : `${length} consecutive days · ${formatPerDay(perDay, currency)}`
    lines.push(withParticipantSuffix(base, perParticipant, participants))
  }
  // landr-qj1g: if a base_tier was provided and its rate differs from every
  // applied rate, append one savings line. We show the highest applied rate
  // (from the last [length, perDay] in streaks) for the comparison.
  const baseTier =
    detail.base_tier && typeof detail.base_tier === 'object'
      ? (detail.base_tier as Record<string, unknown>)
      : null
  if (baseTier && typeof baseTier.amount_per_unit === 'number' && streaks.length > 0) {
    const lastEntry = streaks[streaks.length - 1]
    if (Array.isArray(lastEntry) && lastEntry.length >= 2) {
      const appliedPerDay = Number(lastEntry[1])
      const basePerDay = baseTier.amount_per_unit
      const saving = basePerDay - appliedPerDay
      if (Number.isFinite(saving) && saving > 0.005) {
        lines.push(`save ${formatPerDay(saving, currency)} vs standard rate`)
      }
    }
  }
  return lines
}

/**
 * per_total_days_tier detail = { days, matched?, per_participant,
 * participants, tier: { amount_per_unit, amount_total, ... },
 * base_tier?: { threshold_min, amount_per_unit } }. The per-day rate comes
 * from tier.amount_per_unit; if the tier was priced as a flat total
 * (amount_per_unit null) we derive per-day from amount_total / days so the
 * customer still gets a per-day figure. When base_tier is present (landr-qj1g),
 * appends a savings line: "save €20.00/day vs standard rate".
 * Returns [] when no tier matched (matched === false / no tier).
 */
function buildTotalDaysTierExplanation(
  detail: Record<string, unknown> | undefined,
  currency: string,
): string[] {
  if (!detail) return []
  if (detail.matched === false) return []
  const days = Number(detail.days)
  if (!Number.isFinite(days) || days < 1) return []
  const tier =
    detail.tier && typeof detail.tier === 'object'
      ? (detail.tier as Record<string, unknown>)
      : null
  let perDay: number | null = null
  if (tier) {
    if (typeof tier.amount_per_unit === 'number') {
      perDay = tier.amount_per_unit
    } else if (typeof tier.amount_total === 'number') {
      perDay = tier.amount_total / days
    }
  }
  if (perDay === null || !Number.isFinite(perDay)) return []
  const perParticipant = Boolean(detail.per_participant)
  const participants =
    typeof detail.participants === 'number' ? detail.participants : null
  const dayNoun = days === 1 ? 'day' : 'days'
  const base = `${days} ${dayNoun} · ${formatPerDay(perDay, currency)}`
  const lines = [withParticipantSuffix(base, perParticipant, participants)]
  // landr-qj1g: append a savings line when the API returned a base_tier
  // (the short-stay bracket) that is more expensive than the applied rate.
  const baseTier =
    detail.base_tier && typeof detail.base_tier === 'object'
      ? (detail.base_tier as Record<string, unknown>)
      : null
  if (baseTier && typeof baseTier.amount_per_unit === 'number') {
    const basePerDay = baseTier.amount_per_unit
    const saving = basePerDay - perDay
    if (Number.isFinite(saving) && saving > 0.005) {
      lines.push(`save ${formatPerDay(saving, currency)} vs standard rate`)
    }
  }
  return lines
}
