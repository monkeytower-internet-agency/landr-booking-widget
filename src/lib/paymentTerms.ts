/**
 * The operator's payment terms as the guest sees them BEFORE booking:
 * "30% deposit today (non-refundable), the rest by <date>."
 *
 * The due date mirrors the API rule: first booked day minus N days, never
 * before today (a booking made later is due in full at once). Every field
 * is optional on the wire; with the defaults (refundable, no due date) or an
 * older API nothing is returned and the summary looks as before.
 */
import { formatDayLabel } from '@/components/booking/dateLabel'
import { fmt, pickBundle } from '@/lib/strings'
import type { PaymentMethod } from '@/lib/paymentMode'

export interface CheckoutPaymentTerms {
  payment_methods?: readonly PaymentMethod[] | null
  deposit_percent?: number | null
  deposit_refundable?: boolean | null
  balance_due_days_before_arrival?: number | null
}

/** Local-clock today as YYYY-MM-DD (never toISOString: that is UTC). */
export function localTodayIso(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

function minusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

export function checkoutPaymentTermsNote(
  terms: CheckoutPaymentTerms | null | undefined,
  selectedDays: readonly string[],
  locale?: string,
  today: string = localTodayIso(),
): string | null {
  if (!terms) return null
  const methods = terms.payment_methods ?? []
  const upfront = methods.includes('online') || methods.includes('bank_transfer')
  const percent = terms.deposit_percent
  if (!upfront || percent == null) return null
  const t = pickBundle(locale)
  const nonRefundable = terms.deposit_refundable === false
  const days = terms.balance_due_days_before_arrival
  const first = [...selectedDays].filter(Boolean).sort()[0]
  if (days != null && first) {
    const due = minusDays(first, days)
    if (due > today) {
      return fmt(nonRefundable ? t.depositTodayNonRefundableRestBy : t.depositTodayRestBy, {
        percent,
        date: formatDayLabel(due, locale),
      })
    }
    // Due at once: the whole amount is asked for now.
    return nonRefundable ? fmt(t.depositPercentNonRefundable, { percent }) : null
  }
  return nonRefundable ? fmt(t.depositTodayNonRefundable, { percent }) : null
}
