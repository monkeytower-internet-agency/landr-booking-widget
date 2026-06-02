import { Button } from '@/components/ui/button'
import type { ProductAddon } from '@/api/types'
import { browserLocale, pickLocalized } from '@/lib/locale'
import { formatCurrency } from './accommodationCalc'
import {
  clampAddonQty,
  isOverbooked,
  requiredAddonError,
} from './addonsState'

/**
 * Stateless add-on list. Renders one row per linked add-on with name +
 * per-unit price + qty stepper, an orange quantity-deviation warning
 * (non-blocking), and a destructive helper line when a required add-on
 * falls below its min_qty (the caller wires the disable into its
 * Continue button via the same `requiredAddonError` helper — keeping
 * the component pure of step-machine state).
 *
 * Used by AccommodationStep (rendered under each room, expectedQty =
 * capacity_per_unit × roomQty) and the service-flow add-on rendering
 * inline on BookingForm (expectedQty = 1). Both share the same UX
 * affordances; this component only knows about the add-on rows and the
 * selection map.
 *
 * Per landr-znl: this file ONLY exports the React component as default
 * — the pure helpers (`requiredAddonError`, `isOverbooked`, etc.) live
 * in addonsState.ts so the react-refresh/only-export-components rule
 * stays happy and CF Pages doesn't block the deploy.
 */
interface Props {
  addons: ProductAddon[]
  /**
   * Current selection: map from addon_product_id → quantity. Caller
   * controls state so a single parent component can roll all its
   * add-ons into one submit payload.
   */
  selection: Record<string, number>
  /** Setter for the selection map; pure (no side effects). */
  onChange: (next: Record<string, number>) => void
  /**
   * Expected quantity for per-occupant add-ons (landr-u4c7). For
   * room add-ons (breakfast) this is capacity_per_unit × roomQty —
   * how many people the room(s) sleep in total. For service-flow
   * add-ons where there is no room context, pass 1.
   *
   * qty > expectedQty → orange over-warning ("bringing extras?").
   * 0 < qty < expectedQty → orange under-warning ("one per guest?").
   * qty === expectedQty or qty === 0 → no warning.
   *
   * When expectedQty = 1 (service-flow callers), the under-warning
   * never fires because qty is either 0 or ≥ 1, preserving the
   * existing over-only behaviour for those callers.
   */
  expectedQty: number
  /**
   * landr-yybu: when true, expectedQty is treated as a HARD occupancy cap
   * (the room can't be given more breakfasts than it sleeps) — the + button
   * disables at expectedQty and clampAddonQty bounds there. AccommodationStep
   * passes true for room-linked add-ons so a single-occupancy room caps at 1
   * just like a double caps at 2. Generic service-flow callers
   * (ServiceAddonsStep, expectedQty=1) omit this / pass false so their add-ons
   * stay uncapped. We use an explicit flag rather than `expectedQty > 1`
   * because that signal can't tell a 1-person room from a service add-on.
   */
  occupancyLimited?: boolean
  /**
   * landr-0geh: number of room units of this type booked (default 1).
   * When > 1 the quantity-deviation hints switch to multi-room copy
   * ("rooms" instead of "a room") so the wording is accurate for e.g.
   * 2× Single Rooms where expectedQty = 2 × 1 = 2 total guests but
   * phrasing "a room that sleeps 2" would be misleading.
   */
  roomQty?: number
  /**
   * Optional label rendered above the list (e.g. "Add-ons" inside a
   * room block). The caller usually owns this from a <fieldset
   * legend>, so leaving it null hides the heading entirely.
   */
  heading?: string
}

export function AddonsList({
  addons,
  selection,
  onChange,
  expectedQty,
  occupancyLimited = false,
  roomQty = 1,
  heading,
}: Props) {
  const locale = browserLocale()

  if (addons.length === 0) return null

  // landr-yybu: occupancy hard-cap for room-linked add-ons. undefined for
  // service-flow callers (occupancyLimited=false) so they stay uncapped.
  const occupancyCap = occupancyLimited ? expectedQty : undefined

  function bumpQty(addon: ProductAddon, delta: number) {
    const current = selection[addon.addon_product_id] ?? 0
    const next = clampAddonQty(addon, current + delta, occupancyCap)
    const out = { ...selection, [addon.addon_product_id]: next }
    if (next === 0) delete out[addon.addon_product_id]
    onChange(out)
  }

  return (
    <div className="flex flex-col gap-2" data-testid="addons-list">
      {heading ? (
        <p className="text-xs font-medium text-muted-foreground">{heading}</p>
      ) : null}
      {addons.map((addon) => {
        const qty = selection[addon.addon_product_id] ?? 0
        const addonName = pickLocalized(addon.name, addon.name_localized, locale)
        const deviation = isOverbooked(qty, expectedQty)
        const requiredError = requiredAddonError(addon, qty)
        // landr-yybu: + disabled at the occupancy cap (room-linked add-ons)
        // OR the add-on's own max_qty, whichever binds first.
        const atMax =
          (occupancyCap !== undefined && qty >= occupancyCap) ||
          (addon.max_qty !== null && qty >= addon.max_qty)

        return (
          <div
            key={addon.product_addon_id}
            className="flex flex-col gap-1 rounded-md border border-border bg-muted/20 p-2"
            data-testid={`addon-row-${addon.addon_product_id}`}
          >
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {addonName}
                  {addon.is_required ? (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (required)
                    </span>
                  ) : null}
                </span>
                {addon.price_per_unit ? (
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(
                      Number(addon.price_per_unit),
                      addon.currency,
                    )}{' '}
                    each
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Price on request
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={qty <= 0}
                  onClick={() => bumpQty(addon, -1)}
                  aria-label={`Decrease ${addonName} quantity`}
                >
                  −
                </Button>
                <span
                  className="w-6 text-center text-sm tabular-nums"
                  aria-live="polite"
                >
                  {qty}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={atMax}
                  onClick={() => bumpQty(addon, 1)}
                  aria-label={`Increase ${addonName} quantity`}
                >
                  +
                </Button>
              </div>
            </div>
            {deviation === 'over' ? (
              <p
                className="rounded-sm border border-orange-300 bg-orange-50 px-2 py-1 text-xs text-orange-900 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-100"
                data-testid={`addon-overbook-${addon.addon_product_id}`}
              >
                {roomQty > 1
                  ? `More ${addonName.toLowerCase()} (${qty}) than these ${roomQty} rooms sleep (${expectedQty}) — bringing extras?`
                  : `More ${addonName.toLowerCase()} (${qty}) than this room sleeps (${expectedQty}) — bringing extras?`}
              </p>
            ) : null}
            {deviation === 'under' ? (
              <p
                className="rounded-sm border border-orange-300 bg-orange-50 px-2 py-1 text-xs text-orange-900 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-100"
                data-testid={`addon-underbook-${addon.addon_product_id}`}
              >
                {roomQty > 1
                  ? `Only ${qty} ${addonName.toLowerCase()} for ${roomQty} rooms (${expectedQty} guests) — one per room?`
                  : `Only ${qty} ${addonName.toLowerCase()} for a room that sleeps ${expectedQty} — one per guest?`}
              </p>
            ) : null}
            {requiredError ? (
              <p
                className="text-xs text-destructive"
                data-testid={`addon-required-error-${addon.addon_product_id}`}
              >
                {requiredError}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
