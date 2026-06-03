/**
 * landr-d8rg.7: Product detail page — the page that convinces the customer
 * to book. Replaces the landr-d8rg.4 stub; the props are FINAL (do NOT
 * change the signature — App.tsx wires Book → the existing pick-selection
 * flow and Back → the back-nav rules unchanged).
 *
 * Layout:
 *   - Top-left "← Back" affordance.
 *   - Hero gallery (ProductGallery): first images[].hero_url, else the
 *     designed ProductArt fallback; thumbnail strip when >1 image.
 *   - Name + full Markdown description (same ReactMarkdown pipeline +
 *     sanitisation classes ProductList uses today) + facts chips.
 *   - "from €X" price (hidden when price_from is null) + a prominent
 *     Book Now CTA. The CTA is in-flow on desktop and a fixed sticky bar
 *     on mobile (mirrors PriceSidebar's mobile fixed-bar + h-16 spacer
 *     pattern so it never covers the last bit of content).
 *   - Sold-out (bookable === false): reuse FullyBookedNotice, no Book CTA.
 *
 * Variant-aware hero treatment is handled inside ProductGallery (aurora
 * overlays the title on the hero; summit/alpine render the heading below
 * the hero — so this component hides its own <h2> for aurora to avoid a
 * duplicate title).
 */
import ReactMarkdown from 'react-markdown'
import type { Product } from '@/api/types'
import { Button } from '@/components/ui/button'
import { browserLocale, pickLocalized } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { useVariant } from '@/lib/variant'
import { isBookable } from '@/components/booking/bookability'
import { FullyBookedNotice } from '@/components/booking/FullyBookedNotice'
import { ProductGallery } from '@/components/booking/detail/ProductGallery'
import { ProductFacts } from '@/components/booking/detail/ProductFacts'
import { formatPriceFrom } from '@/components/booking/detail/priceFromLabel'

export interface ProductDetailStepProps {
  product: Product
  onBook: () => void
  onBack: () => void
}

/**
 * Markdown prose classes — kept byte-identical to ProductList's
 * description CardContent so the detail page renders operator copy the
 * exact same way (same heading scale, list indent, link colour). React
 * Markdown does not render raw HTML by default, which is our sanitisation
 * story (no rehype-raw is wired anywhere in the widget).
 */
const PROSE_CLASSES =
  'text-sm text-foreground [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-medium [&_p]:mb-2 [&_p]:leading-relaxed last:[&_p]:mb-0 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_a]:text-primary [&_a]:underline'

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      className="self-start text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
      onClick={onBack}
      data-testid="step-back-button"
    >
      ← Back
    </button>
  )
}

export function ProductDetailStep({
  product,
  onBook,
  onBack,
}: ProductDetailStepProps) {
  const { variant, tokens } = useVariant()
  const locale = browserLocale()
  const name = pickLocalized(product.name, product.name_localized, locale)
  const bookable = isBookable(product)
  const priceLabel = formatPriceFrom(product.price_from, product.currency)
  const images = product.images ?? []

  // aurora overlays the title on the hero (ProductGallery) — so we hide
  // the standalone heading there to avoid showing the name twice. summit
  // and alpine render the heading below the hero.
  const headingBelowHero = variant !== 'aurora'

  // Sold-out: surface the product as "Fully booked" (no Book CTA). The
  // gallery + description still render above so the customer sees what
  // they're missing and can check back later. FullyBookedNotice carries
  // its own back affordance when onBack is supplied.
  if (!bookable) {
    return (
      <div className="flex flex-col gap-4" data-testid="product-detail-step">
        <ProductGallery images={images} seed={product.slug} name={name} />
        {product.description ? (
          <div className={PROSE_CLASSES}>
            <ReactMarkdown>{product.description}</ReactMarkdown>
          </div>
        ) : null}
        <ProductFacts product={product} />
        <FullyBookedNotice
          name={name}
          description={pickLocalized(
            product.short_description,
            product.short_description_localized,
            locale,
          ) || null}
          onBack={onBack}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4" data-testid="product-detail-step">
      <BackLink onBack={onBack} />

      <ProductGallery images={images} seed={product.slug} name={name} />

      {headingBelowHero ? (
        <h2
          className={cn('text-2xl sm:text-3xl', tokens.typeAccent)}
          data-testid="product-detail-name"
        >
          {name}
        </h2>
      ) : null}

      <ProductFacts product={product} />

      {product.description ? (
        <div className={PROSE_CLASSES} data-testid="product-detail-description">
          <ReactMarkdown>{product.description}</ReactMarkdown>
        </div>
      ) : null}

      {/* Desktop price + CTA — in-flow at the bottom of the content. */}
      <div
        className="mt-2 hidden items-center justify-between gap-4 border-t pt-4 md:flex"
        data-testid="product-detail-cta-desktop"
      >
        {priceLabel ? (
          <span
            className="text-lg font-semibold tabular-nums"
            data-testid="product-detail-price"
          >
            {priceLabel}
          </span>
        ) : (
          <span />
        )}
        <Button
          type="button"
          size="lg"
          onClick={onBook}
          data-testid="product-detail-book-cta"
          className="px-8 font-semibold"
        >
          Book now
        </Button>
      </div>

      {/* Mobile sticky bottom bar — mirrors PriceSidebar's fixed-bar
          pattern (fixed inset-x-0 bottom-0 + a matching h-16 spacer below
          so the bar never covers the last bit of content). */}
      <div
        data-testid="product-detail-cta-mobile"
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t bg-card px-4 py-3 shadow-lg md:hidden"
      >
        {priceLabel ? (
          <span
            className="text-base font-semibold tabular-nums"
            data-testid="product-detail-price-mobile"
          >
            {priceLabel}
          </span>
        ) : (
          <span />
        )}
        <Button
          type="button"
          onClick={onBook}
          data-testid="product-detail-book-cta-mobile"
          className="flex-1 font-semibold"
        >
          Book now
        </Button>
      </div>
      {/* Spacer so the mobile fixed bar never covers the content above. */}
      <div aria-hidden className="h-16 md:hidden" />
    </div>
  )
}
