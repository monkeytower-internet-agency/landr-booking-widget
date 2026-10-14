import { describe, expect, it } from 'vitest'
import type { AvailabilitySlot } from '@/api/types'
import {
  formatHoldDeadline,
  holdIsLive,
  maxPartySize,
  seatFit,
  seatsNeeded,
  shortDays,
  windowRangeLabel,
} from './seatHold'

const slot = (date: string, available_seats: number) =>
  ({ date, available_seats }) as AvailabilitySlot

describe('seatsNeeded', () => {
  it('counts participants plus separate_guiding companions only', () => {
    expect(
      seatsNeeded(1, [
        { companion_kind: 'separate_guiding' },
        { companion_kind: 'guest' },
      ]),
    ).toBe(2)
  })
})

describe('seatsNeeded with invite_hold_hours', () => {
  const inv = [{ companion_kind: 'separate_guiding' as const }]
  it('skips invitees when nothing is held (0), counts them when on or absent', () => {
    expect(seatsNeeded(1, inv, 0)).toBe(1)
    expect(seatsNeeded(1, inv, 24)).toBe(2)
    expect(seatsNeeded(1, inv, undefined)).toBe(2)
  })
})

describe('shortDays', () => {
  it('lists days that cannot take the party, sorted, with seats left', () => {
    const slots = [slot('2026-10-18', 3), slot('2026-10-17', 1), slot('2026-10-19', 0)]
    expect(shortDays(slots, ['2026-10-18', '2026-10-17', '2026-10-19'], 2)).toEqual([
      { date: '2026-10-17', left: 1, need: 2 },
      { date: '2026-10-19', left: 0, need: 2 },
    ])
  })
  it('does not judge a single seat or days without a row', () => {
    expect(shortDays([slot('2026-10-17', 0)], ['2026-10-17'], 1)).toEqual([])
    expect(shortDays([], ['2026-10-17'], 3)).toEqual([])
  })
})

describe('hold deadline', () => {
  const now = new Date(2026, 9, 16, 10, 0)
  it('live vs ended', () => {
    expect(holdIsLive(new Date(2026, 9, 17).toISOString(), now)).toBe(true)
    expect(holdIsLive(new Date(2026, 9, 15).toISOString(), now)).toBe(false)
    expect(holdIsLive(null, now)).toBe(false)
  })
  it('adds a relative hint for tomorrow, tonight and nothing further out', () => {
    expect(formatHoldDeadline(new Date(2026, 9, 17, 15, 0).toISOString(), 'en', now)).toMatch(
      /\(tomorrow at .*3:00.*PM\)/,
    )
    expect(formatHoldDeadline(new Date(2026, 9, 16, 20, 0).toISOString(), 'en', now)).toMatch(
      /\(tonight\)/,
    )
    expect(formatHoldDeadline(new Date(2026, 9, 20, 15, 0).toISOString(), 'en', now)).not.toMatch(
      /\(/,
    )
  })
  it('speaks German', () => {
    expect(formatHoldDeadline(new Date(2026, 9, 17, 15, 0).toISOString(), 'de', now)).toMatch(
      /\(morgen um /,
    )
  })
})

describe('seatFit (landr-rmcsu.5)', () => {
  const slots = [
    slot('2026-11-11', 2),
    slot('2026-11-12', 3),
    slot('2026-11-13', 0),
    { ...slot('2026-11-14', 9), activity_bookable: false } as AvailabilitySlot,
  ]
  it('splits bookable days into fit-for-N and short (seats left), skipping sold-out / unbookable', () => {
    const { fit, short } = seatFit(slots, 'none', 3)
    expect([...fit]).toEqual(['2026-11-12'])
    expect([...short]).toEqual([['2026-11-11', 2]])
  })
  it('need absent or 1 is the plain available_seats > 0 rule', () => {
    expect([...seatFit(slots, 'none', undefined).fit]).toEqual(['2026-11-11', '2026-11-12'])
    expect(seatFit(slots, 'none', 1).short.size).toBe(0)
  })
})

describe('seatFit with several slots on one date (landr-rmcsu.7)', () => {
  it('a date is fit as soon as one slot takes the group, never fit AND short', () => {
    const slots = [slot('2026-11-11', 2), slot('2026-11-11', 5), slot('2026-11-12', 1), slot('2026-11-12', 2)]
    const { fit, short } = seatFit(slots, 'none', 3)
    expect([...fit]).toEqual(['2026-11-11'])
    // The short date reports its best slot.
    expect([...short]).toEqual([['2026-11-12', 2]])
  })
})

describe('maxPartySize (landr-rmcsu.5)', () => {
  it('honours any product cap >= 1, including above 6; falls back to 6', () => {
    expect(maxPartySize(12)).toBe(12)
    expect(maxPartySize(1)).toBe(1)
    expect(maxPartySize(null)).toBe(6)
    expect(maxPartySize(undefined)).toBe(6)
    expect(maxPartySize(0)).toBe(6)
  })
})

describe('windowRangeLabel (landr-rmcsu.5)', () => {
  it('formats the loaded window as a month range', () => {
    expect(windowRangeLabel('2026-10-14', '2027-03-01', 'en-GB')).toBe('October 2026 – March 2027')
    expect(windowRangeLabel('2026-10-01', '2026-10-30', 'en-GB')).toBe('October 2026')
  })
})
