/**
 * Persistent price sidebar for the booking flow (landr-qez0). Visible
 * on every step from pick-selection onward through fill-form so the
 * customer always sees what they'll pay before continuing.
 *
 * - Desktop (md and up): renders as a sticky right rail in the page
 *   flex layout. Width clamped around 20rem so it doesn't shove the
 *   main content too far left on narrower laptops.
 * - Mobile (below md): renders as a fixed-bottom bar showing only the
 *   grand total plus a "Tap to expand" affordance. Tapping toggles a
 *   slide-up panel revealing the same full breakdown the desktop rail
 *   shows. We hand-rolled the drawer (vs. the radix Dialog) because the
 *   widget bundle already includes the Dialog primitive for the form
 *   modal flow and stacking + scroll-lock interactions get hairy when
 *   the sidebar is open across step transitions.
 *
 * Data source: useBookingEstimate hook (debounced 300ms) wrapping the
 * POST /api/public/operators/{slug}/products/{id}/estimate endpoint
 * (landr-xbqh). The endpoint reuses the canonical pricing engine so the
 * preview is bit-for-bit identical to what gets persisted on submit
 * (no "estimated" disclaimer — the label is literally "Booking
 * overview").
 *
 * States:
 *   - First load (no data, isLoading): "Calculating…"
 *   - Stale (debounce pending OR fetch in flight WITH prior data):
 *     show the prior breakdown + a small spinner; never blank the panel
 *   - Error (no data, latest fetch errored): friendly fallback string
 *     so the customer keeps progressing — the final total is canonical
 *     and surfaced on the confirmation page
 *   - Happy path: full breakdown with operator/hotel split + applied
 *     discount tags
 */
import { useEffect, useMemo, useState } from 'react'
import type { Product } from '@/api/types'
import type { RoomSelection } from './accommodationCalc'
import type { AddonSelection } from './addonsState'
import { useBookingEstimate } from './useBookingEstimate'
import {
  buildAddonLines,
  formatMoney,
  isDiscountRule,
  splitLineItems,
} from './priceSidebarHelpers'

interface Props {
  operatorSlug: string
  product: Product
  selectedDays: string[]
  participantCount: number
  accommodationRooms: RoomSelection[]
  addons: AddonSelection[]
}

/**
 * Inner content used by both the desktop rail and the mobile drawer
 * body. Stateless — receives the resolved estimate data as props.
 */
