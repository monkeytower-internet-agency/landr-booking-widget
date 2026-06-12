import { describe, expect, it } from 'vitest'
import { dateFromIso, isoDate } from './dateUtils'

describe('dateUtils', () => {
  it('round-trips an ISO date string unchanged (the landr-cnk9 off-by-one)', () => {
    // The bug: AvailabilityPicker formatted via toISOString() (UTC) while
    // parsing locally, so in UTC+ zones 2026-06-10 echoed as 2026-06-09.
    // The canonical pair is local↔local, so the round-trip is identity in
    // every timezone.
    for (const iso of ['2026-01-01', '2026-06-10', '2026-12-31', '2026-03-29']) {
      expect(isoDate(dateFromIso(iso))).toBe(iso)
    }
  })

  it('formats using LOCAL date components, not UTC', () => {
    // A Date built from local components must stringify back to those same
    // components regardless of the runner's offset (guards against a
    // regression to d.toISOString().slice(0,10)).
    const d = new Date(2026, 5, 10, 0, 30) // local 2026-06-10 00:30
    expect(isoDate(d)).toBe('2026-06-10')
    const e = new Date(2026, 5, 10, 23, 30) // local 2026-06-10 23:30
    expect(isoDate(e)).toBe('2026-06-10')
  })

  it('parses an ISO string to LOCAL midnight', () => {
    const d = dateFromIso('2026-06-10')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5) // June (0-indexed)
    expect(d.getDate()).toBe(10)
    expect(d.getHours()).toBe(0)
  })
})
