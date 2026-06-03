/**
 * landr-d8rg.6: grid catalogue card for a single BOOKABLE product.
 *
 * 4:3 image (uploaded thumb_url > designed ProductArt fallback), name, a
 * 2-line-clamped short description, a duration / meta chip, an optional kind
 * badge (non-service kinds), and a "from €X" price label. The WHOLE card is
 * the click target (keyboard-activatable) — selecting routes to the product
 * detail page (App wires onSelect → product-detail).
 *
 * Sold-out products are NOT rendered here — ProductList delegates those to
 * FullyBookedNotice (preserving the landr-7jgo "Fully booked" contract).
 *
 * The longer markdown `description` is intentionally NOT shown on the grid
 * card (the card is a teaser; the full markdown body lives on the detail
 * page). The short_description blurb is the card copy. This matches the
 * epic's "short_description clamp-2" while keeping the existing markdown
 * rendering on the detail surface untouched.
 */
import type { ReactNode } from 'react'
import type { Product } from '@/api/types'
import { cn } from '@/lib/utils'
import { useVariant } from '@/lib/variant'
import { ProductArt } from '@/components/booking/art/ProductArt'
import {
  hasThumb,
  productKindBadge,
  productMetaChip,
  productName,
  productPriceLabel,
  productShortDescription,
  thumbAlt,
} from './productCardData'

interface Props {
  product: Product
  locale: string
  showDateModel: boolean
  onSelect: (product: Product) => void
}

function Chip({ children, radius }: { children: ReactNode; radius: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground',
        radius,
      )}
    >
      {children}
    </span>
  )
}

export function ProductCard({ product, locale, showDateModel, onSelect }: Props) {
  const { tokens } = useVariant()
  const name = productName(product, locale)
  const description = productShortDescription(product, locale)
  const meta = productMetaChip(product, showDateModel)
  const kind = productKindBadge(product)
  const price = productPriceLabel(product)
  const isDraft = product.is_publicly_listed === false

  const activate = () => onSelect(product)

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={name}
      data-testid={`product-card-${product.slug}`}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activate()
        }
      }}
      className={cn(
        'group flex cursor-pointer flex-col overflow-hidden border border-border bg-card text-left transition-all',
        // landr-d8rg.8: shared focus-ring token (was an ad-hoc ring-[2px]/50).
        'hover:shadow-md',
        tokens.focusRing,
        tokens.cardRadius,
        tokens.cardShadow,
      )}
    >
      {/* 4:3 image: uploaded thumb, else designed ProductArt fallback. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {hasThumb(product) ? (
          <img
            src={product.thumb_url ?? undefined}
            alt={thumbAlt(product, name)}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <ProductArt
            seed={product.slug}
            kind={product.name}
            aspect="4:3"
            className="h-full w-full"
          />
        )}
        {isDraft ? (
          <span
            className="absolute left-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"
            data-testid="draft-badge"
          >
            Draft — preview
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className={cn('leading-snug', tokens.typeAccent)}>{name}</h3>

        {description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}

        {meta || kind ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {meta ? <Chip radius={tokens.chipRadius}>{meta}</Chip> : null}
            {kind ? <Chip radius={tokens.chipRadius}>{kind}</Chip> : null}
          </div>
        ) : null}

        {price ? (
          <p className="mt-auto pt-1 text-sm font-semibold text-foreground">
            {price}
          </p>
        ) : null}
      </div>
    </div>
  )
}
