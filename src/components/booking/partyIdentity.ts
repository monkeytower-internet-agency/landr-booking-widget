/**
 * landr-uwvl: STABLE PERSON IDENTITY for the party-member maps.
 *
 * ─── The bug this exists to make impossible ────────────────────────────────
 *
 * The room-assignment / occupant-age / breakfast maps were keyed by a bare
 * party-member INDEX in the unified index space
 * `[participants 0..P-1] ++ [companions P..P+C-1]`. That index is positional,
 * so ANY roster edit in DetailsStep renumbers the party underneath a map that
 * nothing remapped:
 *
 *   • removeParticipant(i) — every later participant AND every companion
 *     shifts down one (companion indices start at P, and P just shrank).
 *   • removeCompanion(i)   — every later companion shifts down one.
 *   • addParticipant()     — every companion shifts UP one.
 *   • addCompanion()       — appends at the end; the only positionally safe
 *                            mutation of the four.
 *
 * Result: delete a middle participant and the person now at index k inherits
 * the room of whoever used to be at index k — and the booking SUBMITS that
 * way (same wrong-occupant class as landr-abme, which was a wipe rather than
 * a renumber).
 *
 * ─── The line this module draws ───────────────────────────────────────────
 *
 *   IDENTITY CROSSES STEP BOUNDARIES; POSITION LIVES INSIDE A STEP.
 *
 * `BookingDraft` and the `Step` union carry the three maps keyed by
 * `PartyMemberId` — they outlive roster mutations, so they must key by
 * person. `accommodationCalc` / `AccommodationStep` / `RoomAssignment` keep
 * the existing party-INDEX space unchanged: the roster is frozen for the
 * whole lifetime of AccommodationStep (DetailsStep is a different step), so
 * an index is a safe internal key there — and it is the natural key for chip
 * rendering and dnd-kit drop targets.
 *
 * App.tsx converts at exactly three seams, always against
 * `[...step.participants, ...step.companions]` (provably the same list, in
 * the same order, that already builds `participantNames`/`companionNames`):
 *
 *   identity → index  when seeding AccommodationStep (`initialAssignment`,
 *                     `initialAgeMap`, `initialBreakfastMap`) and when
 *                     rendering BookingForm (`roomAssignment`,
 *                     `occupantAgeMap`, `breakfastMap`)
 *   index → identity  in `afterAccommodation`, where AccommodationStep's
 *                     onConfirm payload enters the draft
 *
 * A member id that is no longer in the roster is simply dropped on the way
 * back in — the removed person's bed frees up and `autoAssignParty` tops up
 * whoever is unassigned. That is the whole fix: correct by construction for
 * all four mutations above and any future one, instead of correct only where
 * someone remembered to write a remap.
 */
import type { OccupantAgeEntry, RoomAssignmentEntry } from './accommodationCalc'
import type { CompanionDetails, ParticipantDetails } from './detailsTypes'

/**
 * Client-side stable identity for one party member. Opaque — never parsed,
 * never sent to the API, never persisted anywhere but the tab-scoped
 * sessionStorage draft. It exists only to survive a roster edit.
 */
export type PartyMemberId = string

/**
 * The booker's id. participants[0] is ALWAYS the booker (mirrored via
 * `bookerToParticipant`), and there is exactly one, so a fixed sentinel is
 * both correct and necessary: `bookerToParticipant` is called INLINE ON EVERY
 * RENDER in DetailsStep (`participantsForValidation`), so minting a fresh id
 * there would churn the booker's identity on every keystroke and detach them
 * from their own room.
 */
export const BOOKER_MEMBER_ID: PartyMemberId = 'booker'

/** Monotonic tail for the non-crypto fallback below; keeps ids unique
 *  within a page even if two are minted in the same millisecond. */
let mintCounter = 0

/**
 * Mint a fresh member id.
 *
 * `crypto.randomUUID` requires a SECURE CONTEXT — the widget is embedded via
 * the WP plugin and can legitimately run on an `http://` page (and some
 * sandboxed iframes expose no `crypto` at all), so the fallback is a real
 * code path, not defensive noise. Collisions only ever need to be avoided
 * within one party (≤ a dozen members in one tab), which the counter alone
 * already guarantees; the timestamp + random suffix just keep ids distinct
 * across a restore.
 */
