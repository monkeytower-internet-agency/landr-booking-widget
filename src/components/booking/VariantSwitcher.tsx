/**
 * landr-d8rg.8: floating variant switcher for the morning design review.
 *
 * A small chip-group pinned bottom-right that lets the reviewer flip
 * aurora / summit / alpine LIVE — no URL editing, no full reload. It writes
 * the choice into the `?variant=` URL param (via the provider's setVariant)
 * so the link stays shareable and a refresh keeps the picked direction.
 *
 * Rendered ONLY when preview is enabled (useVariant().previewEnabled — true
 * for `?preview=1` or an operator preview_token). It NEVER ships to a
 * customer-facing embed, so it can be loud/utilitarian.
 *
 * Z-order: z-50 so it sits ABOVE the mobile fixed price bar and the
 * product-detail mobile Book bar (both z-40). Offset up by the mobile bar
 * height so the two don't collide on small screens.
 *
 * Component-only file (react-refresh/only-export-components CI gate).
 */
import { VARIANTS, useVariant, type Variant } from '@/lib/variant'
import { cn } from '@/lib/utils'

const LABELS: Record<Variant, string> = {
  aurora: 'Aurora',
  summit: 'Summit',
  alpine: 'Alpine',
}

export function VariantSwitcher() {
  const { variant, setVariant, previewEnabled } = useVariant()

  // Gate: only operators on a preview link see the switcher.
  if (!previewEnabled) return null

  return (
    <div
      data-testid="variant-switcher"
      role="group"
      aria-label="Preview visual variant"
      // bottom offset clears the mobile fixed bars (z-40, ~h-16); z-50 keeps
      // the switcher above them. On md+ the bars are gone so we drop to the
      // corner. Pointer-events scoped to the chip group only.
      className="fixed right-3 bottom-20 z-50 md:bottom-3"
    >
      <div className="flex items-center gap-1 rounded-full border border-border bg-card/95 p-1 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <span className="px-2 text-xs font-medium text-muted-foreground select-none">
          Variant
        </span>
        {VARIANTS.map((v) => {
          const active = v === variant
          return (
            <button
              key={v}
              type="button"
              onClick={() => setVariant(v)}
              aria-pressed={active}
              data-testid={`variant-switcher-${v}`}
              data-active={active ? 'true' : 'false'}
              className={cn(
                'min-h-[40px] rounded-full px-3 text-sm font-medium transition-colors',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {LABELS[v]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
