import { tr } from '@/lib/strings'
import { OptionalReveal } from './OptionalReveal'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// landr-n6ii3: extracted from DetailsStep (landr-de6ej introduced the field
// there) so it can render, editable, on every step from details onward —
// not just the one where it was first collected. See BookingDraft.customerComment
// in appStepMachine.ts for the single source of truth this field reads/writes.
export const MAX_COMMENT_LENGTH = 2000

export interface CustomerCommentFieldProps {
  /** Current value. '' when empty — callers fold '' <-> null at the draft boundary. */
  value: string
  onChange: (value: string) => void
  /**
   * landr-80ubl.1: zen by default — collapse behind "+ Add a note for us"
   * (OptionalReveal) until clicked; a non-empty value keeps it open.
   * Opt-in per step so steps not yet rolled out keep the open field.
   */
  collapsible?: boolean
}

/**
 * landr-n6ii3: the "Anything we should know?" optional free-text field,
 * shared by DetailsStep (where it was originally collected, landr-de6ej)
 * and every step after it. Callers own where the value lives (DetailsStep's
 * own local state pre-Continue; every later step reads/writes
 * App.tsx's bookingDraft.customerComment directly via mergeDraft) — this
 * component is presentation + the maxLength/counter behaviour only, so
 * every step shows byte-identical copy, hint and counter.
 *
 * Never required, never validated red — a customer leaving it blank must
 * feel exactly as unremarkable as one who fills it in. The hint sets the
 * "a human will read this" and "may take a little longer" expectation up
 * front, because a non-empty comment forces the booking to human review on
 * the API side (see approval.py's synthetic customer_comment rule).
 */
export function CustomerCommentField({
  value,
  onChange,
  collapsible = false,
}: CustomerCommentFieldProps) {
  const field = (
    <div className="flex flex-col gap-1" data-testid="customer-comment-section">
      <Label htmlFor="customer-comment" className="text-xs">
        Anything we should know? (optional)
      </Label>
      <Textarea
        id="customer-comment"
        name="customer_comment"
        data-testid="customer-comment"
        aria-describedby="customer-comment-hint customer-comment-counter"
        value={value}
        maxLength={MAX_COMMENT_LENGTH}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. a dietary need, an accessibility request, a special occasion…"
      />
      <div className="flex items-start justify-between gap-2">
        <p id="customer-comment-hint" className="text-xs text-muted-foreground">
          {tr('customerCommentHint')}
        </p>
        <p
          id="customer-comment-counter"
          className="shrink-0 text-xs text-muted-foreground"
          data-testid="customer-comment-counter"
        >
          {value.length}/{MAX_COMMENT_LENGTH}
        </p>
      </div>
    </div>
  )
  if (!collapsible) return field
  return (
    <OptionalReveal
      thing={tr('customerCommentAdd')}
      hasValue={value !== ''}
      data-testid="customer-comment-reveal"
    >
      {field}
    </OptionalReveal>
  )
}
