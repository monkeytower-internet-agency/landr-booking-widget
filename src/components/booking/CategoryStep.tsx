/**
 * landr-d8rg.4: Category entrance stub.
 *
 * STUB — later slice (landr-d8rg.5) replaces internals with the full
 * image-tile grid (variant-aware, counts, imagery). Props are FINALIZED
 * here; do NOT change the component signature in downstream slices.
 *
 * Props:
 *   groups  — all product groups returned by listProductGroups (including
 *             empty ones; the UI may choose to filter them). Passed
 *             directly from the pick-category step state.
 *   onPick  — called when the user selects a group. App.tsx transitions to
 *             pick-product scoped to that group.
 *
 * Accessibility: the list is a <ul> of <button> elements so keyboard
 * navigation and screen readers work without JS tricks.
 */

import type { ProductGroup } from '@/api/types'

export interface CategoryStepProps {
  groups: ProductGroup[]
  onPick: (group: ProductGroup) => void
}

export function CategoryStep({ groups, onPick }: CategoryStepProps) {
  const visible = groups.filter((g) => g.product_count > 0)

  return (
    <div className="flex flex-col gap-4" data-testid="category-step">
      <h2 className="text-lg font-semibold">What are you looking for?</h2>
      <ul className="flex flex-col gap-2">
        {visible.map((group) => (
          <li key={group.id}>
            <button
              type="button"
              className="w-full rounded-md border border-border bg-card px-4 py-3 text-left hover:bg-muted transition-colors"
              onClick={() => onPick(group)}
              data-testid={`category-btn-${group.slug}`}
            >
              <span className="font-medium">{group.name}</span>
              {group.product_count > 0 ? (
                <span className="ml-2 text-muted-foreground text-sm">
                  ({group.product_count})
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
