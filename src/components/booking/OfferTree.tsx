/**
 * The offers of one cart line, from the evaluator's verdict: a row per
 * pickable offer (OfferRow), what is included (IncludedList), and under every
 * picked offer the offers of ITS product, indented one level (stay -> tour ->
 * water shoes), never deeper than MAX_OFFER_DEPTH.
 *
 * Offers booked with their own dates (`schedule = own`) are not rows here:
 * the caller books them as added products (`onAddOwn`).
 */
import type { Dispatch, SetStateAction } from 'react'
import type { EstimateLineItem, EvaluatedLine, EvaluatedOffer } from '@/api/types'
import { Button } from '@/components/ui/button'
import { pickLocalized } from '@/lib/locale'
import {
  depthOf,
  effectiveSchedule,
  estimateLinesFor,
  instantGate,
  lineDays,
  MAX_OFFER_DEPTH,
  type OfferPick,
  type OfferTreeInput,
  type PartyMember,
} from './offerCart'
import { IncludedList } from './IncludedList'
import { OfferRow } from './OfferRow'

export interface OfferTreeProps {
  parentLineId: string
  verdicts: Readonly<Record<string, EvaluatedLine>>
  picks: OfferPick[]
  onPicksChange: Dispatch<SetStateAction<OfferPick[]>>
  tree: OfferTreeInput
  members: readonly PartyMember[]
  idPrefix: string
  locale: string
  currency: string
  /** The estimate's line items (prices of picked rows, the server's attached lines). */
  estimateItems?: readonly EstimateLineItem[]
  /** The evaluator's answer for the current cart is not in yet. */
  isPending?: boolean
  /** The submit refused this line id. */
  errorLineId?: string | null
  /** Offers with their own dates; absent = not shown here. */
  onAddOwn?: (offer: EvaluatedOffer, parentLineId: string) => void
  /** Which own-dated offers may be added now (already added, excluded, loading). */
  ownAllowed?: (offer: EvaluatedOffer) => boolean
  /** Show the parent-NULL (cross-sell) offers of this line (default true). */
  showParentless?: boolean
  disabled?: boolean
}

export function OfferTree(props: OfferTreeProps) {
  const {
    parentLineId,
    verdicts,
    picks,
    onPicksChange,
    tree,
    members,
    idPrefix,
    locale,
    currency,
    estimateItems,
    isPending,
    errorLineId,
    onAddOwn,
    ownAllowed,
    showParentless = true,
    disabled,
  } = props
  const verdict = verdicts[parentLineId]
  const depth = depthOf(parentLineId, tree, picks)
  const all = [...(verdict?.offers ?? [])]
    .filter((o) => showParentless || o.parent_product_id != null)
    // While the party changed and the answer is in flight: hide what this
    // party plainly fails (never show more than the server did).
    .filter((o) => !isPending || instantGate(o.rules, members))
    .sort((a, b) => a.sort_order - b.sort_order)
  const info = all.filter((o) => o.mode === 'info')
  const own = all.filter(
    (o) => o.mode !== 'info' && effectiveSchedule(o) === 'own' && !o.in_cart && (ownAllowed?.(o) ?? true),
  )
  const rows = all.filter((o) => o.mode !== 'info' && effectiveSchedule(o) !== 'own')
  if (info.length === 0 && rows.length === 0 && (own.length === 0 || !onAddOwn)) return null
  const parentDays = lineDays(parentLineId, tree, picks)

  return (
    <div
      data-testid={`offer-tree-${parentLineId}`}
      aria-busy={isPending ? true : undefined}
      className={`space-y-2 ${depth > 0 ? 'ml-4 border-l border-border pl-3' : ''}`}
    >
      {rows.map((offer) => {
        const pick = picks.find((p) => p.offerId === offer.id && p.parentLineId === parentLineId)
        const serverLines =
          offer.mode === 'mandatory' && offer.binding === 'person'
            ? (estimateItems ?? []).filter(
                (li) => li.auto_attached && li.product_id === offer.product_id,
              )
            : undefined
        const estimate = pick ? estimateLinesFor(pick.lineId, estimateItems) : serverLines
        return (
          <div key={offer.id} className="space-y-2">
            <OfferRow
              offer={offer}
              parentLineId={parentLineId}
              parentDays={parentDays}
              pick={pick}
              members={members}
              tree={tree}
              idPrefix={idPrefix}
              onPicksChange={onPicksChange}
              locale={locale}
              currency={currency}
              estimate={estimate && estimate.length > 0 ? estimate : undefined}
              hasError={
                !!errorLineId &&
                !!pick &&
                (errorLineId === pick.lineId || errorLineId.startsWith(`${pick.lineId}-`))
              }
              disabled={disabled}
            />
            {pick && depth + 2 <= MAX_OFFER_DEPTH ? (
              <OfferTree {...props} parentLineId={pick.lineId} showParentless={false} />
            ) : null}
          </div>
        )
      })}
      {own.length > 0 && onAddOwn ? (
        <ul className="flex flex-wrap gap-2">
          {own.map((o) => (
            <li key={o.id}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                data-testid={`add-more-candidate-${o.product_id}`}
                onClick={() => onAddOwn(o, parentLineId)}
              >
                + {pickLocalized(o.name, o.name_localized, locale)}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <IncludedList offers={info} locale={locale} />
    </div>
  )
}
