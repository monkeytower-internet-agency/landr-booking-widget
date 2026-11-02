/**
 * Who a per-person offer is for: one tick per guest, and one option select
 * per ticked guest when the offer has options.
 */
import type { OfferOption } from '@/api/types'
import { fmt, tr } from '@/lib/strings'
import { optionLabel, type PartyMember } from './offerCart'

interface Props {
  offerId: string
  members: readonly PartyMember[]
  /** Member keys ticked. */
  ticked: readonly string[]
  /** Member keys the offer's rules admit (others are shown disabled). */
  admitted: ReadonlySet<string>
  options: readonly OfferOption[]
  picked: Readonly<Record<string, string>>
  currency: string
  locale: string
  disabled?: boolean
  onToggle: (memberKey: string) => void
  onOption: (memberKey: string, optionKey: string) => void
}

export function PersonTickList({
  offerId,
  members,
  ticked,
  admitted,
  options,
  picked,
  currency,
  locale,
  disabled,
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
            <label className={`flex items-center gap-2 ${ok ? '' : 'opacity-50'}`}>
              <input
                type="checkbox"
                data-testid={`offer-who-${offerId}-${m.ref}`}
                checked={on}
                disabled={disabled || (!ok && !on)}
                onChange={() => onToggle(m.key)}
              />
              {m.name}
            </label>
            {on && options.length > 0 ? (
              <select
                aria-label={fmt(tr('offerOptionForTemplate', locale), { name: m.name })}
                data-testid={`offer-option-${offerId}-${m.ref}`}
                className="rounded border border-border px-2 py-0.5 text-sm"
                value={picked[m.key] ?? ''}
                disabled={disabled}
                onChange={(e) => e.target.value && onOption(m.key, e.target.value)}
              >
                {picked[m.key] ? null : <option value="">{tr('offerOptionPlaceholder', locale)}</option>}
                {options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {optionLabel(o, currency, locale)}
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
