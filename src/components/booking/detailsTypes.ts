/**
 * Shared types for the DetailsStep (landr-8c03). Lives in a sibling .ts
 * file so DetailsStep.tsx stays compliant with the
 * react-refresh/only-export-components ESLint rule (widget-eslint-react-hooks-rules).
 *
 * BookerDetails: the person paying / receiving the booking confirmation
 * (matches the customer_* fields on SubmitBookingBody). All four fields
 * are required up front — the legacy "phone optional" relaxation was
 * dropped because Para42's operator needs phone for the welcome SMS.
 *
 * ParticipantDetails: one entry per traveller. The booker is auto-
 * mirrored into participants[0] (carrying the same name/email/phone)
 * so the customer doesn't have to type their own data twice. Additional
 * participants only need first/last; email + phone are optional.
 *
 * NOTE on phone: as of landr-zaan the backend's ParticipantIn accepts a
 * per-participant `phone` field and the public_submit_booking RPC
 * persists it to the participant's `contacts.phone` row (same upsert
 * semantics as the booker's customer_phone). The DetailsStep UI surface
 * is unchanged — participants 2..N continue to see an optional phone
 * input — but the value is now sent on submit instead of dropped.
 */
export interface BookerDetails {
  first_name: string
  last_name: string
  email: string
  phone: string
}

export interface ParticipantDetails {
  first_name: string
  last_name: string
  /** Optional. Empty string when not provided — normalised to null on submit. */
  email: string
  /** Optional per-participant phone. landr-zaan: round-trips to
   *  `contacts.phone` server-side. Empty string normalised to null on
   *  submit so a blank field never overwrites a phone already on file. */
  phone: string
  /**
   * Operator-scoped service_roles.code (landr-mg0a). Defaults to the
   * first ServiceRole returned by getOperatorServiceRoles (typically
   * 'participant'). When the operator has multiple roles configured
   * (e.g. 'pilot' / 'passenger' for tandem paragliding) DetailsStep
   * shows a dropdown per participant so customers can pick.
   *
   * Empty string before App-mount finishes fetching the role list —
   * BookingForm falls back to the first available code on submit so a
   * race never produces an unknown code.
   */
  service_role_code: string
}

/**
 * CompanionDetails (landr-87n9.3): one entry per NON-GUIDING companion
 * collected in the "Others joining" section of DetailsStep. A companion
 * does NOT take part in the activity — they carry no service_role and are
 * never counted toward the guiding-participants cap or the per-participant
 * guiding price. They DO join the whole-party room assignment + occupancy.
 *
 * Only first_name is required (matches the participant rule, minus the
 * required last_name). email/phone stay optional; all three optional fields
 * are normalised to null on submit so a blank never overwrites server data.
 *
 * landr-doam.1 scope-add: companion_kind distinguishes a non-participating
 * guest (partner/child) from a fellow activity-person who books their guiding
 * separately. Default 'guest'. See Companion type in api/types.ts for full
 * semantics.
 */
export interface CompanionDetails {
  first_name: string
  /** Optional. Empty string when not provided — normalised to null on submit. */
  last_name: string
  /** Optional. Empty string when not provided — normalised to null on submit. */
  email: string
  /** Optional. Empty string when not provided — normalised to null on submit. */
  phone: string
  /**
   * landr-doam.1: participation kind. 'guest' (default) = not doing the
   * activity. 'separate_guiding' = joining the activity but booking guiding
   * separately. Controls the hint text in DetailsStep and the wire field on
   * submit. Never affects this booking's price or participant count.
   */
  companion_kind: 'guest' | 'separate_guiding'
}

/**
 * landr-1url: lightweight international-format nudge for phone inputs
 * (no new dependency — a real country-selector + E.164 component was
 * explicitly deferred). `PHONE_HTML_PATTERN` is used as the native
 * `pattern` attribute on the phone `<input>`s (documentation / mobile
 * keyboard hint — there is no `<form>`/submit wrapping these inputs, so
 * it is not itself enforced by the browser).
 *
 * `isValidPhoneFormat` is the actual client-side check: separators
 * (spaces, dashes) commonly used in human-formatted numbers like
 * "+34 600 123 456" are stripped before testing, then the remainder must
 * be a leading '+' followed by 7-15 digits (loose E.164 bound). An empty
 * value is treated as valid here — required-ness is checked separately
 * so this helper works for both required (booker/participant) and
 * optional (companion) phone fields.
 */
