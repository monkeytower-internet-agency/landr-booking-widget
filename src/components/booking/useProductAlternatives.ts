import { useEffect, useMemo, useRef, useState } from 'react'
import { getProductAlternatives } from '@/api/client'
import type { ProductAlternative } from '@/api/types'
import { isoDate } from '@/components/booking/dateUtils'
import { mergeAlternatives, monthRange } from '@/components/booking/alternatives'

/**
 * Alternatives of a product for the given `YYYY-MM` months: one request per
 * month, cached for the life of the component, fetched again only for a month
 * not seen yet (paging). Returns the merged list, or null until every wanted
 * month has answered. A failed month counts as "none" so the panel just stays
 * away; it never blocks the picker.
 */
export function useProductAlternatives(
  productId: string,
  months: string[],
  party: number,
): ProductAlternative[] | null {
  const [cache, setCache] = useState<Record<string, ProductAlternative[]>>({})
  const inflight = useRef(new Set<string>())
  const monthsDep = months.join(',')

  useEffect(() => {
    const todayIso = isoDate(new Date())
    for (const m of monthsDep.split(',').filter(Boolean)) {
      const key = `${productId}|${party}|${m}`
      if (inflight.current.has(key)) continue
      inflight.current.add(key)
      const range = monthRange(m, todayIso)
      const request = range
        ? getProductAlternatives(productId, range.from, range.to, party)
        : Promise.resolve([] as ProductAlternative[])
      void request
        .catch(() => [] as ProductAlternative[])
        .then((list) => setCache((c) => ({ ...c, [key]: list })))
    }
  }, [productId, party, monthsDep])

  return useMemo(() => {
    const wanted = monthsDep.split(',').filter(Boolean)
    const lists = wanted.map((m) => cache[`${productId}|${party}|${m}`])
    if (lists.length === 0 || lists.some((l) => l === undefined)) return null
    return mergeAlternatives(lists as ProductAlternative[][])
  }, [cache, monthsDep, productId, party])
}
