/**
 * Who a per-person offer is for: one toggle per guest, and one option select
 * per ticked guest when the offer has options.
 */
import type { OfferOption, OfferPricePreview } from '@/api/types'
import { fmt, tr } from '@/lib/strings'
import { ToggleChip } from './ToggleChip'
import { optionLabel, type PartyMember } from './offerCart'

interface Props {
  offerId: string
  members: readonly PartyMember[]
  /** Member keys ticked. */
  ticked: readonly string[]
  /** Member keys the offer's rules admit (others are shown disabled). */
  admitted: ReadonlySet<string>
  options: readonly OfferOption[]
  /** The offer's price preview (a free base shows absolute option prices). */
  base?: OfferPricePreview | null
  picked: Readonly<Record<string, string>>
  currency: string
  locale: string
  disabled?: boolean
  /** The option selects' own disabled state (default: `disabled`). */
  optionsDisabled?: boolean
  /** The option is optional: an explicit 'no option' entry stays, so a choice can be cleared. */
  optionalOption?: boolean
  onToggle: (memberKey: string) => void
  onOption: (memberKey: string, optionKey: string) => void
}

export function PersonTickList({
  offerId,
  members,
  ticked,
  admitted,
  options,
  base,
  picked,
  currency,
  locale,
  disabled,
  optionsDisabled = disabled,
  optionalOption = false,
  onToggle,
  onOption,
}: Props) {
  return (
    <fieldset className="space-y-1" data-testid={`offer-who-${offerId}`}>
      <legend className="text-xs text-muted-foreground">{tr('offerWhoTitle', locale)}</legend>
      {members.map((m) => {
        const on = ticked.includes(m.key)
        const ok = admitted.has(m.key)
        return (
          <div key={m.key} className="flex flex-wrap items-center gap-2 text-sm">
            <ToggleChip
              on={on}
              data-testid={`offer-who-${offerId}-${m.ref}`}
              disabled={disabled || (!ok && !on)}
              onToggle={() => onToggle(m.key)}
              className={ok ? '' : 'opacity-50'}
            >
              {m.name}
            </ToggleChip>
            {on && options.length > 0 ? (
              <select
                aria-label={fmt(tr('offerOptionForTemplate', locale), { name: m.name })}
                data-testid={`offer-option-${offerId}-${m.ref}`}
                className="rounded border border-border px-2 py-0.5 text-sm"
                value={picked[m.key] ?? ''}
                disabled={optionsDisabled}
                onChange={(e) => (optionalOption || e.target.value) && onOption(m.key, e.target.value)}
              >
                {optionalOption ? (
                  <option value="">{tr('offerNoOption', locale)}</option>
                ) : picked[m.key] ? null : (
                  <option value="">{tr('offerOptionPlaceholder', locale)}</option>
                )}
                {options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {optionLabel(o, currency, locale, base)}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        )
      })}
    </fieldset>
  )
}
