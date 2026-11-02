/**
 * landr-a27k9.2 / .6: per-DAY stock of a parent's add-ons, for the companion
 * cards (an add-on the guest books on a subset of the parent's days).
 *
 * The add-ons endpoint judges stock over ALL the days it is sent (the lowest
 * remaining), so one full night would sell the whole add-on out. A companion
 * card needs it per day -- a full night's chip is disabled, the stepper stops
 * at the lowest remaining across the PICKED days -- so the batch lookup judges
 * each day on its own, in one call. A failed lookup leaves the card usable
 * (fail open) and the API still judges the submit.
 */
import { useEffect, useMemo, useState } from 'react'
import { getProductAddonsDayStock } from '@/api/client'
import type { DayStock as CompanionDayStock } from './offerCart'

/** Most days looked up at once (the API's cap for the batch lookup); a longer stay falls back to the API's submit check. */
export const COMPANION_STOCK_MAX_DAYS = 31

export async function fetchCompanionDayStock(
  parentProductId: string,
  days: readonly string[],
  participants: number,
): Promise<CompanionDayStock> {
  const unique = [...new Set(days)]
  const out: CompanionDayStock = {}
  if (unique.length === 0 || unique.length > COMPANION_STOCK_MAX_DAYS) return out
  try {
    const rows = await getProductAddonsDayStock(parentProductId, unique, participants)
    for (const r of rows) {
      const verdicts = (out[r.day] ??= {})
      verdicts[r.addon_product_id] = {
        available: r.available !== false,
        remaining: typeof r.stock_remaining === 'number' ? r.stock_remaining : null,
      }
    }
  } catch {
    /* fail open: every day stays selectable */
  }
  return out
}

/**
 * The per-day stock for `days` of `parentProductId`, or null while loading /
 * when `enabled` is false. Re-fetches when the parent, the days or the party
 * size change.
 */
export function useCompanionDayStock(
  parentProductId: string | undefined,
  days: readonly string[],
  participants: number | undefined,
  enabled: boolean,
): CompanionDayStock | null {
  const daysKey = days.join(',')
  const key = useMemo(
    () => `${parentProductId ?? ''}|${daysKey}|${participants ?? 0}`,
    [parentProductId, daysKey, participants],
  )
  const [state, setState] = useState<{ key: string; stock: CompanionDayStock } | null>(
    null,
  )
  const active = enabled && !!parentProductId && !!participants && daysKey !== ''
  useEffect(() => {
    if (!active || !parentProductId || !participants) return
    let cancelled = false
    void fetchCompanionDayStock(parentProductId, daysKey.split(','), participants).then(
      (stock) => {
        if (!cancelled) setState({ key, stock })
      },
    )
    return () => {
      cancelled = true
    }
  }, [active, key, parentProductId, daysKey, participants])
  return active && state?.key === key ? state.stock : null
}
