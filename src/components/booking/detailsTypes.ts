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
import type { CustomerBilling } from '@/api/types'
import {
  BOOKER_MEMBER_ID,
  newMemberId,
  type PartyMemberId,
} from './partyIdentity'

/**
 * landr-uuntm.3: the invoice recipient's billing address. The booker IS the
 * invoice recipient (bookings.customer_contact_id), so it lives on the booker.
 * All strings, '' = empty; normalised to null on submit (billingToPayload).
 * Required (public widget): address_line1, postal_code, city, country.
 */
export interface BillingDetails {
  address_line1: string
  address_line2: string
  postal_code: string
  city: string
  region: string
  /** ISO-3166-1 alpha-2, upper-case, or '' when not chosen. */
  country: string
  company: string
  tax_id: string
}

export interface BookerDetails {
  first_name: string
  last_name: string
  email: string
  phone: string
  billing: BillingDetails
  /**
   * landr-jiagg.2: does the booker take part themselves? `false` = "I'm
   * booking for someone else and won't take part" — the booker pays (they
   * stay the invoice recipient, customer_* on the wire) but is NOT mirrored
   * into participants[] and has no seat in the party (no bed, no occupant,
   * no breakfast chip). Optional so every hand-rolled literal and every draft
   * persisted by an older bundle keeps meaning what it meant: ABSENT = true.
   * Always read it through `bookerJoins`, never as a bare truthiness check.
   */
  joins?: boolean
}

/** landr-jiagg.2: true unless the booker explicitly opted out of taking part. */
export function bookerJoins(b: Pick<BookerDetails, 'joins'> | undefined): boolean {
  return b?.joins !== false
}

export interface ParticipantDetails {
  /**
   * landr-uwvl: STABLE client-side identity. Optional only so the many
   * hand-rolled literals across the test suite keep compiling — every
   * production construction site mints one (`emptyParticipant`,
   * `bookerToParticipant`, DetailsStep's restore backfill, the
   * sessionStorage normalizer). It is what the draft's room-assignment /
   * age / breakfast maps are keyed by, so it MUST survive a roster edit and
   * MUST NOT be regenerated on re-render. Never sent to the API: the submit
   * payload is built from an explicit field list, not a spread.
   */
  id?: PartyMemberId
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
  /** landr-uwvl: stable client-side identity — see ParticipantDetails.id. */
  id?: PartyMemberId
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

export function emptyBilling(): BillingDetails {
  return {
    address_line1: '',
    address_line2: '',
    postal_code: '',
    city: '',
    region: '',
    country: '',
    company: '',
    tax_id: '',
  }
}

export function emptyBooker(): BookerDetails {
  return {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    billing: emptyBilling(),
    joins: true,
  }
}

/** The four billing fields the API requires for the public website channel. */
export function billingAddressComplete(b: BillingDetails | undefined): boolean {
  return (
    !!b &&
    b.address_line1.trim() !== '' &&
    b.postal_code.trim() !== '' &&
    b.city.trim() !== '' &&
    b.country.trim() !== ''
  )
}

/** True when any billing field holds text (drives the company toggle + staff payload). */
export function billingHasAny(b: BillingDetails | undefined): boolean {
  return !!b && Object.values(b).some((v) => v.trim() !== '')
}

/**
 * Restore guard: a booker persisted by an older bundle (sessionStorage,
 * Back-restore) has no `billing` — fill it with empties so the step never
 * dereferences undefined and the required-field check simply asks for it.
 */
export function withBilling(b: BookerDetails): BookerDetails {
  const base = emptyBilling()
  const given = (b as Partial<BookerDetails>).billing
  const billing = { ...base }
  if (given && typeof given === 'object') {
    for (const k of Object.keys(base) as (keyof BillingDetails)[]) {
      const v = given[k]
      billing[k] = typeof v === 'string' ? v : ''
    }
  }
  return { ...b, billing }
}

const blankToNull = (v: string): string | null => (v.trim() === '' ? null : v.trim())

/** Wire shape (landr-uuntm.1 BillingAddressIn): blank optionals -> null, country upper-case. */
export function billingToPayload(b: BillingDetails): CustomerBilling {
  return {
    address_line1: b.address_line1.trim(),
    address_line2: blankToNull(b.address_line2),
    postal_code: b.postal_code.trim(),
    city: b.city.trim(),
    region: blankToNull(b.region),
    country: b.country.trim().toUpperCase(),
    company: blankToNull(b.company),
    tax_id: blankToNull(b.tax_id),
  }
}

/** Empty companion scaffold for a freshly-added "Others joining" row. */
export function emptyCompanion(
  kind: CompanionDetails['companion_kind'] = 'guest',
): CompanionDetails {
  return {
    id: newMemberId(),
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    companion_kind: kind,
  }
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
    id: newMemberId(),
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
    // landr-uwvl: a FIXED sentinel, never a fresh id. This function is
    // called inline on every DetailsStep render (participantsForValidation),
    // so minting here would churn the booker's identity on every keystroke
    // and detach them from their own room. There is exactly one booker and
    // they are always participants[0], so a constant is the correct key.
    id: BOOKER_MEMBER_ID,
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
 * - Booker: all four fields required (first, last, email, phone) plus the
 *   billing address (line1, postal code, city, country — landr-uuntm.3).
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
 *
 * landr-jiagg.2: unless the booker does not take part (`booker.joins ===
 * false`) — then there is no booker row, participants[0] is "Participant 1"
 * and is held to first + last + phone like the rest; the list must be
 * non-empty.
 */
export function detailsAreComplete(
  booker: BookerDetails,
  participants: ParticipantDetails[],
  companions: CompanionDetails[] = [],
  requireBilling: boolean = true,
): boolean {
  // landr-jiagg.2: when the booker does not take part, participants[0] is NOT
  // the booker but the first roster row ("Participant 1") — it carries its own
  // phone and is validated like every other added participant. It must exist.
  const firstRowIsBooker = bookerJoins(booker)
  if (!firstRowIsBooker && participants.length === 0) return false
  if (!booker.first_name.trim() || !booker.last_name.trim()) return false
  // landr-uuntm.3: the invoice recipient's address (staff-entered bookings opt out).
  if (requireBilling && !billingAddressComplete(booker.billing)) return false
  if (!booker.email.trim() || !booker.phone.trim()) return false
  // basic email shape — full validation happens via the form library on
  // submit, but for enable/disable we just want non-empty and an @
  if (!booker.email.includes('@')) return false
  // landr-1url: the booker's phone must also look internationally-formatted
  // (leading '+' + country code).
  if (!isValidPhoneFormat(booker.phone)) return false
  // participants[0] is the booker (mirrored) when they take part — their
  // name/phone were checked above, so that row only needs first + last here.
  // When the booker does not take part (landr-jiagg.2) every row, including
  // participants[0] ("Participant 1"), needs first + last + a valid phone.
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i]!
    if (!p.first_name.trim() || !p.last_name.trim()) return false
    // landr-nkbi: every participant other than the booker row (validated
    // separately above) must supply a non-empty phone number.
    const isBookerRow = i === 0 && firstRowIsBooker
    if (!isBookerRow && !p.phone.trim()) return false
    // landr-1url: when a participant phone is present it must also look
    // internationally-formatted. The booker row is already checked above.
    if (!isBookerRow && !isValidPhoneFormat(p.phone)) return false
  }
  // landr-rxjo: each companion needs both first and last name; phone optional.
  // landr-1url: companion phone stays optional but if filled must also look
  // internationally-formatted (isValidPhoneFormat treats '' as valid).
  for (const c of companions) {
    if (!c.first_name.trim() || !c.last_name.trim()) return false
    if (!isValidPhoneFormat(c.phone)) return false
    // landr-otml0.3 D11: a 'separate_guiding' companion gets their own
    // invite link, so we need SOME way to send it — email OR phone, either
    // is enough. 'guest' companions are unaffected (contact stays fully
    // optional). The API enforces this too (422 companion_contact_required)
    // as a backstop; this client-side gate is what actually blocks Continue.
    if (
      c.companion_kind === 'separate_guiding' &&
      !c.email.trim() &&
      !c.phone.trim()
    ) {
      return false
    }
  }
  return true
}

