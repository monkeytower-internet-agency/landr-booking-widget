/**
 * landr-80ubl.1 — HelpDisclosure: zen by default.
 *
 * A step's explanation copy lives behind a small "ⓘ How this works" toggle,
 * collapsed on arrival, so the only thing that shouts is the next action.
 * Children are the explanation; they are not rendered until expanded.
 *
 *   <HelpDisclosure>
 *     <p>Why we ask, and how the control works.</p>
 *   </HelpDisclosure>
 */
import { useId, useState, type ReactNode } from 'react'
import { tr } from '@/lib/strings'
import { cn } from '@/lib/utils'

export interface HelpDisclosureProps {
  children: ReactNode
  /** Toggle text; defaults to "How this works". */
  label?: string
  className?: string
  'data-testid'?: string
}

export function HelpDisclosure({
  children,
  label = tr('helpDisclosureLabel'),
  className,
  'data-testid': testId = 'help-disclosure',
}: HelpDisclosureProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <div className={cn('flex flex-col gap-1', className)} data-testid={testId}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="self-start rounded-sm text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span aria-hidden className="mr-1">
          ⓘ
        </span>
        {label}
      </button>
      {open ? (
        <div id={panelId} className="flex flex-col gap-1 text-xs text-muted-foreground">
          {children}
        </div>
      ) : null}
    </div>
  )
}
