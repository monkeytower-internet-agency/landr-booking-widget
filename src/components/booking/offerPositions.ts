/**
 * Presentation helpers for the custom-offer v2 positions on the /offer page
 * (landr-8f1sh.4). Pure; no React.
 */
import type { OfferPosition } from '@/api/client'

// The API seeds a position label as
//   "Guided Paragliding Day · 2 consecutive days · €90.00/day × 1 participant"
// i.e. the REGULAR per-day price is baked into the text. It goes stale the
// moment the operator edits the price and would leak the regular price when
// the discount is hidden, so the page strips that tail and renders the price
// from the numeric fields instead.
const PER_DAY_TAIL = /\s+·\s+[^·]*\/day\s*×\s*\d+\s+participants?\s*$/i

export interface PositionText {
  /** The label without the baked-in price tail ("Name · 2 consecutive days"). */
  title: string
  /** True when the label carried the per-day tail, i.e. a €/day × people line makes sense. */
  perDay: boolean
}

export function splitPositionLabel(label: string): PositionText {
  const stripped = label.replace(PER_DAY_TAIL, '')
  return { title: stripped.trim(), perDay: stripped !== label }
}

const EPS = 0.005

/** The regular price is worth showing: savings are on and it really differs. */
export function hasSaving(p: OfferPosition, showSavings: boolean): boolean {
  return showSavings && p.original_total - p.total > EPS
}
