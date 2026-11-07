/**
 * landr-zcb24.2: the party step asks every guest's age as a BAND. The flow
 * (`age_bands`) names the bands the cart needs: Child (exact age 0-17) and the
 * adult side, split at every age cut a price or rule uses ("Adult 18-64",
 * "Senior 65+"). An adult picks a band and the band FLOOR is stored as the age
 * with `age` listed in `guest_attributes._inexact`; a band never straddles a cut,
 * so the floor judges every rule like any real age in the band.
 *
 * landr-zcb24.7: when the operator collects `age` as exact (`age_collect_as`) the
 * flow has no bands: every guest gives an exact age (the booker 18+), stored
 * unflagged. Pure helpers.
 */
import type { FlowAgeBand } from '@/api/flowTypes'
import { pickLocalized } from '@/lib/locale'
import { tr } from '@/lib/strings'
import type { GuestAttributeValues } from './detailsTypes'
import { isInexact, withInexact } from './inexact'

/** From this age on a guest is an adult (the API's occupant_age_band split). */
export const ADULT_FROM = 18

/** What the party step offered before bands existed: Child / Adult. */
export const DEFAULT_AGE_BANDS: readonly FlowAgeBand[] = [
  { key: 'child', min_age: 0, max_age: ADULT_FROM - 1 },
  { key: 'adult', min_age: ADULT_FROM, max_age: null },
]

/** The flow's bands; Child / Adult when the flow has none. */
export function resolveBands(bands: readonly FlowAgeBand[] | null | undefined): readonly FlowAgeBand[] {
  return bands && bands.some((b) => b.min_age < ADULT_FROM) && bands.some((b) => b.min_age >= ADULT_FROM)
    ? bands
    : DEFAULT_AGE_BANDS
}

export const isAdultBand = (b: FlowAgeBand): boolean => b.min_age >= ADULT_FROM
export const adultBandsOf = (bands: readonly FlowAgeBand[]): FlowAgeBand[] =>
  [...bands].filter(isAdultBand).sort((a, b) => a.min_age - b.min_age)
/** Option order of a band select: the adult bands (ascending), then Child, as it always was. */
export const orderedBands = (bands: readonly FlowAgeBand[]): FlowAgeBand[] => [
  ...adultBandsOf(bands),
  ...bands.filter((b) => !isAdultBand(b)),
]
const childKey = (bands: readonly FlowAgeBand[]): string => bands.find((b) => !isAdultBand(b))?.key ?? 'child'

/** The option text of a band: translated Child / Adult, else the flow's own label. */
export function bandLabel(band: FlowAgeBand, bands: readonly FlowAgeBand[], locale: string): string {
  if (!isAdultBand(band)) return tr('childOption', locale)
  if (adultBandsOf(bands).length === 1) return tr('adultOption', locale)
  const own = pickLocalized(null, band.label_localized, locale)
  if (own) return own
  const span = band.max_age == null ? `${band.min_age}+` : `${band.min_age}-${band.max_age}`
  return `${tr('adultOption', locale)} ${span}`
}

/** Anyone whose age the party step records (booker mirror, roster row, companion). */
export interface AgeCarrier {
  occupant_age_band?: 'adult' | 'child' | null
  occupant_age?: number | null
  guest_attributes?: GuestAttributeValues
}

export interface AgeChoice {
  bandKey: string
  /** The exact age of a child; null until chosen and for adults. */
  age: number | null
}

/** The band a guest currently stands on (an unmarked guest is in the first adult band). */
export function ageChoice(g: AgeCarrier, bands: readonly FlowAgeBand[]): AgeChoice {
  if (g.occupant_age_band === 'child') {
    return { bandKey: childKey(bands), age: typeof g.occupant_age === 'number' ? g.occupant_age : null }
  }
  const adults = adultBandsOf(bands)
  const stored = typeof g.occupant_age === 'number' ? g.occupant_age : undefined
  const hit = stored === undefined ? undefined : [...adults].reverse().find((b) => b.min_age <= stored)
  return { bandKey: (hit ?? adults[0] ?? bands[0]).key, age: null }
}

/**
 * The guest with `bandKey` applied. `storeFloor` (the flow asks age): an adult
 * band writes its floor as the age plus `age_exact=false`. Without it an adult
 * carries no age, as before bands existed.
 */
export function withAgeChoice<G extends AgeCarrier>(
  g: G,
  bands: readonly FlowAgeBand[],
  bandKey: string,
  childAge: number | null,
  storeFloor: boolean,
): G {
  const band = bands.find((b) => b.key === bandKey) ?? adultBandsOf(bands)[0]
  // The age lives in occupant_age: a stale copy in guest_attributes would disagree.
  const rest: GuestAttributeValues = withInexact(g.guest_attributes, 'age', false)
  delete rest.age
  if (band && !isAdultBand(band)) {
    return { ...g, occupant_age_band: 'child', occupant_age: childAge, guest_attributes: rest }
  }
  if (storeFloor && band) {
    return {
      ...g,
      occupant_age_band: 'adult',
      occupant_age: band.min_age,
      guest_attributes: withInexact(rest, 'age', true),
    }
  }
  return { ...g, occupant_age_band: 'adult', occupant_age: null, guest_attributes: rest }
}

/** The smallest exact age of an adult guest and the booker; the largest anyone can give. */
export const MAX_EXACT_AGE = 120

