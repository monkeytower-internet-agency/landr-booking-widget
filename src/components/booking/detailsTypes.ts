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
 * NOTE on phone: the backend's ParticipantIn (app/routers/public_bookings.py)
 * does NOT currently accept a per-participant phone field — only the
 * booker's customer_phone is persisted server-side. We still collect
 * participant phones in the UI per the landr-8c03 spec, but they're
 * dropped before submit. Adding `phone` to ParticipantIn is a follow-up
 * (filed as landr-8c03-followup).
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
  /** Optional. Collected client-side; not yet sent to the backend. */
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

export function emptyBooker(): BookerDetails {
  return { first_name: '', last_name: '', email: '', phone: '' }
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
 * Validity check used to enable the Continue button. Booker requires all
 * four fields; each participant requires first + last (email + phone
 * stay optional per landr-8c03 spec).
 */
export function detailsAreComplete(
  booker: BookerDetails,
  participants: ParticipantDetails[],
): boolean {
  if (!booker.first_name.trim() || !booker.last_name.trim()) return false
  if (!booker.email.trim() || !booker.phone.trim()) return false
  // basic email shape — full validation happens via the form library on
  // submit, but for enable/disable we just want non-empty and an @
  if (!booker.email.includes('@')) return false
  for (const p of participants) {
    if (!p.first_name.trim() || !p.last_name.trim()) return false
  }
  return true
}
