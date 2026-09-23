/**
 * landr-80ubl.1 — OptionalReveal: optional fields stay out of the way.
 *
 * Collapsed, it is a single "+ Add <thing>" link; clicking it reveals the
 * children and focuses their first field. It opens on its own — and stays
 * open — whenever `hasValue` is true, so prefilled or restored data is never
 * hidden behind a link (clearing the field afterwards does not collapse it
 * under the customer's cursor).
 *
 *   <OptionalReveal thing="a note for us" hasValue={comment !== ''}>
 *     <CommentField … />
 *   </OptionalReveal>
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { browserLocale } from '@/lib/locale'
import { optionalRevealLabel } from '@/lib/strings'
import { cn } from '@/lib/utils'

export interface OptionalRevealProps {
  /** What gets added, lower-case phrase: "a note for us". */
  thing: string
  /** True when the field already holds data — forces it open. */
  hasValue: boolean
  children: ReactNode
  className?: string
  'data-testid'?: string
}

export function OptionalReveal({
  thing,
  hasValue,
  children,
  className,
  'data-testid': testId = 'optional-reveal',
}: OptionalRevealProps) {
  const [opened, setOpened] = useState(hasValue)
  const [focusOnOpen, setFocusOnOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  // A value arriving later (async restore) latches it open — adjusting state
  // during render, React's documented alternative to a setState-in-effect.
  if (hasValue && !opened) setOpened(true)

  useEffect(() => {
    if (!focusOnOpen) return
    panelRef.current
      ?.querySelector<HTMLElement>('input, textarea, select, button')
      ?.focus()
  }, [focusOnOpen])

  if (!opened) {
    return (
      <button
        type="button"
        data-testid={`${testId}-add`}
        onClick={() => {
          setOpened(true)
          setFocusOnOpen(true)
        }}
        className={cn(
          'self-start rounded-sm text-sm text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring',
          className,
        )}
      >
        <span aria-hidden className="mr-1">
          +
        </span>
        {optionalRevealLabel(thing, browserLocale())}
      </button>
    )
  }
  return (
    <div ref={panelRef} className={className} data-testid={testId}>
      {children}
    </div>
  )
}
