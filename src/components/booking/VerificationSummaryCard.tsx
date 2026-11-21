/**
 * landr-kq0l4 — the documents + signed waiver as a finished summary on Review.
 * Entry happens on the Details step; "Edit" goes back to it. Review never
 * holds an input: when something is still missing (a product added on Review
 * asks for documents, or the page was reloaded) the card says so and Confirm
 * stays disabled.
 */
import { Button } from '@/components/ui/button'
import { browserLocale } from '@/lib/locale'
import { fmt, tr } from '@/lib/strings'
import { verificationReady, type VerificationInput } from './verification'
import { verificationStrings } from './verificationStrings'

export interface VerificationSummaryCardProps {
  value: VerificationInput
  onEdit?: () => void
}

export function VerificationSummaryCard({ value, onEdit }: VerificationSummaryCardProps) {
  const locale = browserLocale()
  const t = verificationStrings(locale)
  const ready = verificationReady(value)
  return (
    <section
      data-testid="review-verification"
      className="rounded-lg border bg-surface-raised p-3 shadow-elev-1"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{tr('reviewDocumentsTitle', locale)}</h3>
        {onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            data-testid="review-verification-edit"
          >
            {tr('reviewEditLabel', locale)}
          </Button>
        ) : null}
      </div>
      {ready ? (
        <div className="text-sm" data-testid="review-verification-lines">
          <span className="block">
            {t.licenceLabel}: {value.licence?.name}
          </span>
          <span className="block">
            {t.insuranceLabel}: {value.insurance?.name}
          </span>
          <span className="block text-muted-foreground">
            {fmt(tr('reviewDocumentsSignedBy', locale), { name: value.signature.trim() })}
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="review-verification-missing">
          {tr('reviewDocumentsMissing', locale)}
        </p>
      )}
    </section>
  )
}
