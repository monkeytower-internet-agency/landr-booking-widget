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
 * landr-872c: a FULLY SOLD-OUT category (product_count > 0, bookable_count
 * === 0 — isCategoryFullySoldOut()) renders as a DISABLED tile in all three
 * variants: a real `disabled` <button> (non-interactive, no onPick, skipped
 * by Tab order and never announced as clickable), muted/desaturated
 * artwork, no hover lift, and the count chip replaced with the
 * "Fully booked" badge (FullyBookedNotice's exact copy, reused via
 * offerCountLabel). It is NEVER hidden — only a genuinely EMPTY category
 * (product_count === 0) is filtered out upstream in CategoryStep.
 *
 * Component-only file (react-refresh/only-export-components CI gate); the
 * count-label helper lives in categoryCopy.ts.
 */

import type { ProductGroup } from '@/api/types'
import { CategoryArt } from '@/components/booking/art/CategoryArt'
import { isCategoryFullySoldOut } from '@/components/booking/bookability'
import { FULLY_BOOKED_BLURB } from '@/components/booking/FullyBookedNotice'
import { useVariant } from '@/lib/variant'
import { pickLocalized } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { offerCountLabel } from './categoryCopy'
import { TILE_HOVER_MAP, type TileScrimResolved, type TileHoverResolved } from '@/lib/tileStyle'

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
  /**
   * landr-jb1k.4: resolved tile corner-radius class (from TILE_RADIUS_CLASS_MAP).
   * OVERRIDES the variant token radius (tokens.cardRadius) on the tile <button>
   * only. Undefined → keep the variant default (current behaviour).
   */
  tileRadiusClass?: string
  /**
   * landr-jb1k.4: resolved tile aspect-ratio class (from TILE_ASPECT_CLASS_MAP).
   * OVERRIDES the variant token aspect (tokens.tileAspect) on the media frame
   * only. Undefined → variant default.
   */
  tileAspectClass?: string
  /**
   * landr-jb1k.4: resolved scrim treatment (from TILE_SCRIM_MAP) for the
   * text-over-image (aurora) layout. Undefined → variant token scrim with white
   * text (current dark behaviour). Ignored by summit/alpine (no scrim there).
   */
  tileScrim?: TileScrimResolved
  /**
   * landr-jb1k.4: resolved hover treatment (from TILE_HOVER_MAP), split into the
   * button (lift) and image (zoom) class strings. CategoryStep always resolves
   * this; when omitted (isolated renders / older callers) it defaults to 'lift'
   * — the current behaviour.
   */
  tileHover?: TileHoverResolved
}

