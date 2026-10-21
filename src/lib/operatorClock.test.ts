import { describe, expect, it } from 'vitest'
import { operatorWallClock } from '@/lib/operatorClock'

describe('operatorWallClock (landr-8ht3m.9)', () => {
  const instant = new Date('2026-05-16T09:30:00Z')

  it('reads the day and minute in the operator zone, whatever the browser zone', () => {
    expect(operatorWallClock('Europe/Berlin', instant)).toEqual({
      iso: '2026-05-16',
      minutes: 11 * 60 + 30,
    })
    expect(operatorWallClock('Pacific/Honolulu', instant)).toEqual({
      iso: '2026-05-15',
      minutes: 23 * 60 + 30,
    })
  })

  it('midnight is minute 0, not 24:00', () => {
    expect(operatorWallClock('Europe/Berlin', new Date('2026-05-15T22:00:00Z'))).toEqual({
      iso: '2026-05-16',
      minutes: 0,
    })
  })

  it('an unknown or missing zone falls back to the browser clock', () => {
    const local = { iso: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), minutes: instant.getHours() * 60 + instant.getMinutes() }
    expect(operatorWallClock('Not/AZone', instant)).toEqual(local)
    expect(operatorWallClock(null, instant)).toEqual(local)
    expect(operatorWallClock(undefined, instant)).toEqual(local)
  })
})
