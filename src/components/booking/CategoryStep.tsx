/**
 * landr-d8rg.5: Category entrance — the widget's first screen and "wow" moment.
 *
 * Replaces the landr-d8rg.4 stub internals. The component signature is FINAL
 * (App.tsx already wires {groups, onPick}); this slice fills in the real
 * image-tile grid. Each category is a <CategoryTile>: an uploaded cover image
 * when set, else a brand-aware fallback (CategoryArt, landr-d8rg.3), with the
 * localized name, a 2-line description and an offer-count chip — the whole tile
 * a focusable, hover-lifting <button>.
 *
 * Layout is responsive and variant-aware:
 *   • 1 column on mobile, 2 on md.
 *   • 3 columns on lg only once there are ≥5 visible groups (fewer groups stay
 *     at 2 so big tiles don't look sparse), OR exactly 3 groups (landr-jb1k.2).
 *   • alpine packs denser (3 on md, 4 on lg ≥5) to honour its utilitarian feel.
 *
 * Empty groups (product_count === 0) are hidden — nothing has ever been
 * listed there. landr-872c: a FULLY SOLD-OUT group (product_count > 0,
 * bookable_count === 0) is NOT hidden — it still renders, as a disabled
 * "Fully booked" tile (see CategoryTile). Two different states, two
 * different treatments; see the contract table in ExpandedCatalog.tsx.
 *
 * No skeleton: App.tsx fetches product groups at boot and only promotes the UI
 * to the pick-category step once the groups have resolved (see App.tsx
 * loadGroups → setStep({ name: 'pick-category', groups })), so this component is
 * never mounted with un-loaded data. A skeleton here would be dead code.
 *
 * File ownership: this file's internals + everything under
 * components/booking/category/ are ours; App.tsx / the step machine are not.
 */

import type { ProductGroup } from '@/api/types'
import { CategoryTile } from './category/CategoryTile'
import { CategoryTileRow } from './category/CategoryTileRow'
import { ViewToggle } from './browse/ViewToggle'
import { useViewMode } from './browse/useViewMode'
import { useVariant } from '@/lib/variant'
import { browserLocale } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { TILE_FONT_FAMILY_MAP, type TileFontKey } from '@/lib/tileFont'
import {
  TILE_RADIUS_CLASS_MAP,
  TILE_ASPECT_CLASS_MAP,
  TILE_SCRIM_MAP,
  TILE_HOVER_MAP,
  type TileRadiusKey,
  type TileAspectKey,
  type TileScrimKey,
  type TileHoverKey,
  type TileScrimResolved,
  type TileHoverResolved,
} from '@/lib/tileStyle'

/**
 * landr-jb1k.2: static column-count → Tailwind class map (md+ breakpoint;
 * mobile always stays single-column). Template-literal class names are BANNED
 * (Tailwind purge) — only static strings from this map may be used.
 * Inputs are clamped to 1..4 before lookup.
 */
const COLUMN_CLASS_MAP: Record<1 | 2 | 3 | 4, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
}

/**
 * landr-jb1k.2: static title-case → Tailwind class map. Applied to tile
 * titles and the CategoryStep heading. Only these four static class strings
 * may appear in the JSX (no dynamic class names — Tailwind purge).
 */
const TITLE_CASE_CLASS_MAP: Record<'uppercase' | 'lowercase' | 'capitalize', string> = {
  uppercase: 'uppercase',
  lowercase: 'lowercase',
  capitalize: 'capitalize',
}

export interface CategoryStepProps {
  groups: ProductGroup[]
  onPick: (group: ProductGroup) => void
  /**
   * landr-jb1k.2: operator-configured column count for the category grid
   * (md+ breakpoint; mobile always stays single-column). Clamped to 1..4.
   * Null/undefined → improved auto-logic: exactly 3 visible groups renders
   * 3 columns on lg (fixes the 2x2-with-3-categories complaint), otherwise
   * the existing variant-aware responsive default applies.
   */
  columns?: number | null
  /**
   * landr-jb1k.2: operator-configured font key for tile titles and the
   * CategoryStep heading. See TileFontKey in lib/tileFont.ts. The CSS
   * font-family string is looked up from TILE_FONT_FAMILY_MAP and applied
   * as an inline style (lazy font loading is triggered by App.tsx).
   * Null/undefined → no override (system default).
   */
  tileFont?: TileFontKey | null
  /**
   * landr-jb1k.2: operator-configured text-transform for tile titles and
   * the CategoryStep heading. Null/undefined → no transform.
   */
  titleCase?: 'uppercase' | 'lowercase' | 'capitalize' | null
  /**
   * landr-jb1k.4: operator-configured tile corner radius. OVERRIDES the
   * variant token radius for tiles only. Null/undefined → variant default.
   */
  tileRadius?: TileRadiusKey | null
  /**
   * landr-jb1k.4: operator-configured tile aspect ratio. OVERRIDES the variant
   * token aspect for tiles only. Null/undefined → variant default.
   */
  tileAspect?: TileAspectKey | null
  /**
   * landr-jb1k.4: operator-configured scrim tint for text-over-image titles
   * (aurora layout only). Null/undefined → variant token scrim (current dark).
   */
  tileScrim?: TileScrimKey | null
  /**
   * landr-jb1k.4: operator-configured tile hover interaction. Null/undefined →
   * 'lift' (current behaviour).
   */
  tileHover?: TileHoverKey | null
}

