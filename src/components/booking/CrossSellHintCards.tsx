/**
 * Cross-sell hint block on the review step. The suggestions are fetched AFTER
 * the step has rendered, as a separate light request that never blocks it; a
 * failure shows nothing. The block sits under the grand total (the price rail's
 * slot on md+, inline at the end of the step below that) with ONE heading, and
 * each chip is only a name plus a "from" price.
 *
 * Availability is the product's own check (supplied by the caller, so the chips
 * and the product's booking flow can never disagree): "Check availability" runs
 * it for every visible chip; tapping a chip runs it for that chip first. A chip
 * that is not available flashes its notice and disappears; when none are left
 * the block says so for a moment and then goes away, heading included.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getProductSuggestions } from '@/api/client'
import type { ProductHint } from '@/api/types'
import { CROSS_SELL_HINTS_SLOT_ID } from '@/components/booking/alternativesSlot'
import { formatMoney } from '@/components/booking/priceSidebarHelpers'
import { browserLocale, pickLocalized } from '@/lib/locale'
import { fmt, tr } from '@/lib/strings'
import { cn } from '@/lib/utils'

/** How long an unavailable chip shows its notice before it disappears. */
export const HINT_FLASH_MS = 1400
/** How long the "none available" message shows before the block disappears. */
export const HINT_NONE_LEFT_MS = 3000

interface Props {
  operatorToken: string
  productId: string
  /** The suggested product the guest tapped (and that is available). */
  onOpen: (hint: ProductHint) => void
  /**
   * The product's own availability check for these hints on the booking's
   * dates and party: product id -> available. A failed read resolves every
   * id as available (the product's own date step re-checks).
   */
  onCheckAvailability: (hints: ProductHint[]) => Promise<Record<string, boolean>>
}

function hintName(hint: ProductHint, locale: string): string {
  return pickLocalized(hint.name, hint.name_localized, locale) || hint.name
}

function priceLabel(hint: ProductHint, locale: string): string {
  const amount = hint.price_from != null ? Number(hint.price_from) : NaN
  if (!Number.isFinite(amount) || amount <= 0 || !hint.currency) {
    return tr('priceOnRequest', locale)
  }
  return fmt(tr('priceFromTemplate', locale), {
    price: formatMoney(String(hint.price_from), hint.currency, locale),
  })
}

export function CrossSellHintCards({
  operatorToken,
  productId,
  onOpen,
  onCheckAvailability,
}: Props) {
  const locale = browserLocale()
  const [hints, setHints] = useState<ProductHint[]>([])
  const [gone, setGone] = useState<string[]>([])
  const [flashing, setFlashing] = useState<string[]>([])
  const [checking, setChecking] = useState(false)
  const [checked, setChecked] = useState(false)
  const [noneLeft, setNoneLeft] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const timers = useRef<number[]>([])
  const goneRef = useRef<string[]>([])

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

  // The price rail renders after the step content, so its slot is looked up
  // once mounted.
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setSlot(document.getElementById(CROSS_SELL_HINTS_SLOT_ID)),
    )
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((t) => window.clearTimeout(t))
  }, [])

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }, [])

  const visible = hints.filter((h) => !gone.includes(h.product_id))

  /** Flash the unavailable chips, then remove them; maybe retire the block. */
  const retire = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return
      setFlashing((prev) => [...prev, ...ids.filter((i) => !prev.includes(i))])
      later(() => {
        goneRef.current = [...goneRef.current, ...ids.filter((i) => !goneRef.current.includes(i))]
        setGone(goneRef.current)
        setFlashing((prev) => prev.filter((i) => !ids.includes(i)))
        if (hints.every((h) => goneRef.current.includes(h.product_id))) {
          setNoneLeft(true)
          later(() => setCollapsed(true), HINT_NONE_LEFT_MS)
        }
      }, HINT_FLASH_MS)
    },
    [hints, later],
  )

  const runCheck = async () => {
    if (checking) return
    setChecking(true)
    const targets = visible.filter((h) => !flashing.includes(h.product_id))
    let result: Record<string, boolean> = {}
    try {
      result = await onCheckAvailability(targets)
    } catch {
      result = {}
    }
    setChecking(false)
    setChecked(true)
    retire(targets.filter((h) => result[h.product_id] === false).map((h) => h.product_id))
  }

  const pick = async (hint: ProductHint) => {
    if (flashing.includes(hint.product_id)) return
    let result: Record<string, boolean>
    try {
      result = await onCheckAvailability([hint])
    } catch {
      result = {}
    }
    if (result[hint.product_id] === false) retire([hint.product_id])
    else onOpen(hint)
  }

  if (hints.length === 0 || collapsed) return null

  const allChecked = checked && !noneLeft && flashing.length === 0
  const block = (
    <section data-testid="cross-sell-hints" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{tr('crossSellHeading', locale)}</h3>
        {!checked && !noneLeft ? (
          <button
            type="button"
            data-testid="cross-sell-check"
            disabled={checking}
            onClick={() => void runCheck()}
            className="tap-44 shrink-0 rounded-lg border border-primary px-3 text-sm font-semibold text-primary transition-colors hover:bg-surface-tint disabled:opacity-70"
          >
            {checking ? tr('crossSellChecking', locale) : tr('crossSellCheck', locale)}
          </button>
        ) : null}
        {allChecked ? (
          <span data-testid="cross-sell-checked" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            {tr('crossSellAvailableOk', locale)}
          </span>
        ) : null}
      </div>
      {noneLeft ? (
        <p
          role="status"
          data-testid="cross-sell-none-left"
          className="hint-fade rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
        >
          {tr('crossSellNoneLeft', locale)}
        </p>
      ) : null}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
        {visible.map((hint) => {
          const name = hintName(hint, locale)
          const price = priceLabel(hint, locale)
          const isFlashing = flashing.includes(hint.product_id)
          return (
            <li key={hint.product_id}>
              {isFlashing ? (
                <div
                  role="status"
                  data-testid={`cross-sell-hint-flash-${hint.product_id}`}
                  className="hint-flash flex min-h-[4.5rem] items-center rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
                >
                  {tr('crossSellSorry', locale)}
                </div>
              ) : (
                <button
                  type="button"
                  data-testid={`cross-sell-hint-${hint.product_id}`}
                  aria-label={`${name}, ${price}`}
                  onClick={() => void pick(hint)}
                  className={cn(
                    'tap-44 flex min-h-[4.5rem] w-full flex-col justify-center gap-0.5 rounded-xl border border-primary/30 bg-surface-tint px-3 py-2 text-left shadow-well transition-colors hover:border-primary',
                  )}
                >
                  <span className="text-sm font-semibold">{name}</span>
                  <span className="text-xs text-muted-foreground">{price}</span>
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )

  return (
    <>
      <div className={slot ? 'md:hidden' : undefined}>{block}</div>
      {slot ? createPortal(<div className="hidden md:block">{block}</div>, slot) : null}
    </>
  )
}
