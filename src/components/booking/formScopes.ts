/**
 * landr-9d82r.4 — pure helpers for per-person custom-form fields.
 *
 * A field's `scope` decides who answers it (landr-api PR #1027 contract):
 *   booking     once per booking (today's behaviour; the default when the API
 *               omits `scope`),
 *   participant once per activity participant,
 *   guest       once per person on the booking = participants + companions.
 *
 * Wire shape per form_responses[] entry: `answers` (booking keys),
 * `participant_answers[i]` ↔ `participants[i]` (participant + guest keys),
 * `companion_answers[j]` ↔ `companions[j]` (guest keys only).
 *
 * VISIBILITY CONTRACT (mirrors `validate_person_answers` server-side): a
 * booking field is evaluated against the booking answers only; a person field
 * for P against `{...bookingAnswers, ...P_answers}` — never another person's
 * answers. `bookingAnswers` here are the PRUNED ones (a hidden booking answer
 * is not submitted, so the server sees it absent and so must we).
 *
 * Lives in a sibling .ts file so CustomFormStep.tsx stays compliant with the
 * react-refresh/only-export-components rule.
 */
import type {
  FlowFieldDef,
  FlowFieldScope,
  FormResponseEntry,
} from '@/api/flowTypes'
import { partyMemberKey } from './partyIdentity'
import { pruneHiddenAnswers, type AnswerMap } from './fieldVisibility'

/**
 * Reserved key inside `draft.customFormAnswers[formKey]` that carries the
 * per-person answers, `{ [personKey]: { [fieldKey]: value } }`. The draft
 * slot is `Record<string, unknown>`, so this rides the existing persistence
 * and back-nav plumbing unchanged. Double underscore: no operator field key
 * collides (keys are slugs).
 */
export const PERSON_ANSWERS_DRAFT_KEY = '__person_answers'

export type PersonKind = 'participant' | 'companion'

/** Minimal shape of a ParticipantDetails / CompanionDetails for this step. */
export interface FormPersonSource {
  id?: string
  first_name: string
  last_name?: string | null
}

export interface FormPerson {
  /**
   * Stable identity for answer storage: the member's id (survives a roster
   * edit in Details — landr-uwvl), else the unified party index as a string
   * (participants 0..P-1, companions P..P+C-1).
   */
  key: string
  kind: PersonKind
  /** Index into `participants[]` / `companions[]` (the wire alignment). */
  index: number
  name: string
}

export function fieldScope(field: FlowFieldDef): FlowFieldScope {
  return field.scope === 'participant' || field.scope === 'guest'
    ? field.scope
    : 'booking'
}

/** Booking-scope fields (also every field of an older API without `scope`). */
export function bookingFields(fields: FlowFieldDef[]): FlowFieldDef[] {
  return fields.filter((f) => fieldScope(f) === 'booking')
}

/**
 * The fields one kind of person answers: a participant answers participant-
 * AND guest-scope fields, a companion only guest-scope ones.
 */
export function fieldsForKind(
  fields: FlowFieldDef[],
  kind: PersonKind,
): FlowFieldDef[] {
  return fields.filter((f) => {
    const scope = fieldScope(f)
    return kind === 'participant'
      ? scope === 'participant' || scope === 'guest'
      : scope === 'guest'
  })
}

/** Participants first, then companions — the wire order. */
export function buildFormPeople(
  participants: readonly FormPersonSource[],
  companions: readonly FormPersonSource[],
  fallbackName: string,
): FormPerson[] {
  const nameOf = (p: FormPersonSource, ordinal: number): string => {
    const full = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
    return full || `${fallbackName} ${ordinal}`
  }
  const people: FormPerson[] = []
  participants.forEach((p, i) =>
    people.push({
      key: partyMemberKey(p, i),
      kind: 'participant',
      index: i,
      name: nameOf(p, i + 1),
    }),
  )
  companions.forEach((c, j) =>
    people.push({
      key: partyMemberKey(c, participants.length + j),
      kind: 'companion',
      index: j,
      name: nameOf(c, participants.length + j + 1),
    }),
  )
  return people
}

/** What a person's visibility rules are evaluated against. */
export function personVisibilityAnswers(
  prunedBookingAnswers: AnswerMap,
  personAnswers: AnswerMap | undefined,
): AnswerMap {
  return { ...prunedBookingAnswers, ...(personAnswers ?? {}) }
}

/**
 * Build the person-level part of a FormResponseEntry. Keys are only emitted
 * when the form actually has fields for that audience, so a booking-only
 * form submits byte-identically to before this feature.
 */
export function buildPersonPayload(
  fields: FlowFieldDef[],
  prunedBookingAnswers: AnswerMap,
  people: FormPerson[],
  personAnswers: Record<string, AnswerMap>,
): Pick<FormResponseEntry, 'participant_answers' | 'companion_answers'> {
  const out: Pick<FormResponseEntry, 'participant_answers' | 'companion_answers'> = {}
  const forPerson = (person: FormPerson) =>
    pruneHiddenAnswers(
      fieldsForKind(fields, person.kind),
      personVisibilityAnswers(prunedBookingAnswers, personAnswers[person.key]),
    )
  const participants = people.filter((p) => p.kind === 'participant')
  const companions = people.filter((p) => p.kind === 'companion')
  if (fieldsForKind(fields, 'participant').length > 0 && participants.length > 0) {
    out.participant_answers = participants.map(forPerson)
  }
  if (fieldsForKind(fields, 'companion').length > 0 && companions.length > 0) {
    out.companion_answers = companions.map(forPerson)
  }
  return out
}

