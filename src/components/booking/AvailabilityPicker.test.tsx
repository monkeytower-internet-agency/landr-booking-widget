// landr-k9pji.1 — AvailabilityPicker with a SYNTHESISED on-request slot
// (availability_id === null). The picker used to key and select slots by
// availability_id, so a null id would collide / never select. It now keys by
// slotKey() (the id, else the date). Renders, selects, restores on re-entry,
// and hands the null-id slot to onConfirm unchanged (BookingForm then omits
// product_availability_id — see BookingForm.contract.test.tsx).
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AvailabilitySlot, Product } from '@/api/types'
import { AvailabilityPicker } from './AvailabilityPicker'
import { hasFixedStartTimes, slotKey, toHHMM } from './slotKey'
import { StaffModeProvider } from '@/lib/staffMode.tsx'
import { ALL_STAFF_POWERS } from '@/lib/staffMode'

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
    product_id: 'p-tandem',
    slug: 'tandem-flight',
    name: 'Tandem flight',
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

function synthetic(date: Date): AvailabilitySlot {
  return {
    availability_id: null,
    date: isoOf(date),
    start_time: null,
    end_time: null,
    capacity: 2,
    capacity_reserved: 0,
    available_seats: 2,
    status: 'open',
    activity_bookable: true,
    accommodation_bookable: null,
  }
}

describe('slotKey (landr-k9pji.1)', () => {
  it('uses the id for a real row and the date for a synthesised one', () => {
    expect(slotKey({ availability_id: 'a-1', date: '2026-05-16' })).toBe('a-1')
    expect(slotKey({ availability_id: null, date: '2026-05-16' })).toBe(
      'day:2026-05-16',
    )
  })
})

describe('AvailabilityPicker with a synthesised on-request slot (landr-k9pji.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mid-month so tomorrow / the day after stay in the rendered month.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the day, selects the null-id slot and confirms it unchanged', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date()
    dayAfter.setDate(dayAfter.getDate() + 2)
    const slots = [synthetic(tomorrow), synthetic(dayAfter)]
    mocks.getAvailability.mockResolvedValue(slots)
    const onConfirm = vi.fn()

    render(
      <AvailabilityPicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={onConfirm}
      />,
    )
    await waitFor(() => dayButton(tomorrow))
    expect(dayButton(tomorrow)).not.toBeDisabled()
    expect(dayButton(dayAfter)).not.toBeDisabled()

    fireEvent.click(dayButton(tomorrow))
    // One whole-day slot: no start_time -> "Time confirmed by the operator".
    const timeButtons = screen.getAllByRole('button', { name: /Time confirmed by the operator/ })
    expect(timeButtons).toHaveLength(1)
    expect(screen.getByTestId('time-confirmed-helper')).toHaveTextContent(
      'The operator will confirm the exact time and details after you book.',
    )
    const cont = screen.getByTestId('availability-picker-submit')
    expect(cont).toBeDisabled()

    fireEvent.click(timeButtons[0])
    expect(cont).not.toBeDisabled()
    fireEvent.click(cont)

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(slots[0])
  })

  it('restores a null-id slot on back-nav re-entry (initialSlot)', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const slot = synthetic(tomorrow)
    mocks.getAvailability.mockResolvedValue([slot])
    const onConfirm = vi.fn()

    render(
      <AvailabilityPicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={onConfirm}
        initialSlot={slot}
      />,
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Time confirmed by the operator/ })).toBeInTheDocument(),
    )
    const cont = screen.getByTestId('availability-picker-submit')
    expect(cont).not.toBeDisabled()
    fireEvent.click(cont)
    expect(onConfirm).toHaveBeenCalledWith(slot)
  })
})

