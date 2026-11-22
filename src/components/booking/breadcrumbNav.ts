import { createContext, useContext } from 'react'
import type { BreadcrumbItem } from '@/appStepMachine'
import type { Step } from '@/appStepMachine'
import type { ProductKind } from '@/api/types'

/**
 * Shared step-breadcrumb wiring (landr).
 *
 * The breadcrumb is an App-level concern (it knows the whole step trail), but
 * the affordance must render exactly where each step's back button used to live
 * — at the top of the step card. Rather than thread a `breadcrumb` prop through
 * every funnel step, App publishes the current trail + a navigate callback via
 * this context, and the shared StepBackButton renders the breadcrumb when the
 * context is present (≥2 crumbs) or falls back to a single back button when it
 * is absent (isolated component tests, catalog/non-funnel steps).
 *
 * Kept in a plain .ts module (no component export) so the widget's
 * react-refresh/only-export-components CI gate stays happy.
 */
export interface BreadcrumbNavValue {
  /** Ordered crumbs for the current step; the last is the active step. */
  items: BreadcrumbItem[]
  /** Navigate to a previous step (state already restored on the target). */
  onNavigate: (target: Step) => void
  /**
   * landr-3knn9: the funnel's main product kind — a stay words its people as
   * guests in the crumbs. Absent/null → participant wording.
   */
  productKind?: ProductKind | null
  /**
   * A cross-sell detour: the product the guest opened from a suggestion has no
   * trail of its own to walk back along, so the back slot (top-left of the
   * step, where the step's back button always sits) returns to the booking
   * they left instead.
   */
  detourBack?: { label: string; onBack: () => void }
}

export const BreadcrumbNavContext = createContext<BreadcrumbNavValue | null>(
  null,
)

/** Returns the current breadcrumb nav, or null when no provider is mounted. */
export function useBreadcrumbNav(): BreadcrumbNavValue | null {
  return useContext(BreadcrumbNavContext)
}
