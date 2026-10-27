import { describe, expect, it } from 'vitest'
import type { AvailabilitySlot } from '@/api/types'
import {
  freeStayNights,
  initialStayRange,
  stayRangeAfterClick,
  stayRangeViolations,
} from './stayRange'

function night(date: string, over: Partial<AvailabilitySlot> = {}): AvailabilitySlot {
  return {
    availability_id: null,
    date,
    start_time: '15:00:00',
    end_time: '11:00:00',
    capacity: 2,
    capacity_reserved: 0,
    available_seats: 2,
    status: 'open',
    activity_bookable: true,
    ...over,
  }
}

const STAY = {
  min_nights: 2,
  max_nights: 5,
  cleaning_fee_cents: 3000,
  check_in_time: '15:00',
  check_out_time: '11:00',
  sleeps: 2,
}

describe('freeStayNights', () => {
  it('splits free, closed and taken nights', () => {
    const n = freeStayNights([
      night('2031-06-01'),
      night('2031-06-02', { status: 'closed' }),
      night('2031-06-03', { available_seats: 0 }),
      night('2031-06-04', { activity_bookable: false }),
    ])
    expect([...n.free]).toEqual(['2031-06-01'])
    expect([...n.closed]).toEqual(['2031-06-02'])
    expect([...n.taken].sort()).toEqual(['2031-06-03', '2031-06-04'])
  })
})

describe('stayRangeAfterClick', () => {
  it('picks check-in, then check-out, and restarts after a complete range', () => {
    let r = stayRangeAfterClick({ checkIn: null, checkOut: null }, '2031-06-03')
    expect(r).toEqual({ checkIn: '2031-06-03', checkOut: null })
    r = stayRangeAfterClick(r, '2031-06-01')
    expect(r).toEqual({ checkIn: '2031-06-01', checkOut: null })
    r = stayRangeAfterClick(r, '2031-06-04')
    expect(r).toEqual({ checkIn: '2031-06-01', checkOut: '2031-06-04' })
    expect(stayRangeAfterClick(r, '2031-06-10')).toEqual({ checkIn: '2031-06-10', checkOut: null })
  })

  it('restores a night list as its range', () => {
    expect(initialStayRange(['2031-06-02', '2031-06-01'])).toEqual({
      checkIn: '2031-06-01',
      checkOut: '2031-06-03',
    })
    expect(initialStayRange(undefined)).toEqual({ checkIn: null, checkOut: null })
  })
})

describe('stayRangeViolations', () => {
  const nights = freeStayNights([
    night('2031-06-01'),
    night('2031-06-02'),
    night('2031-06-03'),
    // Another guest arrives on the 4th: the night of the 4th is taken.
    night('2031-06-04', { available_seats: 0 }),
    night('2031-06-05', { status: 'closed' }),
  ])

  it('allows a check-out on the morning another guest checks in', () => {
    expect(
      stayRangeViolations({ checkIn: '2031-06-01', checkOut: '2031-06-04' }, STAY, nights, '2031-05-01'),
    ).toEqual([])
  })

  it('refuses a taken night, a blocked night and too few nights', () => {
    expect(
      stayRangeViolations({ checkIn: '2031-06-03', checkOut: '2031-06-06' }, STAY, nights, '2031-05-01'),
    ).toEqual([
      { code: 'blocked_night', date: '2031-06-05' },
      { code: 'night_unavailable', date: '2031-06-04' },
    ])
    expect(
      stayRangeViolations({ checkIn: '2031-06-01', checkOut: '2031-06-02' }, STAY, nights, '2031-05-01'),
    ).toEqual([{ code: 'below_min_nights' }])
  })

  it('treats a night with no row as not sellable', () => {
    expect(
      stayRangeViolations({ checkIn: '2031-06-02', checkOut: '2031-06-04' }, null, freeStayNights([night('2031-06-02')]), '2031-05-01'),
    ).toEqual([{ code: 'night_unavailable', date: '2031-06-03' }])
  })
})
