/**
 * Guest attributes: the per-guest facts (age, weight, shoe size, ...) a
 * product or one of its offers asks for. The server decides which attributes a
 * product needs (GET .../flow -> guest_attributes) and validates the values;
 * these pure helpers drive the 'About your guests' step.
 *
 * `age` is the same number as `occupant_age`: it is prefilled from the roster
 * age (the occupancy child-age flow) and written back to it, so there is one
 * age per guest.
 */
import type { FlowGuestAttribute, FlowRange } from '@/api/flowTypes'
import { pickLocalized } from '@/lib/locale'
import type { GuestAttributeValues } from './detailsTypes'
import { withInexact } from './inexact'

/** Adults from this age on (mirrors the API's occupant_age_band derivation). */
export const ADULT_FROM_AGE = 18

/** Fixed bounds of the well-known keys; the server enforces the same ones. */
const WELL_KNOWN_BOUNDS: Record<string, readonly [number, number]> = {
  age: [0, 120],
  weight_kg: [1, 300],
  height_cm: [30, 250],
  shoe_size_eu: [15, 60],
}

export const MAX_TEXT_LENGTH = 64

/** The guests the step lists: anyone with a name, in roster order. */
export interface GuestLike {
  first_name: string
  last_name: string
  occupant_age_band?: 'adult' | 'child'
  occupant_age?: number | null
  guest_attributes?: GuestAttributeValues
}

export type AttributeProblem = 'required' | 'not_a_number' | 'not_whole' | 'range' | 'choice' | 'too_long'

export interface Checked {
  value?: number | string
  problem?: AttributeProblem
}

/**
 * landr-zcb24.17: true when the operator collects this attribute before
 * arrival, not at booking. Either flag says so (`deferred` == not
 * `required_now`); a flow from an older API carries neither = required now.
 */
export function isDeferred(def: FlowGuestAttribute): boolean {
  return def.deferred === true || def.required_now === false
}

export function attributeLabel(def: FlowGuestAttribute, locale: string): string {
  return pickLocalized(def.label, def.label_localized, locale)
}

/** The [min, max] a numeric attribute accepts (well-known keys: platform bounds). */
export function attributeBounds(def: FlowGuestAttribute): [number | null, number | null] {
  const wk = WELL_KNOWN_BOUNDS[def.key]
  if (wk) return [wk[0], wk[1]]
  return [def.min_value ?? null, def.max_value ?? null]
}

/**
 * The current value of `key` for a guest. `age` is the roster age
 * (occupant_age) and nothing else: a copy kept in guest_attributes goes stale
 * when the party step changes the child's age or switches the guest to adult.
 */
export function currentValue(guest: GuestLike, key: string): number | string | undefined {
  if (key === 'age') return typeof guest.occupant_age === 'number' ? guest.occupant_age : undefined
  const v = guest.guest_attributes?.[key]
  return typeof v === 'number' || typeof v === 'string' ? v : undefined
}

/**
 * landr-zcb24.7: the ranges the guest picks from when the operator collects
 * this numeric attribute as ranges (a select instead of a number input), else
 * null. Ascending by floor.
 */
export function rangesOf(def: FlowGuestAttribute): readonly FlowRange[] | null {
  if (def.collect_as !== 'ranges' || (def.value_type !== 'number' && def.value_type !== 'integer')) return null
  const ranges = def.ranges ?? []
  return ranges.length > 0 ? [...ranges].sort((a, b) => a.min - b.min) : null
}

/** The range a stored value falls in (the highest floor at or below it). */
export function rangeOfValue(ranges: readonly FlowRange[], value: number): FlowRange | undefined {
  return [...ranges].reverse().find((r) => r.min <= value)
}

/** The option text of a range: the flow's own label, else its span with the unit. */
export function rangeLabel(range: FlowRange, unit?: string | null): string {
  if (range.label) return range.label
  const u = unit ? ` ${unit}` : ''
  return range.max == null ? `${range.min}+${u}` : `${range.min}-${range.max}${u}`
}

/**
 * What the 'About your guests' step asks of a flow: its `guest_attributes`
 * without `age` once the party step collects the age (`age_needed`; the API
 * already leaves it out, this keeps an older response from asking twice).
 */