export function CategoryStep({
  groups,
  onPick,
  columns = null,
  tileFont = null,
  titleCase = null,
  tileRadius = null,
  tileAspect = null,
  tileScrim = null,
  tileHover = null,
}: CategoryStepProps) {
  const { variant } = useVariant()
  // Resolve the viewer locale once; CategoryTile localizes name/description.
  const locale = browserLocale()
  // Grid/list toggle — same per-visitor preference ProductList/ExpandedCatalog
  // use, so the choice carries over once a category is picked and the product
  // list renders (all three surfaces share the one localStorage-backed hook).
  const [view, setView] = useViewMode()

  // landr-872c: hide only genuinely EMPTY categories (product_count === 0
  // — nothing has ever been listed here). This does NOT filter out FULLY
  // SOLD-OUT categories (product_count > 0, bookable_count === 0) — those
  // still render, via CategoryTile/CategoryTileRow's disabled state, so the
  // tile is never a dead end and never silently vanishes. (The comment this
  // replaces claimed the opposite — that it hid "nothing bookable" — which
  // was wrong: product_count never measured bookability, so a sold-out
  // category always passed this filter and rendered as a normal clickable
  // tile that dead-ended on "No products in this category." That was the
  // bug; see bd landr-872c.)
  const visible = groups.filter((g) => g.product_count > 0)

  // landr-jb1k.2: resolve the grid column classes.
  //
  // When the operator has configured an explicit column count, use the static
  // class map (clamped 1..4; mobile always stays grid-cols-1 — the md: prefix
  // on the map values handles the breakpoint). This wins over the auto logic.
  //
  // When columns is null/undefined, fall back to improved auto-logic:
  //   • Exactly 3 visible groups → 3 columns from lg (fixes the 2x2-with-3-
  //     categories complaint even without any config — user report 2026-06-04).
  //   • Otherwise: variant-aware responsive default (alpine denser, others 2-col
  //     md with lg:3 upgrade when ≥5 groups fill the wider row).
  let gridCols: string
  if (columns != null) {
    const clamped = Math.min(4, Math.max(1, Math.round(columns))) as 1 | 2 | 3 | 4
    gridCols = cn('grid-cols-1', COLUMN_CLASS_MAP[clamped])
  } else {
    const manyGroups = visible.length >= 5
    const exactlyThree = visible.length === 3
    gridCols =
      variant === 'alpine'
        ? cn('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3', manyGroups && 'xl:grid-cols-4')
        : cn(
            'grid-cols-1 md:grid-cols-2',
            (exactlyThree || manyGroups) && 'lg:grid-cols-3',
          )
  }

  // Gap rhythm tracks variant density: alpine tight, summit airy, aurora mid.
  const gridGap =
    variant === 'summit' ? 'gap-6' : variant === 'alpine' ? 'gap-3' : 'gap-4'

  // landr-jb1k.2: resolve title font-family and text-transform for the
  // heading and tile titles. Font is applied via inline style (font-family
  // is a data value, not a Tailwind class). The actual font CSS is lazy-loaded
  // by App.tsx (loadTileFont) before settings propagate here.
  const titleFontStyle: string | undefined =
    tileFont && tileFont !== 'system' ? TILE_FONT_FAMILY_MAP[tileFont] : undefined
  const titleCaseClass: string | undefined =
    titleCase ? TITLE_CASE_CLASS_MAP[titleCase] : undefined

  // landr-jb1k.4: resolve the tile-style overrides from their static maps.
  // Each null/undefined leaves the value undefined so CategoryTile keeps the
  // variant token (current/auto behaviour) — untouched embeds never shift.
  const tileRadiusClass: string | undefined =
    tileRadius ? TILE_RADIUS_CLASS_MAP[tileRadius] : undefined
  const tileAspectClass: string | undefined =
    tileAspect ? TILE_ASPECT_CLASS_MAP[tileAspect] : undefined
  const tileScrimResolved: TileScrimResolved | undefined =
    tileScrim ? TILE_SCRIM_MAP[tileScrim] : undefined
  // hover defaults to 'lift' (current behaviour) when unset.
  const tileHoverResolved: TileHoverResolved = TILE_HOVER_MAP[tileHover ?? 'lift']

  if (visible.length === 0) {
    // Defensive: App only promotes to pick-category when >1 non-empty group
    // exists, so this should not render in practice — but never blow up.
    return (
      <div
        className="flex flex-col gap-4"
        data-testid="category-step"
        data-variant={variant}
      >
        <p className="text-sm text-muted-foreground">
          No categories are available right now.
        </p>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col gap-5"
      data-testid="category-step"
      data-variant={variant}
    >
      <div className="flex items-center justify-end">
        <ViewToggle value={view} onChange={setView} />
      </div>

      {view === 'grid' ? (
        <ul
          className={cn('grid list-none', gridCols, gridGap)}
          data-testid="category-grid"
        >
          {visible.map((group) => (
            <li key={group.id}>
              <CategoryTile
                group={group}
                locale={locale}
                onPick={onPick}
                titleFontStyle={titleFontStyle}
                titleCaseClass={titleCaseClass}
                tileRadiusClass={tileRadiusClass}
                tileAspectClass={tileAspectClass}
                tileScrim={tileScrimResolved}
                tileHover={tileHoverResolved}
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul
          className={cn('flex list-none flex-col', gridGap)}
          data-testid="category-list"
        >
          {visible.map((group) => (
            <li key={group.id}>
              <CategoryTileRow
                group={group}
                locale={locale}
                onPick={onPick}
                titleFontStyle={titleFontStyle}
                titleCaseClass={titleCaseClass}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
