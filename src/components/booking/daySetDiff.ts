import { isoDate } from '@/components/booking/dateUtils'

/**
 * landr-otml0.3 — ported verbatim from the dashboard's
 * `src/components/calendar/daySetDiff.ts` (landr-q4t3, itself extracted from
 * MultiDayPicker's inline diff `useMemo`, landr-fxza.5 Section C — which in
 * turn started life in THIS widget before landr-fxza.5 ported it to the
 * dashboard). Kept in step per landr-otml0.3's ticket note: no shared
 * package between the two repos yet.
 */
export type DayDiff = {
  added: string[]
  removed: string[]
  hasDiff: boolean
}

export function computeDayDiff(
  valueSet: ReadonlySet<string>,
  originalValue: Date[] | undefined,
): DayDiff | null {
  if (!originalValue) return null
  const originalSet = new Set(originalValue.map(isoDate))
  const added: string[] = []
  const removed: string[] = []
  for (const iso of valueSet) {
    if (!originalSet.has(iso)) added.push(iso)
  }
  for (const iso of originalSet) {
    if (!valueSet.has(iso)) removed.push(iso)
  }
  added.sort()
  removed.sort()
  return { added, removed, hasDiff: added.length > 0 || removed.length > 0 }
}
