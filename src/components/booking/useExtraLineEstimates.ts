/**
 * Price estimates for the products added on the review step ("Add more to
 * this booking"): one estimate call per added line (see crossSell.ts for why
 * summing per-line estimates is exact). Latest request set wins; while a set
 * is in flight `pending` is true so the sidebar can show its stale state.
 */
import { useEffect, useMemo, useState } from 'react'
import { estimateBookingPrice } from '@/api/client'
import type { EstimateResponse } from '@/api/types'
import type { ExtraEstimateRequest } from './crossSell'

export interface ExtraLineEstimates {
  /** Estimates for the current request set, in order; null while pending or failed. */
  data: Array<{ estimate: EstimateResponse; quantity: number }> | null
  pending: boolean
  error: Error | null
}

const EMPTY: ExtraLineEstimates = { data: [], pending: false, error: null }

export function useExtraLineEstimates(
  operatorToken: string,
  requests: readonly ExtraEstimateRequest[],
): ExtraLineEstimates {
  const key = useMemo(
    () => JSON.stringify(requests.map((r) => [r.productId, r.body])),
    [requests],
  )
  const [state, setState] = useState<{ key: string; result: ExtraLineEstimates }>({
    key: '[]',
    result: EMPTY,
  })

  useEffect(() => {
    if (requests.length === 0) return
    let live = true
    Promise.all(requests.map((r) => estimateBookingPrice(operatorToken, r.productId, r.body)))
      .then((estimates) => {
        if (!live) return
        setState({
          key,
          result: {
            data: estimates.map((estimate) => ({ estimate, quantity: 1 })),
            pending: false,
            error: null,
          },
        })
      })
      .catch((err: unknown) => {
        if (!live) return
        setState({
          key,
          result: {
            data: null,
            pending: false,
            error: err instanceof Error ? err : new Error(String(err)),
          },
        })
      })
    return () => {
      live = false
    }
    // `key` captures the request content; `requests` itself churns per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorToken, key])

  if (requests.length === 0) return EMPTY
  if (state.key !== key) return { data: null, pending: true, error: null }
  // Quantity is applied at merge time, so a quantity change never refetches.
  const data = state.result.data
    ? state.result.data.map((d, i) => ({ ...d, quantity: requests[i]?.quantity ?? 1 }))
    : null
  return { ...state.result, data }
}
