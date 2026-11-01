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
import type { FlowGuestAttribute } from '@/api/flowTypes'
import { pickLocalized } from '@/lib/locale'
import type { GuestAttributeValues } from './detailsTypes'

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

export function attributeLabel(def: FlowGuestAttribute, locale: string): string {
  return pickLocalized(def.label, def.label_localized, locale)
}

/** The [min, max] a numeric attribute accepts (well-known keys: platform bounds). */
export function attributeBounds(def: FlowGuestAttribute): [number | null, number | null] {
  const wk = WELL_KNOWN_BOUNDS[def.key]
  if (wk) return [wk[0], wk[1]]
  return [def.min_value ?? null, def.max_value ?? null]
}

/** The stored value of `key` for a guest, falling back to the roster age. */
export function currentValue(guest: GuestLike, key: string): number | string | undefined {
  const own = guest.guest_attributes?.[key]
  if (own !== undefined) return own
  if (key === 'age' && typeof guest.occupant_age === 'number') return guest.occupant_age
  return undefined
}

/** The text a guest's input starts with. */
export function initialText(guest: GuestLike, key: string): string {
  const v = currentValue(guest, key)
  return v === undefined ? '' : String(v)
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
  const num = Number(text.replace(',', '.'))
  if (!Number.isFinite(num)) return { problem: 'not_a_number' }
  if (def.value_type === 'integer' && !Number.isInteger(num)) return { problem: 'not_whole' }
  const [lo, hi] = attributeBounds(def)
  if ((lo !== null && num < lo) || (hi !== null && num > hi)) return { problem: 'range' }
  return { value: num }
}

/** Raw input strings per guest index and attribute key. */
export type AttributeInputs = Record<number, Record<string, string>>

/** True when every guest has a valid value for every asked attribute. */
export function allAnswered(
  defs: readonly FlowGuestAttribute[],
  guests: readonly GuestLike[],
  inputs: AttributeInputs,
): boolean {
  return guests.every((g, i) =>
    defs.every((d) => checkAttribute(d, inputs[i]?.[d.key] ?? initialText(g, d.key)).value !== undefined),
  )
}

/** Count of (guest, attribute) pairs still without a valid value. */
export function unansweredCount(
  defs: readonly FlowGuestAttribute[],
  guests: readonly GuestLike[],
  inputs: AttributeInputs,
): number {
  let n = 0
  guests.forEach((g, i) => {
    for (const d of defs) {
      if (checkAttribute(d, inputs[i]?.[d.key] ?? initialText(g, d.key)).value === undefined) n += 1
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
  for (const d of defs) {
    const checked = checkAttribute(d, guestInputs?.[d.key] ?? initialText(guest, d.key))
    if (checked.value !== undefined) attrs[d.key] = checked.value
    else delete attrs[d.key]
  }
  const age = attrs.age
  const ageFields: Pick<GuestLike, 'occupant_age' | 'occupant_age_band'> =
    defs.some((d) => d.key === 'age') && typeof age === 'number'
      ? { occupant_age: age, occupant_age_band: age < ADULT_FROM_AGE ? 'child' : 'adult' }
      : {}
  return { ...guest, guest_attributes: attrs, ...ageFields }
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
