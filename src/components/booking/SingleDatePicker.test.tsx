import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AvailabilitySlot, Product } from '@/api/types'
import { SingleDatePicker } from './SingleDatePicker'

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
  if (!match) {
    throw new Error(
      `No day button for ${isoOf(date)}; found ${buttons.length} buttons total`,
    )
  }
  return match
}

function makeAvailability(dates: Date[]): AvailabilitySlot[] {
  return dates.map((d) => ({
    availability_id: `slot-${isoOf(d)}`,
    date: isoOf(d),
    start_time: null,
    end_time: null,
    capacity: 5,
    capacity_reserved: 0,
    available_seats: 5,
    status: 'open',
  }))
}

describe('SingleDatePicker (landr-y9k)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Freeze "today" to a stable mid-month date so `tomorrow = today+1` and
    // `twoDaysOut = today+2` stay inside the same calendar month — the picker
    // only renders the current month by default, so without this the tests
    // fail with "No day button for <next-month-date>" whenever the system
    // clock advances past ~the 28th. Only Date is faked; setTimeout etc. stay
    // real so React's waitFor + animations behave normally.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the calendar and the Continue button starts disabled', async () => {
    mocks.getAvailability.mockResolvedValue([])
    render(
      <SingleDatePicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    )
    await waitFor(() => {
      expect(mocks.getAvailability).toHaveBeenCalledTimes(1)
    })
    const cont = screen.getByRole('button', { name: 'Continue' })
    expect(cont).toBeDisabled()
  })

  it('clicking a day with availability enables Continue and onConfirm commits a one-day selected_days array', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    mocks.getAvailability.mockResolvedValue(makeAvailability([tomorrow]))
    const onConfirm = vi.fn()
    render(
      <SingleDatePicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={onConfirm}
      />,
    )
    await waitFor(() => expect(mocks.getAvailability).toHaveBeenCalled())
    // Wait for the calendar buttons to render after slots load.
    await waitFor(() => dayButton(tomorrow))
    fireEvent.click(dayButton(tomorrow))
    const cont = screen.getByRole('button', { name: 'Continue' })
    expect(cont).not.toBeDisabled()
    fireEvent.click(cont)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith([isoOf(tomorrow)])
  })

  it('days without availability are disabled', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const twoDaysOut = new Date()
    twoDaysOut.setDate(twoDaysOut.getDate() + 2)
    // Only `tomorrow` has availability — twoDaysOut should render disabled.
    mocks.getAvailability.mockResolvedValue(makeAvailability([tomorrow]))
    render(
      <SingleDatePicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    )
    await waitFor(() => expect(mocks.getAvailability).toHaveBeenCalled())
    await waitFor(() => dayButton(tomorrow))
    expect(dayButton(tomorrow)).not.toBeDisabled()
    expect(dayButton(twoDaysOut)).toBeDisabled()
  })

  it('renders an error state if the availability fetch fails', async () => {
    mocks.getAvailability.mockRejectedValue(new Error('boom'))
    render(
      <SingleDatePicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText(/Could not load availability/i)).toBeInTheDocument(),
    )
  })
})
