import { describe, expect, it } from 'vitest'
import type { AvailabilitySlot } from '@/api/types'
import { formatHoldDeadline, holdIsLive, seatsNeeded, shortDays } from './seatHold'

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
