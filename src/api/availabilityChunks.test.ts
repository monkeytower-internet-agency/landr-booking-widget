import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  AVAILABILITY_RPC_MAX_SPAN_DAYS,
  getAvailability,
  splitAvailabilityWindows,
} from './client'
import { AVAILABILITY_HORIZON_DAYS, availabilityWindow } from '@/components/booking/calendarStart'
import type { AvailabilitySlot } from './types'

const DAY = 86_400_000
const ms = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
const spanDays = (w: { from: string; to: string }) => (ms(w.to) - ms(w.from)) / DAY

function slot(date: string, start_time: string | null = null): AvailabilitySlot {
  return {
    availability_id: `slot-${date}-${start_time ?? ''}`,
    date,
    start_time,
    end_time: null,
    capacity: 5,
    capacity_reserved: 0,
    available_seats: 5,
    status: 'open',
  } as AvailabilitySlot
}

describe('splitAvailabilityWindows (landr-gm2px)', () => {
  it('keeps a range within the RPC cap as one unchanged window', () => {
    expect(splitAvailabilityWindows('2026-10-05', '2027-01-03')).toEqual([
      { from: '2026-10-05', to: '2027-01-03' }, // exactly 90 days
    ])
    expect(splitAvailabilityWindows('2026-10-05', '2026-10-05')).toEqual([
      { from: '2026-10-05', to: '2026-10-05' },
    ])
  })

  it('splits at exactly 90-day spans: 91 days -> two windows', () => {
    const w = splitAvailabilityWindows('2026-10-05', '2027-01-04')
    expect(w).toEqual([
      { from: '2026-10-05', to: '2027-01-03' },
      { from: '2027-01-04', to: '2027-01-04' },
    ])
  })

  it('covers the full 731-day horizon with no gap, no overlap, every span <= 90', () => {
    const { fromIso, toIso } = availabilityWindow(new Date(2026, 9, 5))
    expect(AVAILABILITY_HORIZON_DAYS).toBe(731)
    const w = splitAvailabilityWindows(fromIso, toIso)

    expect(w[0].from).toBe(fromIso)
    expect(w[w.length - 1].to).toBe(toIso)
    for (const win of w) {
      expect(spanDays(win)).toBeLessThanOrEqual(AVAILABILITY_RPC_MAX_SPAN_DAYS)
      expect(spanDays(win)).toBeGreaterThanOrEqual(0)
    }
    for (let i = 1; i < w.length; i++) {
      // next window starts the day after the previous one ends
      expect(ms(w[i].from) - ms(w[i - 1].to)).toBe(DAY)
    }
    // every window but the last is a full 90-day span; the last is shorter
    for (const win of w.slice(0, -1)) expect(spanDays(win)).toBe(90)
    expect(spanDays(w[w.length - 1])).toBeLessThan(90)
    // 732 inclusive days = 8 * 91 + 4
    expect(w).toHaveLength(9)
    // total coverage equals the whole range
    const covered = w.reduce((n, win) => n + spanDays(win) + 1, 0)
    expect(covered).toBe(AVAILABILITY_HORIZON_DAYS + 1)
  })

  it('is DST-safe (windows crossing both clock changes stay contiguous)', () => {
    const w = splitAvailabilityWindows('2026-03-01', '2027-03-01')
    for (let i = 1; i < w.length; i++) {
      expect(ms(w[i].from) - ms(w[i - 1].to)).toBe(DAY)
    }
    expect(w[w.length - 1].to).toBe('2027-03-01')
  })
})

describe('getAvailability chunked fetch (landr-gm2px)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  function stubFetch(handler: (from: string, to: string) => AvailabilitySlot[] | Error) {
    vi.stubEnv('VITE_USE_MOCKS', '0')
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input))
      const out = handler(url.searchParams.get('from')!, url.searchParams.get('to')!)
      if (out instanceof Error) return Promise.reject(out)
      return Promise.resolve(new Response(JSON.stringify(out), { status: 200 }))
    })
  }

  it('issues one request per window, each within the 90-day cap, carrying the invite token', async () => {
    const fetchSpy = stubFetch(() => [])
    await getAvailability('prod-1', '2026-10-05', '2028-10-05', 'inv-tok')
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(1)
    for (const [input] of fetchSpy.mock.calls) {
      const u = new URL(String(input))
      expect(u.pathname).toBe('/api/public/products/prod-1/availability')
      expect(u.searchParams.get('invite')).toBe('inv-tok')
      expect(
        spanDays({ from: u.searchParams.get('from')!, to: u.searchParams.get('to')! }),
      ).toBeLessThanOrEqual(90)
    }
  })

  it('a range within the cap stays a single request', async () => {
    const fetchSpy = stubFetch(() => [slot('2026-10-06')])
    const rows = await getAvailability('prod-1', '2026-10-05', '2026-10-05')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(rows.map((r) => r.date)).toEqual(['2026-10-06'])
  })

  it('returns days beyond today+90 (the live bug) concatenated in window order', async () => {
    // Like the real RPC: rows only for the requested window, zero rows if span > 90.
    stubFetch((from, to) => {
      if (spanDays({ from, to }) > 90) return []
      const rows: AvailabilitySlot[] = []
      for (const d of ['2026-11-01', '2027-01-06', '2027-03-07', '2028-02-29']) {
        if (d >= from && d <= to) rows.push(slot(d))
      }
      return rows
    })
    const { fromIso, toIso } = availabilityWindow(new Date(2026, 9, 5))
    const rows = await getAvailability('prod-1', fromIso, toIso)
    expect(rows.map((r) => r.date)).toEqual([
      '2026-11-01',
      '2027-01-06',
      '2027-03-07',
      '2028-02-29',
    ])
  })

  it('dedupes by date + start_time but keeps distinct start times on one date', async () => {
    stubFetch(() => [slot('2026-12-01', '09:00:00'), slot('2026-12-01', '14:00:00')])
    const rows = await getAvailability('prod-1', '2026-10-05', '2027-01-30')
    // every window returned the same two rows -> merged to two
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.start_time)).toEqual(['09:00:00', '14:00:00'])
  })

  it('rejects when any single window fails (no silently partial calendar)', async () => {
    stubFetch((from) => (from > '2027-03-01' ? new Error('boom') : [slot('2026-11-01')]))
    await expect(getAvailability('prod-1', '2026-10-05', '2028-10-05')).rejects.toThrow()
  })

  it('mock mode is unchanged: no fetch, mock rows', async () => {
    vi.stubEnv('VITE_USE_MOCKS', '1')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const rows = await getAvailability('any', '2026-10-05', '2028-10-05')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(Array.isArray(rows)).toBe(true)
  })
})
