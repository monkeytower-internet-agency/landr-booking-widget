/** The days of a day-pick offer: one chip per day of its parent, a full day disabled. */
import { tr } from '@/lib/strings'
import { formatDayLabel } from './dateLabel'
import { isDayFull, type DayStock } from './offerCart'

interface Props {
  offerId: string
  productId: string
  parentDays: readonly string[]
  picked: readonly string[]
  stock: DayStock | null
  locale: string
  disabled?: boolean
  onToggle: (day: string) => void
}

export function SubsetDayChips({
  offerId,
  productId,
  parentDays,
  picked,
  stock,
  locale,
  disabled,
  onToggle,
}: Props) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{tr('offerPickDays', locale)}</span>
      <div className="flex flex-wrap gap-1.5" role="group" data-testid={`offer-days-${offerId}`}>
        {parentDays.map((d) => {
          const on = picked.includes(d)
          const full = isDayFull(stock, productId, d)
          return (
            <button
              key={d}
              type="button"
              data-testid={`offer-day-${offerId}-${d}`}
              aria-pressed={on}
              aria-label={full ? `${formatDayLabel(d, locale)}: ${tr('addonSoldOut', locale)}` : formatDayLabel(d, locale)}
              disabled={disabled || (full && !on) || (on && picked.length === 1)}
              onClick={() => onToggle(d)}
              className={`rounded-full border px-2 py-0.5 text-sm ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border'} ${full ? 'line-through opacity-50' : ''}`}
            >
              {formatDayLabel(d, locale)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
