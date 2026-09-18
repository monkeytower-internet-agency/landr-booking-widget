import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { AvailabilitySlot } from '@/api/types'
import { MultiDayPicker } from './MultiDayPicker'
import { dateFromIso, isoDate } from './dateUtils'

/**
 * landr-otml0.3 — the originalValue diff mode, ported from the dashboard's
 * MultiDayPicker.diff.test.tsx (landr-fxza.5 Section C / landr-q4t3), scoped
 * to what this ticket actually specifies for the widget: added/removed
 * tinting, the "+N day(s) / −M day(s) vs <host>" summary, and the "Reset to
 * <host>'s dates" button. The widget has no staff/force-book UI concerns in
 * scope here, so this file only covers the diff surface itself.
 */

function makeAvailability(start: Date, count: number): AvailabilitySlot[] {
  const out: AvailabilitySlot[] = []
  for (let i = 0; i < count; i += 1) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const iso = isoDate(d)
    out.push({
      availability_id: `slot-${iso}`,
      date: iso,
      start_time: null,
      end_time: null,
      capacity: 5,
      capacity_reserved: 0,
      available_seats: 5,
      status: 'open',
    })
  }
  return out
}

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
    throw new Error(`No day button for ${isoDate(date)}`)
  }
  return match
}

function clickDay(date: Date) {
  fireEvent.click(dayButton(date))
}

function Harness({
  availability,
  initial,
  originalValue,
  originalValueLabel,
  onChangeSpy,
  defaultMonth,
}: {
  availability: AvailabilitySlot[]
  initial: Date[]
  originalValue?: Date[]
  originalValueLabel?: string
  onChangeSpy?: (days: Date[]) => void
  defaultMonth: Date
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
      originalValue={originalValue}
      originalValueLabel={originalValueLabel}
    />
  )
}

const windowStart = new Date(2026, 5, 10) // 2026-06-10
const defaultMonth = new Date(2026, 5, 1)
const availability = makeAvailability(windowStart, 10) // 10..19
const hostDates = ['2026-06-12', '2026-06-13'].map(dateFromIso)

describe('MultiDayPicker — invite-mode diff (landr-otml0.3)', () => {
  it('renders no diff chrome when originalValue is omitted', () => {
    render(
      <Harness
        availability={availability}
        initial={[]}
        defaultMonth={defaultMonth}
      />,
    )
    expect(screen.queryByTestId('multi-day-diff')).toBeNull()
  })

  it('shows no legend/summary when the selection matches the baseline exactly', () => {
    render(
      <Harness
        availability={availability}
        initial={hostDates}
        originalValue={hostDates}
        originalValueLabel="Olaf"
        defaultMonth={defaultMonth}
      />,
    )
    expect(screen.getByTestId('multi-day-diff')).toBeInTheDocument()
    expect(screen.queryByTestId('multi-day-diff-legend')).toBeNull()
    expect(screen.queryByTestId('multi-day-diff-summary')).toBeNull()
    expect(screen.getByTestId('multi-day-reset-button')).toBeDisabled()
  })

  it('adding a day past the host baseline shows +1 / -0 and tints the added day', () => {
    render(
      <Harness
        availability={availability}
        initial={hostDates}
        originalValue={hostDates}
        originalValueLabel="Olaf"
        defaultMonth={defaultMonth}
      />,
    )
    // landr-otml0.3: individual (toggle) mode — range mode's anchor starts
    // null on mount regardless of the pre-filled `value`, so a first click
    // there restarts the WHOLE selection at the clicked day (pre-existing
    // widget behaviour, not specific to the diff feature). Toggle mode adds
    // exactly the clicked day, which is what these assertions exercise.
    fireEvent.click(screen.getByRole('button', { name: /individual days/i }))
    clickDay(new Date(2026, 5, 14))
    expect(screen.getByTestId('multi-day-diff-summary').textContent).toContain(
      '+1 day',
    )
    expect(screen.getByTestId('multi-day-diff-summary').textContent).toContain(
      '−0 days',
    )
    expect(screen.getByTestId('multi-day-diff-summary').textContent).toContain(
      'vs Olaf',
    )
    expect(dayButton(new Date(2026, 5, 14)).dataset.diff).toBe('added')
  })

  it('removing a host day shows -1 and tints it removed, without deselecting it from the grid', () => {
    render(
      <Harness
        availability={availability}
        initial={hostDates}
        originalValue={hostDates}
        originalValueLabel="Olaf"
        defaultMonth={defaultMonth}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /individual days/i }))
    clickDay(new Date(2026, 5, 13))
    expect(screen.getByTestId('multi-day-diff-summary').textContent).toContain(
      '+0 days',
    )
    expect(screen.getByTestId('multi-day-diff-summary').textContent).toContain(
      '−1 day',
    )
    expect(dayButton(new Date(2026, 5, 13)).dataset.diff).toBe('removed')
  })

  it('a same-count swap reads as +1/-1, not a collapsed net-zero', () => {
    render(
      <Harness
        availability={availability}
        initial={hostDates}
        originalValue={hostDates}
        originalValueLabel="Olaf"
        defaultMonth={defaultMonth}
      />,
    )
    // Swap the 13th for the 14th — same total day count, but a genuine change.
    fireEvent.click(screen.getByRole('button', { name: /individual days/i }))
    clickDay(new Date(2026, 5, 13)) // remove
    clickDay(new Date(2026, 5, 14)) // add
    const summary = screen.getByTestId('multi-day-diff-summary').textContent
    expect(summary).toContain('+1 day')
    expect(summary).toContain('−1 day')
  })

  it('Reset restores the host baseline exactly', () => {
    const spy = vi.fn<(days: Date[]) => void>()
    render(
      <Harness
        availability={availability}
        initial={hostDates}
        originalValue={hostDates}
        originalValueLabel="Olaf"
        onChangeSpy={spy}
        defaultMonth={defaultMonth}
      />,
    )
    clickDay(new Date(2026, 5, 14))
    fireEvent.click(screen.getByTestId('multi-day-reset-button'))
    expect(spy.mock.calls.at(-1)![0].map(isoDate)).toEqual(
      hostDates.map(isoDate),
    )
    expect(screen.getByTestId('multi-day-reset-button')).toBeDisabled()
  })
})
