/**
 * landr-f210e.5: cross-sell hint cards on the review step. The suggestions are
 * fetched AFTER the step has rendered, as a separate light request that never
 * blocks it; a failure shows no cards. A card is only a pointer: tapping it
 * opens the suggested product as its own booking (dates and party carried
 * over, its own availability check), so nothing here reads stock.
 */
import { useEffect, useState } from 'react'
import { getProductSuggestions } from '@/api/client'
import type { ProductHint } from '@/api/types'
import { formatMoney } from '@/components/booking/priceSidebarHelpers'
import { browserLocale, pickLocalized } from '@/lib/locale'
import { fmt, tr } from '@/lib/strings'

interface Props {
  operatorToken: string
  productId: string
  /** The suggested product the guest tapped. */
  onOpen: (hint: ProductHint) => void
}

function hintName(hint: ProductHint, locale: string): string {
  return pickLocalized(hint.name, hint.name_localized, locale) || hint.name
}

export function CrossSellHintCards({ operatorToken, productId, onOpen }: Props) {
  const locale = browserLocale()
  const [hints, setHints] = useState<ProductHint[]>([])

  useEffect(() => {
    let live = true
    getProductSuggestions(operatorToken, productId)
      .then((rows) => {
        if (live) setHints(rows.filter((h) => h.product_id !== productId))
      })
      .catch(() => {
        if (live) setHints([])
      })
    return () => {
      live = false
    }
  }, [operatorToken, productId])

  if (hints.length === 0) return null

  return (
    <ul data-testid="cross-sell-hints" className="grid gap-2 sm:grid-cols-2">
      {hints.map((hint) => {
        const name = hintName(hint, locale)
        const price =
          hint.price_from != null && hint.currency
            ? fmt(tr('priceFromTemplate', locale), {
                price: formatMoney(String(hint.price_from), hint.currency, locale),
              })
            : null
        const title = fmt(tr('crossSellHintTitle', locale), { name })
        return (
          <li key={hint.product_id}>
            <button
              type="button"
              data-testid={`cross-sell-hint-${hint.product_id}`}
              aria-label={price ? `${title}, ${price}` : title}
              onClick={() => onOpen(hint)}
              className="tap-44 flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-surface-tint p-2 text-left shadow-well transition-colors hover:border-primary"
            >
              {hint.thumb_url ? (
                <img
                  src={hint.thumb_url}
                  alt=""
                  className="size-14 shrink-0 rounded-lg object-cover"
                  loading="lazy"
                />
              ) : null}
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{title}</span>
                {price ? <span className="text-xs text-muted-foreground">{price}</span> : null}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
