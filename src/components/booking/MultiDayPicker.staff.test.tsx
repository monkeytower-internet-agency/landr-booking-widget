/**
 * landr-aoak.2 [S3]: staff force-book on MultiDayPicker. A blocked / sold-out
 * day (zero availability) becomes selectable inside an active StaffModeProvider
 * and is reported via onForcedDaysChange. Normal-mode behaviour is covered by
 * MultiDayPicker.test.tsx (untouched).
 */
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AvailabilitySlot } from '@/api/types'
import { MultiDayPicker } from './MultiDayPicker'
import { StaffModeProvider } from '@/lib/staffMode.tsx'
import { ALL_STAFF_POWERS, type StaffSession } from '@/lib/staffMode'

const STAFF: StaffSession = {
  active: true,
  token: 'staff.token',
  powers: ALL_STAFF_POWERS,
  operatorId: 'op-uuid-1',
}

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`

function slot(d: Date, available: number): AvailabilitySlot {
  const iso = isoOf(d)
  return {
    availability_id: `slot-${iso}`,
    date: iso,
    start_time: null,
    end_time: null,
    capacity: 5,
    capacity_reserved: 5 - available,
    available_seats: available,
    status: available > 0 ? 'open' : 'fully_booked',
  }
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
  if (!match) throw new Error(`No day button for ${isoOf(date)}`)
  return match
}

const defaultMonth = new Date(2026, 5, 1)
const availDay = new Date(2026, 5, 10) // available
const blockedDay = new Date(2026, 5, 11) // zero availability

function StaffHarness({
  staffActive,
  onForced,
}: {
  staffActive: boolean
  onForced?: (iso: string[]) => void
}) {
  const [value, setValue] = useState<Date[]>([])
  return (
    <StaffModeProvider value={staffActive ? STAFF : undefined}>
      <MultiDayPicker
        availability={[slot(availDay, 5), slot(blockedDay, 0)]}
        value={value}
        onChange={setValue}
        onForcedDaysChange={onForced}
        defaultMonth={defaultMonth}
      />
    </StaffModeProvider>
  )
}

describe('MultiDayPicker — staff force-book', () => {
  afterEach(() => vi.restoreAllMocks())

  it('a zero-availability day is DISABLED for a normal customer', () => {
    render(<StaffHarness staffActive={false} />)
    expect(dayButton(blockedDay)).toBeDisabled()
    expect(dayButton(availDay)).not.toBeDisabled()
  })

  it('a zero-availability day is SELECTABLE in staff mode and reported as forced', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onForced = vi.fn<(iso: string[]) => void>()
    render(<StaffHarness staffActive onForced={onForced} />)

    // In staff mode every day is clickable (no per-day disabled predicate).
    expect(dayButton(blockedDay)).not.toBeDisabled()
    fireEvent.click(dayButton(blockedDay))

    expect(window.confirm).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('operator-override-badge')).toBeInTheDocument()
    expect(onForced).toHaveBeenLastCalledWith([isoOf(blockedDay)])
  })

  it('declining the confirm leaves the blocked day unselected', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onForced = vi.fn<(iso: string[]) => void>()
    render(<StaffHarness staffActive onForced={onForced} />)
    fireEvent.click(dayButton(blockedDay))
    expect(screen.queryByTestId('operator-override-badge')).not.toBeInTheDocument()
    // onForced only ever called with [] (mount sync), never the blocked day.
    for (const call of onForced.mock.calls) {
      expect(call[0]).toEqual([])
    }
  })

  it('picking an AVAILABLE day in staff mode reports no forced days', () => {
    const onForced = vi.fn<(iso: string[]) => void>()
    render(<StaffHarness staffActive onForced={onForced} />)
    fireEvent.click(dayButton(availDay))
    expect(screen.queryByTestId('operator-override-badge')).not.toBeInTheDocument()
    expect(onForced).toHaveBeenLastCalledWith([])
  })
})
