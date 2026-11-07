/**
 * landr-zcb24.7: `guest_attributes._inexact` lists the keys whose stored value is
 * the FLOOR of a range the guest picked (an adult age band, a weight range)
 * rather than a number they gave. The API validates the floor against the
 * cart's ranges. Pure helpers shared by the age bands and the range selects.
 */
import type { GuestAttributeValues } from './detailsTypes'

export const INEXACT_KEY = '_inexact'
/** The flag before ranges existed: `age_exact = false` meant `age` is a floor. */
const LEGACY_AGE_EXACT = 'age_exact'

/** The keys stored as a range floor (the legacy age flag counts as `age`). */
export function inexactKeys(attrs: GuestAttributeValues | undefined): string[] {
  const out = new Set<string>()
  const listed = attrs?.[INEXACT_KEY]
  if (Array.isArray(listed)) for (const k of listed) if (typeof k === 'string') out.add(k)
  if (attrs?.[LEGACY_AGE_EXACT] === false) out.add('age')
  return [...out].sort()
}

export const isInexact = (attrs: GuestAttributeValues | undefined, key: string): boolean =>
  inexactKeys(attrs).includes(key)

/** `attrs` with `key` flagged (or not) as a range floor; the legacy flag is folded in. */
export function withInexact(
  attrs: GuestAttributeValues | undefined,
  key: string,
  inexact: boolean,
): GuestAttributeValues {
  const keys = new Set(inexactKeys(attrs))
  if (inexact) keys.add(key)
  else keys.delete(key)
  const rest: GuestAttributeValues = { ...(attrs ?? {}) }
  delete rest[INEXACT_KEY]
  delete rest[LEGACY_AGE_EXACT]
  return keys.size > 0 ? { ...rest, [INEXACT_KEY]: [...keys].sort() } : rest
}
