/**
 * Presentation helpers for the custom-offer v2 positions on the /offer page
 * (landr-8f1sh.4). Pure; no React. The per-day sub-line is always rendered from
 * the numeric position fields (landr-8f1sh.6), never parsed from the label.
 */
import type { OfferPosition } from '@/api/client'

const EPS = 0.005

/** The regular price is worth showing: savings are on and it really differs. */
export function hasSaving(p: OfferPosition, showSavings: boolean): boolean {
  return showSavings && p.original_total - p.total > EPS
}
