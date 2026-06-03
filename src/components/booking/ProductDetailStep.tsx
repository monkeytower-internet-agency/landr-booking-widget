/**
 * landr-d8rg.4: Product detail page stub.
 *
 * STUB — later slice (landr-d8rg.7) replaces internals with the full
 * gallery, facts panel, sticky Book CTA, and variant-aware layout.
 * Props are FINALIZED here; do NOT change the component signature in
 * downstream slices.
 *
 * Props:
 *   product — the product to display.
 *   onBook  — called when the customer taps the "Book" CTA. App.tsx
 *             transitions to pick-selection for this product.
 *   onBack  — called when the customer taps "Back". App.tsx routes back
 *             to pick-product (scoped list) or pick-category per the
 *             back-nav rules in App.tsx.
 *
 * Markup is intentionally minimal — a name, short description, and two
 * buttons. Downstream slices add gallery, price_from chip, variant tokens
 * and the sticky CTA bar without touching App.tsx or appStepMachine.ts.
 */

import type { Product } from '@/api/types'
import { browserLocale, pickLocalized } from '@/lib/locale'

export interface ProductDetailStepProps {
  product: Product
  onBook: () => void
  onBack: () => void
}

export function ProductDetailStep({
  product,
  onBook,
  onBack,
}: ProductDetailStepProps) {
  const locale = browserLocale()
  const name = pickLocalized(product.name, product.name_localized, locale)
  const description = pickLocalized(
    product.short_description,
    product.short_description_localized,
    locale,
  )

  return (
    <div className="flex flex-col gap-4" data-testid="product-detail-step">
      <button
        type="button"
        className="text-primary text-sm underline-offset-2 hover:underline self-start"
        onClick={onBack}
        data-testid="step-back-button"
      >
        ← Back
      </button>

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">{name}</h2>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>

      <button
        type="button"
        className="bg-primary text-primary-foreground rounded-md px-6 py-3 font-semibold hover:opacity-90 transition-opacity self-start"
        onClick={onBook}
        data-testid="product-detail-book-cta"
      >
        Book
      </button>
    </div>
  )
}
