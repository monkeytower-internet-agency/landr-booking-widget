/**
 * landr-80ubl.1 — NextAction: the one-next-action rule.
 *
 * Wrap the ONE pending required control on a step. While `active`, it paints
 * an accent-tinted surface + accent ring and a short visible "Next: <cue>"
 * label above its children; inactive, it is a plain box (same element, so
 * children never remount — the language board's dnd-kit state survives the
 * flip). Exactly one NextAction per screen should be active: when the
 * required input is satisfied, activate the one around Continue instead
 * (ContinueAction does that for you).
 *
 *   <NextAction active={!picked} cue="pick a date">
 *     <Calendar … />
 *   </NextAction>
 *
 * The accent is --primary (ring-primary / text-primary / bg-surface-tint), so
 * an operator's theme flows through. The cue is plain visible text — no
 * aria-live, since it changes with every assignment and would spam a screen
 * reader; the control's own gate/status text carries announcements.
 */
import type { ReactNode } from 'react'
import { browserLocale } from '@/lib/locale'
import { tr } from '@/lib/strings'
import { cn } from '@/lib/utils'

export interface NextActionProps {
  active: boolean
  /** Lower-case cue after "Next:", e.g. "pick a language for Thomas". */
  cue: string
  children: ReactNode
  className?: string
  'data-testid'?: string
}

export function NextAction({
  active,
  cue,
  children,
  className,
  'data-testid': testId,
}: NextActionProps) {
  return (
    <div
      data-next-action={active ? 'active' : 'inactive'}
      data-testid={testId}
      className={cn(
        'flex flex-col gap-2 rounded-lg',
        active && 'bg-surface-tint p-3 ring-2 ring-primary',
        className,
      )}
    >
      {active ? (
        <p className="text-xs font-semibold text-primary" data-testid="next-action-cue">
          {tr('nextActionPrefix', browserLocale())} {cue}
        </p>
      ) : null}
      {children}
    </div>
  )
}
