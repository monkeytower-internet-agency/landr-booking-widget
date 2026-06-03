/**
 * landr-d8rg.7: hero gallery for the product-detail page.
 *
 * - Hero: the selected image's hero_url when the product has imagery;
 *   otherwise the designed ProductArt SVG fallback (16:9). The hero frame
 *   itself is VARIANT-AWARE via the heroTreatment token (aspect + radius +
 *   border), so each direction gets its own framing.
 * - Thumbnail strip: rendered only when the product has MORE THAN ONE
 *   image. Each thumb is a real <button> (keyboard accessible, focus
 *   ring), and the active thumb carries a primary selection ring. Clicking
 *   a thumb swaps the hero. No external lightbox dependency — pure state.
 * - Alt text: per-image `alt` when the operator supplied one, else the
 *   product name (so the hero is never unlabelled).
 *
 * Variant title treatment (aurora only): aurora overlays the product name
 * on the hero with a gradient scrim for the immersive look. summit and
 * alpine render the title BELOW the hero (handled by ProductDetailStep),
 * so this component renders no overlay for them — it reports back which
 * mode it used via `titleRendered` is not needed; ProductDetailStep keys
 * off the variant directly and hides its own heading for aurora.
 */
import { useState } from 'react'
import type { ProductImage } from '@/api/types'
import { ProductArt } from '@/components/booking/art/ProductArt'
import { cn } from '@/lib/utils'
import { useVariant } from '@/lib/variant'

interface Props {
  /** Sorted rendition pairs (may be empty → ProductArt fallback). */
  images: ProductImage[]
  /** Product slug — seeds the deterministic ProductArt fallback. */
  seed: string
  /** Product display name — alt fallback + ProductArt icon bias + overlay. */
  name: string
}

export function ProductGallery({ images, seed, name }: Props) {
  const { variant, tokens } = useVariant()
  const [activeIndex, setActiveIndex] = useState(0)

  const hasImages = images.length > 0
  const active = hasImages ? images[Math.min(activeIndex, images.length - 1)] : null
  const heroAlt = active?.alt?.trim() || name
  const showThumbs = images.length > 1
  // aurora overlays the title on the hero for the immersive treatment;
  // summit/alpine show the name below the hero instead (rendered by the
  // step), so no scrim here.
  const overlayTitle = variant === 'aurora'

  return (
    <div className="flex flex-col gap-3" data-testid="product-gallery">
      <div
        className={cn(
          'relative overflow-hidden bg-muted',
          tokens.heroTreatment,
        )}
        data-testid="product-gallery-hero"
      >
        {active ? (
          <img
            src={active.hero_url}
            alt={heroAlt}
            className="h-full w-full object-cover"
            data-testid="product-gallery-hero-image"
          />
        ) : (
          // When aurora overlays the visible title on the hero, that <h2>
          // already labels the region — so the fallback art is decorative
          // (no `title`, avoiding a duplicate accessible name). For
          // summit/alpine the art carries the product name as its label.
          <ProductArt
            seed={seed}
            kind={name}
            aspect="16:9"
            title={overlayTitle ? undefined : name}
            className="h-full w-full"
          />
        )}
        {overlayTitle ? (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent"
            />
            <h2
              className={cn(
                'absolute inset-x-0 bottom-0 p-4 text-2xl text-white drop-shadow-md sm:text-3xl',
                tokens.typeAccent,
              )}
              data-testid="product-gallery-overlay-title"
            >
              {name}
            </h2>
          </>
        ) : null}
      </div>

      {showThumbs ? (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="Product image thumbnails"
          data-testid="product-gallery-thumbs"
        >
          {images.map((img, i) => {
            const selected = i === activeIndex
            return (
              <button
                key={`${img.thumb_url}-${i}`}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={`Show image ${i + 1}${img.alt ? `: ${img.alt}` : ''}`}
                aria-pressed={selected}
                data-testid="product-gallery-thumb"
                data-active={selected ? 'true' : 'false'}
                className={cn(
                  'h-16 w-20 shrink-0 overflow-hidden rounded-md ring-offset-2 ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  selected
                    ? 'ring-2 ring-primary'
                    : 'ring-1 ring-border opacity-80 hover:opacity-100',
                )}
              >
                <img
                  src={img.thumb_url}
                  alt={img.alt?.trim() || `${name} thumbnail ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
