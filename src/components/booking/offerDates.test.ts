import { describe, expect, it } from 'vitest'

import { collapseDays, formatRanges, lineRanges } from './offerDates'

describe('offerDates', () => {
  it('collapses consecutive days, sorting and de-duplicating', () => {
    expect(collapseDays(['2027-01-26', '2027-01-24', '2027-01-25', '2027-01-25', '2027-02-01'])).toEqual([
      { start: '2027-01-24', end: '2027-01-26', days: 3 },
      { start: '2027-02-01', end: '2027-02-01', days: 1 },
    ])
  })

  it('collapses across a month and year boundary', () => {
    expect(collapseDays(['2026-12-31', '2027-01-01'])).toEqual([
      { start: '2026-12-31', end: '2027-01-01', days: 2 },
    ])
  })

  it('formats like the trip page (en) with one trailing year', () => {
    expect(formatRanges([{ start: '2027-01-24', end: '2027-01-29' }], 'en-US')).toBe(
      'Sun 24 Jan – Fri 29 Jan 2027',
    )
    expect(formatRanges([{ start: '2027-01-24', end: '2027-01-24' }], 'en')).toBe('Sun 24 Jan 2027')
  })

  it('puts a year on each stretch when they span years', () => {
    expect(
      formatRanges(
        [
          { start: '2026-12-30', end: '2026-12-31' },
          { start: '2027-01-02', end: '2027-01-02' },
        ],
        'en',
      ),
    ).toBe('Wed 30 Dec – Thu 31 Dec 2026; Sat 2 Jan 2027')
  })

  it('uses the locale\'s own names for German', () => {
    const out = formatRanges([{ start: '2027-01-24', end: '2027-01-29' }], 'de')
    expect(out).toContain('So')
    expect(out).toContain('Fr')
    expect(out.endsWith('2027')).toBe(true)
  })

  it('lineRanges falls back to the date range, then to nothing', () => {
    expect(lineRanges({ selected_days: [], date_range_start: '2027-01-24', date_range_end: '2027-01-26' })).toEqual([
      { start: '2027-01-24', end: '2027-01-26', days: 3 },
    ])
    expect(lineRanges({})).toEqual([])
  })
})
