import { describe, expect, it } from 'vitest'

import { addDays, collapseDays, derivePeriodRows, formatRanges, lineRanges, periodRowsFromApi } from './offerDates'

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

describe('period rows (landr-8f1sh.4)', () => {
  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28')
  })

  it('derives arrival / activity / departure from a hotel + guiding booking', () => {
    const rows = derivePeriodRows([
      { name: 'Guiding', hotel: false, selected_days: ['2027-01-25', '2027-01-26'] },
      { name: 'Hotel', hotel: true, selected_days: ['2027-01-24', '2027-01-25', '2027-01-26'] },
    ])
    expect(rows.map((r) => [r.kind, r.start, r.count, r.nights])).toEqual([
      ['arrival', '2027-01-24', 3, true],
      ['activity', '2027-01-25', 2, false],
      ['departure', '2027-01-27', 0, false],
    ])
  })

  it('splits a gap into two activity rows and merges products sharing days', () => {
    const rows = derivePeriodRows([
      { name: 'A', hotel: false, selected_days: ['2027-01-25', '2027-01-27'] },
      { name: 'B', hotel: false, selected_days: ['2027-01-25'] },
    ])
    expect(rows.map((r) => [r.name, r.start, r.count])).toEqual([
      ['A + B', '2027-01-25', 1],
      ['A', '2027-01-27', 1],
    ])
  })

  it('treats date_range_end of a hotel line without selected_days as check-out', () => {
    const rows = derivePeriodRows([
      { name: 'Hotel', hotel: true, date_range_start: '2027-01-24', date_range_end: '2027-01-27' },
    ])
    expect(rows.map((r) => [r.kind, r.start, r.count])).toEqual([
      ['arrival', '2027-01-24', 3],
      ['departure', '2027-01-27', 0],
    ])
  })

  it('returns nothing for undated lines', () => {
    expect(derivePeriodRows([{ name: 'X', hotel: false }])).toEqual([])
  })

  it('maps server periods, putting the stay length on the arrival row', () => {
    const rows = periodRowsFromApi([
      { kind: 'arrival', start_date: '2027-02-01', end_date: '2027-02-01', label: 'Arrival', product_name: null, days: 1 },
      { kind: 'activity', start_date: '2027-02-02', end_date: '2027-02-03', label: 'Activity', product_name: 'Tandem', days: 2 },
      { kind: 'departure', start_date: '2027-02-04', end_date: '2027-02-04', label: 'Departure', product_name: null, days: 1 },
    ])
    expect(rows.map((r) => [r.kind, r.name, r.count, r.nights])).toEqual([
      ['arrival', null, 3, true],
      ['activity', 'Tandem', 2, false],
      ['departure', null, 0, false],
    ])
  })
  it('folds a timed stay (arrival + departure with check-in/out times) into one stay row', () => {
    const times = { nights: 3, check_in_time: '14:00', check_out_time: '10:30' }
    const rows = periodRowsFromApi([
      { kind: 'arrival', start_date: '2027-02-01', end_date: '2027-02-01', label: 'Arrival', product_name: null, days: 1, meta: times },
      { kind: 'activity', start_date: '2027-02-02', end_date: '2027-02-03', label: 'Activity', product_name: 'Tandem', days: 2, meta: {} },
      { kind: 'departure', start_date: '2027-02-04', end_date: '2027-02-04', label: 'Departure', product_name: null, days: 1, meta: times },
    ])
    expect(rows.map((r) => [r.kind, r.name, r.count, r.nights])).toEqual([
      ['stay', null, 3, true],
      ['activity', 'Tandem', 2, false],
    ])
    expect(rows[0]).toMatchObject({ start: '2027-02-01', end: '2027-02-04' })
    expect(rows[0]!.stay).toMatchObject({ kind: 'stay', end_date: '2027-02-04' })
  })

  it('keeps Arrival / Departure for a hotel-room booking without times', () => {
    const rows = periodRowsFromApi([
      { kind: 'arrival', start_date: '2027-02-01', end_date: '2027-02-01', label: 'Arrival', product_name: null, days: 1, meta: { nights: 3 } },
      { kind: 'departure', start_date: '2027-02-04', end_date: '2027-02-04', label: 'Departure', product_name: null, days: 1, meta: { nights: 3 } },
    ])
    expect(rows.map((r) => r.kind)).toEqual(['arrival', 'departure'])
  })
})
