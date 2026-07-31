import { describe, expect, it } from 'vitest'
import { formatDayLabel, formatDayRange, formatDayRangeShort } from './dateLabel'

describe('formatDayLabel', () => {
  it('returns empty string for empty input', () => {
    expect(formatDayLabel('')).toBe('')
  })

  it('returns empty string for invalid input', () => {
    expect(formatDayLabel('not-a-date')).toBe('')
  })

  it('formats a known ISO date as "Sat 23 Nov" in en-GB', () => {
    // 2024-11-23 is a Saturday.
    expect(formatDayLabel('2024-11-23', 'en-GB')).toBe('Sat 23 Nov')
  })

  it('formats a known ISO date in en-US (comma between weekday and date)', () => {
    expect(formatDayLabel('2024-11-23', 'en-US')).toBe('Sat, Nov 23')
  })

  it('is timezone-stable — same calendar day regardless of caller TZ', () => {
    // Pin to UTC formatter; 2024-01-01 must always show "Mon 1 Jan"
    // and never roll back to 2023-12-31 even when the viewer sits
    // east of UTC.
    expect(formatDayLabel('2024-01-01', 'en-GB')).toBe('Mon 1 Jan')
  })
})

describe('formatDayRange', () => {
  it('returns empty string when both inputs are empty', () => {
    expect(formatDayRange('', '')).toBe('')
  })

  it('returns single label when first and last collapse to same ISO', () => {
    expect(formatDayRange('2024-11-23', '2024-11-23', 'en-GB')).toBe('Sat 23 Nov')
  })

  it('joins with the arrow separator', () => {
    expect(formatDayRange('2024-11-23', '2024-11-30', 'en-GB')).toBe(
      'Sat 23 Nov → Sat 30 Nov',
    )
  })

  it('falls back gracefully when only one side is valid', () => {
    expect(formatDayRange('2024-11-23', '', 'en-GB')).toBe('Sat 23 Nov')
    expect(formatDayRange('', '2024-11-30', 'en-GB')).toBe('Sat 30 Nov')
  })
})

// landr-4a5j: compact numeric day-range teaser for the expanded catalog.
describe('formatDayRangeShort', () => {
  it('returns empty string when the first input is empty/unparseable', () => {
    expect(formatDayRangeShort('', '')).toBe('')
    expect(formatDayRangeShort('not-a-date', '2026-09-19')).toBe('')
  })

  it('formats a same-month range as "DD.–DD.MM."', () => {
    expect(formatDayRangeShort('2026-09-12', '2026-09-19')).toBe('12.–19.09.')
  })

  it('formats a cross-month range with both months shown', () => {
    expect(formatDayRangeShort('2026-09-28', '2026-10-03')).toBe(
      '28.09. – 03.10.',
    )
  })

  it('formats a single day (same ISO on both sides) as "DD.MM."', () => {
    expect(formatDayRangeShort('2026-09-12', '2026-09-12')).toBe('12.09.')
  })

  it('formats a single day when only the first side is given', () => {
    expect(formatDayRangeShort('2026-09-12', '')).toBe('12.09.')
  })
})
