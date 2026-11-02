/**
 * One offer of a cart line: who it is for (binding), whose days (schedule),
 * whether it may be left out (mode) and how it is paid (collection).
 *
 *  - person   a tick per guest (+ an option per ticked guest);
 *  - booking  one toggle for the booking (+ an option);
 *  - free     a quantity stepper;
 *  - locked   the parent's period, read-only; subset: day chips inside it.
 *
 * A mandatory offer starts picked and cannot be removed; a mandatory
 * per-person one is attached by the server and only names its guests.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { EstimateLineItem, EvaluatedOffer } from '@/api/types'
import { Button } from '@/components/ui/button'
import { pickLocalized } from '@/lib/locale'
import { fmt, tr } from '@/lib/strings'
import { useCompanionDayStock } from './companionStock'
import { formatDayLabel } from './dateLabel'
import {
  addPick,
  admittedMembers,
  clampOfferQty,
  isOfferSoldOut,
  missingOption,
  newPick,
  nextLineId,
  offerStockCeiling,
  offerUnavailableMessage,
  optionLabel,
  removeLine,
  setOption,
  setQuantity,
  togglePerson,
  toggleSubsetDay,
  treeLineIds,
  WHOLE_BOOKING,
  type OfferPick,
  type OfferTreeInput,
  type PartyMember,
} from './offerCart'
import { OfferPrice } from './OfferPrice'
import { PersonTickList } from './PersonTickList'
import { SubsetDayChips } from './SubsetDayChips'

/** Show "Only {n} left" at or below this many. */
const LOW_STOCK = 5

interface Props {
  offer: EvaluatedOffer
  parentLineId: string
  parentDays: readonly string[]
  pick: OfferPick | undefined
  members: readonly PartyMember[]
  tree: OfferTreeInput
  /** Pick ids this surface mints: `o` (review) / `a` (accommodation). */
  idPrefix: string
  onPicksChange: Dispatch<SetStateAction<OfferPick[]>>
  locale: string
  currency: string
  /** The estimate lines of this pick (or the server's attached lines of this offer). */
  estimate?: readonly EstimateLineItem[]
  /** The submit refused this line: highlighted and scrolled to. */
  hasError?: boolean
  disabled?: boolean
}

