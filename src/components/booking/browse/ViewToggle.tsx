/**
 * landr-d8rg.6: grid/list view toggle — an icon segmented control for the
 * product catalogue. Two icon buttons in a single bordered group; the active
 * one is highlighted. Variant-aware corner radius (token-level, not forked).
 *
 * Accessible: a `radiogroup` of two `radio` buttons (aria-checked) with
 * aria-labels, so screen readers announce "Grid view / List view" and the
 * active state. data-testids let the tests assert the active layout.
 */
import { LayoutGrid, LayoutList } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVariant } from '@/lib/variant'
import type { ViewMode } from './useViewMode'

interface Props {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

const OPTIONS: { mode: ViewMode; label: string; Icon: typeof LayoutGrid }[] = [
  { mode: 'grid', label: 'Grid view', Icon: LayoutGrid },
  { mode: 'list', label: 'List view', Icon: LayoutList },
]

export function ViewToggle({ value, onChange }: Props) {
  const { tokens } = useVariant()
  return (
    <div
      role="radiogroup"
      aria-label="Catalogue layout"
      className={cn(
        'inline-flex items-center gap-0.5 border border-border bg-card p-0.5',
        tokens.cardRadius,
      )}
      data-testid="view-toggle"
    >
      {OPTIONS.map(({ mode, label, Icon }) => {
        const active = value === mode
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            data-testid={`view-toggle-${mode}`}
            data-active={active ? 'true' : 'false'}
            onClick={() => onChange(mode)}
            className={cn(
              'inline-flex size-8 items-center justify-center rounded-[inherit] transition-colors outline-none focus-visible:ring-[2px] focus-visible:ring-ring/50',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
