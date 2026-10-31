/**
 * Staff range mode fills every day in the span (unbookable ones become forced
 * days) behind one confirm; customer ranges still fill bookable days only.
 * Also: today is a ring (not a grey fill), past days read differently for staff.
 */
import { useState } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AvailabilitySlot } from '@/api/types'
import type { ForceReason } from '@/lib/strings'
import { MultiDayPicker } from './MultiDayPicker'
import { StaffModeProvider } from '@/lib/staffMode.tsx'
import { ALL_STAFF_POWERS } from '@/lib/staffMode'
import { isoDate } from './dateUtils'

const STAFF = { active: true, token: 't', powers: ALL_STAFF_POWERS, operatorId: 'op' }
const now = new Date()
const nextMonth = (day: number) => new Date(now.getFullYear(), now.getMonth() + 1, day)
const slot = (d: Date, available: number): AvailabilitySlot => ({
  availability_id: `s-${isoDate(d)}`,
  date: isoDate(d),
  start_time: null,
  end_time: null,
  capacity: 5,
  capacity_reserved: 5 - available,
  available_seats: available,
  status: available > 0 ? 'open' : 'fully_booked',
})

function btn(d: Date): HTMLButtonElement {
  const m = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-day]')).find(
    (b) => b.dataset.day && isoDate(new Date(b.dataset.day)) === isoDate(d),
  )
  if (!m) throw new Error(`no button ${isoDate(d)}`)
  return m
}
const selected = () =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-selected-single=true]'))
    .map((b) => isoDate(new Date(b.dataset.day!)))
    .sort()

function Harness({
  staff,
  month,
  availability,
  onForced,
}: {
  staff: boolean
  month: Date
  availability: AvailabilitySlot[]
  onForced?: (d: string[], r: ForceReason[]) => void
}) {
  const [value, setValue] = useState<Date[]>([])
  return (
    <StaffModeProvider value={staff ? STAFF : undefined}>
      <MultiDayPicker
        availability={availability}
        value={value}
        onChange={setValue}
        onForcedDaysChange={onForced}
        defaultMonth={new Date(month.getFullYear(), month.getMonth(), 1)}
      />
    </StaffModeProvider>
  )
}

describe('MultiDayPicker range mode', () => {
  afterEach(() => vi.restoreAllMocks())
  // 10 and 14 bookable, 11-13 not offered / full.
  const avail = [slot(nextMonth(10), 5), slot(nextMonth(12), 0), slot(nextMonth(14), 5)]

  it('staff: range across unavailable days selects every day, forced, one confirm', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onForced = vi.fn<(d: string[], r: ForceReason[]) => void>()
    render(<Harness staff month={nextMonth(1)} availability={avail} onForced={onForced} />)
    fireEvent.click(btn(nextMonth(10)))
    fireEvent.click(btn(nextMonth(14)))
    expect(selected()).toEqual([10, 11, 12, 13, 14].map((n) => isoDate(nextMonth(n))))
    expect(confirmSpy).toHaveBeenCalledTimes(1) // one per gesture, not per day
    expect(onForced).toHaveBeenLastCalledWith(
      [11, 12, 13].map((n) => isoDate(nextMonth(n))),
      expect.arrayContaining(['capacity', 'off_schedule']),
    )
  })

  it('staff: declining the confirm leaves the selection untouched', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<Harness staff month={nextMonth(1)} availability={avail} />)
    fireEvent.click(btn(nextMonth(10)))
    fireEvent.click(btn(nextMonth(14)))
    expect(selected()).toEqual([isoDate(nextMonth(10))])
  })

  it('staff: two forced ends fill the whole span', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Harness staff month={nextMonth(1)} availability={avail} />)
    fireEvent.click(btn(nextMonth(20)))
    fireEvent.click(btn(nextMonth(23)))
    expect(selected()).toEqual([20, 21, 22, 23].map((n) => isoDate(nextMonth(n))))
  })

  it('customer: range still fills bookable days only', () => {
    render(<Harness staff={false} month={nextMonth(1)} availability={avail} />)
    fireEvent.click(btn(nextMonth(10)))
    fireEvent.click(btn(nextMonth(14)))
    expect(selected()).toEqual([10, 14].map((n) => isoDate(nextMonth(n))))
  })

  it('today is a ring, not a grey fill', () => {
    render(<Harness staff={false} month={now} availability={[]} />)
    const td = document.querySelector('[data-today="true"]')!
    expect(td.className).toMatch(/ring-primary/)
    expect(td.className).not.toMatch(/bg-accent/)
  })

  it('staff: past days are muted, clickable and amber-ringed once selected; customers keep them disabled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    // Mid-month yesterday is in the visible month unless today is the 1st.
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    const month = new Date(yesterday.getFullYear(), yesterday.getMonth(), 1)
    const { unmount } = render(<Harness staff month={month} availability={[]} />)
    expect(btn(yesterday)).not.toBeDisabled()
    expect(btn(yesterday).dataset.past).toBe('true')
    expect(btn(yesterday).className).not.toMatch(/ring-amber/)
    fireEvent.click(btn(yesterday))
    expect(btn(yesterday).className).toMatch(/ring-amber-500/)
    unmount()
    render(<Harness staff={false} month={month} availability={[]} />)
    expect(btn(yesterday)).toBeDisabled()
    expect(btn(yesterday).dataset.past).toBeUndefined()
  })
})
