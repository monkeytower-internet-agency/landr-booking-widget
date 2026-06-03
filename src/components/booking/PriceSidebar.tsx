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
import { RefreshCw } from 'lucide-react'
import type { Product } from '@/api/types'
import { deriveStayWindow, type RoomSelection } from './accommodationCalc'
import type { AddonSelection } from './addonsState'
import { formatDayLabel } from './dateLabel'
import { DayChips } from './DayChips'
import { useBookingEstimate } from './useBookingEstimate'
import {
  buildAddonLines,
  buildDiscountExplanation,
  formatMoney,
  isDiscountRule,
  splitLineItems,
} from './priceSidebarHelpers'

interface Props {
  operatorToken: string
  product: Product
  selectedDays: string[]
  participantCount: number
  /**
   * Optional. When supplied (landr-8c03 — populated once DetailsStep
   * has run), renders a "For Ada, Grace + 1 other" sub-line under the
   * Booking overview header so the customer sees who they're paying
   * for. Empty/undefined falls back to the count-only behaviour.
   */
  participantNames?: string[]
  accommodationRooms: RoomSelection[]
  addons: AddonSelection[]
  /** Debounce delay in ms before firing the estimate RPC (default 300). */
  debounceMs?: number
}

/**
 * Inner content used by both the desktop rail and the mobile drawer
 * body. Stateless — receives the resolved estimate data as props plus
 * the selectedDays so it can render day chips per operator line item
 * (landr-2wyi) and derive the hotel check-in / check-out span.
 */
interface BookingOverviewBodyProps
  extends ReturnType<typeof useBookingEstimate> {
  /** ISO YYYY-MM-DD days the customer picked for the guided service. */
  selectedDays: string[]
}

