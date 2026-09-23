import type { Product } from '@/api/types'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { browserLocale } from '@/lib/locale'
import { isGermanLocale, shopComingSoonBody, tr } from '@/lib/strings'
import { StepBackButton } from './StepBackButton'

interface Props {
  product: Product
  /** Absent → no Back affordance (landr-6eita.1: start=dates entry). */
  onBack?: () => void
}

const KIND_LABEL: Record<NonNullable<Product['product_kind']>, string> = {
  service: 'service',
  // hotel_room is sold via AccommodationStep, not the main catalogue —
  // if it ever falls through here something upstream went wrong, so we
  // still render a polite-but-useful label rather than 'undefined'.
  hotel_room: 'hotel room',
  subscription: 'subscription',
  digital_good: 'digital product',
  physical_good: 'physical product',
  gift_card: 'gift card',
}

// landr-5aih0.17: German nouns for the same kinds carry different genders
// (der/die/das), which a single {kind}-substitution template can't agree
// with grammatically — shopComingSoonBodyTemplate sidesteps that by
// treating the kind as a parenthetical label ("Diese Art von Produkt
// ({kind})…") rather than a grammatical subject, so a flat translation
// table (no der/die/das needed) is enough here.
const KIND_LABEL_DE: Record<NonNullable<Product['product_kind']>, string> = {
  service: 'Leistung',
  hotel_room: 'Hotelzimmer',
  subscription: 'Abonnement',
  digital_good: 'digitales Produkt',
  physical_good: 'physisches Produkt',
  gift_card: 'Geschenkkarte',
}

/**
 * Rendered when product.product_kind ∈ {digital_good, physical_good, gift_card}.
 *
 * The booking widget does not (yet) take checkout for shop kinds — the Landr
 * Shop surface is on the roadmap but not built. Until then, render a polite
 * stub asking the customer to contact the operator directly (landr-y9k).
 */
export function ShopComingSoonStub({ product, onBack }: Props) {
  const locale = browserLocale()
  const kindLabel = isGermanLocale(locale)
    ? (KIND_LABEL_DE[product.product_kind] ?? 'Produkt')
    : (KIND_LABEL[product.product_kind] ?? 'product')
  return (
    <Card data-testid="shop-coming-soon-stub">
      <StepBackButton onBack={onBack} label={tr('backToProductsLabel', locale)} />
      <CardHeader>
        <CardTitle>{product.name}</CardTitle>
        <CardDescription>{shopComingSoonBody(kindLabel, locale)}</CardDescription>
      </CardHeader>
    </Card>
  )
}
