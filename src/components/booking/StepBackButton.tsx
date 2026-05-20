import { ChevronLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
 * Top-left back affordance shared by every booking step (landr-8yaz).
 *
 * Previously each step rendered its Back button at the bottom-left next to
 * Continue. The bottom row now holds only the primary action (Continue /
 * Confirm), and Back lives in a small row above the CardHeader so the
 * customer can retreat without scrolling past the form first.
 *
 * Implementation notes:
 *  - ghost variant + small size keeps the affordance light visually so it
 *    doesn't compete with the step's title.
 *  - data-testid lets tests target the back affordance unambiguously when
 *    the same step renders multiple back-eligible buttons (e.g. error
 *    fallbacks); existing tests that query by `name: /back/i` still work
 *    because the visible label remains "Back".
 */
export function StepBackButton({ onBack, label = 'Back' }: Props) {
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
