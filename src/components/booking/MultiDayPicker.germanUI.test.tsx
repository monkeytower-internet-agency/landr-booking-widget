/**
 * landr-5aih0.27 — widget German UI.
 *
 * MultiDayPicker's invite-mode diff chrome (landr-otml0.3: the
 * added/removed legend + change-summary line, shown only when
 * `originalValue` is supplied) renders in German when the browser reports
 * a German locale.
 */
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AvailabilitySlot } from '@/api/types'
import { MultiDayPicker } from './MultiDayPicker'

function makeAvailability(start: Date, count: number): AvailabilitySlot[] {
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
    })
  }
  return out
}

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`

function setBrowserLanguage(language: string) {
  vi.stubGlobal('navigator', { ...navigator, language })
}

describe('MultiDayPicker — German UI diff chrome (landr-5aih0.27)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the added/removed legend and change summary in German', () => {
    setBrowserLanguage('de-DE')
    const start = new Date(2026, 5, 10) // 2026-06-10
    const availability = makeAvailability(start, 6)
    const day = (offset: number) => {
      const d = new Date(start)
      d.setDate(start.getDate() + offset)
      return d
    }

    render(
      <MultiDayPicker
        availability={availability}
        value={[day(0), day(1)]}
        originalValue={[day(0), day(2)]}
        originalValueLabel="Ada"
        onChange={vi.fn()}
        defaultMonth={start}
      />,
    )

    const legend = screen.getByTestId('multi-day-diff-legend')
    expect(legend).toHaveTextContent('Hinzugefügt')
    expect(legend).toHaveTextContent('Entfernt')
    expect(legend).not.toHaveTextContent('Added')
    expect(legend).not.toHaveTextContent('Removed')

    expect(screen.getByTestId('multi-day-diff-summary')).toHaveTextContent(
      '+1 Tag / −1 Tag gegenüber Ada',
    )

    expect(screen.getByRole('button', { name: /Zurücksetzen auf die Termine von Ada/ })).toBeInTheDocument()
  })
})
