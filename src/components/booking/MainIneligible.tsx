/**
 * The main product cannot be booked for this party (its eligibility rules):
 * the product stays on screen, Confirm is disabled, and this says why.
 */
import type { EvaluatedLine } from '@/api/types'
import { Button } from '@/components/ui/button'
import { fmt, tr } from '@/lib/strings'
import { reasonText } from './offerCart'

interface Props {
  verdict: EvaluatedLine
  locale: string
  /** Back to the guest questions, for an unanswered attribute. */
  onAnswerQuestions?: () => void
}

export function MainIneligible({ verdict, locale, onAnswerQuestions }: Props) {
  const reason = reasonText(verdict.eligibility_reason_key, verdict.eligibility_reason_params, locale)
  const asks = verdict.eligibility_reason_key?.startsWith('attribute_missing.') ?? false
  return (
    <div
      role="alert"
      data-testid="main-ineligible"
      className="space-y-2 rounded-md border border-destructive bg-destructive/5 p-3 text-sm text-destructive"
    >
      <p>{fmt(tr('offerMainIneligible', locale), { reason })}</p>
      {asks && onAnswerQuestions ? (
        <Button type="button" variant="outline" size="sm" onClick={onAnswerQuestions}>
          {tr('offerAnswerGuestQuestions', locale)}
        </Button>
      ) : null}
    </div>
  )
}
