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
 *     at 2 so big tiles don't look sparse).
 *   • alpine packs denser (3 on md, 4 on lg ≥5) to honour its utilitarian feel.
 *
 * Empty groups (product_count === 0) are hidden — they have nothing bookable.
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
import { useVariant } from '@/lib/variant'
import { browserLocale } from '@/lib/locale'
import { cn } from '@/lib/utils'

export interface CategoryStepProps {
  groups: ProductGroup[]
  onPick: (group: ProductGroup) => void
}

export function CategoryStep({ groups, onPick }: CategoryStepProps) {
  const { variant, tokens } = useVariant()
  // Resolve the viewer locale once; CategoryTile localizes name/description.
  const locale = browserLocale()

  // Hide categories with nothing bookable — they would be dead-end tiles.
  const visible = groups.filter((g) => g.product_count > 0)

  // Responsive column rhythm. Mobile is always single-column for elegance;
  // md doubles up; lg widens to 3 (or 4 in dense alpine) only when there are
  // enough tiles to fill the row, otherwise the grid stays at 2 so each tile
  // keeps a generous footprint.
  const manyGroups = visible.length >= 5
  const gridCols =
    variant === 'alpine'
      ? cn('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3', manyGroups && 'xl:grid-cols-4')
      : cn('grid-cols-1 md:grid-cols-2', manyGroups && 'lg:grid-cols-3')

  // Gap rhythm tracks variant density: alpine tight, summit airy, aurora mid.
  const gridGap =
    variant === 'summit' ? 'gap-6' : variant === 'alpine' ? 'gap-3' : 'gap-4'

  if (visible.length === 0) {
    // Defensive: App only promotes to pick-category when >1 non-empty group
    // exists, so this should not render in practice — but never blow up.
    return (
      <div
        className="flex flex-col gap-4"
        data-testid="category-step"
        data-variant={variant}
      >
        <h2 className={cn('text-lg', tokens.typeAccent)}>What are you looking for?</h2>
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
      <h2 className={cn('text-lg', tokens.typeAccent)}>What are you looking for?</h2>
      <ul className={cn('grid list-none', gridCols, gridGap)}>
        {visible.map((group) => (
          <li key={group.id}>
            <CategoryTile group={group} locale={locale} onPick={onPick} />
          </li>
        ))}
      </ul>
    </div>
  )
}