export function CategoryTile({
  group,
  locale,
  onPick,
  titleFontStyle,
  titleCaseClass,
  tileRadiusClass,
  tileAspectClass,
  tileScrim,
  tileHover = TILE_HOVER_MAP.lift,
}: CategoryTileProps) {
  const { variant, tokens } = useVariant()

  const name = pickLocalized(group.name, group.name_localized, locale)
  const description = pickLocalized(
    group.description,
    group.description_localized,
    locale,
  )
  const countLabel = offerCountLabel(group)
  // landr-872c: FULLY SOLD-OUT — render disabled, never navigate, never hide.
  const fullySoldOut = isCategoryFullySoldOut(group)
  // image_url is OPTIONAL on the wire; undefined is treated as "no image".
  const hasImage = Boolean(group.image_url)

  // landr-jb1k.4: the operator-configured aspect OVERRIDES the variant token
  // (tiles only); undefined keeps the variant default. The hover image-scale
  // comes from the resolved hover treatment (empty string when hover is 'lift'
  // or 'none' — only 'zoom' scales the image).
  const mediaAspect = tileAspectClass ?? tokens.tileAspect

  // landr-jb1k.4: aurora scrim override. Undefined → variant token scrim with
  // white text (current behaviour). The 'light' scrim is a white gradient, so
  // the title/description/count-chip flip to dark text to stay ≥AA.
  const scrimOverlay = tileScrim?.overlay ?? tokens.overlayScrim
  const scrimTitleDark = tileScrim?.titleDark ?? false

  // landr-872c: no hover-zoom motion on a disabled tile — it can't be
  // "entered" in any meaningful sense.
  const mediaHoverClass = fullySoldOut ? '' : tileHover.image

  // The media block — uploaded cover when present, else brand-aware fallback
  // art. Shared across variants; the *frame* differs per variant below.
  // Desaturated + dimmed when fullySoldOut so the tile reads as disabled at
  // a glance, independent of the operator's uploaded artwork.
  const media = (
    <div
      className={cn(
        'relative w-full overflow-hidden',
        mediaAspect,
        fullySoldOut && 'opacity-60 grayscale',
      )}
    >
      {hasImage ? (
        <img
          src={group.image_url ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn(
            'h-full w-full object-cover',
            'transition-transform duration-200 ease-out motion-reduce:transition-none',
            mediaHoverClass,
          )}
        />
      ) : (
        <CategoryArt
          seed={group.slug}
          aspect={variant === 'alpine' ? '1:1' : variant === 'summit' ? '3:2' : '4:3'}
          className={cn(
            'h-full w-full',
            'transition-transform duration-200 ease-out motion-reduce:transition-none',
            mediaHoverClass,
          )}
        />
      )}
    </div>
  )

  // landr-jb1k.4: on aurora, the count chip sits inside the scrim. With the
  // 'light' (white) scrim it must use a dark-on-light treatment to stay legible;
  // the dark/brand scrims keep the white-on-glass chip.
  // landr-872c: a fullySoldOut chip always falls back to the neutral muted
  // treatment (mirrors FullyBookedNotice's badge) regardless of variant/scrim
  // — the tile is already desaturated, and this keeps "Fully booked" legible
  // and visually consistent everywhere it appears.
  const auroraChipClass = scrimTitleDark
    ? 'bg-foreground/10 text-foreground backdrop-blur-sm'
    : 'bg-white/20 text-white backdrop-blur-sm'
  const countChip = (
    <span
      className={cn(
        // landr-d8rg.8: chip radius from the variant token (alpine squares it).
        'inline-flex items-center px-2 py-0.5 text-xs font-medium',
        tokens.chipRadius,
        fullySoldOut
          ? 'bg-muted text-muted-foreground'
          : variant === 'aurora'
            ? auroraChipClass
            : 'bg-muted text-muted-foreground',
      )}
      data-testid={fullySoldOut ? 'fully-booked-badge' : 'category-count-chip'}
    >
      {countLabel}
    </span>
  )

  // Shared interaction chrome for every variant's <button>.
  // landr-d8rg.8: focus ring now comes from the shared token (tokens.focusRing)
  // so every interactive surface across the three steps rings identically.
  // landr-jb1k.4: the button lift comes from the resolved hover treatment
  // (tileHover.button — empty for 'zoom'/'none'); the radius is the operator
  // override when set, else the variant token.
  // landr-872c: fullySoldOut drops the pointer/lift affordances entirely —
  // disabled + cursor-not-allowed + no hover class — since there is nothing
  // to activate.
  const baseButton = cn(
    'group relative block w-full overflow-hidden text-left',
    fullySoldOut ? 'cursor-not-allowed' : 'cursor-pointer',
    'transition-all duration-200 ease-out motion-reduce:transition-none',
    tokens.focusRing,
    !fullySoldOut && tileHover.button,
    tileRadiusClass ?? tokens.cardRadius,
  )

  // landr-jb1k.2: inline style for operator-configured font-family on titles.
  const h3Style = titleFontStyle ? { fontFamily: titleFontStyle } : undefined

  // landr-872c: shared disabled-state props for every variant's <button> —
  // a real `disabled` attribute (non-interactive: no click, not Tab-focusable,
  // announced as disabled by AT) plus an aria-label carrying the "fully
  // booked" context (FullyBookedNotice's exact blurb) since the visual chip
  // alone isn't guaranteed to be read by every screen reader in every
  // variant's layout.
  const disabledButtonProps = fullySoldOut
    ? {
        disabled: true as const,
        'aria-label': `${name} — ${countLabel}. ${FULLY_BOOKED_BLURB}`,
      }
    : { onClick: () => onPick(group) }

  // --- aurora: text-on-image with a brand gradient scrim. ---
  if (variant === 'aurora') {
    return (
      <button
        type="button"
        {...disabledButtonProps}
        className={cn(
          baseButton,
          tokens.cardShadow,
          !fullySoldOut && 'hover:shadow-xl',
        )}
        data-testid={`category-btn-${group.slug}`}
        data-variant={variant}
      >
        {media}
        <div
          className={cn('pointer-events-none absolute inset-0', scrimOverlay)}
          aria-hidden="true"
          data-testid="category-scrim"
        />
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4',
            // landr-jb1k.4: white text on dark/brand scrims; dark text on the
            // 'light' (white) scrim to stay ≥AA.
            scrimTitleDark ? 'text-foreground' : 'text-white',
          )}
        >
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
            <p
              className={cn(
                'line-clamp-2 text-sm',
                scrimTitleDark ? 'text-foreground/80' : 'text-white/90',
              )}
            >
              {description}
            </p>
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
        {...disabledButtonProps}
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
      {...disabledButtonProps}
      className={cn(
        baseButton,
        tokens.cardShadow,
        'bg-card',
        !fullySoldOut && 'hover:border-primary/40',
      )}
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
