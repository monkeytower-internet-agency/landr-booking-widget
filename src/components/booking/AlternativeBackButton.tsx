import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeftIcon } from 'lucide-react'
import { ALTERNATIVE_BACK_SLOT_ID } from '@/components/booking/alternativesSlot'
import { browserLocale } from '@/lib/locale'
import { tr } from '@/lib/strings'
import { cn } from '@/lib/utils'

interface Props {
  /** Localized name of the product the guest switched away from. */
  productName: string
  /** Day(s) were picked there and come back with the button. */
  keepsDates: boolean
  onBack: () => void
}

function BackButton({ productName, keepsDates, onBack, className }: Props & { className?: string }) {
  const locale = browserLocale()
  return (
    <button
      type="button"
      onClick={onBack}
      data-testid="alternative-back"
      className={cn(
        'tap-44 flex w-full items-center gap-2 rounded-xl border border-primary/30 bg-surface-tint px-3 py-2 text-left text-sm shadow-well transition-colors hover:border-primary',
        className,
      )}
    >
      <ChevronLeftIcon className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">
          {tr('alternativeBackTemplate', locale).replace('{name}', productName)}
        </span>
        {keepsDates ? (
          <span className="text-xs text-muted-foreground">
            {tr('alternativeBackKeepsDates', locale)}
          </span>
        ) : null}
      </span>
    </button>
  )
}

/**
 * landr-p2du5 / landr-d9qs8: "Back to <product>" after an "Also available"
 * switch. On md+ it portals under the price total (the desktop rail slot),
 * where the tapped row was; below md, or without the rail, it renders inline.
 */
export function AlternativeBackButton(props: Props) {
  // The rail renders after the step content, so the slot is looked up once
  // mounted (a ref-callback-free sync with the DOM, not derived state).
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setSlot(document.getElementById(ALTERNATIVE_BACK_SLOT_ID)),
    )
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <>
      <BackButton {...props} className={slot ? 'md:hidden' : undefined} />
      {slot ? createPortal(<BackButton {...props} />, slot) : null}
    </>
  )
}
