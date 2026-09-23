import { useEffect, useMemo, useState } from 'react'
import { getProductAddons } from '@/api/client'
import type { Product, ProductAddon } from '@/api/types'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { browserLocale, pickLocalized } from '@/lib/locale'
import { tr } from '@/lib/strings'
import { AddonsList } from './AddonsList'
import { ContinueAction } from './ContinueAction'
import { CustomerCommentField } from './CustomerCommentField'
import { NextAction } from './NextAction'
import { StepBackButton } from './StepBackButton'
import {
  defaultAddonQty,
  requiredAddonError,
  selectionToLines,
  type AddonSelection,
} from './addonsState'

/**
 * ServiceAddonsStep — inserted between pick-selection and the pickup/
 * fill-form branch for service products that have linked add-ons but
 * no hotel offering (landr-cip6). For services WITH a hotel offering,
 * the add-ons are rendered inline under each room inside
 * AccommodationStep instead, so this step never runs in that case.
 *
 * Parent qty is implicitly 1 (the customer just picked one of the
 * service product) — the overbook warning fires when an add-on qty
 * exceeds 1. Required add-ons seed at min_qty so the Continue button
 * is unblocked by default; the customer can still decrease them but
 * Continue blocks until min_qty is met again.
 *
 * App.tsx only renders this step when the upstream probe (getProductAddons
 * in afterSelection) found at least one add-on — so the empty-state of
 * the fetch happening inside this component should never appear in
 * practice. It's still handled for robustness (network blip, race).
 */
interface Props {
  product: Product
  /**
   * landr-yf0n: when the customer hits Back from a downstream step,
   * App.tsx threads the previously confirmed add-on line items back so
   * the step re-mounts with the prior selections restored. When
   * present, the seed-from-min_qty defaults are skipped because the
   * customer's explicit picks take precedence (including any required
   * add-ons they had at their picked qty).
   */
  initialAddons?: AddonSelection[]
  /**
   * landr-n6ii3: current value of the "Anything we should know?" comment,
   * read straight off App.tsx's bookingDraft.customerComment — this step
   * doesn't own the value, it just renders CustomerCommentField and
   * reports every keystroke back via onCustomerCommentChange. Optional
   * (defaults to '' / a no-op) so existing tests need no change.
   */
  customerComment?: string
  onCustomerCommentChange?: (comment: string) => void
  onBack: () => void
  onConfirm: (addons: AddonSelection[]) => void
}

export function ServiceAddonsStep({
  product,
  initialAddons,
  customerComment = '',
  onCustomerCommentChange = () => {},
  onBack,
  onConfirm,
}: Props) {
  const locale = browserLocale()
  const productName = pickLocalized(product.name, product.name_localized, locale)

  const [addons, setAddons] = useState<ProductAddon[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Record<string, number>>(() => {
    if (!initialAddons || initialAddons.length === 0) return {}
    const seed: Record<string, number> = {}
    for (const line of initialAddons) seed[line.productId] = line.quantity
    return seed
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await getProductAddons(product.product_id)
        if (cancelled) return
        setAddons(list)
        // Seed required add-ons at their min_qty so the customer sees
        // a sensible default and the Continue button isn't blocked the
        // moment they land here. landr-yf0n: when initialAddons came
        // through (back-nav re-entry), the customer's prior picks
        // already own the selection map — don't overwrite them with
        // min_qty defaults; just fill in any required add-on the
        // initialAddons map doesn't already cover.
        setSelection((prev) => {
          const next = { ...prev }
          for (const a of list) {
            if (next[a.addon_product_id] !== undefined) continue
            const q = defaultAddonQty(a)
            if (q > 0) next[a.addon_product_id] = q
          }
          return next
        })
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [product.product_id])

  const unmetRequired = useMemo(() => {
    if (!addons) return false
    for (const a of addons) {
      const qty = selection[a.addon_product_id] ?? 0
      if (requiredAddonError(a, qty) !== null) return true
    }
    return false
  }, [addons, selection])

  const canContinue = addons !== null && !unmetRequired

  function handleContinue() {
    if (!canContinue) return
    // landr-fxza.4: thread each add-on's product_kind through so
    // BookingForm can tell a room-tied add-on apart from a service-tied
    // one (this step is only ever the LATTER — services with a hotel
    // offering render add-ons inside AccommodationStep instead — but
    // passing the real catalogue keeps this correct if that ever changes).
    onConfirm(selectionToLines(selection, addons ?? []))
  }

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>{tr('addonsTitle', locale)}</CardTitle>
        <CardDescription>{productName}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {addons === null && !error ? (
          <p className="text-sm text-muted-foreground">{tr('loadingAddons', locale)}</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {addons !== null && addons.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tr('noAddonsAvailable', locale)}
          </p>
        ) : null}
        {addons !== null && addons.length > 0 ? (
          <NextAction active={unmetRequired} cue={tr('pickRequiredAddonsCue', locale)}>
            <AddonsList
              addons={addons}
              selection={selection}
              onChange={setSelection}
              expectedQty={1}
            />
          </NextAction>
        ) : null}
        {/* landr-n6ii3: same field DetailsStep collects, editable here too —
            last field before Continue. */}
        <CustomerCommentField
          value={customerComment}
          onChange={onCustomerCommentChange}
          collapsible
        />
        <ContinueAction
          ready={canContinue}
          reason={
            canContinue
              ? tr('readyToContinue', locale)
              : tr('pickRequiredAddonsToContinue', locale)
          }
          reasonId="addons-step-gate"
          onContinue={handleContinue}
          data-testid="addons-step-submit"
        />
      </CardContent>
    </Card>
  )
}
