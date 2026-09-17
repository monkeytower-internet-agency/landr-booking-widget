/**
 * Shared "Subtotal → savings rows → Amount due" block (landr-nva1a.4).
 * Renders the customer-facing savings breakdown that every price surface
 * in the widget now shows (PriceSidebar's operator well, and the
 * Confirmation success screen's price breakdown) — the SAME shape the
 * booking_confirmation/booking_received/booking_payment_link emails
 * render, computed once server-side (booking_savings.py) so nothing here
 * re-derives a saving; this component only formats and lays out rows the
 * API already gave it.
 *
 * No-savings degrade (older API deploy, or a booking with nothing to
 * discount): `subtotalBeforeSavings`/`savings` are absent or empty, and
 * the component renders ONLY the total row — no "Subtotal" line, no
 * empty savings list. `amountDue` is required and is always the row
 * shown last, regardless of whether savings rendered above it.
 *
 * Sibling .tsx file — single component export keeps
 * react-refresh/only-export-components happy (see PriceSidebar/DayChips
 * for the same convention).
 */
import type { SavingLine } from '@/api/types'
import { cn } from '@/lib/utils'
import { formatMoney } from './priceSidebarHelpers'

export interface PriceBreakdownProps {
  /** Decimal string. Omit/null when there's nothing to break down. */
  subtotalBeforeSavings?: string | null
  savings?: SavingLine[] | null
  /** Decimal string. Always shown, as the last row. */
  amountDue: string
  currency: string
  /** Defaults to "Amount due". */
  totalLabel?: string
  /** Extra classes on the total row (e.g. the sidebar's recessed well). */
  totalClassName?: string
  /** Prefixes every data-testid so the two call sites stay distinguishable. */
  testIdPrefix: string
  className?: string
}

export function PriceBreakdown({
  subtotalBeforeSavings,
  savings,
  amountDue,
  currency,
  totalLabel = 'Amount due',
  totalClassName,
  testIdPrefix,
  className,
}: PriceBreakdownProps) {
  const rows = savings ?? []
  const hasSavings = rows.length > 0 && Boolean(subtotalBeforeSavings)

  return (
    <div className={cn('space-y-1', className)}>
      {hasSavings ? (
        <>
          <div
            className="flex items-baseline justify-between text-sm"
            data-testid={`${testIdPrefix}-subtotal`}
          >
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums text-muted-foreground">
              {formatMoney(subtotalBeforeSavings as string, currency)}
            </span>
          </div>
          <ul className="space-y-1" data-testid={`${testIdPrefix}-savings`}>
            {rows.map((saving, idx) => (
              <li
                key={`${saving.kind}-${idx}`}
                className="flex items-baseline justify-between gap-2 text-sm text-emerald-700 dark:text-emerald-400"
                data-testid={`${testIdPrefix}-saving`}
              >
                <span>− {saving.label}</span>
                <span className="tabular-nums">
                  −{formatMoney(saving.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <div
        className={cn(
          'flex items-baseline justify-between',
          totalClassName,
        )}
        data-testid={`${testIdPrefix}-amount-due`}
      >
        <span className="font-semibold">{totalLabel}</span>
        <span className="font-semibold tabular-nums">
          {formatMoney(amountDue, currency)}
        </span>
      </div>
    </div>
  )
}

export default PriceBreakdown
