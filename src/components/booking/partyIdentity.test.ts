import { describe, expect, it } from 'vitest'

import type { RoomAssignmentEntry } from './accommodationCalc'
import { autoAssignParty } from './accommodationCalc'
import {
  bookerToParticipant,
  emptyBooker,
  emptyCompanion,
  emptyParticipant,
  type CompanionDetails,
  type ParticipantDetails,
} from './detailsTypes'
import {
  BOOKER_MEMBER_ID,
  buildPartyRoster,
  newMemberId,
  partyMemberKey,
  toIdentityKeyed,
  toIndexKeyed,
  toIndexKeyedOrUndefined,
  withMemberId,
} from './partyIdentity'

// ─── fixtures ────────────────────────────────────────────────────────────────

const SINGLE_0: RoomAssignmentEntry = { roomProductId: 'room-single', unitIndex: 0 }
const DOUBLE_0: RoomAssignmentEntry = {
  roomProductId: 'room-double',
  unitIndex: 0,
  slot: 0,
}
const DOUBLE_1: RoomAssignmentEntry = {
  roomProductId: 'room-double',
  unitIndex: 0,
  slot: 1,
}
const TRIPLE_0: RoomAssignmentEntry = { roomProductId: 'room-triple', unitIndex: 0 }

function participant(id: string, first: string): ParticipantDetails {
  return {
    id,
    first_name: first,
    last_name: 'Test',
    email: '',
    phone: '+34600000000',
    service_role_code: 'participant',
  }
}

function companion(id: string, first: string): CompanionDetails {
  return {
    id,
    first_name: first,
    last_name: 'Test',
    email: '',
    phone: '',
    companion_kind: 'guest',
  }
}

describe('partyIdentity — minting (landr-uwvl)', () => {
  it('emptyParticipant / emptyCompanion mint a fresh id every call', () => {
    const a = emptyParticipant('participant')
    const b = emptyParticipant('participant')
    const c = emptyCompanion()
    expect(a.id).toBeTruthy()
    expect(b.id).toBeTruthy()
    expect(c.id).toBeTruthy()
    expect(new Set([a.id, b.id, c.id]).size).toBe(3)
  })

  it('bookerToParticipant stamps the FIXED booker sentinel, never a fresh id', () => {
    // Load-bearing: DetailsStep calls this inline on every render
    // (participantsForValidation). A fresh id here would churn the booker's
    // identity on every keystroke and detach them from their own room.
    const booker = emptyBooker()
    booker.first_name = 'Ada'
    const first = bookerToParticipant(booker, 'participant')
    const second = bookerToParticipant({ ...booker, first_name: 'Adaa' }, 'pilot')
    expect(first.id).toBe(BOOKER_MEMBER_ID)
    expect(second.id).toBe(BOOKER_MEMBER_ID)
  })

  it('newMemberId returns distinct non-empty ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newMemberId()))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id.length).toBeGreaterThan(0)
  })

  it('withMemberId backfills an id-less row and leaves an identified row alone', () => {
    const identified = participant('u1', 'Grace')
    expect(withMemberId(identified)).toBe(identified) // referentially untouched
    const bare = { ...identified, id: undefined }
    const filled = withMemberId(bare)
    expect(filled.id).toBeTruthy()
    expect(filled.first_name).toBe('Grace')
  })
})