export const PHONE_HTML_PATTERN = '\\+[1-9][0-9 -]{6,14}'

function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s-]/g, '')
}

export function isValidPhoneFormat(phone: string): boolean {
  const trimmed = phone.trim()
  if (!trimmed) return true
  return /^\+[1-9]\d{6,14}$/.test(normalizePhone(trimmed))
}

export function emptyBooker(): BookerDetails {
  return { first_name: '', last_name: '', email: '', phone: '' }
}

/** Empty companion scaffold for a freshly-added "Others joining" row. */
export function emptyCompanion(): CompanionDetails {
  return { first_name: '', last_name: '', email: '', phone: '', companion_kind: 'guest' }
}

/**
 * Empty participant scaffold. `serviceRoleCode` defaults to '' so callers
 * that don't yet have the operator's role list (race on App mount) can
 * still construct rows; BookingForm fills the gap with the first
 * available code before submit.
 */
export function emptyParticipant(
  serviceRoleCode: string = '',
): ParticipantDetails {
  return {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    service_role_code: serviceRoleCode,
  }
}

/**
 * Mirror the booker into participants[0]. Called after the booker fills
 * in their own details so the first participant slot is pre-populated.
 * Subsequent edits to participants[0] are user-driven and not synced
 * back (the prevBooker ref pattern from landr-iu3s/landr-qs8d lives in
 * DetailsStep itself).
 *
 * landr-mg0a: callers pass the operator's default service_role_code so
 * the synthesised participants[0] row carries it through to submit.
 */
export function bookerToParticipant(
  b: BookerDetails,
  serviceRoleCode: string = '',
): ParticipantDetails {
  return {
    first_name: b.first_name,
    last_name: b.last_name,
    email: b.email,
    phone: b.phone,
    service_role_code: serviceRoleCode,
  }
}

/**
 * Validity check used to enable the Continue button.
 *
 * - Booker: all four fields required (first, last, email, phone).
 * - Participants (additional, i.e. participants[1..N] in the final array):
 *     first + last + phone required (landr-nkbi); email stays optional.
 *     participants[0] is the booker, already validated above.
 * - Companions (landr-87n9.3): only first name required; phone is optional.
 *
 * `companions` is optional so existing call-sites keep working.
 *
 * NOTE: `participants` here is the FULL list including the booker at [0].
 * The booker's phone is validated via the booker fields above, so we skip
 * index 0 and validate indices 1..N (the "additional" rows).
 */
export function detailsAreComplete(
  booker: BookerDetails,
  participants: ParticipantDetails[],
  companions: CompanionDetails[] = [],
): boolean {
  if (!booker.first_name.trim() || !booker.last_name.trim()) return false
  if (!booker.email.trim() || !booker.phone.trim()) return false
  // basic email shape — full validation happens via the form library on
  // submit, but for enable/disable we just want non-empty and an @
  if (!booker.email.includes('@')) return false
  // landr-1url: the booker's phone must also look internationally-formatted
  // (leading '+' + country code).
  if (!isValidPhoneFormat(booker.phone)) return false
  // participants[0] is the booker (mirrored) — skip; validate 1..N
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i]!
    if (!p.first_name.trim() || !p.last_name.trim()) return false
    // landr-nkbi: every participant (other than the booker who is validated
    // separately above) must supply a non-empty phone number.
    if (i > 0 && !p.phone.trim()) return false
    // landr-1url: when a participant phone is present it must also look
    // internationally-formatted. i===0 is the booker, already checked above.
    if (i > 0 && !isValidPhoneFormat(p.phone)) return false
  }
  // landr-rxjo: each companion needs both first and last name; phone optional.
  // landr-1url: companion phone stays optional but if filled must also look
  // internationally-formatted (isValidPhoneFormat treats '' as valid).
  for (const c of companions) {
    if (!c.first_name.trim() || !c.last_name.trim()) return false
    if (!isValidPhoneFormat(c.phone)) return false
  }
  return true
}