function BookingOverviewBody({
  data,
  isLoading,
  isStale,
  error,
  selectedDays,
}: BookingOverviewBodyProps) {
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
  // Hotel check-in / check-out span (landr-2wyi). Derived from the
  // selected guided days: check-in = first day − 1, check-out = last
  // day + 1 (see deriveStayWindow / accommodationCalc.ts). We surface
  // this as an explicit "Hotel: Sun 24 May → Thu 29 May, 5 nights"
  // header above the hotel line items so the customer sees the actual
  // night range — the chips on the operator side only cover the
  // guided days, not the +1 buffer nights.
  const stay =
    hotel.length > 0 && selectedDays.length > 0
      ? deriveStayWindow(selectedDays)
      : null
  const showStaleSpinner = isStale && data !== null
  return (
    <div className="space-y-4">
      {operator.length > 0 ? (
        <section data-testid="price-sidebar-operator-section">
          <h4 className="mb-1 text-sm font-semibold text-foreground">
            You pay now
          </h4>
          <ul className="space-y-2 text-sm">
            {operator.map((li) => (
              <li
                key={`op-${li.product_id}`}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="flex-1">
                  <span className="block">{li.label}</span>
                  {/* DayChips: one chip per picked date — replaces the
                      previous "qty × units days" subtitle which conflated
                      non-contiguous selections with a range. We still
                      show the participant-count multiplier when qty > 1
                      so the customer sees why the line total scales. */}
                  <DayChips dates={selectedDays} />
                  {li.qty > 1 ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {li.qty} × {li.units}{' '}
                      {li.units === 1 ? 'day' : 'days'}
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums">
                  {formatMoney(li.line_total, data.currency)}
                </span>
              </li>
            ))}
          </ul>
          {/* landr-kat8: "Booking total" (was "Grand total") — what the
              customer pays now to the operator. The hotel line items are
              rendered as a separate pill below with their own subtotal
              + "paid at check-in" caveat so the customer can't mistake
              the hotel charge for part of the booking checkout total. */}
          <div
            className="mt-2 flex items-baseline justify-between border-t pt-2"
            data-testid="price-sidebar-booking-total"
          >
            <span className="text-base font-semibold">Booking total</span>
            <span className="text-base font-semibold tabular-nums">
              {formatMoney(data.operator_total, data.currency)}
            </span>
          </div>
        </section>
      ) : null}
      {hotel.length > 0 ? (
        // landr-kat8: hotel rendered as a visually distinct pill/card
        // (border + tinted background) so the customer reads it as a
        // separate concern from the booking total above. The explicit
        // caveat at the bottom reinforces that the hotel charge is NOT
        // part of the operator checkout.
        <section
          data-testid="price-sidebar-hotel-section"
          className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/40"
        >
          <h4 className="mb-1 text-sm font-semibold text-foreground">
            At-hotel total · pay at check-in
          </h4>
          {stay && stay.checkInIso && stay.checkOutIso ? (
            <p
              className="mb-2 text-xs text-muted-foreground"
              data-testid="price-sidebar-hotel-span"
            >
              Hotel: {formatDayLabel(stay.checkInIso)} →{' '}
              {formatDayLabel(stay.checkOutIso)}, {stay.nights}{' '}
              {stay.nights === 1 ? 'night' : 'nights'}
            </p>
          ) : null}
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
          <div
            className="mt-2 flex items-baseline justify-between border-t border-amber-200 pt-2 text-sm dark:border-amber-900"
            data-testid="price-sidebar-hotel-total"
          >
            <span className="font-medium">Subtotal</span>
            <span className="font-medium tabular-nums">
              {formatMoney(data.hotel_total, data.currency)}
            </span>
          </div>
          <p
            className="mt-2 text-xs italic text-muted-foreground"
            data-testid="price-sidebar-hotel-caveat"
          >
            Paid directly to the hotel at check-in. Not included in your
            booking total.
          </p>
        </section>
      ) : null}
      <div
        className="flex items-baseline justify-between border-t pt-3"
        data-testid="price-sidebar-grand-total"
      >
        <span className="text-base font-semibold">Grand total</span>
        {isLoading ? (
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <span className="text-base font-semibold tabular-nums">
            {formatMoney(data.grand_total, data.currency)}
          </span>
        )}
      </div>
      {data.applied_rules.some((r) => isDiscountRule(r.kind)) ? (
        // landr-8s6c: each discount rule renders its terse tag PLUS a
        // plain-language explanation of why the price dropped — the
        // consecutive-day count + the per-day rate that was applied —
        // so the customer sees the multi-day rate working, not just a
        // bare "Streak discount" pill. Explanation lines come from
        // buildDiscountExplanation (reads applied_rules[].detail).
        <ul className="space-y-2" data-testid="price-sidebar-discounts">
          {data.applied_rules
            .filter((r) => isDiscountRule(r.kind))
            .map((rule, idx) => {
              const lines = buildDiscountExplanation(rule, data.currency)
              return (
                <li key={`rule-${idx}`} data-testid="price-sidebar-discount">
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900">
                    {discountLabel(rule.kind)}
                  </span>
                  {lines.length > 0 ? (
                    <div
                      className="mt-1 text-xs text-muted-foreground"
                      data-testid="price-sidebar-discount-explanation"
                    >
                      <span className="block font-medium text-foreground/80">
                        {explanationHeading(rule.kind)}
                      </span>
                      {lines.map((line, lineIdx) => (
                        <span
                          key={`rule-${idx}-line-${lineIdx}`}
                          className="block tabular-nums"
                        >
                          {line}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </li>
              )
            })}
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

/**
 * Heading above the per-day explanation lines (landr-8s6c). Names the
 * WHY in plain language — both tier kinds resolve to "Multi-day rate
 * applied" since that's the reason the per-day price dropped.
 */
function explanationHeading(kind: string): string {
  switch (kind) {
    case 'per_streak_tier':
    case 'per_total_days_tier':
      return 'Multi-day rate applied'
    default:
      return ''
  }
}

export default function PriceSidebar(props: Props) {
  const {
    operatorToken,
    product,
    selectedDays,
    participantCount,
    participantNames,
    accommodationRooms,
    addons,
    debounceMs,
  } = props

  const addonLines = useMemo(
    () => buildAddonLines(accommodationRooms, addons),
    [accommodationRooms, addons],
  )

  // Human-friendly "for Ada, Grace + 1 other" line. Only renders when
  // DetailsStep has surfaced the names (landr-8c03). Three or fewer
  // names: list them all; otherwise show the first two + "+N others".
  const namesLine = useMemo(() => {
    const names = (participantNames ?? []).filter((n) => n.length > 0)
    if (names.length === 0) return null
    if (names.length <= 3) return `For ${names.join(', ')}`
    const head = names.slice(0, 2).join(', ')
    const rest = names.length - 2
    return `For ${head} + ${rest} other${rest === 1 ? '' : 's'}`
  }, [participantNames])

  // landr-hpyn: never price an empty selection. selectedDays only ever
  // arrives empty on the pick-selection step BEFORE the customer has
  // chosen anything (every later step derives ≥1 day from the committed
  // selection — see selectionToDays). The estimate endpoint happily
  // returns the product's base price for selected_days=[], which made a
  // fixed-window course with zero upcoming windows render "No upcoming
  // windows" next to a €450 Booking overview. Gate BOTH the fetch
  // (enabled) and the render (`visible` below) — the hook deliberately
  // keeps the previous response for stale-while-loading, so deselecting
  // the last day would otherwise leave the old price on screen.
  const hasSelection = selectedDays.length > 0

  const estimate = useBookingEstimate({
    operatorToken,
    productId: product.product_id,
    selectedDays,
    participantCount,
    addonLines,
    enabled: hasSelection,
    debounceMs,
  })

  // What the UI is allowed to show: identical to `estimate` while a
  // selection exists; collapses to the no-data empty state ("Pick your
  // options to see the price.") when nothing is selected.
  const visible: typeof estimate = hasSelection
    ? estimate
    : {
        data: null,
        isLoading: false,
        isStale: false,
        error: null,
        refresh: estimate.refresh,
      }

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

  // landr-kat8: the collapsed mobile bar shows the BOOKING total (operator
  // only — what the customer pays now at checkout). The hotel charge is
  // surfaced as a separate "+ €X at hotel" sub-line so the customer sees
  // it exists without conflating it into the checkout number.
  const bookingTotalLabel = visible.data
    ? formatMoney(visible.data.operator_total, visible.data.currency)
    : '—'
  const atHotelLabel =
    visible.data && Number(visible.data.hotel_total) > 0
      ? formatMoney(visible.data.hotel_total, visible.data.currency)
      : null

  return (
    <>
      {/* Desktop: sticky right rail. Visible from md upward. */}
      <aside
        data-testid="price-sidebar-desktop"
        className="hidden md:block w-80 shrink-0"
      >
        <div className="sticky top-6 rounded-md border bg-card p-4 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-base font-semibold">Booking overview</h3>
            {visible.isStale ? (
              <button
                type="button"
                onClick={visible.refresh}
                title="Update price"
                data-testid="price-sidebar-refresh"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          {namesLine ? (
            <p
              className="mb-3 text-xs text-muted-foreground"
              data-testid="price-sidebar-names"
            >
              {namesLine}
            </p>
          ) : (
            <div className="mb-3" />
          )}
          <BookingOverviewBody {...visible} selectedDays={selectedDays} />
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
              Booking total
            </span>
            <span className="text-base font-semibold tabular-nums">
              {bookingTotalLabel}
            </span>
            {atHotelLabel ? (
              <span
                className="text-xs text-muted-foreground"
                data-testid="price-sidebar-mobile-athotel"
              >
                + {atHotelLabel} at hotel
              </span>
            ) : null}
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
            <BookingOverviewBody {...visible} selectedDays={selectedDays} />
          </div>
        ) : null}
      </div>
      {/* Spacer so the mobile fixed bar never covers the last bit of
          step content. Matches the bar's collapsed height (~60px). */}
      <div aria-hidden className="md:hidden h-16" />
    </>
  )
}