describe('partyIdentity — roster (landr-uwvl)', () => {
  it('lays participants first, companions after (the unified index space)', () => {
    const roster = buildPartyRoster(
      [participant(BOOKER_MEMBER_ID, 'Ada'), participant('u1', 'Grace')],
      [companion('c1', 'Marie')],
    )
    expect(roster).toEqual([BOOKER_MEMBER_ID, 'u1', 'c1'])
  })

  it('falls back to the POSITIONAL key for an id-less member (pre-landr-uwvl behaviour)', () => {
    const bare = { ...participant('x', 'Ada'), id: undefined }
    expect(partyMemberKey(bare, 3)).toBe('3')
    expect(buildPartyRoster([bare, bare], [])).toEqual(['0', '1'])
  })

  it('de-duplicates a colliding id so two people can never share one key', () => {
    const roster = buildPartyRoster(
      [participant('dup', 'Ada'), participant('dup', 'Grace')],
      [],
    )
    expect(new Set(roster).size).toBe(2)
    expect(roster[0]).toBe('dup')
  })

  it('tolerates undefined participant / companion arrays', () => {
    expect(buildPartyRoster(undefined, undefined)).toEqual([])
  })
})

describe('partyIdentity — conversion at the seam (landr-uwvl)', () => {
  const roster = [BOOKER_MEMBER_ID, 'u1', 'u2', 'c1']

  it('round-trips an unchanged roster exactly', () => {
    const indexMap: Record<number, RoomAssignmentEntry> = {
      0: SINGLE_0,
      1: DOUBLE_0,
      2: DOUBLE_1,
      3: TRIPLE_0,
    }
    const identity = toIdentityKeyed(indexMap, roster)
    expect(identity).toEqual({
      [BOOKER_MEMBER_ID]: SINGLE_0,
      u1: DOUBLE_0,
      u2: DOUBLE_1,
      c1: TRIPLE_0,
    })
    expect(toIndexKeyed(identity, roster)).toEqual(indexMap)
  })

  it('preserves the UI-only `slot` across the round trip', () => {
    // landr-abme proved slots are what distinguish "preserved" from
    // "coincidentally rebuilt" — a rebuilt map is slot-less.
    const identity = toIdentityKeyed({ 1: DOUBLE_1 }, roster)
    expect(toIndexKeyed(identity, roster)[1]).toEqual(DOUBLE_1)
    expect(toIndexKeyed(identity, roster)[1]!.slot).toBe(1)
  })

  it('drops an entry whose index is outside the roster (a shrunken-party ghost)', () => {
    expect(toIdentityKeyed({ 0: SINGLE_0, 9: DOUBLE_0 }, roster)).toEqual({
      [BOOKER_MEMBER_ID]: SINGLE_0,
    })
  })

  it('drops an entry whose member has left the party', () => {
    const identity = { [BOOKER_MEMBER_ID]: SINGLE_0, gone: DOUBLE_0 }
    expect(toIndexKeyed(identity, [BOOKER_MEMBER_ID])).toEqual({ 0: SINGLE_0 })
  })

  it('toIndexKeyedOrUndefined keeps undefined distinct from empty', () => {
    // AccommodationStep reads `initialAssignment === undefined` as "nothing
    // restored"; collapsing that to {} would change its seeding behaviour.
    expect(toIndexKeyedOrUndefined(undefined, roster)).toBeUndefined()
    expect(toIndexKeyedOrUndefined({}, roster)).toEqual({})
  })
})

// ─── THE BUG (landr-uwvl) ────────────────────────────────────────────────────
//
// Every case below is RED against the pre-landr-uwvl positional keying, where
// the draft's map survived a roster edit untouched while the index space
// underneath it renumbered. Three of the four roster mutations renumber, so
// all three are pinned here.

