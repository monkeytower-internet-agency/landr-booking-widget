import type { Product } from '@/api/types'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { browserLocale } from '@/lib/locale'
import { shopComingSoonBody, tr, type Bundle } from '@/lib/strings'
import { StepBackButton } from './StepBackButton'

interface Props {
  product: Product
  /** Absent → no Back affordance (landr-6eita.1: start=dates entry). */
  onBack?: () => void
}

// landr-8r6oc.18: the kind nouns live in the language catalog (Bundle.shopKind*),
// so catalogs.test.ts enforces them for every language. The coming-soon template
// treats the kind as a parenthetical label rather than a grammatical subject
// (landr-5aih0.17), so a flat noun table needs no der/die/das.
// hotel_room is sold via AccommodationStep, not the main catalogue; if it ever
// falls through here something upstream went wrong, so it still gets a polite
// label rather than 'undefined'.
const KIND_LABEL_KEY: Record<NonNullable<Product['product_kind']>, keyof Bundle> = {
  service: 'shopKindService',
  hotel_room: 'shopKindHotelRoom',
  subscription: 'shopKindSubscription',
  digital_good: 'shopKindDigitalGood',
  physical_good: 'shopKindPhysicalGood',
  gift_card: 'shopKindGiftCard',
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
  const labelKey = KIND_LABEL_KEY[product.product_kind]
  const kindLabel = tr(labelKey ?? 'shopKindFallback', locale)
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
