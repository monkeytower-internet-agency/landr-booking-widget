/** Info offers: what the booking includes, a plain list without controls. */
import type { EvaluatedOffer } from '@/api/types'
import { pickLocalized } from '@/lib/locale'
import { tr } from '@/lib/strings'

interface Props {
  offers: readonly EvaluatedOffer[]
  locale: string
}

export function IncludedList({ offers, locale }: Props) {
  if (offers.length === 0) return null
  return (
    <div data-testid="offer-included" className="space-y-1">
      <h4 className="text-sm font-medium">{tr('offerIncludedTitle', locale)}</h4>
      <ul className="space-y-0.5 text-sm text-muted-foreground">
        {offers.map((o) => {
          const blurb = pickLocalized(o.short_description, o.short_description_localized, locale)
          return (
            <li key={o.id} data-testid={`offer-included-${o.id}`}>
              <span className="text-foreground">✓ {pickLocalized(o.name, o.name_localized, locale)}</span>
              {blurb ? <span> · {blurb}</span> : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