export function askedAttributes(
  flow: { guest_attributes?: FlowGuestAttribute[]; age_needed?: boolean } | null | undefined,
): FlowGuestAttribute[] {
  const all = flow?.guest_attributes ?? []
  return flow?.age_needed ? all.filter((a) => a.key !== 'age') : all
}

/**
 * Whether the 'About your guests' step is worth showing: some attribute is
 * required now, or a deferred one already has an answer the guest may want to
 * change (they came back). When every attribute is deferred and nothing is
 * filled, the step is skipped -- the operator asks before arrival instead.
 */
export function guestStepNeeded(
  attributes: readonly FlowGuestAttribute[],
  guests: readonly GuestLike[],
): boolean {
  if (attributes.length === 0) return false
  if (attributes.some((a) => !isDeferred(a))) return true
  return guests.some((g) => attributes.some((a) => currentValue(g, a.key) !== undefined))
}

/**
 * The ranges of one attribute across several lines, split at every line's floors
 * (a range must not straddle a cut that another line's rules or prices use). A
 * range the lines agree on keeps its label; a new split gets a generated one.
 */
function mergeRanges(defs: readonly FlowGuestAttribute[]): FlowRange[] {
  const lists = defs.map((d) => rangesOf(d)).filter((r): r is readonly FlowRange[] => r !== null)
  const all = lists.flat()
  const floors = [...new Set(all.map((r) => r.min))].sort((a, b) => a - b)
  const unit = defs.find((d) => d.unit)?.unit
  const u = unit ? ` ${unit}` : ''
  const integer = defs.every((d) => d.value_type === 'integer')
  return floors.map((lo, i): FlowRange => {
    const hi = i + 1 < floors.length ? floors[i + 1]! : null
    const same = all.find((r) => r.min === lo && (r.max ?? null) === hi)
    if (same) return same
    const label =
      hi === null ? `${lo}+${u}` : i === 0 ? `<${hi}${u}` : `${lo}-${integer ? hi - 1 : hi}${u}`
    return { min: lo, max: hi, label }
  })
}

/**
 * The attributes of several lists, each key once, first definition wins. An
 * attribute collected as ranges in several lists keeps the ranges of all of
 * them merged (landr-zcb24.7).
 */
export function unionAttributes(
  ...lists: ReadonlyArray<readonly FlowGuestAttribute[] | null | undefined>
): FlowGuestAttribute[] {
  const seen = new Map<string, FlowGuestAttribute[]>()
  for (const list of lists) for (const def of list ?? []) seen.set(def.key, [...(seen.get(def.key) ?? []), def])
  return [...seen.values()].map((defs) => {
    const first = defs[0]!
    const ranged = defs.filter((d) => rangesOf(d) !== null)
    const merged =
      rangesOf(first) !== null && ranged.length > 1 ? { ...first, ranges: mergeRanges(ranged) } : first
    // Asked at booking by any line = asked at booking: required now wins over deferred.
    return isDeferred(merged) && defs.some((d) => !isDeferred(d))
      ? { ...merged, required_now: true, deferred: false }
      : merged
  })
}

/** The text a guest's input starts with. */
export function initialText(guest: GuestLike, key: string, def?: FlowGuestAttribute): string {
  const v = currentValue(guest, key)
  if (v === undefined) return ''
  // A ranges select shows the range the stored value falls in (a floor is its own range).
  const ranges = def ? rangesOf(def) : null
  const n = typeof v === 'number' ? v : Number(v)
  if (ranges && Number.isFinite(n)) return String(rangeOfValue(ranges, n)?.min ?? '')
  return String(v)
}