export function OfferRow({
  offer,
  parentLineId,
  parentDays,
  pick,
  members,
  tree,
  idPrefix,
  onPicksChange,
  locale,
  currency,
  estimate,
  hasError,
  disabled,
}: Props) {
  const mandatory = offer.mode === 'mandatory'
  const readOnlyPerson = mandatory && offer.binding === 'person'
  const serverAttached = readOnlyPerson && offer.server_attached !== false
  const subset = (pick?.schedule ?? offer.schedule) === 'subset' || offer.day_selection === 'parent_subset'
  const soldOut = !pick && isOfferSoldOut(offer)
  const off = disabled || soldOut
  const admitted = admittedMembers(offer, members)
  const admittedKeys = new Set(admitted.map((m) => m.key))
  const name = pickLocalized(offer.name, offer.name_localized, locale)
  const blurb = pickLocalized(offer.short_description, offer.short_description_localized, locale)
  const options = offer.options ?? []
  const dayStock = useCompanionDayStock(
    offer.parent_product_id ?? undefined,
    parentDays,
    members.length,
    subset && !!pick,
  )

  const withPick = (prev: OfferPick[], patch?: (p: OfferPick) => OfferPick): OfferPick[] => {
    if (prev.some((p) => p.lineId === pick?.lineId)) return prev
    const id = nextLineId(idPrefix, treeLineIds(tree, prev))
    const fresh = newPick(offer, parentLineId, id, parentDays)
    return addPick(prev, patch ? patch(fresh) : fresh, tree)
  }

  const onToggleBooking = () =>
    onPicksChange((prev) => (pick ? (mandatory ? prev : removeLine(prev, pick.lineId)) : withPick(prev)))
  const onTogglePerson = (key: string) =>
    onPicksChange((prev) =>
      pick
        ? togglePerson(prev, pick.lineId, key)
        : withPick(prev, (p) => ({ ...p, memberIds: [key] })),
    )
  const onOption = (who: string, key: string) =>
    onPicksChange((prev) => {
      const ensured = withPick(prev)
      const id = pick?.lineId ?? ensured.find((p) => p.offerId === offer.id && p.parentLineId === parentLineId)?.lineId
      return id ? setOption(ensured, id, who, key) : ensured
    })
  const onQuantity = (q: number) =>
    onPicksChange((prev) =>
      pick
        ? setQuantity(prev, pick.lineId, q)
        : q > 0
          ? withPick(prev, (p) => ({ ...p, quantity: clampOfferQty(offer, q) }))
          : prev,
    )
  const onDay = (day: string) =>
    onPicksChange((prev) => (pick ? toggleSubsetDay(prev, pick.lineId, day, parentDays) : prev))

  const qty = pick?.quantity ?? 0
  const maxQty = Math.min(offer.max_qty ?? Number.POSITIVE_INFINITY, offerStockCeiling(offer))
  const remaining = offer.stock?.stock_remaining
  const autoRefs = serverAttached
    ? (estimate ?? []).filter((li) => li.auto_attached).flatMap((li) => li.participant_ids ?? [])
    : []
  const autoNames = serverAttached
    ? (autoRefs.length > 0
        ? members.filter((m) => autoRefs.includes(m.ref))
        : admitted
      ).map((m) => m.name)
    : readOnlyPerson && pick
      ? members.filter((m) => pick.memberIds.includes(m.key)).map((m) => m.name)
      : []

  return (
    <div
      data-testid={`offer-row-${offer.id}`}
      data-offer-product={offer.product_id}
      data-line-id={pick?.lineId}
      data-error={hasError ? 'true' : undefined}
      className={`space-y-2 rounded-md border p-3 ${hasError ? 'border-destructive' : 'border-border'} ${soldOut ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium">{name}</span>
          {mandatory ? (
            <span
              data-testid="offer-mandatory-badge"
              className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {tr('offerMandatoryBadge', locale)}
            </span>
          ) : null}
          {blurb ? <p className="text-xs text-muted-foreground">{blurb}</p> : null}
        </div>
        <OfferPrice offer={offer} locale={locale} estimate={estimate} currency={currency} />
      </div>

      {readOnlyPerson ? (
        autoNames.length > 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="offer-auto-for">
            {fmt(tr('offerAutoFor', locale), { names: autoNames.join(', ') })}
          </p>
        ) : null
      ) : offer.binding === 'person' ? (
        <PersonTickList
          offerId={offer.id}
          members={members}
          ticked={pick?.memberIds ?? []}
          admitted={admittedKeys}
          options={options}
          picked={pick?.options ?? {}}
          currency={currency}
          locale={locale}
          disabled={off}
          onToggle={onTogglePerson}
          onOption={onOption}
        />
      ) : offer.binding === 'booking' ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              data-testid={`offer-toggle-${offer.id}`}
              checked={!!pick}
              disabled={off || (mandatory && !!pick)}
              onChange={onToggleBooking}
            />
            {tr('offerAddToBooking', locale)}
          </label>
          {options.length > 0 && (pick || mandatory) ? (
            <select
              data-testid={`offer-option-${offer.id}`}
              aria-label={name}
              className="rounded border border-border px-2 py-0.5 text-sm"
              value={pick?.options[WHOLE_BOOKING] ?? ''}
              disabled={off}
              onChange={(e) => e.target.value && onOption(WHOLE_BOOKING, e.target.value)}
            >
              {pick?.options[WHOLE_BOOKING] ? null : (
                <option value="">{tr('offerOptionPlaceholder', locale)}</option>
              )}
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {optionLabel(o, currency, locale)}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <span>{tr('offerQuantity', locale)}</span>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="−"
            data-testid={`offer-qty-minus-${offer.id}`}
            disabled={off || qty <= (mandatory ? Math.max(1, offer.min_qty) : 0)}
            onClick={() => onQuantity(qty - 1 < offer.min_qty ? 0 : qty - 1)}
          >
            −
          </Button>
          <span data-testid={`offer-qty-${offer.id}`}>{qty}</span>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="+"
            data-testid={`offer-qty-plus-${offer.id}`}
            disabled={off || qty >= maxQty}
            onClick={() => onQuantity(Math.max(qty + 1, offer.min_qty))}
          >
            +
          </Button>
        </div>
      )}

      {pick && subset ? (
        <SubsetDayChips
          offerId={offer.id}
          productId={offer.product_id}
          parentDays={parentDays}
          picked={pick.days}
          stock={dayStock}
          locale={locale}
          disabled={disabled}
          onToggle={onDay}
        />
      ) : (pick || serverAttached) && parentDays.length > 0 && offer.schedule === 'locked' ? (
        <p className="text-xs text-muted-foreground" data-testid={`offer-period-${offer.id}`}>
          {fmt(tr('offerPeriodLocked', locale), {
            period:
              parentDays.length > 1
                ? `${formatDayLabel(parentDays[0]!, locale)} – ${formatDayLabel(parentDays[parentDays.length - 1]!, locale)}`
                : formatDayLabel(parentDays[0]!, locale),
          })}
        </p>
      ) : null}

      {soldOut ? (
        <p className="text-sm text-destructive">{offerUnavailableMessage(offer, locale)}</p>
      ) : typeof remaining === 'number' && remaining > 0 && remaining <= LOW_STOCK ? (
        <p className="text-xs text-muted-foreground">
          {fmt(tr('addonStockLeftTemplate', locale), { n: remaining })}
        </p>
      ) : null}
      {pick && missingOption(pick) ? (
        <p className="text-sm text-destructive" data-testid={`offer-option-required-${offer.id}`}>
          {tr('offerOptionRequired', locale)}
        </p>
      ) : null}
    </div>
  )
}
