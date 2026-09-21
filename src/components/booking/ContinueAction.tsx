/**
 * landr-80ubl.1 — ContinueAction: a step's Continue CTA under the
 * one-next-action rule.
 *
 * Ready → solid accent button inside an ACTIVE NextAction ("Next: continue"),
 * because once the step is satisfied, Continue IS the next action. Not ready
 * → muted (secondary) disabled button with a one-line reason beside it. The
 * reason is a role="status" live region and the disabled button points at it
 * via aria-describedby, so focusing Continue reads out why it cannot be
 * pressed. Pass `active={false}` when another NextAction on the screen still
 * owns the ring (never two at once).
 *
 *   <ContinueAction
 *     ready={complete}
 *     reason={complete ? 'Everyone has a language.' : 'Still waiting on Kay.'}
 *     reasonId="language-step-gate"
 *     onContinue={() => onConfirm(x)}
 *     data-testid="language-step-submit"
 *   />
 */
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { tr } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { NextAction } from './NextAction'

export interface ContinueActionProps {
  ready: boolean
  /** One-line status beside the button; shown whether ready or not. */
  reason: ReactNode
  /** DOM id for the reason, the disabled button's aria-describedby target. */
  reasonId: string
  /** Extra classes for the reason (e.g. text-destructive once started). */
  reasonClassName?: string
  onContinue: () => void
  /** Defaults to `ready`. */
  active?: boolean
  label?: ReactNode
  'data-testid'?: string
  /** data-testid for the reason line. */
  reasonTestId?: string
}

export function ContinueAction({
  ready,
  reason,
  reasonId,
  reasonClassName,
  onContinue,
  active = ready,
  label = tr('continueLabel'),
  'data-testid': testId,
  reasonTestId,
}: ContinueActionProps) {
  return (
    <NextAction active={active} cue={tr('continueCue')} className="mt-2">
      <div className="flex items-center justify-end gap-3">
        <p
          id={reasonId}
          role="status"
          data-testid={reasonTestId}
          className={cn('min-w-0 flex-1 text-xs text-muted-foreground', reasonClassName)}
        >
          {reason}
        </p>
        <Button
          type="button"
          variant={ready ? 'default' : 'secondary'}
          onClick={onContinue}
          disabled={!ready}
          aria-describedby={ready ? undefined : reasonId}
          data-testid={testId}
        >
          {label}
        </Button>
      </div>
    </NextAction>
  )
}