/**
 * landr-jiagg.2: the participants[] the submit sends. When the booker takes
 * part this is the list unchanged (participants[0] already mirrors them).
 * When they book for someone else, "Participant 1" may leave email/phone
 * blank (placeholder "same as yours") — fill those blanks from the booker so
 * the joining person is reachable through the payer, the same way a family's
 * children share the parent's contact (landr-0utgk copy, landr-pmbfk server
 * side: a shared email with a different name resolves to its own contact).
 * Only row 1 is filled; rows 2..N keep their optional blanks exactly as when
 * the booker joins. Returns new objects — the draft keeps the blanks so a
 * Back-restore shows what the customer actually typed.
 */
export function participantsForSubmit(
  booker: BookerDetails,
  participants: ParticipantDetails[],
): ParticipantDetails[] {
  if (bookerJoins(booker) || participants.length === 0) return participants
  const [first, ...rest] = participants
  return [
    {
      ...first!,
      email: first!.email.trim() ? first!.email : booker.email,
      phone: first!.phone.trim() ? first!.phone : booker.phone,
    },
    ...rest,
  ]
}

/**
 * landr-jiagg.2 (+ landr-jiagg.5 block rule): the read-only "Invoice to:" cue
 * in the billing block — the first two lines of the billing address block
 * (company / person / street / postal city / COUNTRY). The company line only
 * when the "Invoice to a company?" toggle is on and the company is non-blank;
 * then the booker follows as the contact person. Empty when the booker has no
 * name yet (the cue is not rendered).
 */
export function invoiceToLines(
  booker: Pick<BookerDetails, 'first_name' | 'last_name' | 'billing'>,
  invoiceToCompany: boolean,
): string[] {
  const person = `${booker.first_name.trim()} ${booker.last_name.trim()}`.trim()
  if (!person) return []
  const company = invoiceToCompany ? (booker.billing?.company ?? '').trim() : ''
  return company ? [company, person] : [person]
}
