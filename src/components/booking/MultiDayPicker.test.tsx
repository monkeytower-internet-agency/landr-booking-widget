import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { AvailabilitySlot } from '@/api/types'
import { MultiDayPicker } from './MultiDayPicker'

function makeAvailability(
  start: Date,
  count: number,
  perDay: Partial<AvailabilitySlot> = {},
): AvailabilitySlot[] {
  const out: AvailabilitySlot[] = []
  for (let i = 0; i < count; i += 1) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const iso = isoOf(d)
    out.push({
      availability_id: `slot-${iso}`,
      date: iso,
      start_time: null,
      end_time: null,
      capacity: 5,
      capacity_reserved: 0,
      available_seats: 5,
      status: 'open',
      ...perDay,
    })
  }
  return out
}

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`

/**
 * Find the day cell <button> for the given calendar date.
 * CalendarDayButton sets data-day to the JS Date's locale string; match by
 * parsing the attribute back to a Date so test locale doesn't matter.
 */
function dayButton(date: Date): HTMLButtonElement {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('button[data-day]'),
  )
  const match = buttons.find((b) => {
    const raw = b.dataset.day
    if (!raw) return false
    const parsed = new Date(raw)
    return (
      parsed.getFullYear() === date.getFullYear() &&
      parsed.getMonth() === date.getMonth() &&
      parsed.getDate() === date.getDate()
    )
  })
  if (!match) {
    throw new Error(
      `No day button for ${isoOf(date)}; found ${buttons.length} buttons total`,
    )
  }
  return match
}

function clickDay(date: Date, init: Partial<MouseEventInit> = {}) {
  fireEvent.click(dayButton(date), init)
}

function Harness({
  availability,
  initial = [],
  onChangeSpy,
  defaultMonth,
  isContiguous,
}: {
  availability: AvailabilitySlot[]
  initial?: Date[]
  onChangeSpy?: (days: Date[]) => void
  defaultMonth: Date
  isContiguous?: boolean
}) {
  const [value, setValue] = useState<Date[]>(initial)
  return (
    <MultiDayPicker
      availability={availability}
      value={value}
      onChange={(days) => {
        setValue(days)
        onChangeSpy?.(days)
      }}
      defaultMonth={defaultMonth}
      isContiguous={isContiguous}
    />
  )
}

const windowStart = new Date(2026, 5, 10) // 2026-06-10
const defaultMonth = new Date(2026, 5, 1) // June 2026
const availability = makeAvailability(windowStart, 10) // 10..19

describe('MultiDayPicker', () => {
  // -------------------------------------------------------------------------
  // individual mode (default)
  // -------------------------------------------------------------------------
  describe('individual mode (default)', () => {
    it('tapping a day adds it', () => {
      const spy = vi.fn<(days: Date[]) => void>()
      render(
        <Harness
          availability={availability}
          onChangeSpy={spy}
          defaultMonth={defaultMonth}
        />,
      )
      clickDay(new Date(2026, 5, 12))
      expect(spy.mock.calls.at(-1)![0].map(isoOf)).toEqual(['2026-06-12'])
    })

    it('tapping a selected day removes it', () => {
      const spy = vi.fn<(days: Date[]) => void>()
      render(
        <Harness
          availability={availability}
          onChangeSpy={spy}
          defaultMonth={defaultMonth}
        />,
      )
      clickDay(new Date(2026, 5, 12))
      clickDay(new Date(2026, 5, 12)) // tap again to remove
      expect(spy.mock.calls.at(-1)![0].map(isoOf)).toEqual([])
    })

    it('tapping two non-adjacent days keeps both (non-consecutive)', () => {
      const spy = vi.fn<(days: Date[]) => void>()
      render(
        <Harness
          availability={availability}
          onChangeSpy={spy}
          defaultMonth={defaultMonth}
        />,
      )
      clickDay(new Date(2026, 5, 12))
      clickDay(new Date(2026, 5, 19)) // non-adjacent
      expect(spy.mock.calls.at(-1)![0].map(isoOf)).toEqual([
        '2026-06-12',
        '2026-06-19',
      ])
    })
  })

  // -------------------------------------------------------------------------
  // range mode
  // -------------------------------------------------------------------------
  describe('range mode', () => {
    it('switch to range then tap two days fills the span', () => {
      const spy = vi.fn<(days: Date[]) => void>()
      render(
        <Harness
          availability={availability}
          onChangeSpy={spy}
          defaultMonth={defaultMonth}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /date range/i }))
      clickDay(new Date(2026, 5, 12))
      clickDay(new Date(2026, 5, 15))
      expect(spy.mock.calls.at(-1)![0].map(isoOf)).toEqual([
        '2026-06-12',
        '2026-06-13',
        '2026-06-14',
        '2026-06-15',
      ])
    })

    it('switching mode mid-selection does not crash; new mode governs subsequent taps', () => {
      const spy = vi.fn<(days: Date[]) => void>()
      render(
        <Harness
          availability={availability}
          onChangeSpy={spy}
          defaultMonth={defaultMonth}
        />,
      )
      // Start in individual, tap a day
      clickDay(new Date(2026, 5, 12))
      expect(spy.mock.calls.at(-1)![0].map(isoOf)).toEqual(['2026-06-12'])

      // Switch to range mid-selection
      fireEvent.click(screen.getByRole('button', { name: /date range/i }))

      // Tap another day — range mode: extends from anchor (12) to 15
      clickDay(new Date(2026, 5, 15))
      expect(spy.mock.calls.at(-1)![0].map(isoOf)).toEqual([
        '2026-06-12',
        '2026-06-13',
        '2026-06-14',
        '2026-06-15',
      ])
    })
  })

  // -------------------------------------------------------------------------
  // modifier key overrides mode
  // -------------------------------------------------------------------------
  it('modifier+tap while in range mode toggles a single day', () => {
    const spy = vi.fn<(days: Date[]) => void>()
    render(
      <Harness
        availability={availability}
        onChangeSpy={spy}
        defaultMonth={defaultMonth}
      />,
    )
    // Switch to range mode
    fireEvent.click(screen.getByRole('button', { name: /date range/i }))
    clickDay(new Date(2026, 5, 12))
    // shiftKey while in range mode => individual toggle
    clickDay(new Date(2026, 5, 19), { shiftKey: true })
    expect(spy.mock.calls.at(-1)![0].map(isoOf)).toEqual([
      '2026-06-12',
      '2026-06-19',
    ])
  })

  // -------------------------------------------------------------------------
  // legacy range tests (preserved)
  // -------------------------------------------------------------------------
  it('clicking two dates selects the inclusive range between them (range mode)', () => {
    const spy = vi.fn<(days: Date[]) => void>()
    render(
      <Harness
        availability={availability}
        onChangeSpy={spy}
        defaultMonth={defaultMonth}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /date range/i }))
    clickDay(new Date(2026, 5, 12))
    clickDay(new Date(2026, 5, 15))
    const lastCall = spy.mock.calls.at(-1)
    expect(lastCall).toBeDefined()
    expect(lastCall![0].map(isoOf)).toEqual([
      '2026-06-12',
      '2026-06-13',
      '2026-06-14',
      '2026-06-15',
    ])
  })

  it('clicking a date outside the current range extends the range (range mode)', () => {
    const spy = vi.fn<(days: Date[]) => void>()
    render(
      <Harness
        availability={availability}
        onChangeSpy={spy}
        defaultMonth={defaultMonth}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /date range/i }))
    clickDay(new Date(2026, 5, 12))
    clickDay(new Date(2026, 5, 14)) // 12..14
    clickDay(new Date(2026, 5, 17)) // 17 outside => 12..17
    expect(spy.mock.calls.at(-1)![0].map(isoOf)).toEqual([
      '2026-06-12',
      '2026-06-13',
      '2026-06-14',
      '2026-06-15',
      '2026-06-16',
      '2026-06-17',
    ])
  })

  it('shift+click inside the current range removes just that day', () => {
    const spy = vi.fn<(days: Date[]) => void>()
    render(
      <Harness
        availability={availability}
        onChangeSpy={spy}
        defaultMonth={defaultMonth}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /date range/i }))
    clickDay(new Date(2026, 5, 12))
    clickDay(new Date(2026, 5, 16)) // 12..16
    clickDay(new Date(2026, 5, 14), { shiftKey: true })
    expect(spy.mock.calls.at(-1)![0].map(isoOf)).toEqual([
      '2026-06-12',
      '2026-06-13',
      '2026-06-15',
      '2026-06-16',
    ])
  })

  it('shift+click on an unselected far date adds just that day without filling the gap', () => {
    const spy = vi.fn<(days: Date[]) => void>()
    render(
      <Harness
        availability={availability}
        onChangeSpy={spy}
        defaultMonth={defaultMonth}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /date range/i }))
    clickDay(new Date(2026, 5, 12))
    clickDay(new Date(2026, 5, 19), { shiftKey: true })
    expect(spy.mock.calls.at(-1)![0].map(isoOf)).toEqual([
      '2026-06-12',
      '2026-06-19',
    ])
  })

  it('ctrl+click toggles like shift+click', () => {
    const spy = vi.fn<(days: Date[]) => void>()
    render(
      <Harness
        availability={availability}
        onChangeSpy={spy}
        defaultMonth={defaultMonth}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /date range/i }))
    clickDay(new Date(2026, 5, 12))
    clickDay(new Date(2026, 5, 19), { ctrlKey: true })
    expect(spy.mock.calls.at(-1)![0].map(isoOf)).toEqual([
      '2026-06-12',
      '2026-06-19',
    ])
  })

  it('clicking a day with zero seats is ignored (button is disabled)', () => {
    const seatless = availability.map((slot, idx) =>
      idx === 3 ? { ...slot, available_seats: 0 } : slot,
    )
    const spy = vi.fn<(days: Date[]) => void>()
    render(
      <Harness
        availability={seatless}
        onChangeSpy={spy}
        defaultMonth={defaultMonth}
      />,
    )
    const target = dayButton(new Date(2026, 5, 13))
    expect(target).toBeDisabled()
    fireEvent.click(target)
    expect(spy).not.toHaveBeenCalled()
  })

  it(
    'click+click range that brackets a disabled day still includes the surrounding days and excludes the disabled one (landr-e10.9)',
    () => {
      // 2026-06-13 is the 4th day in the 10..19 window (idx 3) -- flip it
      // to zero seats so it renders disabled inside the range.
      const seatless = availability.map((slot, idx) =>
        idx === 3 ? { ...slot, available_seats: 0, capacity_reserved: 5 } : slot,
      )
      const spy = vi.fn<(days: Date[]) => void>()
      render(
        <Harness
          availability={seatless}
          onChangeSpy={spy}
          defaultMonth={defaultMonth}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /date range/i }))
      clickDay(new Date(2026, 5, 12)) // anchor
      clickDay(new Date(2026, 5, 15)) // range click+click
      expect(spy.mock.calls.at(-1)![0].map(isoOf)).toEqual([
        '2026-06-12',
        // 2026-06-13 omitted -- disabled day inside the bracketed range
        '2026-06-14',
        '2026-06-15',
      ])
    },
  )

  it('renders the provided help text', () => {
    render(
      <MultiDayPicker
        availability={availability}
        value={[]}
        onChange={() => {}}
        helpText="Custom help string"
        defaultMonth={defaultMonth}
      />,
    )
    expect(screen.getByTestId('multi-day-help')).toHaveTextContent(
      'Custom help string',
    )
  })

  it('renders individual-mode help text by default', () => {
    render(
      <MultiDayPicker
        availability={availability}
        value={[]}
        onChange={() => {}}
        defaultMonth={defaultMonth}
      />,
    )
    expect(screen.getByTestId('multi-day-help')).toHaveTextContent(
      /tap days to add or remove/i,
    )
  })

  it('renders range-mode help text when range mode is active', () => {
    render(
      <MultiDayPicker
        availability={availability}
        value={[]}
        onChange={() => {}}
        defaultMonth={defaultMonth}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /date range/i }))
    expect(screen.getByTestId('multi-day-help')).toHaveTextContent(
      /tap a start date/i,
    )
  })

  // -------------------------------------------------------------------------
  // contiguous mode (landr-y9k)
  // -------------------------------------------------------------------------
  describe('contiguous mode (landr-y9k)', () => {
    it('does NOT render the mode toggle in contiguous mode', () => {
      render(
        <MultiDayPicker
          availability={availability}
          value={[]}
          onChange={() => {}}
          defaultMonth={defaultMonth}
          isContiguous
        />,
      )
      expect(
        screen.queryByRole('button', { name: /individual days/i }),
      ).toBeNull()
      expect(screen.queryByRole('button', { name: /date range/i })).toBeNull()
    })

    it('renders the consecutive-days help text in contiguous mode', () => {
      render(
        <MultiDayPicker
          availability={availability}
          value={[]}
          onChange={() => {}}
          defaultMonth={defaultMonth}
          isContiguous
        />,
      )
      expect(screen.getByTestId('multi-day-help')).toHaveTextContent(
        /consecutive days/i,
      )
    })

    it('clicking two adjacent dates extends the range', () => {
      const spy = vi.fn<(days: Date[]) => void>()
      render(
        <Harness
          availability={availability}
          onChangeSpy={spy}
          defaultMonth={defaultMonth}
          isContiguous
        />,
      )
      clickDay(new Date(2026, 5, 12))
      clickDay(new Date(2026, 5, 15))
      expect(spy.mock.calls.at(-1)![0].map(isoOf)).toEqual([
        '2026-06-12',
        '2026-06-13',
        '2026-06-14',
        '2026-06-15',
      ])
    })

    it('clicking past a gap in availability RESTARTS the selection (can not span a disabled day)', () => {
      // Punch out 2026-06-14 (idx 4 in the 10..19 window) so any range that
      // would bracket it is rejected as non-contiguous.
      const gappy = availability.map((slot, idx) =>
        idx === 4 ? { ...slot, available_seats: 0, capacity_reserved: 5 } : slot,
      )
      const spy = vi.fn<(days: Date[]) => void>()
      render(
        <Harness
          availability={gappy}
          onChangeSpy={spy}
          defaultMonth={defaultMonth}
          isContiguous
        />,
      )
      clickDay(new Date(2026, 5, 12))
      clickDay(new Date(2026, 5, 13)) // 12..13 (fine, no gap)
      // 14 is disabled; trying to extend to 16 would bracket it =>
      // contiguous invariant violated => restart from 16.
      clickDay(new Date(2026, 5, 16))
      expect(spy.mock.calls.at(-1)![0].map(isoOf)).toEqual(['2026-06-16'])
    })

    it('shift+click suppresses the toggle gesture and restarts from the clicked date', () => {
      const spy = vi.fn<(days: Date[]) => void>()
      render(
        <Harness
          availability={availability}
          onChangeSpy={spy}
          defaultMonth={defaultMonth}
          isContiguous
        />,
      )
      clickDay(new Date(2026, 5, 12))
      clickDay(new Date(2026, 5, 19), { shiftKey: true })
      // In any-day mode this would yield [12, 19]; in contiguous mode the
      // toggle gesture is suppressed and the run restarts from the click.
      expect(spy.mock.calls.at(-1)![0].map(isoOf)).toEqual(['2026-06-19'])
    })

    it('clicking one day before the existing run prepends it (adjacent extension)', () => {
      const spy = vi.fn<(days: Date[]) => void>()
      render(
        <Harness
          availability={availability}
          onChangeSpy={spy}
          defaultMonth={defaultMonth}
          isContiguous
        />,
      )
      clickDay(new Date(2026, 5, 14)) // anchor at 14
      clickDay(new Date(2026, 5, 13)) // adjacent before => 13..14
      expect(spy.mock.calls.at(-1)![0].map(isoOf)).toEqual([
        '2026-06-13',
        '2026-06-14',
      ])
    })
  })

  // landr-8yaz: calendar week defaults to Monday (European convention) for
  // every picker that mounts <Calendar>. react-day-picker renders the
  // weekday header row as <th scope="col"> cells inside an aria-hidden
  // <thead>, so query the cells via class selector (the rdp-weekday class
  // is part of the public render contract) rather than role lookup.
  it('renders the weekday header with Monday in the first column', () => {
    const { container } = render(
      <Harness
        availability={availability}
        onChangeSpy={vi.fn()}
        defaultMonth={defaultMonth}
      />,
    )
    const headers = container.querySelectorAll('th.rdp-weekday')
    expect(headers.length).toBeGreaterThanOrEqual(7)
    // Use the full aria-label ("Monday"/"Tuesday"/...) which react-day-picker
    // sets independent of the visible short label so the assertion stays
    // stable across CI locale variants.
    expect(headers[0]!.getAttribute('aria-label')).toBe('Monday')
    expect(headers[6]!.getAttribute('aria-label')).toBe('Sunday')
  })
})
