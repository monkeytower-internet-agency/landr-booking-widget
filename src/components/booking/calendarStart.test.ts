import { describe, expect, it } from 'vitest'


describe('availabilityWindow booking window', () => {
  it('caps the fetch window at today + N calendar months, clamping the day', async () => {
    const { availabilityWindow } = await import('./calendarStart')
    expect(availabilityWindow(new Date(2026, 7, 31), 6).toIso).toBe('2027-02-28')
    expect(availabilityWindow(new Date(2026, 10, 12), 12).toIso).toBe('2027-11-12')
  })

  it('is unchanged when unlimited or wider than the default horizon', async () => {
    const { availabilityWindow, AVAILABILITY_HORIZON_DAYS } = await import('./calendarStart')
    const today = new Date(2026, 10, 12)
    const unlimited = availabilityWindow(today)
    expect(availabilityWindow(today, null)).toEqual(unlimited)
    expect(availabilityWindow(today, 60)).toEqual(unlimited)
    expect(AVAILABILITY_HORIZON_DAYS).toBe(731)
  })
})
