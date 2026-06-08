/**
 * landr-aoak.2 [S3]: staff-mode affordances on SingleDatePicker. The
 * non-staff behaviour is covered by SingleDatePicker.test.tsx and is NOT
 * touched here — these tests run inside an ACTIVE StaffModeProvider only.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AvailabilitySlot, Product } from '@/api/types'
import { SingleDatePicker } from './SingleDatePicker'
import { StaffModeProvider } from '@/lib/staffMode.tsx'
import { ALL_STAFF_POWERS, type StaffSession } from '@/lib/staffMode'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getAvailability: vi.fn<
      (id: string, from: string, to: string) => Promise<AvailabilitySlot[]>
    >(),
  },
}))

vi.mock('@/api/client', () => ({
  getAvailability: mocks.getAvailability,
}))

const STAFF: StaffSession = {
  active: true,
  token: 'staff.token',
  powers: ALL_STAFF_POWERS,
}

function makeProduct(): Product {
  return {
    product_id: 'p-single',
    slug: 'equipment-rental',
    name: 'Equipment Rental',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'single_date',
    is_contiguous: false,
    duration_minutes: null,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: null,
    group_slug: null,
    group_name: null,
    sort_order: 0,
    sport_subcategory_codes: [],
    location_ids: [],
    needs_pickup: false,
  }
}

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`

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

function renderStaff(onConfirm = vi.fn()) {
  render(
    <StaffModeProvider value={STAFF}>
      <SingleDatePicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={onConfirm}
      />
    </StaffModeProvider>,
  )
  return onConfirm
}

describe('SingleDatePicker — staff force-book', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('a sold-out day is SELECTABLE and force-books with the forced flag', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    // No availability at all → tomorrow is a blocked / sold-out day.
    mocks.getAvailability.mockResolvedValue([])
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onConfirm = renderStaff()

    await waitFor(() => expect(mocks.getAvailability).toHaveBeenCalled())
    await waitFor(() => dayButton(tomorrow))

    // In staff mode the blocked day is NOT disabled.
    expect(dayButton(tomorrow)).not.toBeDisabled()
    fireEvent.click(dayButton(tomorrow))
    expect(confirmSpy).toHaveBeenCalledTimes(1)

    // Override badge appears for the forced selection.
    expect(screen.getByTestId('operator-override-badge')).toBeInTheDocument()

    const cont = screen.getByRole('button', { name: 'Continue' })
    expect(cont).not.toBeDisabled()
    fireEvent.click(cont)
    // selectedDays carries the day; forcedDays carries the SAME day.
    expect(onConfirm).toHaveBeenCalledWith([isoOf(tomorrow)], [isoOf(tomorrow)])
  })

  it('declining the confirm dialog does not select the blocked day', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    mocks.getAvailability.mockResolvedValue([])
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderStaff()

    await waitFor(() => expect(mocks.getAvailability).toHaveBeenCalled())
    await waitFor(() => dayButton(tomorrow))
    fireEvent.click(dayButton(tomorrow))

    expect(screen.queryByTestId('operator-override-badge')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('an available day picked in staff mode commits with NO forced arg', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    mocks.getAvailability.mockResolvedValue([
      {
        availability_id: `slot-${isoOf(tomorrow)}`,
        date: isoOf(tomorrow),
        start_time: null,
        end_time: null,
        capacity: 5,
        capacity_reserved: 0,
        available_seats: 5,
        status: 'open',
      },
    ])
    const onConfirm = renderStaff()

    await waitFor(() => expect(mocks.getAvailability).toHaveBeenCalled())
    await waitFor(() => dayButton(tomorrow))
    fireEvent.click(dayButton(tomorrow))
    expect(screen.queryByTestId('operator-override-badge')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    // Non-forced selection → exactly one argument (byte-identical to normal).
    expect(onConfirm).toHaveBeenCalledWith([isoOf(tomorrow)])
  })
})
