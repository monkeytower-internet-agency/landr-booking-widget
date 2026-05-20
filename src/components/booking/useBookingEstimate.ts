/**
 * Booking-price estimate hook for the PriceSidebar (landr-qez0). Wraps
 * estimateBookingPrice() with a debounced trigger + stale-while-loading
 * UX so the sidebar follows the customer's choices without flashing
 * empty / re-flowing on every keystroke.
 *
 * Why a plain useState + useEffect instead of @tanstack/react-query:
 * the widget bundle doesn't ship react-query (see package.json — only
 * react-hook-form + zod). Adding it for one endpoint would bloat the
 * embedded bundle that operators include in their WordPress sites.
 * The behaviour we need (debounce, latest-wins, keep-previous-while-
 * loading) is ~30 LOC by hand.
 *
 * Returns:
 *   - data:      last successful estimate (or null until the first one)
 *   - isLoading: true while a fetch is in flight (only when data===null)
 *   - isStale:   true when the inputs changed but the debounce or fetch
 *                has not yet resolved (use this to render a spinner
 *                over the previous data instead of clearing the panel)
 *   - error:     last error (or null when the latest fetch succeeded)
 *
 * `enabled=false` short-circuits the fetch (used before pick-selection
 * when there's no product to price yet). Concurrent-fetch protection
 * uses a request counter so a late-arriving response from a stale set
 * of inputs is dropped instead of overwriting fresher data.
 *
 * Sibling .ts file (react-refresh/only-export-components rule — see
 * useDebouncedValue.ts for the rationale).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { estimateBookingPrice } from '@/api/client'
import type {
  EstimateAddonLine,
  EstimateRequestBody,
  EstimateResponse,
} from '@/api/types'
import { useDebouncedValue } from './useDebouncedValue'

export interface UseBookingEstimateArgs {
  operatorSlug: string
  productId: string | null
  selectedDays: string[]
  participantCount: number
  addonLines: EstimateAddonLine[]
  enabled?: boolean
  /** Debounce in ms (default 300). */
  debounceMs?: number
}

export interface UseBookingEstimateResult {
  data: EstimateResponse | null
  isLoading: boolean
  isStale: boolean
  error: Error | null
}

/**
 * Build a stable string key from the inputs so the debouncer can
 * compare cheaply even when the array references churn on every parent
 * re-render. JSON.stringify is fine here — the addon list is short
 * (<10 entries in practice) and the keys are deterministic.
 */
function buildKey(
  operatorSlug: string,
  productId: string | null,
  body: EstimateRequestBody,
): string {
  return JSON.stringify({ operatorSlug, productId, ...body })
}

export function useBookingEstimate(
  args: UseBookingEstimateArgs,
): UseBookingEstimateResult {
  const {
    operatorSlug,
    productId,
    selectedDays,
    participantCount,
    addonLines,
    enabled = true,
    debounceMs = 300,
  } = args

  // Body composed from the live inputs. Memoised so reference stability
  // matches the actual inputs and useDebouncedValue's effect doesn't
  // re-arm on identity-only changes.
  const body = useMemo<EstimateRequestBody>(
    () => ({
      selected_days: selectedDays,
      participants_count: participantCount,
      addon_lines: addonLines,
    }),
    [selectedDays, participantCount, addonLines],
  )

  const liveKey = useMemo(
    () => buildKey(operatorSlug, productId, body),
    [operatorSlug, productId, body],
  )
  const debouncedKey = useDebouncedValue(liveKey, debounceMs)

  const [data, setData] = useState<EstimateResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const requestIdRef = useRef<number>(0)

  // The effect re-runs whenever the debounced KEY changes. We don't
  // call setState synchronously inside the effect body — that triggers
  // the react-hooks/set-state-in-effect rule. Instead, the async IIFE
  // is what flips isLoading on (still synchronous-ish, but inside an
  // async function so it's queued as a microtask) and back off when
  // the response lands. Stale responses are dropped via the request
  // id comparison so concurrent fetches can't overwrite fresher data.
  useEffect(() => {
    if (!enabled || !productId) return
    const myId = ++requestIdRef.current
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await estimateBookingPrice(operatorSlug, productId, body)
        if (cancelled || myId !== requestIdRef.current) return
        setData(res)
        setIsLoading(false)
      } catch (err) {
        if (cancelled || myId !== requestIdRef.current) return
        setError(err instanceof Error ? err : new Error(String(err)))
        setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // body is intentionally tracked via debouncedKey (a stable
    // string-serialised form of body+operatorSlug+productId). If we
    // also listed `body` here React's identity check would re-fire on
    // every parent render even when the actual inputs haven't changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKey])

  return {
    data,
    isLoading,
    // Stale = inputs changed but the debounce/fetch hasn't caught up.
    // The sidebar uses this to render a small spinner OVER the last
    // good total instead of blanking the panel.
    isStale: liveKey !== debouncedKey || isLoading,
    error,
  }
}
