/**
 * landr-hzovu.5: the "pay separately" block for performer-paid lines — money
 * the customer hands to their pilot / guide on the day, outside the booking
 * total. One section per payee label so "Paid to your Tandem pilot" and
 * "Paid to your photographer" never share a heading. Shared by PriceSidebar
 * and Confirmation; the hotel block keeps its own copy.
 */
import { browserLocale } from '@/lib/locale'
import { payeeText, qtyOnly } from '@/lib/strings'
import { formatMoney, type PerformerGroup } from './priceSidebarHelpers'

interface Props {
  groups: PerformerGroup[]
  currency: string
  /** data-testid prefix: `${prefix}-performer-section` etc. */
  testIdPrefix: string
}

export function PerformerPaySections({ groups, currency, testIdPrefix }: Props) {
  const locale = browserLocale()
  return (
    <>
      {groups.map((g) => (
        <section
          key={g.payeeLabel ?? ''}
          data-testid={`${testIdPrefix}-performer-section`}
          className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40"
        >
          <h4 className="mb-1 text-sm font-semibold text-foreground">
            {payeeText('paidToPayeeOnTheDay', g.payeeLabel, locale)}
          </h4>
          <ul className="space-y-1">
            {g.lines.map((li) => (
              <li
                key={`perf-${li.product_id}`}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="flex-1">
                  <span className="block">{li.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {qtyOnly(li.qty, locale)}
                  </span>
                </span>
                <span className="tabular-nums">
                  {formatMoney(li.line_total, currency, locale)}
                </span>
              </li>
            ))}
          </ul>
          <div
            className="mt-2 flex items-baseline justify-end border-t border-amber-200 pt-2 font-medium tabular-nums dark:border-amber-900"
            data-testid={`${testIdPrefix}-performer-total`}
          >
            {formatMoney(g.total, currency, locale)}
          </div>
          <p
            className="mt-2 text-xs italic text-muted-foreground"
            data-testid={`${testIdPrefix}-performer-caveat`}
          >
            {g.paymentNote ?? payeeText('paidDirectlyToPayeeCaveat', g.payeeLabel, locale)}
          </p>
        </section>
      ))}
    </>
  )
}
