import { describe, expect, it } from 'vitest'

import type { CompanionDetails, ParticipantDetails } from './detailsTypes'
import {
  buildRoomRoster,
  isOwnAccommodation,
  isOwnAccommodationInvite,
  normalizeOwnAccommodation,
  ownAccommodationCompanions,
  ownAccommodationWire,
  roomedCompanions,
} from './ownAccommodation'
import { buildPartyRoster, toIdentityKeyed, toIndexKeyed } from './partyIdentity'

function companion(
  id: string,
  over: Partial<CompanionDetails> = {},
): CompanionDetails {
  return {
    id,
    first_name: id,
    last_name: '',
    email: '',
    phone: '',
    companion_kind: 'guest',
    ...over,
  }
}

const P = (id: string): ParticipantDetails =>
  ({ id, first_name: id, last_name: '' }) as ParticipantDetails

const OWN = companion('own', { companion_kind: 'separate_guiding', own_accommodation: true })
const SEP = companion('sep', { companion_kind: 'separate_guiding' })
const GUEST = companion('guest')

describe('ownAccommodation helpers (landr-qw2v8.2)', () => {
  it('isOwnAccommodation needs separate_guiding AND the flag', () => {
    expect(isOwnAccommodation(OWN)).toBe(true)
    expect(isOwnAccommodation(SEP)).toBe(false)
    expect(isOwnAccommodation(companion('g', { own_accommodation: true }))).toBe(false)
  })

  it('splits companions into roomed and own-accommodation, keeping order', () => {
    const all = [GUEST, OWN, SEP]
    expect(roomedCompanions(all).map((c) => c.id)).toEqual(['guest', 'sep'])
    expect(ownAccommodationCompanions(all).map((c) => c.id)).toEqual(['own'])
    expect(roomedCompanions(undefined)).toEqual([])
  })

  it('room roster skips own-accommodation companions; party roster keeps them', () => {
    const participants = [P('p0'), P('p1')]
    const all = [GUEST, OWN, SEP]
    expect(buildRoomRoster(participants, all)).toEqual(['p0', 'p1', 'guest', 'sep'])
    expect(buildPartyRoster(participants, all)).toEqual([
      'p0',
      'p1',
      'guest',
      'own',
      'sep',
    ])
  })

  it('a room assignment survives the roomed -> whole-party seam without moving anyone', () => {
    const participants = [P('p0')]
    const all = [OWN, GUEST, SEP]
    // AccommodationStep index space (roomed): p0=0, guest=1, sep=2.
    const confirmed = {
      0: { roomProductId: 'r', unitIndex: 0 },
      1: { roomProductId: 'r', unitIndex: 1 },
      2: { roomProductId: 'r', unitIndex: 1 },
    }
    const byIdentity = toIdentityKeyed(confirmed, buildRoomRoster(participants, all))
    expect(Object.keys(byIdentity).sort()).toEqual(['guest', 'p0', 'sep'])
    // BookingForm index space (whole party): p0=0, own=1, guest=2, sep=3.
    const submit = toIndexKeyed(byIdentity, buildPartyRoster(participants, all))
    expect(submit[1]).toBeUndefined() // the own-accommodation companion has no room
    expect(submit[2]).toEqual({ roomProductId: 'r', unitIndex: 1 })
    expect(submit[3]).toEqual({ roomProductId: 'r', unitIndex: 1 })
  })

  it('normalizeOwnAccommodation strips the flag unless it is valid', () => {
    expect(normalizeOwnAccommodation(OWN, true)).toBe(OWN)
    expect(normalizeOwnAccommodation(OWN, false)).not.toHaveProperty('own_accommodation')
    const flippedToGuest = { ...OWN, companion_kind: 'guest' as const }
    expect(normalizeOwnAccommodation(flippedToGuest, true)).not.toHaveProperty(
      'own_accommodation',
    )
    expect(normalizeOwnAccommodation(SEP, true)).toBe(SEP)
  })

  it('wire field is sent only when set', () => {
    expect(ownAccommodationWire(OWN)).toEqual({ own_accommodation: true })
    expect(ownAccommodationWire(SEP)).toEqual({})
  })

  it('reads the invite prefill flag; absent = false', () => {
    expect(isOwnAccommodationInvite({ own_accommodation: true })).toBe(true)
    expect(isOwnAccommodationInvite({ own_accommodation: false })).toBe(false)
    expect(isOwnAccommodationInvite({})).toBe(false)
    expect(isOwnAccommodationInvite(undefined)).toBe(false)
  })
})