// landr-xtkae.2 — fixed daily start times. The API synthesises one row per
// start time per day (availability_id null for all of them); full or
// lead-time-closed times stay visible but disabled, and the picked slot is
// handed to onConfirm intact (BookingForm trims it to HH:MM on submit).
describe('slotKey / helpers for fixed start times (landr-xtkae.2)', () => {
  it('keys synthesised timed slots by date AND start time', () => {
    expect(
      slotKey({ availability_id: null, date: '2026-05-16', start_time: '11:00:00' }),
    ).toBe('day:2026-05-16@11:00:00')
    expect(
      slotKey({ availability_id: null, date: '2026-05-16', start_time: '09:00:00' }),
    ).not.toBe(
      slotKey({ availability_id: null, date: '2026-05-16', start_time: '11:00:00' }),
    )
    // A whole-day synthesised row keeps its old key.
    expect(
      slotKey({ availability_id: null, date: '2026-05-16', start_time: null }),
    ).toBe('day:2026-05-16')
  })

  it('hasFixedStartTimes routes on non-empty data and toHHMM trims seconds', () => {
    expect(hasFixedStartTimes({ daily_start_times: ['09:00'] })).toBe(true)
    expect(hasFixedStartTimes({ daily_start_times: [] })).toBe(false)
    expect(hasFixedStartTimes({ daily_start_times: null })).toBe(false)
    expect(hasFixedStartTimes({})).toBe(false)
    expect(toHHMM('11:00:00')).toBe('11:00')
    expect(toHHMM('11:00')).toBe('11:00')
    expect(toHHMM(null)).toBeNull()
  })
})

describe('AvailabilityPicker with fixed daily start times (landr-xtkae.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const timed = (
    date: Date,
    start: string,
    over: Partial<AvailabilitySlot> = {},
  ): AvailabilitySlot => ({
    ...synthetic(date),
    start_time: start,
    capacity: 2,
    available_seats: 2,
    ...over,
  })
  const timedProduct = (): Product => ({
    ...makeProduct(),
    daily_start_times: ['09:00', '11:00', '13:00'],
  })

  it('shows the day then its times; full and closed times are disabled', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const slots = [
      timed(tomorrow, '09:00:00'),
      timed(tomorrow, '11:00:00', { available_seats: 0, capacity_reserved: 2 }),
      timed(tomorrow, '13:00:00', { activity_bookable: false }),
    ]
    mocks.getAvailability.mockResolvedValue(slots)
    const onConfirm = vi.fn()

    render(
      <AvailabilityPicker
        product={timedProduct()}
        onBack={() => {}}
        onConfirm={onConfirm}
      />,
    )
    await waitFor(() => dayButton(tomorrow))
    fireEvent.click(dayButton(tomorrow))

    const options = screen.getAllByTestId('start-time-option')
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveTextContent('09:00')
    expect(options[0]).not.toBeDisabled()
    expect(options[1]).toHaveTextContent('11:00')
    expect(options[1]).toBeDisabled()
    expect(options[1]).toHaveTextContent(/Full/)
    expect(options[2]).toHaveTextContent('13:00')
    expect(options[2]).toBeDisabled()
    expect(options[2]).toHaveTextContent(/Too late to book/)
    // No time-confirmed-by-operator fallback on a timed product.
    expect(screen.queryByRole('button', { name: /Time confirmed by the operator/ })).toBeNull()
    expect(screen.queryByTestId('time-confirmed-helper')).toBeNull()

    const cont = screen.getByTestId('availability-picker-submit')
    expect(cont).toBeDisabled()
    fireEvent.click(options[0])
    expect(cont).not.toBeDisabled()
    fireEvent.click(cont)
    expect(onConfirm).toHaveBeenCalledWith(slots[0])
  })

  it('disables a day whose every time is full', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date()
    dayAfter.setDate(dayAfter.getDate() + 2)
    mocks.getAvailability.mockResolvedValue([
      timed(tomorrow, '09:00:00', { available_seats: 0 }),
      timed(dayAfter, '09:00:00'),
    ])
    render(
      <AvailabilityPicker
        product={timedProduct()}
        onBack={() => {}}
        onConfirm={vi.fn()}
      />,
    )
    await waitFor(() => dayButton(tomorrow))
    expect(dayButton(tomorrow)).toBeDisabled()
    expect(dayButton(dayAfter)).not.toBeDisabled()
  })

  it('restores the picked time on back-nav (initialSlot)', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const slots = [timed(tomorrow, '09:00:00'), timed(tomorrow, '11:00:00')]
    mocks.getAvailability.mockResolvedValue(slots)
    const onConfirm = vi.fn()
    render(
      <AvailabilityPicker
        product={timedProduct()}
        onBack={() => {}}
        onConfirm={onConfirm}
        initialSlot={slots[1]}
      />,
    )
    await waitFor(() => expect(screen.getAllByTestId('start-time-option')).toHaveLength(2))
    fireEvent.click(screen.getByTestId('availability-picker-submit'))
    expect(onConfirm).toHaveBeenCalledWith(slots[1])
  })
})

