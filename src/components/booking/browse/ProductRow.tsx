/**
 * landr-d8rg.6: list-view catalogue row for a single BOOKABLE product. Same
 * data as the grid card, denser: a small 16:10 thumb on the left, the text
 * block in the middle, the price on the right. The WHOLE row is the click
 * target (keyboard-activatable) and routes to the product detail page.
 *
 * Sold-out products are NOT rendered here — ProductList delegates those to
 * FullyBookedNotice (preserving the landr-7jgo "Fully booked" contract).
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

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  )
}

export function ProductRow({ product, locale, showDateModel, onSelect }: Props) {
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
      data-testid={`product-row-${product.slug}`}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activate()
        }
      }}
      className={cn(
        'group flex cursor-pointer items-center gap-4 border border-border bg-card p-3 text-left transition-all outline-none',
        'hover:shadow-md focus-visible:ring-[2px] focus-visible:ring-ring/50',
        tokens.cardRadius,
        tokens.cardShadow,
      )}
    >
      {/* 16:10 small thumb: uploaded image, else designed ProductArt fallback. */}
      <div className="relative aspect-[16/10] w-24 shrink-0 overflow-hidden rounded bg-muted sm:w-32">
        {hasThumb(product) ? (
          <img
            src={product.thumb_url ?? undefined}
            alt={thumbAlt(product, name)}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <ProductArt
            seed={product.slug}
            kind={product.name}
            aspect="16:9"
            className="h-full w-full"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <h3 className={cn('truncate leading-snug', tokens.typeAccent)}>
            {name}
          </h3>
          {isDraft ? (
            <span
              className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"
              data-testid="draft-badge"
            >
              Draft — preview
            </span>
          ) : null}
        </div>

        {description ? (
          <p className="line-clamp-1 text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}

        {meta || kind ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {meta ? <Chip>{meta}</Chip> : null}
            {kind ? <Chip>{kind}</Chip> : null}
          </div>
        ) : null}
      </div>

      {price ? (
        <p className="shrink-0 self-center text-sm font-semibold text-foreground">
          {price}
        </p>
      ) : null}
    </div>
  )
}
