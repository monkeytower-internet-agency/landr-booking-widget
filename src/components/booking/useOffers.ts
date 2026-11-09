/**
 * The evaluator's verdict for the cart and party
 * (POST /api/public/offers/evaluate): which offers each line shows, and may
 * each line be booked.
 *
 * Refetches only when the request would change -- the tree (line ids,
 * products, parents, days) or the party (refs, attributes). Ticks, options and
 * quantities never change the verdict, so they never refetch. Debounced
 * 300 ms (the first request goes out at once); a newer request aborts the older one and only the latest answer
 * lands. While a changed request is unanswered `isPending` is true and the
 * previous verdict stays on screen (rows keep their DOM). A failed, timed-out
 * or rate-limited call sets `checkFailed` instead: the booking never waits on
 * it -- submit re-judges every line.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { getOffers } from '@/api/client'
import type { EvaluatedLine, OfferEvaluateGuest, OfferEvaluateLine } from '@/api/types'
import { useDebouncedValue } from './useDebouncedValue'

export interface OffersState {
  /** line id -> verdict, from the last answered request (empty before the first). */
  byLine: Record<string, EvaluatedLine>
  requiredAttributeKeys: string[]
  /** Keys collected before arrival, not at booking: never block on them. */
  deferredAttributeKeys: string[]
  /** The request changed and its answer is not in yet. */
  isPending: boolean
  /** The last request failed (error, timeout, 429); the previous verdict stays. */
  checkFailed: boolean
  /** The request key the current `byLine` answers (null before the first answer). */
  answeredKey: string | null
}

export interface UseOffersArgs {
  widgetToken: string
  lines: readonly OfferEvaluateLine[]
  guests: readonly OfferEvaluateGuest[]
  enabled?: boolean
  debounceMs?: number
  /** Bump to ask again for the same cart (after a refused submit). */
  refreshKey?: number
}

/** The refetch key: everything the verdict depends on, nothing it does not. */
export function offersRequestKey(
  widgetToken: string,
  lines: readonly OfferEvaluateLine[],
  guests: readonly OfferEvaluateGuest[],
): string {
  return JSON.stringify({
    t: widgetToken,
    l: lines.map((l) => [l.line_id, l.product_id, l.parent_line_id ?? null, l.selected_days ?? null]),
    g: guests.map((g) => [g.id, Object.entries(g.attributes).sort(([a], [b]) => a.localeCompare(b))]),
  })
}

export function useOffers({
  widgetToken,
  lines,
  guests,
  enabled = true,
  debounceMs = 300,
  refreshKey = 0,
}: UseOffersArgs): OffersState {
  const key = useMemo(
    () => `${refreshKey}|${offersRequestKey(widgetToken, lines, guests)}`,
    [widgetToken, lines, guests, refreshKey],
  )
  // Nothing answered yet: ask at once (the debounce only calms later edits).
  const [firstAnswered, setFirstAnswered] = useState(false)
  const debouncedKey = useDebouncedValue(key, firstAnswered ? debounceMs : 0)
  const bodyRef = useRef({ lines, guests })
  useEffect(() => {
    bodyRef.current = { lines, guests }
  }, [lines, guests])

  const [state, setState] = useState<{
    byLine: Record<string, EvaluatedLine>
    requiredAttributeKeys: string[]
    deferredAttributeKeys: string[]
    answeredKey: string | null
    failedKey: string | null
  }>({ byLine: {}, requiredAttributeKeys: [], deferredAttributeKeys: [], answeredKey: null, failedKey: null })

  const active = enabled && !!widgetToken && lines.length > 0
  useEffect(() => {
    if (!active) return
    const requestKey = debouncedKey
    const ctrl = new AbortController()
    const { lines: ls, guests: gs } = bodyRef.current
    void getOffers(
      { widget_token: widgetToken, lines: [...ls], guests: [...gs] },
      { signal: ctrl.signal },
    )
      .then((res) => {
        if (ctrl.signal.aborted) return
        const byLine: Record<string, EvaluatedLine> = {}
        for (const l of res.lines ?? []) byLine[l.line_id] = l
        setFirstAnswered(true)
        setState({
          byLine,
          requiredAttributeKeys: res.required_attribute_keys ?? [],
          deferredAttributeKeys: res.deferred_attribute_keys ?? [],
          answeredKey: requestKey,
          failedKey: null,
        })
      })
      .catch(() => {
        // Aborted by a newer request: not a failure (a timeout is).
        if (ctrl.signal.aborted) return
        setState((prev) => ({ ...prev, failedKey: requestKey }))
      })
    return () => ctrl.abort()
    // The body is read through bodyRef: the key is what the request depends on.
  }, [active, debouncedKey, widgetToken])

  const checkFailed = active && state.failedKey === key
  return {
    byLine: state.byLine,
    requiredAttributeKeys: state.requiredAttributeKeys,
    deferredAttributeKeys: state.deferredAttributeKeys,
    isPending: active && !checkFailed && state.answeredKey !== key,
    checkFailed,
    answeredKey: state.answeredKey,
  }
}
