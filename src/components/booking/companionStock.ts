/**
 * landr-a27k9.2: per-DAY stock of a parent's add-ons, for the companion cards
 * (an add-on the guest books on a subset of the parent's days).
 *
 * The add-ons endpoint judges stock over ALL the days it is sent (the lowest
 * remaining), so one full night would sell the whole add-on out. A companion
 * card needs it per day -- a full night's chip is disabled, the stepper stops
 * at the lowest remaining across the PICKED days -- so each day is asked on
 * its own. A day whose lookup fails is simply absent: the card stays usable
 * and the API still judges the submit.
 */
import { useEffect, useMemo, useState } from 'react'
import { getProductAddons } from '@/api/client'
import type { CompanionDayStock } from './addonsState'

/** Most days looked up one by one; a longer stay falls back to the API's submit check. */
export const COMPANION_STOCK_MAX_DAYS = 31

export async function fetchCompanionDayStock(
  parentProductId: string,
  days: readonly string[],
  participants: number,
): Promise<CompanionDayStock> {
  const unique = [...new Set(days)]
  const out: CompanionDayStock = {}
  if (unique.length === 0 || unique.length > COMPANION_STOCK_MAX_DAYS) return out
  await Promise.all(
    unique.map(async (day) => {
      try {
        const rows = await getProductAddons(parentProductId, {
          selectedDays: [day],
          participants,
        })
        const verdicts: CompanionDayStock[string] = {}
        for (const r of rows) {
          verdicts[r.addon_product_id] = {
            available: r.available !== false,
            remaining: typeof r.stock_remaining === 'number' ? r.stock_remaining : null,
          }
        }
        out[day] = verdicts
      } catch {
        /* fail open: this day stays selectable */
      }
    }),
  )
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