function coerceAnswerValue(v: unknown): string | string[] | undefined {
  if (Array.isArray(v)) return v.map(String)
  if (v === null || v === undefined || typeof v === 'object') return undefined
  return String(v)
}

/** Sanitise one persisted answer object into an AnswerMap. */
export function coerceAnswerMap(raw: unknown): AnswerMap {
  const out: AnswerMap = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const val = coerceAnswerValue(v)
    if (val !== undefined) out[k] = val
  }
  return out
}

/** Read the per-person answers back out of a draft slot (back-nav restore). */
export function readPersonAnswers(
  initial: Record<string, unknown> | undefined,
): Record<string, AnswerMap> {
  const raw = initial?.[PERSON_ANSWERS_DRAFT_KEY]
  const out: Record<string, AnswerMap> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, answers] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = coerceAnswerMap(answers)
  }
  return out
}

/**
 * Drop answers of people no longer on the booking (removed in Details after
 * answering). Anyone new simply has no entry, so their required fields block
 * Continue until answered.
 */
export function pruneToPeople(
  personAnswers: Record<string, AnswerMap>,
  people: FormPerson[],
): Record<string, AnswerMap> {
  const live = new Set(people.map((p) => p.key))
  const out: Record<string, AnswerMap> = {}
  for (const [key, answers] of Object.entries(personAnswers)) {
    if (live.has(key)) out[key] = answers
  }
  return out
}

/**
 * Clamp the person-level arrays of every entry to the CURRENT headcount right
 * before submit, so an entry confirmed before a roster edit can never send
 * more answers than there are people (the server 422s `person_out_of_range`),
 * and a shorter array is padded with `{}` (= unanswered). Entries without
 * person arrays are returned untouched (same reference).
 */
export function alignFormResponses(
  entries: FormResponseEntry[],
  participantCount: number,
  companionCount: number,
): FormResponseEntry[] {
  const fit = (
    list: FormResponseEntry['participant_answers'],
    n: number,
  ): Record<string, string | string[]>[] =>
    Array.from({ length: n }, (_, i) => list?.[i] ?? {})
  return entries.map((e) => {
    if (!e.participant_answers && !e.companion_answers) return e
    const next: FormResponseEntry = { ...e }
    if (e.participant_answers) {
      next.participant_answers = fit(e.participant_answers, participantCount)
    }
    if (e.companion_answers) {
      next.companion_answers =
        companionCount > 0 ? fit(e.companion_answers, companionCount) : undefined
      if (next.companion_answers === undefined) delete next.companion_answers
    }
    return next
  })
}

/** One item of a 422 `form_responses_invalid` body, mapped to a person. */
export interface FormResponseErrorItem {
  formKey: string
  fieldKey: string
  /** The API's machine code (`required`, `option`, …), '' when absent. */
  code: string
  message: string
  /** Index in the unified party space (participants first), or null = booking-level. */
  partyIndex: number | null
}

/**
 * Parse a `{error: 'form_responses_invalid', errors: [...]}` detail. Per-person
 * items carry `person: {kind: 'participant'|'companion', index}` (0-based into
 * `participants[]` / `companions[]`); they are mapped onto the unified party
 * index (companions after participants) so the caller can name the person.
 * Returns null when the detail is not that shape.
 */
export function parseFormResponseErrors(
  detail: unknown,
  participantCount: number,
): FormResponseErrorItem[] | null {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null
  const d = detail as { error?: unknown; errors?: unknown }
  if (d.error !== 'form_responses_invalid' || !Array.isArray(d.errors)) return null
  const items: FormResponseErrorItem[] = []
  for (const raw of d.errors) {
    if (!raw || typeof raw !== 'object') continue
    const e = raw as {
      form_key?: unknown
      field_key?: unknown
      message?: unknown
      code?: unknown
      person?: { kind?: unknown; index?: unknown } | null
    }
    const fieldKey = typeof e.field_key === 'string' ? e.field_key : ''
    const message =
      typeof e.message === 'string' && e.message.trim()
        ? e.message
        : [fieldKey, typeof e.code === 'string' ? e.code : 'invalid']
            .filter(Boolean)
            .join(': ')
    let partyIndex: number | null = null
    const person = e.person
    if (person && typeof person === 'object' && typeof person.index === 'number') {
      if (person.kind === 'participant') partyIndex = person.index
      else if (person.kind === 'companion') partyIndex = participantCount + person.index
    }
    items.push({
      formKey: typeof e.form_key === 'string' ? e.form_key : '',
      fieldKey,
      code: typeof e.code === 'string' ? e.code : '',
      message,
      partyIndex,
    })
  }
  return items
}
