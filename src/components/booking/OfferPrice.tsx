/** The price of an offer row: "€40.00", "€20.00 · Pay on arrival" or "Free". */
import type { EstimateLineItem, EvaluatedOffer } from '@/api/types'
import { priceLabel } from './offerCart'

interface Props {
  offer: Pick<EvaluatedOffer, 'collection' | 'price_preview'>
  locale: string
  /** The estimate lines this pick produced, once it is priced. */
  estimate?: readonly EstimateLineItem[]
  currency?: string
}

export function OfferPrice({ offer, locale, estimate, currency }: Props) {
  const { text, tone } = priceLabel(offer, locale, estimate, currency)
  return (
    <span
      data-testid="offer-price"
      data-tone={tone}
      className={`text-sm whitespace-nowrap ${tone === 'free' ? 'text-success' : tone === 'tbd' ? 'text-muted-foreground' : 'font-medium'}`}
    >
      {text}
    </span>
  )
}
