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
import { slotKey } from './slotKey'

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
    // One whole-day slot: no start_time -> "Any time".
    const timeButtons = screen.getAllByRole('button', { name: /Any time/ })
    expect(timeButtons).toHaveLength(1)
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
      expect(screen.getByRole('button', { name: /Any time/ })).toBeInTheDocument(),
    )
    const cont = screen.getByTestId('availability-picker-submit')
    expect(cont).not.toBeDisabled()
    fireEvent.click(cont)
    expect(onConfirm).toHaveBeenCalledWith(slot)
  })
})