// landr-rmcsu.7: slot pickers honour the group size like the day pickers do.
describe('AvailabilityPicker seat-aware times (landr-rmcsu.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const timed = (
    date: Date,
    start: string,
    seats: number,
  ): AvailabilitySlot => ({
    ...synthetic(date),
    start_time: start,
    capacity: 6,
    capacity_reserved: 6 - seats,
    available_seats: seats,
  })
  const product = (): Product => ({
    ...makeProduct(),
    daily_start_times: ['09:00', '11:00'],
    max_party_size: 6,
  })
  const days = () => {
    const d1 = new Date()
    d1.setDate(d1.getDate() + 1)
    const d2 = new Date()
    d2.setDate(d2.getDate() + 2)
    return { d1, d2 }
  }

  it('marks a time with too few seats "Only n left" (not Full) and disables it', async () => {
    const { d1 } = days()
    mocks.getAvailability.mockResolvedValue([
      timed(d1, '09:00:00', 2),
      timed(d1, '11:00:00', 5),
    ])
    render(
      <AvailabilityPicker
        product={product()}
        seatsNeeded={3}
        onBack={() => {}}
        onConfirm={vi.fn()}
      />,
    )
    await waitFor(() => dayButton(d1))
    fireEvent.click(dayButton(d1))
    const options = screen.getAllByTestId('start-time-option')
    expect(options[0]).toBeDisabled()
    expect(options[0]).toHaveTextContent(/Not enough seats for 3/)
    expect(options[0]).not.toHaveTextContent(/Full/)
    expect(options[1]).not.toBeDisabled()
    expect(screen.getByTestId('seat-fit-count')).toHaveTextContent('1 date fits 3 people')
  })

  it('shows the seat count on a short time when the operator exposes seats', async () => {
    const { d1 } = days()
    mocks.getAvailability.mockResolvedValue([
      timed(d1, '09:00:00', 2),
      timed(d1, '11:00:00', 5),
    ])
    render(
      <AvailabilityPicker
        product={product()}
        seatsNeeded={3}
        exposeSeatsToCustomer
        onBack={() => {}}
        onConfirm={vi.fn()}
      />,
    )
    await waitFor(() => dayButton(d1))
    fireEvent.click(dayButton(d1))
    expect(screen.getAllByTestId('start-time-option')[0]).toHaveTextContent(
      'Only 2 left (you need 3)',
    )
  })

  it('strikes a day whose every time is short and disables it', async () => {
    const { d1, d2 } = days()
    mocks.getAvailability.mockResolvedValue([
      timed(d1, '09:00:00', 2),
      timed(d1, '11:00:00', 1),
      timed(d2, '09:00:00', 4),
    ])
    render(
      <AvailabilityPicker
        product={product()}
        seatsNeeded={3}
        onBack={() => {}}
        onConfirm={vi.fn()}
      />,
    )
    await waitFor(() => dayButton(d1))
    expect(dayButton(d1)).toBeDisabled()
    expect(dayButton(d1)).toHaveAttribute('data-short', 'true')
    expect(dayButton(d2)).not.toBeDisabled()
    expect(screen.getByTestId('short-day-legend')).toBeInTheDocument()
  })

  it('offers fewer people / a group inquiry when no time fits (never stranded)', async () => {
    const { d1 } = days()
    mocks.getAvailability.mockResolvedValue([timed(d1, '09:00:00', 2)])
    render(
      <AvailabilityPicker
        product={product()}
        seatsNeeded={4}
        showPartySizeStepper
        onBack={() => {}}
        onConfirm={vi.fn()}
      />,
    )
    await waitFor(() => screen.getByTestId('seat-fit-none'))
    expect(screen.getByTestId('seat-fit-fewer')).toBeInTheDocument()
    expect(screen.getByTestId('seat-fit-inquiry')).toBeInTheDocument()
  })

  it('the stepper re-filters the times and reports the group size', async () => {
    const { d1 } = days()
    mocks.getAvailability.mockResolvedValue([
      timed(d1, '09:00:00', 2),
      timed(d1, '11:00:00', 5),
    ])
    const onPartySizeChange = vi.fn()
    render(
      <AvailabilityPicker
        product={product()}
        seatsNeeded={2}
        showPartySizeStepper
        onPartySizeChange={onPartySizeChange}
        onBack={() => {}}
        onConfirm={vi.fn()}
      />,
    )
    await waitFor(() => dayButton(d1))
    fireEvent.click(dayButton(d1))
    expect(screen.getAllByTestId('start-time-option')[0]).not.toBeDisabled()
    fireEvent.click(screen.getByTestId('party-size-increase'))
    expect(onPartySizeChange).toHaveBeenCalledWith(3)
    expect(screen.getAllByTestId('start-time-option')[0]).toBeDisabled()
    expect(screen.getAllByTestId('start-time-option')[1]).not.toBeDisabled()
  })

  it('a picked time that stops fitting no longer commits', async () => {
    const { d1 } = days()
    mocks.getAvailability.mockResolvedValue([
      timed(d1, '09:00:00', 2),
      timed(d1, '11:00:00', 5),
    ])
    const onConfirm = vi.fn()
    render(
      <AvailabilityPicker
        product={product()}
        seatsNeeded={2}
        showPartySizeStepper
        onBack={() => {}}
        onConfirm={onConfirm}
      />,
    )
    await waitFor(() => dayButton(d1))
    fireEvent.click(dayButton(d1))
    fireEvent.click(screen.getAllByTestId('start-time-option')[0])
    expect(screen.getByTestId('availability-picker-submit')).not.toBeDisabled()
    fireEvent.click(screen.getByTestId('party-size-increase'))
    expect(screen.getByTestId('availability-picker-submit')).toBeDisabled()
  })

  it('staff with force_book can still pick a short time (capacity force)', async () => {
    const { d1 } = days()
    const slots = [timed(d1, '09:00:00', 2), timed(d1, '11:00:00', 5)]
    mocks.getAvailability.mockResolvedValue(slots)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onConfirm = vi.fn()
    render(
      <StaffModeProvider
        value={{ active: true, token: 't', powers: ALL_STAFF_POWERS, operatorId: 'op' }}
      >
        <AvailabilityPicker
          product={product()}
          seatsNeeded={3}
          onBack={() => {}}
          onConfirm={onConfirm}
        />
      </StaffModeProvider>,
    )
    await waitFor(() => dayButton(d1))
    fireEvent.click(dayButton(d1))
    const options = screen.getAllByTestId('start-time-option')
    expect(options[0]).not.toBeDisabled()
    fireEvent.click(options[0])
    fireEvent.click(screen.getByTestId('availability-picker-submit'))
    expect(onConfirm).toHaveBeenCalledWith(slots[0], true, ['capacity'])
  })
})
