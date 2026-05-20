import type { Product } from '@/api/types'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StepBackButton } from './StepBackButton'

interface Props {
  product: Product
  onBack: () => void
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

/**
 * Rendered when product.product_kind ∈ {digital_good, physical_good, gift_card}.
 *
 * The booking widget does not (yet) take checkout for shop kinds — the Landr
 * Shop surface is on the roadmap but not built. Until then, render a polite
 * stub asking the customer to contact the operator directly (landr-y9k).
 */
export function ShopComingSoonStub({ product, onBack }: Props) {
  const kindLabel = KIND_LABEL[product.product_kind] ?? 'product'
  return (
    <Card data-testid="shop-coming-soon-stub">
      <StepBackButton onBack={onBack} label="Back to products" />
      <CardHeader>
        <CardTitle>{product.name}</CardTitle>
        <CardDescription>
          This {kindLabel} is sold in our Shop, which is coming soon. Please
          contact the operator directly to order it in the meantime.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