/** `raw` read as a whole age, else null (blank, fractional, negative, over 120). */
export function parseExactAge(raw: string): number | null {
  const text = raw.trim()
  if (!/^\d{1,3}$/.test(text)) return null
  const n = Number(text)
  return n <= MAX_EXACT_AGE ? n : null
}

/** True when `age` is a usable exact age (the booker: 18 or older). */
export const isValidExactAge = (age: number | null | undefined, booker = false): boolean =>
  typeof age === 'number' &&
  Number.isInteger(age) &&
  age >= (booker ? ADULT_FROM : 0) &&
  age <= MAX_EXACT_AGE

/**
 * The guest with an exact age (`age_collect_as = exact`): the age is the roster
 * age, under 18 the guest is a child; null until typed. Never flagged inexact.
 */
export function withExactAge<G extends AgeCarrier>(g: G, age: number | null): G {
  const rest: GuestAttributeValues = withInexact(g.guest_attributes, 'age', false)
  delete rest.age
  return {
    ...g,
    occupant_age_band: age !== null && age < ADULT_FROM ? 'child' : 'adult',
    occupant_age: age,
    guest_attributes: rest,
  }
}

/** The exact age a guest has, else null. */
export const exactAgeOf = (g: AgeCarrier): number | null =>
  typeof g.occupant_age === 'number' ? g.occupant_age : null

/** `g` with its current band written out (an untouched guest is stamped adult). */
export function stampAge<G extends AgeCarrier>(g: G, bands: readonly FlowAgeBand[], storeFloor: boolean): G {
  const c = ageChoice(g, bands)
  return withAgeChoice(g, bands, c.bandKey, c.age, storeFloor)
}

/** The floor an adult band was stored as (`age` in `_inexact`), else undefined. */
export function adultFloorOf(g: AgeCarrier): number | undefined {
  return g.occupant_age_band !== 'child' &&
    isInexact(g.guest_attributes, 'age') &&
    typeof g.occupant_age === 'number'
    ? g.occupant_age
    : undefined
}

/** The bands of several lines merged: one adult floor each, labels from the first list that has them. */
export function mergeBands(lists: ReadonlyArray<readonly FlowAgeBand[] | null | undefined>): readonly FlowAgeBand[] {
  const real = lists.filter((l): l is readonly FlowAgeBand[] => !!l && l.length > 0)
  if (real.length === 0) return DEFAULT_AGE_BANDS
  if (real.length === 1) return resolveBands(real[0])
  const floors = [...new Set(real.flatMap((l) => adultBandsOf(l).map((b) => b.min_age)))].sort((a, b) => a - b)
  const adults = floors.map((lo, i): FlowAgeBand => {
    const hi = i + 1 < floors.length ? floors[i + 1] - 1 : null
    const same = real.flatMap((l) => l).find((b) => isAdultBand(b) && b.min_age === lo && (b.max_age ?? null) === hi)
    return same ?? { key: i === 0 ? 'adult' : `age_${lo}_${hi ?? 'plus'}`, min_age: lo, max_age: hi }
  })
  return [real[0].find((b) => !isAdultBand(b)) ?? DEFAULT_AGE_BANDS[0], ...adults]
}

/**
 * landr-zcb24.12: the guests the review step must ask again. The party step
 * asked with the main flow's bands (`base`) and stored each adult's band FLOOR.
 * An added line can bring a cut the main bands lack, so `merged` splits some
 * band in two: a guest whose floor sits in a band that now splits (a merged floor
 * strictly between their floor and the next base floor) may be on either side,
 * and their stored floor would judge a rule of the new cut wrongly. `floors` are
 * the stored adult floors by roster index (children and exact ages are not
 * listed: a child's age is exact already).
 */
export function guestsToReask(
  base: readonly FlowAgeBand[],
  merged: readonly FlowAgeBand[],
  floors: Readonly<Record<number, number | undefined>>,
): number[] {
  const baseFloors = adultBandsOf(base).map((b) => b.min_age)
  const mergedFloors = adultBandsOf(merged).map((b) => b.min_age)
  const out: number[] = []
  for (const [k, floor] of Object.entries(floors)) {
    if (floor === undefined) continue
    const next = baseFloors.find((f) => f > floor) ?? Infinity
    if (mergedFloors.some((f) => f > floor && f < next)) out.push(Number(k))
  }
  return out.sort((a, b) => a - b)
}

/**
 * The wire fields of a guest's age that ride beside the child fields:
 * an adult band's floor as `occupant_age` plus `age` in `guest_attributes._inexact`.
 * An adult with an exact age (`exactAge`, the party step's number or the review
 * step's inline one) sends it as `occupant_age` unflagged. A child (or a guest
 * without either) sends the attributes without the flag. `inlineFloor` is the
 * floor picked on the review step.
 */
export function adultAgeWire(
  g: AgeCarrier,
  isChild: boolean,
  inlineFloor?: number,
  inlineExactAge?: number,
): { occupant_age?: number; guest_attributes?: GuestAttributeValues } {
  const attrs = withInexact(g.guest_attributes, 'age', false)
  const floor = isChild ? undefined : (inlineFloor ?? adultFloorOf(g))
  if (floor !== undefined) {
    return { occupant_age: floor, guest_attributes: withInexact(attrs, 'age', true) }
  }
  const exact = isChild ? undefined : (inlineExactAge ?? (typeof g.occupant_age === 'number' ? g.occupant_age : undefined))
  const rest: { guest_attributes?: GuestAttributeValues } = Object.keys(attrs).length > 0 ? { guest_attributes: attrs } : {}
  return exact !== undefined ? { occupant_age: exact, ...rest } : rest
}