export function newMemberId(): PartyMemberId {
  mintCounter += 1
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // fall through to the non-crypto path
  }
  return `pm-${Date.now().toString(36)}-${mintCounter}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

/** A party member as far as identity is concerned. */
export interface PartyMemberLike {
  id?: PartyMemberId
}

/**
 * The key for one member. `id` is OPTIONAL on ParticipantDetails /
 * CompanionDetails so the many hand-rolled object literals across the test
 * suite keep compiling; for those the positional fallback reproduces the
 * PRE-landr-uwvl behaviour EXACTLY, so an id-less caller never changes
 * meaning. Every production construction site (`emptyParticipant`,
 * `emptyCompanion`, `bookerToParticipant`, DetailsStep's restore-time
 * backfill, and the sessionStorage normalizer) mints an id, so the fallback
 * is the safety net rather than the intended path.
 */
export function partyMemberKey(
  member: PartyMemberLike | undefined,
  index: number,
): PartyMemberId {
  return member?.id ?? String(index)
}

/**
 * Backfill a stable id onto a member that has none, leaving one that already
 * has an id REFERENTIALLY UNTOUCHED. Call it in a `useState` initialiser (or
 * another once-per-mount site), never during render: re-minting on every
 * render would detach the member from their own room, which is the exact
 * failure this ticket is about.
 */
export function withMemberId<T extends PartyMemberLike>(member: T): T {
  return member.id ? member : { ...member, id: newMemberId() }
}

/**
 * The ordered party roster: participant ids first, then companion ids —
 * the same unified index space `accommodationCalc` operates in, so position
 * `i` in this array IS party-member index `i`.
 */
export type PartyRoster = PartyMemberId[]

export function buildPartyRoster(
  participants: readonly ParticipantDetails[] | undefined,
  companions: readonly CompanionDetails[] | undefined,
): PartyRoster {
  const members: PartyMemberLike[] = [
    ...(participants ?? []),
    ...(companions ?? []),
  ]
  const roster: PartyRoster = []
  const seen = new Set<PartyMemberId>()
  members.forEach((member, index) => {
    let key = partyMemberKey(member, index)
    // Duplicates are not reachable through any production path, but a
    // colliding key would silently merge two people into one bed. Suffix
    // rather than drop so the roster stays exactly party-length and every
    // position keeps a distinct key.
    if (seen.has(key)) key = `${key}#${index}`
    seen.add(key)
    roster.push(key)
  })
  return roster
}

/**
 * Position-keyed → identity-keyed. Entries whose index is outside the roster
 * (a ghost left by a shrunken party) are dropped; `autoAssignParticipants`
 * already prunes those, this is belt-and-braces at the boundary.
 */
export function toIdentityKeyed<T>(
  indexMap: Record<number, T> | undefined,
  roster: PartyRoster,
): Record<PartyMemberId, T> {
  const out: Record<PartyMemberId, T> = {}
  if (!indexMap) return out
  for (const [key, entry] of Object.entries(indexMap)) {
    const index = Number(key)
    if (!Number.isInteger(index)) continue
    const memberId = roster[index]
    if (memberId === undefined) continue
    out[memberId] = entry
  }
  return out
}

/**
 * Identity-keyed → position-keyed, against the CURRENT roster. A member who
 * has left the party is absent from the roster and their entry is dropped —
 * which is exactly right: their bed frees up and the survivors keep theirs.
 */
export function toIndexKeyed<T>(
  identityMap: Record<PartyMemberId, T> | undefined,
  roster: PartyRoster,
): Record<number, T> {
  const out: Record<number, T> = {}
  if (!identityMap) return out
  roster.forEach((memberId, index) => {
    const entry = identityMap[memberId]
    if (entry !== undefined) out[index] = entry
  })
  return out
}

/**
 * `toIndexKeyed` but preserving `undefined` for an absent map, so App.tsx can
 * keep passing `undefined` (rather than `{}`) into the `initial*` props —
 * AccommodationStep distinguishes "nothing restored" from "restored empty".
 */
export function toIndexKeyedOrUndefined<T>(
  identityMap: Record<PartyMemberId, T> | undefined,
  roster: PartyRoster,
): Record<number, T> | undefined {
  if (!identityMap) return undefined
  return toIndexKeyed(identityMap, roster)
}

// ─── Identity-keyed twins of the three party maps ────────────────────────────
//
// Same entry shapes as their positional counterparts in accommodationCalc —
// only the KEY differs. These are what `BookingDraft` and the `Step` union
// carry; the positional forms never leave the accommodation step.
//
// NOTE these are structurally `Record<string, …>`, so TypeScript cannot stop
// someone reading one with a numeric index. It degrades SAFELY rather than
// silently-wrongly: real ids are uuid-shaped, so an accidental `map[3]` yields
// `undefined` (a visibly unassigned person), never someone else's room. The
// conversion helpers above are the only supported way across the seam.

/** Room assignment keyed by PartyMemberId (draft/step form). */
export type PartyAssignmentMap = Record<PartyMemberId, RoomAssignmentEntry>

/** Per-occupant age band keyed by PartyMemberId (draft/step form). */
export type PartyOccupantAgeMap = Record<PartyMemberId, OccupantAgeEntry>

/** Per-occupant breakfast flag keyed by PartyMemberId (draft/step form). */
export type PartyBreakfastMap = Record<PartyMemberId, boolean>
