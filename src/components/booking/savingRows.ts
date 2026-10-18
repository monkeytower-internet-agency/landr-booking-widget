/**
 * Price-row helpers shared by every surface that renders the API's savings
 * block (PriceBreakdown, the /pay page, the confirmation screen)
 * (landr-1l6hl.5). The API ships `savings[{kind,label,amount}]` with English
 * labels for the offer kinds; the widget translates those by `kind` so a
 * German customer never reads "Special price". Kinds it does not know keep
 * the server's label (already localized for the engine's multi-day rows).
 */
import type { PriceAdjustment, SavingLine } from '@/api/types'
import { tr } from '@/lib/strings'

type StringKey = Parameters<typeof tr>[0]

const KIND_LABEL_KEY: Record<string, StringKey | undefined> = {
  special_price: 'savingSpecialPriceLabel',
  price_override: 'savingSpecialPriceLabel',
  offer_discount: 'savingOfferDiscountLabel',
  group_discount: 'savingGroupDiscountLabel',
  free_spots: 'savingFreeSpotsLabel',
  imported_price: 'savingImportedPriceLabel',
}

export function savingLabel(
  saving: Pick<SavingLine, 'kind' | 'label'>,
  locale?: string,
): string {
  const key = KIND_LABEL_KEY[saving.kind]
  return key ? tr(key, locale) : saving.label
}

export interface SavingRows {
  /** Decimal string — the list price before any saving. */
  subtotal: string
  rows: SavingLine[]
}

/**
 * The rows to render between the list-priced lines and "Amount due".
 * `savings` wins; with none, a legacy price override becomes one row (only
 * when it is cheaper than list — a price above list is shown as the plain
 * amount due). `null` => nothing to explain, render today's layout.
 */
export function savingRows(input: {
  savings?: SavingLine[] | null
  subtotal_before_savings?: string | null
  price_adjustment?: PriceAdjustment | null
}): SavingRows | null {
  const rows = input.savings ?? []
  if (rows.length > 0 && input.subtotal_before_savings) {
    return { subtotal: input.subtotal_before_savings, rows }
  }
  const adj = input.price_adjustment
  if (adj && Number(adj.amount) > 0 && adj.regular_total) {
    return {
      subtotal: adj.regular_total,
      rows: [{ kind: adj.kind, label: adj.label, amount: adj.amount }],
    }
  }
  return null
}
