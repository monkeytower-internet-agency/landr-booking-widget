/**
 * landr-d8rg.6: loading skeletons for the product catalogue, matching the
 * grid-card and list-row silhouettes so the layout doesn't jump when the
 * real products arrive. Variant-aware radius/shadow via tokens.
 *
 * Decorative only — the whole block is aria-hidden and the live region with
 * "Loading products…" sits alongside it in ProductList for screen readers.
 */
import { cn } from '@/lib/utils'
import { useVariant } from '@/lib/variant'

const PLACEHOLDER_COUNT = 4

function GridSkeletonCard() {
  const { tokens } = useVariant()
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden border border-border bg-card',
        tokens.cardRadius,
        tokens.cardShadow,
      )}
    >
      <div className="aspect-[4/3] w-full animate-pulse bg-muted" />
      <div className="flex flex-col gap-3 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}

function ListSkeletonRow() {
  const { tokens } = useVariant()
  return (
    <div
      className={cn(
        'flex items-center gap-4 border border-border bg-card p-3',
        tokens.cardRadius,
        tokens.cardShadow,
      )}
    >
      <div className="aspect-[16/10] w-24 shrink-0 animate-pulse rounded bg-muted" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-4 w-16 shrink-0 animate-pulse rounded bg-muted" />
    </div>
  )
}

export function ProductSkeleton({ view }: { view: 'grid' | 'list' }) {
  const items = Array.from({ length: PLACEHOLDER_COUNT })
  return (
    <div
      aria-hidden="true"
      data-testid="product-skeleton"
      className={
        view === 'grid'
          ? 'grid gap-4 sm:grid-cols-2'
          : 'flex flex-col gap-3'
      }
    >
      {items.map((_, i) =>
        view === 'grid' ? (
          <GridSkeletonCard key={i} />
        ) : (
          <ListSkeletonRow key={i} />
        ),
      )}
    </div>
  )
}
