import { describe, expect, it } from 'vitest'
import { formatDayLabel, formatDayRange } from './dateLabel'

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
