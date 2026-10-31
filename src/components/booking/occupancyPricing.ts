/**
 * landr-hfvyc.2: guest-based stay pricing helpers (contract: landr-hfvyc.1).
 * A stay whose product payload carries `occupancy_pricing` prices by who
 * sleeps there: adults beyond the included count and children by age band.
 * Pure — the UI (DetailsStep) and the estimate hooks share these.
 */
import { fmt, tr } from '@/lib/strings'
import type { OccupancyPricing, Product } from '@/api/types'
import { formatMoney } from './priceSidebarHelpers'

/** True when any of the given products (main or cross-sell line) has a rule. */
export function hasOccupancyPricing(
  ...products: ReadonlyArray<Pick<Product, 'occupancy_pricing'> | null | undefined>
): boolean {
  return products.some((p) => !!p?.occupancy_pricing)
}

interface GuestAge {
  occupant_age_band?: 'adult' | 'child'
  occupant_age?: number | null
}

/**
 * Roster -> estimate `child_ages`. Only children with a valid age (0-17)
 * count; a child still missing an age is blocked upstream and priced as an
 * adult meanwhile. Never more than `participantCount - 1` (the API's cap).
 */
export function childAgesFromRoster(
  guests: readonly GuestAge[],
  participantCount: number,
): number[] {
  const ages: number[] = []
  for (const g of guests) {
    if (g.occupant_age_band !== 'child') continue
    const age = g.occupant_age
    if (typeof age === 'number' && Number.isInteger(age) && age >= 0 && age <= 17) {
      ages.push(age)
    }
  }
  return ages.slice(0, Math.max(0, participantCount - 1))
}

/** True when a guest is marked child but has no age yet (blocks Continue). */
export function hasChildWithoutAge(guests: readonly GuestAge[]): boolean {
  return guests.some(
    (g) => g.occupant_age_band === 'child' && (g.occupant_age === null || g.occupant_age === undefined),
  )
}

/**
 * The short price-model line, e.g.
 * "incl. 2 adults - additional adults +25 EUR/night - children 3-11 +12 EUR/night".
 */
export function occupancyBlurb(
  rule: OccupancyPricing,
  currency: string,
  locale?: string,
): string {
  const parts: string[] = [
    rule.included_adults === 1
      ? tr('occupancyIncludedOne', locale)
      : fmt(tr('occupancyIncludedMany', locale), { count: rule.included_adults }),
  ]
  if (Number(rule.extra_adult_per_night) > 0) {
    parts.push(
      fmt(tr('occupancyExtraAdult', locale), {
        price: formatMoney(rule.extra_adult_per_night, currency, locale),
      }),
    )
  }
  const bands = [...rule.child_bands].sort((a, b) => a.min_age - b.min_age)
  for (const b of bands) {
    const free = !(Number(b.per_night) > 0)
    parts.push(
      fmt(tr(free ? 'occupancyChildBandFree' : 'occupancyChildBand', locale), {
        from: b.min_age,
        to: b.max_age,
        price: formatMoney(b.per_night, currency, locale),
      }),
    )
  }
  return parts.join(' · ')
}
