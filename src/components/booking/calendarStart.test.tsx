import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvailabilitySlot } from '@/api/types'
import { MultiDayPicker } from './MultiDayPicker'
import {
  availabilityWindow,
  firstBookableDay,
  pickStartMonth,
} from './calendarStart'

// landr-l38a4: pickers open on the first selected day, else the first
// bookable day, else today — never on a dead "today" month.

const today = new Date(2026, 8, 21) // 21 Sep 2026

describe('pickStartMonth', () => {
  it('opens on the earliest selected day, even when earlier days are bookable', () => {
    const month = pickStartMonth(
      ['2026-10-14', '2026-10-12'],
      ['2026-09-25', '2026-10-12'],
      today,
    )
    expect(month).toEqual(new Date(2026, 9, 1))
  })

  it('opens on the first bookable day when nothing is selected', () => {
    const month = pickStartMonth([], ['2026-11-20', '2026-11-03'], today)
    expect(month).toEqual(new Date(2026, 10, 1))
  })

  it('ignores bookable days before today', () => {
    expect(firstBookableDay(['2026-09-01', '2026-12-02'], today)).toBe(
      '2026-12-02',
    )
  })

  it("falls back to today's month when nothing is bookable", () => {
    expect(pickStartMonth([], [], today)).toEqual(new Date(2026, 8, 1))
  })

  it('fetches a 90-day window from today (landr-api RPC caps p_to - p_from <= 90)', () => {
    expect(availabilityWindow(today)).toEqual({
      fromIso: '2026-09-21',
      toIso: '2026-12-20',
    })
  })
})

function slot(date: string): AvailabilitySlot {
  return {
    availability_id: `slot-${date}`,
    date,
    start_time: null,
    end_time: null,
    capacity: 5,
    capacity_reserved: 0,
    available_seats: 5,
    status: 'open',
  } as AvailabilitySlot
}

describe('MultiDayPicker opening month', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 21, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens on the season start and says nothing earlier is available', () => {
    render(
      <MultiDayPicker
        availability={[slot('2026-11-03'), slot('2026-11-04')]}
        value={[]}
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('November 2026')
    expect(screen.getByTestId('calendar-nothing-before')).toHaveTextContent(
      'Nothing is available before 3 November 2026.',
    )
  })

  it('moves to the season start once availability arrives after mount', () => {
    const { rerender } = render(
      <MultiDayPicker availability={[]} value={[]} onChange={() => {}} />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('September 2026')
    rerender(
      <MultiDayPicker
        availability={[slot('2026-11-03')]}
        value={[]}
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('November 2026')
  })

  it('re-entering with a selection opens on the first selected day', () => {
    render(
      <MultiDayPicker
        availability={[slot('2026-09-25'), slot('2026-10-12'), slot('2026-10-13')]}
        value={[new Date(2026, 9, 12), new Date(2026, 9, 13)]}
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('October 2026')
    expect(screen.queryByTestId('calendar-nothing-before')).not.toBeInTheDocument()
  })
})
