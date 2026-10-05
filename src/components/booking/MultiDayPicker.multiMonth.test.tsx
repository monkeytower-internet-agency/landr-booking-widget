import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AvailabilitySlot } from '@/api/types'
import { MultiDayPicker } from './MultiDayPicker'
import { AVAILABILITY_HORIZON_DAYS } from './calendarStart'

// landr-53vao: multi-month calendar. Two months side by side when the
// picker's CONTAINER is wide, one month plus a next-month peek strip when it
// is narrow. The container is measured with a ResizeObserver (jsdom has no
// layout), so each test stubs one that reports a fixed width.

function stubContainerWidth(width: number | null) {
  if (width === null) {
    vi.stubGlobal('ResizeObserver', undefined)
    return
  }
  class FakeResizeObserver {
    private readonly cb: ResizeObserverCallback
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb
    }
    observe(el: Element) {
      this.cb(
        [{ target: el, contentRect: { width } } as unknown as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      )
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
}

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`

function slotsBetween(from: Date, to: Date): AvailabilitySlot[] {
  const out: AvailabilitySlot[] = []
  const cursor = new Date(from)
  while (cursor <= to) {
    const iso = isoOf(cursor)
    out.push({
      availability_id: `slot-${iso}`,
      date: iso,
      start_time: null,
      end_time: null,
      capacity: 5,
      capacity_reserved: 0,
      available_seats: 5,
      status: 'open',
    } as AvailabilitySlot)
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

function Harness({
  availability,
  defaultMonth,
  onChangeSpy,
}: {
  availability: AvailabilitySlot[]
  defaultMonth: Date
  onChangeSpy?: (days: Date[]) => void
}) {
  const [value, setValue] = useState<Date[]>([])
  return (
    <MultiDayPicker
      availability={availability}
      value={value}
      onChange={(days) => {
        setValue(days)
        onChangeSpy?.(days)
      }}
      defaultMonth={defaultMonth}
    />
  )
}

function dayButtons(date: Date): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('button[data-day]'),
  ).filter((b) => {
    const parsed = new Date(b.dataset.day ?? '')
    return (
      parsed.getFullYear() === date.getFullYear() &&
      parsed.getMonth() === date.getMonth() &&
      parsed.getDate() === date.getDate()
    )
  })
}

const TODAY = new Date(2026, 11, 21, 12) // 21 Dec 2026

describe('MultiDayPicker multi-month layout', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(TODAY)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const availability = slotsBetween(new Date(2026, 11, 21), new Date(2027, 2, 31))

  it('shows two months side by side with no peek when the container is wide', () => {
    stubContainerWidth(800)
    render(
      <Harness availability={availability} defaultMonth={new Date(2027, 0, 1)} />,
    )
    const captions = screen.getAllByRole('status').map((n) => n.textContent)
    expect(captions).toEqual(['January 2027', 'February 2027'])
    expect(screen.queryByTestId('calendar-peek')).toBeNull()
  })

  it('shows one month plus a next-month peek strip when the container is narrow', () => {
    stubContainerWidth(360)
    render(
      <Harness availability={availability} defaultMonth={new Date(2027, 0, 1)} />,
    )
    expect(screen.getAllByRole('status').map((n) => n.textContent)).toEqual([
      'January 2027',
    ])
    const peek = screen.getByTestId('calendar-peek')
    expect(within(peek).getByText('February 2027')).toBeInTheDocument()
    const peekDays = within(peek).getAllByRole('button')
    expect(peekDays).toHaveLength(7)
    expect(peekDays.map((b) => b.textContent)).toEqual([
      '1', '2', '3', '4', '5', '6', '7',
    ])
  })

  it('falls back to the single-month layout when ResizeObserver is unavailable', () => {
    stubContainerWidth(null)
    render(
      <Harness availability={availability} defaultMonth={new Date(2027, 0, 1)} />,
    )
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByTestId('calendar-peek')).toBeInTheDocument()
  })

  it('selects a range across the month boundary in two-month mode (Jan 22 -> Feb 5)', () => {
    stubContainerWidth(800)
    const spy = vi.fn()
    render(
      <Harness
        availability={availability}
        defaultMonth={new Date(2027, 0, 1)}
        onChangeSpy={spy}
      />,
    )
    fireEvent.click(dayButtons(new Date(2027, 0, 22))[0]!)
    fireEvent.click(dayButtons(new Date(2027, 1, 5))[0]!)
    const last = spy.mock.calls.at(-1)![0] as Date[]
    expect(last.map(isoOf)).toEqual(
      slotsBetween(new Date(2027, 0, 22), new Date(2027, 1, 5)).map((s) => s.date),
    )
  })

  it('selects a range ending in the next month through the peek strip (narrow)', () => {
    stubContainerWidth(360)
    const spy = vi.fn()
    render(
      <Harness
        availability={availability}
        defaultMonth={new Date(2027, 0, 1)}
        onChangeSpy={spy}
      />,
    )
    fireEvent.click(dayButtons(new Date(2027, 0, 22))[0]!)
    const peek = screen.getByTestId('calendar-peek')
    fireEvent.click(within(peek).getByRole('button', { name: /5 February 2027|February 5/ }))
    const last = spy.mock.calls.at(-1)![0] as Date[]
    expect(last.map(isoOf)).toEqual(
      slotsBetween(new Date(2027, 0, 22), new Date(2027, 1, 5)).map((s) => s.date),
    )
    // The tapped peek day now carries the selected styling hook.
    expect(
      within(peek).getByRole('button', { name: /5 February 2027|February 5/ }),
    ).toHaveAttribute('data-selected-single', 'true')
  })

  it('disables unavailable days in the peek strip', () => {
    stubContainerWidth(360)
    // Availability ends 31 Mar; peek month is Apr when viewing March.
    render(
      <Harness availability={availability} defaultMonth={new Date(2027, 2, 1)} />,
    )
    const peek = screen.getByTestId('calendar-peek')
    for (const b of within(peek).getAllByRole('button')) {
      expect(b).toBeDisabled()
    }
  })

  it('pages one month at a time with two months shown', () => {
    stubContainerWidth(800)
    render(
      <Harness availability={availability} defaultMonth={new Date(2027, 0, 1)} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /next month/i }))
    expect(screen.getAllByRole('status').map((n) => n.textContent)).toEqual([
      'February 2027',
      'March 2027',
    ])
  })

  describe('horizon end', () => {
    // today + 731 days from 21 Dec 2026 lands in Dec 2028.
    const horizon = new Date(TODAY)
    horizon.setDate(horizon.getDate() + AVAILABILITY_HORIZON_DAYS)

    it('disables the next arrow on the last horizon month and renders no peek (narrow)', () => {
      stubContainerWidth(360)
      render(
        <Harness
          availability={availability}
          defaultMonth={new Date(horizon.getFullYear(), horizon.getMonth(), 1)}
        />,
      )
      expect(screen.queryByTestId('calendar-peek')).toBeNull()
      expect(screen.getByRole('button', { name: /next month/i })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
    })

    it('stops paging when the second of two months is the horizon month (wide)', () => {
      stubContainerWidth(800)
      render(
        <Harness
          availability={availability}
          defaultMonth={new Date(horizon.getFullYear(), horizon.getMonth() - 1, 1)}
        />,
      )
      expect(screen.getAllByRole('status')).toHaveLength(2)
      expect(screen.getByRole('button', { name: /next month/i })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
    })
  })
})
