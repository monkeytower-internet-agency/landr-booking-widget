/**
 * List-view row for a single category — companion to CategoryTile's grid
 * card. Mirrors ProductRow's layout (thumb left, text middle, count chip
 * right) so the "Categories" catalog layout can offer the same grid/list
 * toggle parity as "Expanded catalog"/the scoped product list.
 *
 * Variant-agnostic (uses shared tokens only, no aurora/summit/alpine forks,
 * no tile-style overrides) — the list view is a dense utility layout, not the
 * showcase treatment CategoryTile's grid gives each variant.
 *
 * landr-872c: mirrors CategoryTile's disabled treatment for a FULLY SOLD-OUT
 * category (product_count > 0, bookable_count === 0) — a real `disabled`
 * <button>, muted/desaturated thumb, no hover, count chip replaced with the
 * "Fully booked" badge. See the contract table in ExpandedCatalog.tsx.
 */
import type { ProductGroup } from '@/api/types'
import { CategoryArt } from '@/components/booking/art/CategoryArt'
import { isCategoryFullySoldOut } from '@/components/booking/bookability'
import { FULLY_BOOKED_BLURB } from '@/components/booking/FullyBookedNotice'
import { useVariant } from '@/lib/variant'
import { pickLocalized } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { offerCountLabel } from './categoryCopy'

export interface CategoryTileRowProps {
  group: ProductGroup
  locale: string
  onPick: (group: ProductGroup) => void
  /** See CategoryStep — resolved font-family string for the row title. */
  titleFontStyle?: string
  /** See CategoryStep — resolved text-transform class for the row title. */
  titleCaseClass?: string
}

export function CategoryTileRow({
  group,
  locale,
  onPick,
  titleFontStyle,
  titleCaseClass,
}: CategoryTileRowProps) {
  const { tokens } = useVariant()
  const name = pickLocalized(group.name, group.name_localized, locale)
  const description = pickLocalized(
    group.description,
    group.description_localized,
    locale,
  )
  const countLabel = offerCountLabel(group)
  const fullySoldOut = isCategoryFullySoldOut(group)
  const hasImage = Boolean(group.image_url)
  const h3Style = titleFontStyle ? { fontFamily: titleFontStyle } : undefined

  const disabledButtonProps = fullySoldOut
    ? {
        disabled: true as const,
        'aria-label': `${name} — ${countLabel}. ${FULLY_BOOKED_BLURB}`,
      }
    : { onClick: () => onPick(group) }

  return (
    <button
      type="button"
      {...disabledButtonProps}
      data-testid={`category-row-${group.slug}`}
      className={cn(
        'group flex w-full items-center gap-4 border border-border bg-card p-3 text-left transition-all',
        fullySoldOut ? 'cursor-not-allowed' : 'cursor-pointer hover:shadow-md',
        tokens.focusRing,
        tokens.cardRadius,
        tokens.cardShadow,
      )}
    >
      {/* 16:10 small thumb: uploaded cover, else brand-aware fallback art. */}
      <div
        className={cn(
          'relative aspect-[16/10] w-24 shrink-0 overflow-hidden rounded bg-muted sm:w-32',
          fullySoldOut && 'opacity-60 grayscale',
        )}
      >
        {hasImage ? (
          <img
            src={group.image_url ?? undefined}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <CategoryArt seed={group.slug} aspect="16:9" className="h-full w-full" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3
          className={cn('truncate leading-snug', tokens.typeAccent, titleCaseClass)}
          style={h3Style}
        >
          {name}
        </h3>
        {description ? (
          <p className="line-clamp-1 text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      <span
        className={cn(
          'inline-flex shrink-0 items-center bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground',
          tokens.chipRadius,
        )}
        data-testid={fullySoldOut ? 'fully-booked-badge' : 'category-count-chip'}
      >
        {countLabel}
      </span>
    </button>
  )
}
