/**
 * landr-qw2v8.2: pure helpers for the "arranges own accommodation" companion.
 *
 * A host booking WITH accommodation may leave a `separate_guiding` companion
 * without a room (camper, own flat). That companion is NOT a bed occupant:
 * the room-assignment board, the occupancy gate and the host-room-full guard
 * all work on the ROOMED party only, and the submit body carries
 * `own_accommodation: true` with no room for them (the API 422s
 * `own_accommodation_invalid` otherwise).
 *
 * Index-space rule (see partyIdentity.ts): the Step union and the draft carry
 * the room/age/breakfast maps keyed by stable PartyMemberId, so an
 * own-accommodation companion simply has no entry. AccommodationStep works in
 * the party-INDEX space of the ROOMED roster, which is what `buildRoomRoster`
 * builds; every other seam (BookingForm, LanguageStep) keeps the whole-party
 * roster.
 */
import type { InvitePrefill } from '@/api/types'
import type { CompanionDetails, ParticipantDetails } from './detailsTypes'
import { buildPartyRoster, type PartyRoster } from './partyIdentity'

/** True only for a separate_guiding companion flagged as arranging their own stay. */
export function isOwnAccommodation(
  companion: Pick<CompanionDetails, 'companion_kind' | 'own_accommodation'>,
): boolean {
  return (
    companion.own_accommodation === true &&
    companion.companion_kind === 'separate_guiding'
  )
}

/** Companions who need a bed on this booking (everyone but own-accommodation). */
export function roomedCompanions(
  companions: readonly CompanionDetails[] | undefined,
): CompanionDetails[] {
  return (companions ?? []).filter((c) => !isOwnAccommodation(c))
}

/** Companions who arrange their own accommodation (no room on this booking). */
export function ownAccommodationCompanions(
  companions: readonly CompanionDetails[] | undefined,
): CompanionDetails[] {
  return (companions ?? []).filter((c) => isOwnAccommodation(c))
}

/**
 * The roster AccommodationStep's party-index space is built from: participants
 * first, then ONLY the companions who need a room.
 */
export function buildRoomRoster(
  participants: readonly ParticipantDetails[] | undefined,
  companions: readonly CompanionDetails[] | undefined,
): PartyRoster {
  return buildPartyRoster(participants, roomedCompanions(companions))
}

/**
 * The flag is only meaningful on a separate_guiding companion on a booking that
 * has accommodation at all. Strip it everywhere else so a stale flag (kind
 * flipped back to 'guest', or a product with no hotel) never reaches the wire.
 */
export function normalizeOwnAccommodation(
  companion: CompanionDetails,
  hasAccommodation: boolean,
): CompanionDetails {
  if (companion.own_accommodation === undefined) return companion
  if (hasAccommodation && companion.companion_kind === 'separate_guiding') {
    return companion
  }
  const { own_accommodation: _dropped, ...rest } = companion
  void _dropped
  return rest
}

/** Does this invite link belong to a companion with no room on the host booking? */
export function isOwnAccommodationInvite(
  prefill: Pick<InvitePrefill, 'own_accommodation'> | null | undefined,
): boolean {
  return prefill?.own_accommodation === true
}

/**
 * Wire-level companion fields for the submit body: own_accommodation goes out
 * only when set, and an own-accommodation companion never carries a room.
 */
export function ownAccommodationWire(
  companion: Pick<CompanionDetails, 'companion_kind' | 'own_accommodation'>,
): { own_accommodation?: true } {
  return isOwnAccommodation(companion) ? { own_accommodation: true } : {}
}
