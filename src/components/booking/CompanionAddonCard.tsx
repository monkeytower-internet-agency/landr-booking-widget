import { Button } from '@/components/ui/button'
import type { ProductAddon } from '@/api/types'
import { pickLocalized } from '@/lib/locale'
import { qtyAdjustAriaLabel, tr } from '@/lib/strings'
import { formatCurrency } from './accommodationCalc'
import {
  addonStockCeiling,
  isCompanionDayFull,
  type CompanionDayStock,
} from './addonsState'
import { formatDayLabel } from './dateLabel'

/** Show the "only N left" hint at or below this many. */
const LOW_STOCK_HINT_MAX = 3

/**
 * landr-a27k9.2: the card of a companion add-on (day_selection =
 * 'parent_subset', e.g. a city bike): picture, name, short description, the
 * price per day, one chip per day of the parent (the stay's nights / the
 * activity's days) and a quantity stepper.
 *
 * Stateless. `addon` is already the companion view (stock judged on the
 * picked days only -- see companionView) so the stepper stops at
 * min(party size, lowest remaining across the picked days). A day with no
 * stock left is a disabled chip.
 */
interface Props {
  addon: ProductAddon
  quantity: number
  /** The days picked (already trimmed to the parent's days). */
  pickedDays: readonly string[]
  parentDays: readonly string[]
  stock: CompanionDayStock | null
  /** Most the stepper may reach (rule / max / party size), Infinity = none. */
  ceiling: number
  locale: string
  onBump: (delta: number) => void
  onToggleDay: (day: string) => void
}

export function CompanionAddonCard({
  addon,
  quantity,
  pickedDays,
  parentDays,
  stock,
  ceiling,
  locale,
  onBump,
  onToggleDay,
}: Props) {
  const name = pickLocalized(addon.name, addon.name_localized, locale)
  const description = addon.short_description
    ? pickLocalized(addon.short_description, addon.short_description_localized ?? null, locale)
    : null
  const image = addon.images?.[0]
  const imageUrl = image?.thumb_url ?? addon.thumb_url ?? null
  const picked = new Set(pickedDays)
  const stockCeiling = addonStockCeiling(addon)
  const atMax = quantity >= ceiling
  const needsDay = quantity > 0 && pickedDays.length === 0

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-border bg-surface-well p-2 shadow-well"
      data-testid={`addon-row-${addon.addon_product_id}`}
    >
      <div
        className={
          'grid items-start gap-2 ' + (imageUrl ? 'grid-cols-[auto_1fr_auto]' : 'grid-cols-[1fr_auto]')
        }
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={image?.alt ?? name}
            loading="lazy"
            className="h-16 w-16 rounded-md object-cover"
            data-testid={`addon-image-${addon.addon_product_id}`}
          />
        ) : null}
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{name}</span>
          {description ? (
            <span className="text-xs text-muted-foreground">{description}</span>
          ) : null}
          {addon.price_per_unit ? (
            <span
              className="text-xs text-muted-foreground"
              data-testid={`addon-day-price-${addon.addon_product_id}`}
            >
              {formatCurrency(Number(addon.price_per_unit), addon.currency, locale)}{' '}
              {tr('companionPerDaySuffix', locale)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{tr('priceOnRequest', locale)}</span>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-full bg-surface-raised p-1 shadow-elev-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="tap-44 rounded-full bg-primary/10 text-foreground hover:bg-primary/20"
            disabled={quantity <= 0}
            onClick={() => onBump(-1)}
            aria-label={qtyAdjustAriaLabel('decrease', name, locale)}
          >
            −
          </Button>
          <span className="w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">
            {quantity}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="tap-44 rounded-full bg-primary/10 text-foreground hover:bg-primary/20"
            disabled={atMax}
            onClick={() => onBump(1)}
            aria-label={qtyAdjustAriaLabel('increase', name, locale)}
          >
            +
          </Button>
        </div>
      </div>
      <div
        role="group"
        aria-label={tr('companionDaysAriaTemplate', locale).replace('{item}', name)}
        className="flex flex-wrap gap-1.5"
        data-testid={`addon-days-${addon.addon_product_id}`}
      >
        {parentDays.map((day) => {
          const full = isCompanionDayFull(stock, addon.addon_product_id, day)
          const on = picked.has(day)
          return (
            <button
              key={day}
              type="button"
              disabled={full && !on}
              aria-pressed={on}
              title={full ? tr('companionDayFull', locale) : undefined}
              onClick={() => onToggleDay(day)}
              data-testid={`addon-day-${addon.addon_product_id}-${day}`}
              className={
                'tap-44 rounded-full border px-3 text-xs font-medium transition-colors ' +
                (on
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-surface-raised text-foreground hover:bg-primary/10') +
                (full ? ' cursor-not-allowed opacity-40 line-through' : '')
              }
            >
              {formatDayLabel(day, locale)}
            </button>
          )
        })}
      </div>
      {needsDay ? (
        <p
          className="text-xs text-destructive"
          data-testid={`addon-days-required-${addon.addon_product_id}`}
        >
          {tr('companionDaysRequired', locale)}
        </p>
      ) : null}
      {pickedDays.length > 0 && stockCeiling === 0 ? (
        <p
          className="text-xs text-destructive"
          data-testid={`addon-sold-out-${addon.addon_product_id}`}
        >
          {tr('companionPickedDaySoldOut', locale)}
        </p>
      ) : null}
      {pickedDays.length > 0 &&
      stockCeiling > 0 &&
      Number.isFinite(stockCeiling) &&
      stockCeiling <= LOW_STOCK_HINT_MAX ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid={`addon-stock-left-${addon.addon_product_id}`}
        >
          {tr('addonStockLeftTemplate', locale).replace('{n}', String(stockCeiling))}
        </p>
      ) : null}
    </div>
  )
}
