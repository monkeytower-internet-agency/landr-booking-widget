/**
 * landr-rw8i2 — the billing address as a finished summary on Review. Entry
 * happens on the Address step; "Edit" goes back to it.
 */
import { Button } from '@/components/ui/button'
import { countryName } from '@/lib/countries'
import { browserLocale } from '@/lib/locale'
import { tr } from '@/lib/strings'
import { invoiceToLines, type BillingDetails, type BookerDetails } from './detailsTypes'

export interface BillingSummaryCardProps {
  booker: Pick<BookerDetails, 'first_name' | 'last_name'>
  billing: BillingDetails
  onEdit?: () => void
}

export function BillingSummaryCard({ booker, billing, onEdit }: BillingSummaryCardProps) {
  const locale = browserLocale()
  const invoiceTo = invoiceToLines(
    { ...booker, billing },
    billing.company.trim() !== '',
  )
  const cityLine = [billing.postal_code.trim(), billing.city.trim()]
    .filter(Boolean)
    .join(' ')
  const lines = [
    billing.address_line1.trim(),
    billing.address_line2.trim(),
    cityLine,
    billing.country ? countryName(billing.country, locale) : '',
  ].filter(Boolean)
  return (
    <section
      data-testid="review-billing"
      className="rounded-lg border bg-surface-raised p-3 shadow-elev-1"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{tr('billingAddressTitle', locale)}</h3>
        {onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            data-testid="review-billing-edit"
          >
            {tr('reviewEditLabel', locale)}
          </Button>
        ) : null}
      </div>
      <div className="text-sm" data-testid="review-billing-lines">
        {invoiceTo.map((line, i) => (
          <span key={`to-${i}`} className={`block ${i === 0 ? 'font-medium' : ''}`}>
            {line}
          </span>
        ))}
        {lines.map((line, i) => (
          <span key={`line-${i}`} className="block">
            {line}
          </span>
        ))}
        {billing.tax_id.trim() ? (
          <span className="block text-xs text-muted-foreground">{billing.tax_id.trim()}</span>
        ) : null}
      </div>
    </section>
  )
}
