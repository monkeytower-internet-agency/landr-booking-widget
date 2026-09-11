/**
 * landr-r6e5x.4 — per-participant guide-language assignment (pure helpers).
 *
 * Epic decision D3: every party member (guiding participants AND non-guiding
 * companions) is assigned to EXACTLY ONE of the operator's offered guide
 * languages before the booking can be submitted. This replaces the old
 * booking-level multi-select, which could not tell the calendar which flag
 * belongs to which person.
 *
 * The map is keyed by the UNIFIED PARTY INDEX — participants 0..P-1, then
 * companions P..P+C-1 — exactly the index space `accommodationCalc` /
 * `RoomAssignment` already work in, so `partyIdentity`'s existing
 * identity↔index conversion helpers carry it across step boundaries
 * unchanged (see PartyLanguageMap there).
 *
 * Kept separate from ParticipantLanguageBoard.tsx so that file exports only
 * its component (react-refresh/only-export-components — landr-znl), mirroring
 * the accommodationCalc.ts / RoomAssignment.tsx split.
 *
 * NEVER throws: the widget has no React error boundary (bd memory landr-9ut4),
 * so every helper here degrades on malformed input rather than raising.
 */

/** Party-member index → assigned ISO 639-1 language code. */
export type ParticipantLanguageMap = Record<number, string>

/**
 * The platform default offered set — the same four languages the API's
 * `operators.offered_languages` column defaults to (landr-r6e5x.2's
 * migration), and what the widget falls back to when the public operator
 * config predates that column or returns something malformed. A hard-coded
 * fallback is required rather than an empty list: with no columns at all the
 * step would be unusable and the booking unsubmittable.
 */
export const DEFAULT_OFFERED_LANGUAGES: readonly string[] = ['en', 'de', 'es', 'fr']

/** ISO 639-1 → display name. Codes outside the table fall back to the code. */
const LANGUAGE_NAMES: Record<string, string> = {
  ar: 'Arabic',
  bg: 'Bulgarian',
  bs: 'Bosnian',
  ca: 'Catalan',
  cs: 'Czech',
  da: 'Danish',
  de: 'German',
  el: 'Greek',
  en: 'English',
  es: 'Spanish',
  et: 'Estonian',
  eu: 'Basque',
  fi: 'Finnish',
  fr: 'French',
  ga: 'Irish',
  gl: 'Galician',
  he: 'Hebrew',
  hi: 'Hindi',
  hr: 'Croatian',
  hu: 'Hungarian',
  id: 'Indonesian',
  is: 'Icelandic',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  lt: 'Lithuanian',
  lv: 'Latvian',
  mk: 'Macedonian',
  nl: 'Dutch',
  no: 'Norwegian',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  sk: 'Slovak',
  sl: 'Slovenian',
  sq: 'Albanian',
  sr: 'Serbian',
  sv: 'Swedish',
  th: 'Thai',
  tr: 'Turkish',
  uk: 'Ukrainian',
  vi: 'Vietnamese',
  zh: 'Chinese',
}

/**
 * ISO 639-1 → a representative flag emoji. A language is not a country, so
 * this is deliberately "the flag customers associate with the language"
 * rather than anything authoritative; codes with no obvious single flag (or
 * no entry at all) get the neutral globe so a column always has a face.
 */
const LANGUAGE_FLAGS: Record<string, string> = {
  bg: '🇧🇬',
  bs: '🇧🇦',
  cs: '🇨🇿',
  da: '🇩🇰',
  de: '🇩🇪',
  el: '🇬🇷',
  en: '🇬🇧',
  es: '🇪🇸',
  et: '🇪🇪',
  fi: '🇫🇮',
  fr: '🇫🇷',
  ga: '🇮🇪',
  he: '🇮🇱',
  hi: '🇮🇳',
  hr: '🇭🇷',
  hu: '🇭🇺',
  id: '🇮🇩',
  is: '🇮🇸',
  it: '🇮🇹',
  ja: '🇯🇵',
  ko: '🇰🇷',
  lt: '🇱🇹',
  lv: '🇱🇻',
  mk: '🇲🇰',
  nl: '🇳🇱',
  no: '🇳🇴',
  pl: '🇵🇱',
  pt: '🇵🇹',
  ro: '🇷🇴',
  ru: '🇷🇺',
  sk: '🇸🇰',
  sl: '🇸🇮',
  sq: '🇦🇱',
  sr: '🇷🇸',
  sv: '🇸🇪',
  th: '🇹🇭',
  tr: '🇹🇷',
  uk: '🇺🇦',
  vi: '🇻🇳',
  zh: '🇨🇳',
}

const NEUTRAL_FLAG = '🌐'

/** Display name for a language code — falls back to the upper-cased code. */
export function languageName(code: string): string {
  const key = String(code ?? '').toLowerCase()
  return LANGUAGE_NAMES[key] ?? key.toUpperCase()
}

/** Flag emoji for a language code — the neutral globe when unmapped. */
export function languageFlag(code: string): string {
  return LANGUAGE_FLAGS[String(code ?? '').toLowerCase()] ?? NEUTRAL_FLAG
}

