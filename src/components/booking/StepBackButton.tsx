import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BreadcrumbItem } from '@/appStepMachine'
import { useBreadcrumbNav } from './breadcrumbNav'

interface Props {
  onBack: () => void
  /**
   * Accessible label; also used as the visible text. Defaults to "Back" but
   * callers can pass a more specific label (e.g. "Back to products" for the
   * ShopComingSoonStub).
   */
  label?: string
}

/**
 * Top-left navigation affordance shared by every booking step (landr-8yaz).
 *
 * Two modes, chosen automatically:
 *  - When a BreadcrumbNav context is present with ≥2 crumbs (the integrated
 *    booking flow), it renders the full breadcrumb trail: every prior step is a
 *    clickable crumb that jumps back with its state restored, and the current
 *    step is the bold, non-clickable tail. The crumb immediately before the
 *    current one carries `data-testid="step-back-button"`, so a single "go
 *    back" is exactly the previous crumb (and existing back-nav tests keep
 *    working unchanged).
 *  - Otherwise (isolated component tests, catalog / non-funnel steps), it falls
 *    back to the original single back button.
 *
 * The ghost/small styling keeps the affordance light so it doesn't compete with
 * the step's title.
 */
export function StepBackButton({ onBack, label = 'Back' }: Props) {
  const nav = useBreadcrumbNav()
  if (nav && nav.items.length > 1) {
    return <StepBreadcrumb items={nav.items} onNavigate={nav.onNavigate} />
  }
  return (
    <div className="mb-2 px-6 pt-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        data-testid="step-back-button"
        className="-ml-2 h-8 gap-1 px-2 text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        {label}
      </Button>
    </div>
  )
}

/**
 * The breadcrumb trail. Past steps are buttons; the active step is a bold,
 * non-clickable label. The penultimate crumb (one step back) doubles as the
 * canonical back affordance via the `step-back-button` testid.
 */
function StepBreadcrumb({
  items,
  onNavigate,
}: {
  items: BreadcrumbItem[]
  onNavigate: (target: NonNullable<BreadcrumbItem['target']>) => void
}) {
  // Index of the crumb immediately before the current step.
  const backIndex = items.length - 2
  return (
    <nav
      aria-label="Booking steps"
      data-testid="step-breadcrumb"
      className="mb-2 px-6 pt-2"
    >
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
        {items.map((item, i) => (
          <li key={`${item.name}-${i}`} className="flex items-center gap-1">
            {i > 0 ? (
              <ChevronRightIcon
                className="size-3.5 shrink-0 text-muted-foreground/50"
                aria-hidden
              />
            ) : null}
            {item.current || !item.target ? (
              <span
                aria-current="step"
                className="font-semibold text-foreground"
              >
                {item.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => item.target && onNavigate(item.target)}
                data-testid={
                  i === backIndex
                    ? 'step-back-button'
                    : `breadcrumb-${item.name}`
                }
                className="rounded-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.label}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
