/**
 * landr-zorj8: the sub-line under an age-banded charge (tourist tax) that says
 * who is counted, e.g. "2 guests from 10 · Olaf (adult), Alyda Maria (12)".
 * The API reports the bands and their guest counts; the names and ages are the
 * party's own (the same members the estimate was sent).
 */
import { ADULT_FROM } from './ageBands'
import type { PartyMember } from './offerCart'
import type { EstimateLineItem } from '@/api/types'
import { fmt, tr } from '@/lib/strings'

type Bands = NonNullable<EstimateLineItem['attribute_bands']>

export function taxedGuestsLine(
  summary: EstimateLineItem['attribute_bands'],
  members: readonly PartyMember[],
  locale?: string,
): string | null {
  const s = summary as Bands | null | undefined
  if (!s || s.attribute_key !== 'age') return null
  const used = (s.bands ?? []).filter((b) => (b.guests ?? 0) > 0)
  if (used.length === 0) return null
  const counted = members.filter((m) => {
    const age = m.attributes.age
    return (
      typeof age === 'number' &&
      used.some((b) => age >= (b.min ?? 0) && (b.max == null || age <= b.max))
    )
  })
  if (counted.length === 0) return null
  const count = used.reduce((n, b) => n + (b.guests ?? 0), 0)
  const rangeOf = (b: (typeof used)[number]): string =>
    b.max == null
      ? fmt(tr('taxedRangeFrom', locale), { min: b.min ?? 0 })
      : (b.min ?? 0) <= 0
        ? fmt(tr('taxedRangeUpTo', locale), { max: b.max })
        : fmt(tr('taxedRangeBetween', locale), { min: b.min ?? 0, max: b.max })
  const range = used.map(rangeOf).join(', ')
  const who = counted
    .map((m) => {
      const age = m.attributes.age as number
      return `${m.name} (${age >= ADULT_FROM ? tr('taxedAdult', locale) : age})`
    })
    .join(', ')
  const head = fmt(tr(count === 1 ? 'taxedGuestsOne' : 'taxedGuestsMany', locale), { count, range })
  return `${head} · ${who}`
}