/** Check one raw input against its definition. Blank = required. */
export function checkAttribute(def: FlowGuestAttribute, raw: string): Checked {
  const text = raw.trim()
  if (text === '') return { problem: 'required' }
  if (def.value_type === 'text') {
    return text.length > MAX_TEXT_LENGTH ? { problem: 'too_long' } : { value: text }
  }
  if (def.value_type === 'choice') {
    return (def.choices ?? []).includes(text) ? { value: text } : { problem: 'choice' }
  }
  const ranges = rangesOf(def)
  if (ranges) {
    // The raw text is the picked range's floor; the API checks it against the cart's ranges.
    const hit = ranges.find((r) => String(r.min) === text)
    return hit ? { value: hit.min } : { problem: 'choice' }
  }
  const num = Number(text.replace(',', '.'))
  if (!Number.isFinite(num)) return { problem: 'not_a_number' }
  if (def.value_type === 'integer' && !Number.isInteger(num)) return { problem: 'not_whole' }
  const [lo, hi] = attributeBounds(def)
  if ((lo !== null && num < lo) || (hi !== null && num > hi)) return { problem: 'range' }
  return { value: num }
}

/** Raw input strings per guest index and attribute key. */
export type AttributeInputs = Record<number, Record<string, string>>

/** True when every guest has a valid value for every attribute required now. */
export function allAnswered(
  defs: readonly FlowGuestAttribute[],
  guests: readonly GuestLike[],
  inputs: AttributeInputs,
): boolean {
  return guests.every((g, i) =>
    defs.filter((d) => !isDeferred(d)).every((d) => checkAttribute(d, inputs[i]?.[d.key] ?? initialText(g, d.key, d)).value !== undefined),
  )
}

/**
 * Count of (guest, attribute) pairs still without a valid value. Deferred
 * attributes never count: they are optional and never block Continue.
 */
export function unansweredCount(
  defs: readonly FlowGuestAttribute[],
  guests: readonly GuestLike[],
  inputs: AttributeInputs,
): number {
  let n = 0
  guests.forEach((g, i) => {
    for (const d of defs) {
      if (isDeferred(d)) continue
      if (checkAttribute(d, inputs[i]?.[d.key] ?? initialText(g, d.key, d)).value === undefined) n += 1
    }
  })
  return n
}

/**
 * The guest with the answered attributes applied: `guest_attributes` gets the
 * asked keys, and `age` is written to `occupant_age` (+ the adult/child band).
 * Keys the step does not ask are left as they were.
 */
export function applyAttributes<G extends GuestLike>(
  guest: G,
  defs: readonly FlowGuestAttribute[],
  guestInputs: Record<string, string> | undefined,
): G & GuestLike {
  const attrs: GuestAttributeValues = { ...(guest.guest_attributes ?? {}) }
  const inexact: Record<string, boolean> = {}
  for (const d of defs) {
    const checked = checkAttribute(d, guestInputs?.[d.key] ?? initialText(guest, d.key, d))
    if (checked.value !== undefined) attrs[d.key] = checked.value
    else delete attrs[d.key]
    inexact[d.key] = checked.value !== undefined && rangesOf(d) !== null
  }
  // A key answered by a ranges select is stored as the range floor: flag it, the
  // way the API wants it; a key typed exactly is exact (a stale flag goes).
  let withFlags: GuestAttributeValues = attrs
  for (const [key, flag] of Object.entries(inexact)) withFlags = withInexact(withFlags, key, flag)
  const age = attrs.age
  const ageFields: Pick<GuestLike, 'occupant_age' | 'occupant_age_band'> =
    defs.some((d) => d.key === 'age') && typeof age === 'number'
      ? { occupant_age: age, occupant_age_band: age < ADULT_FROM_AGE ? 'child' : 'adult' }
      : {}
  return { ...guest, guest_attributes: withFlags, ...ageFields }
}

/** The submit-body fragment of a guest: `guest_attributes` only when non-empty. */
export function guestAttributesWire(guest: {
  guest_attributes?: GuestAttributeValues
}): { guest_attributes?: GuestAttributeValues } {
  const attrs = guest.guest_attributes
  return attrs && Object.keys(attrs).length > 0 ? { guest_attributes: attrs } : {}
}

/** The display name of guest `index` ("Ada Lovelace", or a numbered fallback). */
export function guestName(guest: GuestLike, index: number, fallback: (n: number) => string): string {
  const name = `${guest.first_name} ${guest.last_name}`.trim()
  return name || fallback(index + 1)
}