describe('roster mutations must not move anyone (landr-uwvl)', () => {
  // Ada (booker) + Grace + Alan guiding, Marie joining as a companion.
  // Arrangement (as the customer hand-assigned it):
  //   single::0 → Grace          double::0 → Alan (slot 0), Ada (slot 1)
  //   triple::0 → Marie
  const ADA = BOOKER_MEMBER_ID
  const participantsBefore = [
    participant(ADA, 'Ada'),
    participant('grace', 'Grace'),
    participant('alan', 'Alan'),
  ]
  const companionsBefore = [companion('marie', 'Marie')]
  // What AccommodationStep confirmed, in ITS party-index space.
  const confirmedByIndex: Record<number, RoomAssignmentEntry> = {
    0: DOUBLE_1, // Ada
    1: SINGLE_0, // Grace
    2: DOUBLE_0, // Alan
    3: TRIPLE_0, // Marie
  }
  const draftMap = toIdentityKeyed(
    confirmedByIndex,
    buildPartyRoster(participantsBefore, companionsBefore),
  )

  it('removing a MIDDLE participant leaves every survivor in their own room', () => {
    // DetailsStep.removeParticipant(0) splices Grace out: Alan slides from
    // party index 2 → 1 and Marie from 3 → 2. Positionally, Alan would
    // inherit Grace's single and Marie would inherit Alan's double slot.
    const after = toIndexKeyed(
      draftMap,
      buildPartyRoster(
        [participantsBefore[0]!, participantsBefore[2]!],
        companionsBefore,
      ),
    )
    expect(after).toEqual({
      0: DOUBLE_1, // Ada — unmoved
      1: DOUBLE_0, // Alan — still in the double, NOT Grace's single
      2: TRIPLE_0, // Marie — still in the triple
    })
    // Explicit statement of the reported symptom.
    expect(after[1]!.roomProductId).not.toBe('room-single')
  })

  it('removing a MIDDLE companion leaves the later companions where they were', () => {
    // Two companions so the removal actually renumbers someone — dropping the
    // LAST member of the party shifts nobody and would pass either way.
    const twoCompanions = [companion('marie', 'Marie'), companion('rosalind', 'Rosalind')]
    const withTwo = toIdentityKeyed(
      { ...confirmedByIndex, 4: SINGLE_0 },
      buildPartyRoster(participantsBefore, twoCompanions),
    )
    const after = toIndexKeyed(
      withTwo,
      buildPartyRoster(participantsBefore, [twoCompanions[1]!]),
    )
    expect(after).toEqual({
      0: DOUBLE_1, // Ada
      1: SINGLE_0, // Grace
      2: DOUBLE_0, // Alan
      3: SINGLE_0, // Rosalind — hers, NOT Marie's triple
    })
    expect(after[3]).not.toEqual(TRIPLE_0)
  })

  it('ADDING a participant does not shift the companions (their indices start at P)', () => {
    // The subtler half of the same defect: appending a participant grows P, so
    // every companion index moves UP one and the map follows the position, not
    // the person.
    const added = participant('newcomer', 'Katherine')
    const after = toIndexKeyed(
      draftMap,
      buildPartyRoster([...participantsBefore, added], companionsBefore),
    )
    expect(after).toEqual({
      0: DOUBLE_1, // Ada
      1: SINGLE_0, // Grace
      2: DOUBLE_0, // Alan
      // 3 = Katherine — brand new, correctly unassigned
      4: TRIPLE_0, // Marie — still in the triple, NOT bumped into a bed
    })
    expect(after[3]).toBeUndefined()
  })

  it("the removed person's bed frees up for autoAssignParty to top up", () => {
    // End-to-end with the real calc: Grace leaves, so single::0 is empty and
    // the newcomer who replaces her lands there rather than displacing anyone.
    const units = [
      { roomProductId: 'room-single', unitIndex: 0, capacity: 1, roomName: 'Single' },
      { roomProductId: 'room-double', unitIndex: 0, capacity: 2, roomName: 'Double' },
    ]
    const newcomer = participant('newcomer', 'Katherine')
    const nextParticipants = [participantsBefore[0]!, participantsBefore[2]!, newcomer]
    const seeded = toIndexKeyed(draftMap, buildPartyRoster(nextParticipants, []))
    const topped = autoAssignParty(units, nextParticipants.length, 0, seeded)
    expect(topped[0]).toEqual(DOUBLE_1) // Ada kept her bed
    expect(topped[1]).toEqual(DOUBLE_0) // Alan kept his
    expect(topped[2]).toEqual({ roomProductId: 'room-single', unitIndex: 0 })
  })
})