function BookingOverviewBody({
  data,
  isLoading,
  isStale,
  error,
}: ReturnType<typeof useBookingEstimate>) {
  if (!data && isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Calculating…</p>
    )
  }
  if (!data && error) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn&apos;t fetch price — your final total will be shown at
        confirmation.
      </p>
    )
  }
  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        Pick your options to see the price.
      </p>
    )
  }
  const { operator, hotel } = splitLineItems(data.line_items)
  const showStaleSpinner = isStale && data !== null
  return (
    <div className="space-y-4">
      {operator.length > 0 ? (
        <section data-testid="price-sidebar-operator-section">
          <h4 className="mb-1 text-sm font-semibold text-foreground">
            You pay now
          </h4>
          <ul className="space-y-1 text-sm">
            {operator.map((li) => (
              <li
                key={`op-${li.product_id}`}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="flex-1">
                  <span className="block">{li.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {li.qty} × {li.units} {li.units === 1 ? 'day' : 'days'}
                  </span>
                </span>
                <span className="tabular-nums">
                  {formatMoney(li.line_total, data.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-baseline justify-between border-t pt-2 text-sm">
            <span className="font-medium">Subtotal</span>
            <span className="font-medium tabular-nums">
              {formatMoney(data.operator_total, data.currency)}
            </span>
          </div>
        </section>
      ) : null}
      {hotel.length > 0 ? (
        <section data-testid="price-sidebar-hotel-section">
          <h4 className="mb-1 text-sm font-semibold text-foreground">
            Pay at hotel
          </h4>
          <ul className="space-y-1 text-sm">
            {hotel.map((li) => (
              <li
                key={`hot-${li.product_id}`}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="flex-1">
                  <span className="block">{li.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {li.qty} × {li.units} {li.units === 1 ? 'night' : 'nights'}
                  </span>
                </span>
                <span className="tabular-nums">
                  {formatMoney(li.line_total, data.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-baseline justify-between border-t pt-2 text-sm">
            <span className="font-medium">Subtotal</span>
            <span className="font-medium tabular-nums">
              {formatMoney(data.hotel_total, data.currency)}
            </span>
          </div>
        </section>
      ) : null}
      <div
        className="flex items-baseline justify-between border-t pt-3"
        data-testid="price-sidebar-grand-total"
      >
        <span className="text-base font-semibold">Grand total</span>
        <span className="text-base font-semibold tabular-nums">
          {formatMoney(data.grand_total, data.currency)}
        </span>
      </div>
      {data.applied_rules.some((r) => isDiscountRule(r.kind)) ? (
        <ul className="flex flex-wrap gap-1">
          {data.applied_rules
            .filter((r) => isDiscountRule(r.kind))
            .map((rule, idx) => (
              <li
                key={`rule-${idx}`}
                className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900"
              >
                {discountLabel(rule.kind)}
              </li>
            ))}
        </ul>
      ) : null}
      {showStaleSpinner ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid="price-sidebar-stale"
        >
          Updating…
        </p>
      ) : null}
    </div>
  )
}

/** Human label for the supported discount-rule kinds. */
function discountLabel(kind: string): string {
  switch (kind) {
    case 'per_total_days_tier':
      return 'Multi-day discount'
    case 'per_streak_tier':
      return 'Streak discount'
    case 'voucher_percent':
    case 'voucher_fixed':
      return 'Voucher applied'
    default:
      return kind
  }
}

export default function PriceSidebar(props: Props) {
  const {
    operatorSlug,
    product,
    selectedDays,
    participantCount,
    accommodationRooms,
    addons,
  } = props

  const addonLines = useMemo(
    () => buildAddonLines(accommodationRooms, addons),
    [accommodationRooms, addons],
  )

  const estimate = useBookingEstimate({
    operatorSlug,
    productId: product.product_id,
    selectedDays,
    participantCount,
    addonLines,
    enabled: true,
  })

  // Mobile drawer open state — collapsed by default so the customer
  // sees just the grand total + a tap target. Resetting it to false on
  // step change would be friendlier, but step transitions don't
  // re-mount this component (it lives in App.tsx around the step
  // switch), so we leave the drawer state alone and trust the customer
  // to dismiss it.
  const [mobileOpen, setMobileOpen] = useState(false)

  // Lock body scroll while the mobile drawer is open so the underlying
  // step doesn't scroll behind the modal — same convention the Dialog
  // primitive uses for the booking-form modal.
  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  const grandTotalLabel = estimate.data
    ? formatMoney(estimate.data.grand_total, estimate.data.currency)
    : '—'

  return (
    <>
      {/* Desktop: sticky right rail. Visible from md upward. */}
      <aside
        data-testid="price-sidebar-desktop"
        className="hidden md:block w-80 shrink-0"
      >
        <div className="sticky top-6 rounded-md border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-base font-semibold">Booking overview</h3>
          <BookingOverviewBody {...estimate} />
        </div>
      </aside>

      {/* Mobile: fixed bottom bar (collapsed) + slide-up drawer (expanded). */}
      <div
        data-testid="price-sidebar-mobile"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t bg-card shadow-lg"
      >
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-controls="price-sidebar-mobile-panel"
        >
          <span className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground">
              Booking overview
            </span>
            <span className="text-base font-semibold tabular-nums">
              {grandTotalLabel}
            </span>
          </span>
          <span className="text-sm text-muted-foreground">
            {mobileOpen ? 'Tap to collapse' : 'Tap to expand'}
          </span>
        </button>
        {mobileOpen ? (
          <div
            id="price-sidebar-mobile-panel"
            className="max-h-[60vh] overflow-y-auto border-t bg-card px-4 py-4"
          >
            <BookingOverviewBody {...estimate} />
          </div>
        ) : null}
      </div>
      {/* Spacer so the mobile fixed bar never covers the last bit of
          step content. Matches the bar's collapsed height (~60px). */}
      <div aria-hidden className="md:hidden h-16" />
    </>
  )
}
