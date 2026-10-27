import { describe, expect, it } from 'vitest'
import type { BookingPeriod } from '@/api/types'
import { foldStayPeriods, stayWindowLabel } from './stayWindow'

const period = (over: Partial<BookingPeriod>): BookingPeriod => ({
  kind: 'arrival',
  start_date: '2026-09-14',
  end_date: '2026-09-14',
  label: 'Arrival',
  product_name: null,
  days: 1,
  meta: {},
  ...over,
})

const times = { nights: 2, check_in_time: '14:00', check_out_time: '10:30' }
const STAY = [
  period({ meta: times }),
  period({ kind: 'departure', start_date: '2026-09-16', end_date: '2026-09-16', label: 'Departure', meta: times }),
]

describe('foldStayPeriods', () => {
  it('folds arrival + departure into one stay row', () => {
    const rows = foldStayPeriods(STAY)
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe('stay')
    expect(rows[0].end_date).toBe('2026-09-16')
  })

  it('keeps activity rows around it', () => {
    const activity = period({ kind: 'activity', start_date: '2026-09-15', end_date: '2026-09-15', label: 'Tandem' })
    expect(foldStayPeriods([STAY[0], activity, STAY[1]]).map((p) => p.kind)).toEqual(['stay', 'activity'])
  })

  it('passes a hotel-room booking (no times) through untouched', () => {
    const hotel = STAY.map((p) => ({ ...p, meta: { nights: 2 } }))
    expect(foldStayPeriods(hotel)).toBe(hotel)
  })
})

describe('stayWindowLabel', () => {
  const [stay] = foldStayPeriods(STAY)

  it.each([
    ['en', 'Check-in 14.09. 14:00 – Check-out 16.09. 10:30 (2 nights)'],
    ['de', 'Check-in 14.09. 14:00 – Check-out 16.09. 10:30 (2 Nächte)'],
    ['es', 'Check-in 14.09. 14:00 – Check-out 16.09. 10:30 (2 noches)'],
    ['tr', 'Giriş 14.09. 14:00 – Çıkış 16.09. 10:30 (2 gece)'],
  ])('%s matches the confirmation email wording', (locale, expected) => {
    expect(stayWindowLabel(stay, locale)).toBe(expected)
  })

  it('derives the night count from the dates when meta lacks it', () => {
    const noNights = { ...stay, meta: { check_in_time: '15:00', check_out_time: '11:00' } }
    expect(stayWindowLabel(noNights, 'en')).toBe('Check-in 14.09. 15:00 – Check-out 16.09. 11:00 (2 nights)')
  })

  it('drops the trailing nights suffix when the caller has its own length column', () => {
    expect(stayWindowLabel(stay, 'en', { withNights: false })).toBe(
      'Check-in 14.09. 14:00 – Check-out 16.09. 10:30',
    )
    expect(stayWindowLabel(stay, 'tr', { withNights: false })).toBe(
      'Giriş 14.09. 14:00 – Çıkış 16.09. 10:30',
    )
  })
})