/**
 * Coerce whatever the public operator config handed us into a usable offered
 * list: lower-cased two-letter codes, de-duplicated, order preserved.
 *
 * `fallback` is consulted (and the miss logged once per call) when the input
 * is absent or yields nothing usable — the operator column is brand new
 * (landr-r6e5x.2), so a widget deployed ahead of the API, or pointed at an
 * older tier, must still render a working step rather than an empty board.
 */
export function normaliseOfferedLanguages(
  raw: unknown,
  fallback: readonly string[] = DEFAULT_OFFERED_LANGUAGES,
): string[] {
  const cleaned: string[] = []
  const seen = new Set<string>()
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry !== 'string') continue
      const code = entry.trim().toLowerCase()
      if (!/^[a-z]{2}$/.test(code)) continue
      if (seen.has(code)) continue
      seen.add(code)
      cleaned.push(code)
    }
  }
  if (cleaned.length > 0) return cleaned
  console.warn(
    '[booking-widget] operator offered_languages missing or unusable; falling back to',
    fallback,
  )
  return [...fallback]
}

/**
 * Party-member indices with no language yet, in party order. `count` is the
 * whole party size (participants + companions), so a member appended after
 * the map was built is correctly reported as unassigned.
 */
export function unassignedMemberIndices(
  count: number,
  assignment: ParticipantLanguageMap,
): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i += 1) {
    if (typeof assignment[i] !== 'string') out.push(i)
  }
  return out
}

/** Party-member indices assigned to `code`, in party order. */
export function membersOfLanguage(
  assignment: ParticipantLanguageMap,
  code: string,
  count: number,
): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i += 1) {
    if (assignment[i] === code) out.push(i)
  }
  return out
}

/**
 * The distinct assigned languages, BOOKER FIRST then the rest alphabetically.
 *
 * This is what gets mirrored into the form's `languages` answer and (until
 * the API derives it itself) `bookings.customer_languages`. The order is not
 * cosmetic: the pre-existing contract is that the FIRST entry is the
 * customer's preferred language and the backend picks the confirmation
 * email's locale from it (see RankedLanguagePicker, the ranked multi-select
 * this board replaces). Party index 0 is always the booker
 * (`bookerToParticipant` mirrors them into participants[0]), so their choice
 * is the preference — the board has no separate ranking gesture.
 */
export function distinctAssignedLanguages(
  assignment: ParticipantLanguageMap,
  count: number,
): string[] {
  const seen = new Set<string>()
  for (let i = 0; i < count; i += 1) {
    const code = assignment[i]
    if (typeof code === 'string' && code) seen.add(code)
  }
  const bookerCode = assignment[0]
  const rest = [...seen].sort()
  if (typeof bookerCode === 'string' && seen.has(bookerCode)) {
    return [bookerCode, ...rest.filter((c) => c !== bookerCode)]
  }
  return rest
}

/**
 * Drop entries that no longer make sense against the CURRENT party size and
 * offered list — a member who left the party, or a language the operator
 * stopped offering while the customer had the tab open. Dropping rather than
 * remapping is deliberate: the person simply shows up unassigned again and
 * the submit gate makes the customer re-pick, which is always right.
 */
export function pruneLanguageAssignment(
  assignment: ParticipantLanguageMap,
  offered: readonly string[],
  count: number,
): ParticipantLanguageMap {
  const allowed = new Set(offered)
  const out: ParticipantLanguageMap = {}
  for (let i = 0; i < count; i += 1) {
    const code = assignment[i]
    if (typeof code === 'string' && allowed.has(code)) out[i] = code
  }
  return out
}

/**
 * Which language columns are on screen: every column the customer explicitly
 * opened, PLUS every language somebody is already assigned to (so a restored
 * draft never hides an assignment behind a closed column), intersected with
 * what the operator actually offers and ordered by the offered list.
 */
export function openLanguageColumns(
  opened: readonly string[],
  assignment: ParticipantLanguageMap,
  offered: readonly string[],
  count: number,
): string[] {
  const live = new Set<string>()
  for (const code of opened) live.add(code)
  for (const code of distinctAssignedLanguages(assignment, count)) live.add(code)
  return offered.filter((code) => live.has(code))
}

/** True when every party member has a language — the submit gate. */
export function isLanguageAssignmentComplete(
  count: number,
  assignment: ParticipantLanguageMap,
): boolean {
  return unassignedMemberIndices(count, assignment).length === 0
}

/**
 * Assign (or, with `code === null`, unassign) one member. Pure — returns a
 * fresh map so callers can hand it straight to setState.
 */
export function applyLanguageAssignment(
  assignment: ParticipantLanguageMap,
  memberIndex: number,
  code: string | null,
): ParticipantLanguageMap {
  const next: ParticipantLanguageMap = { ...assignment }
  if (code === null) delete next[memberIndex]
  else next[memberIndex] = code
  return next
}

/**
 * Display label for a party member — the shared "named person, else Guest N"
 * convention used by the room-assignment board, kept identical so the two
 * boards never disagree about what to call someone.
 */
export function memberLabel(names: readonly string[], index: number): string {
  const name = (names[index] ?? '').trim()
  return name.length > 0 ? name : `Guest ${index + 1}`
}
