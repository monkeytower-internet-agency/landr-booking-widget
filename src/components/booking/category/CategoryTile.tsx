/**
 * landr-d8rg.5: CategoryTile — a single category in the widget entrance grid.
 *
 * The whole tile is a real <button> so it is keyboard-focusable and activatable
 * (Enter/Space) and announced as a control to screen readers, with no JS key
 * handling. Imagery is the uploaded `image_url` cover when present, else the
 * brand-aware <CategoryArt> SVG fallback (landr-d8rg.3) — so a tile is never an
 * empty grey box, whatever the operator has uploaded.
 *
 * Variant-aware (landr-d8rg.3 tokens), visibly distinct at a glance:
 *   aurora — gradient-overlaid text-on-image; the copy sits *inside* the image
 *            with a brand scrim. Immersive, rounded-2xl.
 *   summit — editorial: image on top, copy in a generous block below. Lots of
 *            whitespace, serif accent. The "travel magazine" direction.
 *   alpine — compact bordered card: smaller image, copy below, sharp radius,
 *            dense. The utilitarian "just book it" direction.
 *
 * Motion is subtle (200ms hover lift + image scale) and fully disabled under
 * prefers-reduced-motion via Tailwind's motion-reduce: variants. focus-visible
 * gets a ring.
 *
 * Component-only file (react-refresh/only-export-components CI gate); the
 * count-label helper lives in categoryCopy.ts.
 */

import type { ProductGroup } from '@/api/types'
import { CategoryArt } from '@/components/booking/art/CategoryArt'
import { useVariant } from '@/lib/variant'
import { pickLocalized } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { offerCountLabel } from './categoryCopy'

export interface CategoryTileProps {
  group: ProductGroup
  locale: string
  onPick: (group: ProductGroup) => void
  /**
   * landr-jb1k.2: resolved CSS font-family string from TILE_FONT_FAMILY_MAP.
   * Applied as an inline fontFamily style on every tile title <h3>. Undefined
   * when the operator hasn't configured a font (system default wins).
   */
  titleFontStyle?: string
  /**
   * landr-jb1k.2: resolved Tailwind text-transform class (from
   * TITLE_CASE_CLASS_MAP in CategoryStep). Applied to every tile title <h3>.
   * Undefined when no transform is configured.
   */
  titleCaseClass?: string
}

export function CategoryTile({ group, locale, onPick, titleFontStyle, titleCaseClass }: CategoryTileProps) {
  const { variant, tokens } = useVariant()

  const name = pickLocalized(group.name, group.name_localized, locale)
  const description = pickLocalized(
    group.description,
    group.description_localized,
    locale,
  )
  const countLabel = offerCountLabel(group.product_count)
  // image_url is OPTIONAL on the wire; undefined is treated as "no image".
  const hasImage = Boolean(group.image_url)

  // The media block — uploaded cover when present, else brand-aware fallback
  // art. Shared across variants; the *frame* differs per variant below.
  const media = (
    <div className={cn('relative w-full overflow-hidden', tokens.tileAspect)}>
      {hasImage ? (
        <img
          src={group.image_url ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn(
            'h-full w-full object-cover',
            'transition-transform duration-200 ease-out motion-reduce:transition-none',
            'group-hover:scale-105 group-focus-visible:scale-105',
          )}
        />
      ) : (
        <CategoryArt
          seed={group.slug}
          aspect={variant === 'alpine' ? '1:1' : variant === 'summit' ? '3:2' : '4:3'}
          className={cn(
            'h-full w-full',
            'transition-transform duration-200 ease-out motion-reduce:transition-none',
            'group-hover:scale-105 group-focus-visible:scale-105',
          )}
        />
      )}
    </div>
  )

  const countChip = (
    <span
      className={cn(
        // landr-d8rg.8: chip radius from the variant token (alpine squares it).
        'inline-flex items-center px-2 py-0.5 text-xs font-medium',
        tokens.chipRadius,
        variant === 'aurora'
          ? 'bg-white/20 text-white backdrop-blur-sm'
          : 'bg-muted text-muted-foreground',
      )}
      data-testid="category-count-chip"
    >
      {countLabel}
    </span>
  )

  // Shared interaction chrome for every variant's <button>.
  // landr-d8rg.8: focus ring now comes from the shared token (tokens.focusRing)
  // so every interactive surface across the three steps rings identically.
  const baseButton = cn(
    'group relative block w-full overflow-hidden text-left',
    'cursor-pointer',
    'transition-all duration-200 ease-out motion-reduce:transition-none',
    tokens.focusRing,
    'hover:-translate-y-0.5 focus-visible:-translate-y-0.5 motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0',
    tokens.cardRadius,
  )

  // landr-jb1k.2: inline style for operator-configured font-family on titles.
  const h3Style = titleFontStyle ? { fontFamily: titleFontStyle } : undefined

  // --- aurora: text-on-image with a brand gradient scrim. ---
  if (variant === 'aurora') {
    return (
      <button
        type="button"
        onClick={() => onPick(group)}
        className={cn(baseButton, tokens.cardShadow, 'hover:shadow-xl')}
        data-testid={`category-btn-${group.slug}`}
        data-variant={variant}
      >
        {media}
        <div
          className={cn('pointer-events-none absolute inset-0', tokens.overlayScrim)}
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4 text-white">
          <div className="flex items-center justify-between gap-2">
            <h3
              className={cn('text-lg', tokens.typeAccent, titleCaseClass)}
              style={h3Style}
            >
              {name}
            </h3>
            {countChip}
          </div>
          {description ? (
            <p className="line-clamp-2 text-sm text-white/90">{description}</p>
          ) : null}
        </div>
      </button>
    )
  }

  // --- summit: editorial — image above, generous copy block below. ---
  if (variant === 'summit') {
    return (
      <button
        type="button"
        onClick={() => onPick(group)}
        className={cn(baseButton, tokens.cardShadow, 'bg-card')}
        data-testid={`category-btn-${group.slug}`}
        data-variant={variant}
      >
        {media}
        <div className="flex flex-col gap-2 p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h3
              className={cn('text-xl', tokens.typeAccent, titleCaseClass)}
              style={h3Style}
            >
              {name}
            </h3>
            {countChip}
          </div>
          {description ? (
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </button>
    )
  }

  // --- alpine: compact bordered card — sharp radius, dense. ---
  return (
    <button
      type="button"
      onClick={() => onPick(group)}
      className={cn(baseButton, tokens.cardShadow, 'bg-card hover:border-primary/40')}
      data-testid={`category-btn-${group.slug}`}
      data-variant={variant}
    >
      {media}
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3
            className={cn('text-sm', tokens.typeAccent, titleCaseClass)}
            style={h3Style}
          >
            {name}
          </h3>
          {countChip}
        </div>
        {description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </button>
  )
}
