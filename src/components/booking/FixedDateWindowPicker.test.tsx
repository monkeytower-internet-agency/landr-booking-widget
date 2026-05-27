import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FixedDateWindow, Product } from '@/api/types'
import { FixedDateWindowPicker } from './FixedDateWindowPicker'
import { expandWindowDays } from './expandWindowDays'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getFixedDateWindows: vi.fn<(id: string) => Promise<FixedDateWindow[]>>(),
  },
}))

vi.mock('@/api/client', () => ({
  getFixedDateWindows: mocks.getFixedDateWindows,
}))

function makeProduct(): Product {
  return {
    product_id: 'p-1',
    slug: 'siv-course',
    name: 'SIV Course',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'fixed_window',
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

describe('FixedDateWindowPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders one card per window and disables full ones', async () => {
    mocks.getFixedDateWindows.mockResolvedValue([
      { id: 'w-1', start_date: '2027-07-07', end_date: '2027-07-13', capacity: 8, capacity_reserved: 0 },
      { id: 'w-2', start_date: '2027-08-04', end_date: '2027-08-10', capacity: 8, capacity_reserved: 8 },
    ])
    const onConfirm = vi.fn()
    render(
      <FixedDateWindowPicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={onConfirm}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText(/Jul 7, 2027/)).toBeInTheDocument()
      expect(screen.getByText(/Aug 4, 2027/)).toBeInTheDocument()
    })
    expect(screen.getByText('8 seats left')).toBeInTheDocument()
    expect(screen.getByText('Full')).toBeInTheDocument()
  })

  it('hides seat counts when exposeSeats is false', async () => {
    mocks.getFixedDateWindows.mockResolvedValue([
      { id: 'w-1', start_date: '2027-07-07', end_date: '2027-07-13', capacity: 8, capacity_reserved: 0 },
    ])
    render(
      <FixedDateWindowPicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={() => {}}
        exposeSeats={false}
      />,
    )
    await waitFor(() => expect(screen.getByText('Available')).toBeInTheDocument())
    expect(screen.queryByText(/seats? left/i)).not.toBeInTheDocument()
  })

  it('confirms selected window with a synthesised slot', async () => {
    const window: FixedDateWindow = {
      id: 'w-1',
      start_date: '2027-07-07',
      end_date: '2027-07-13',
      capacity: 8,
      capacity_reserved: 2,
    }
    mocks.getFixedDateWindows.mockResolvedValue([window])
    const onConfirm = vi.fn()
    render(
      <FixedDateWindowPicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={onConfirm}
      />,
    )

    await waitFor(() => screen.getByText(/Jul 7, 2027/))
    fireEvent.click(screen.getByText(/Jul 7, 2027/))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [slot, returnedWindow] = onConfirm.mock.calls[0]
    expect(slot.date).toBe('2027-07-07')
    expect(slot.availability_id).toBe('w-1')
    expect(slot.capacity).toBe(8)
    expect(slot.available_seats).toBe(6)
    expect(returnedWindow).toBe(window)
  })

  it('renders error state on API failure', async () => {
    mocks.getFixedDateWindows.mockRejectedValue(new Error('nope'))
    render(
      <FixedDateWindowPicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText(/Could not load course windows/i)).toBeInTheDocument(),
    )
  })

  it('expandWindowDays covers inclusive range', () => {
    const days = expandWindowDays({
      id: 'w',
      start_date: '2027-07-07',
      end_date: '2027-07-10',
      capacity: 1,
      capacity_reserved: 0,
    })
    expect(days).toEqual(['2027-07-07', '2027-07-08', '2027-07-09', '2027-07-10'])
  })
})
