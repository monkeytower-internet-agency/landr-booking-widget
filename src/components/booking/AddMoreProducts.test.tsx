import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import { getAvailability, listProducts, submitBooking } from '@/api/client'
import { BookingForm, type BookingSelection } from './BookingForm'
import type { ExtraLine } from './crossSell'
import type { BookerDetails } from './detailsTypes'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    submitBooking: vi.fn(),
    getAvailability: vi.fn(),
    listProducts: vi.fn(),
    getFixedDateWindows: vi.fn(),
  }
})

function product(id: string, over: Partial<Product> = {}): Product {
  return {
    product_id: id,
    slug: id,
    name: id === 'main' ? 'Lift pass' : 'Camping',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'days_range',
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
    ...over,
  }
}

const MAIN = product('main')
const CAMPING = product('camping', { product_kind: 'stay', service_time_shape: null })
const SELECTION: BookingSelection = { kind: 'days', selectedDays: ['2026-11-02', '2026-11-03'] }
const BOOKER: BookerDetails = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone: '',
  billing: {
    address_line1: 'Calle Mayor 1',
    address_line2: '',
    postal_code: '28013',
    city: 'Madrid',
    region: '',
    country: 'ES',
    company: '',
    tax_id: '',
    name: '',
  },
}

function Harness() {
  const [lines, setLines] = useState<ExtraLine[]>([])
  return (
    <BookingForm
      widgetToken="tok"
      product={MAIN}
      selection={SELECTION}
      booker={BOOKER}
      participants={[{ ...BOOKER, service_role_code: '' }]}
      pickupLocationId={null}
      extraLines={lines}
      onExtraLinesChange={setLines}
      onBack={vi.fn()}
      onConfirmed={vi.fn()}
    />
  )
}

describe('Add more to this booking (review step)', () => {
  beforeEach(() => {
    vi.mocked(submitBooking).mockReset()
    vi.mocked(getAvailability).mockReset()
    vi.mocked(listProducts).mockReset()
    vi.mocked(listProducts).mockResolvedValue([MAIN, CAMPING])
  })

  it('adds a product with the main dates and submits both lines in one booking', async () => {
    vi.mocked(getAvailability).mockResolvedValue([])
    vi.mocked(submitBooking).mockResolvedValue({ booking_id: 'b-1', semantic_state: 'pending' })
    render(<Harness />)

    const add = await screen.findByTestId('add-more-candidate-camping')
    expect(screen.queryByTestId('add-more-candidate-main')).toBeNull()
    await act(async () => {
      fireEvent.click(add)
    })
    const line = await screen.findByTestId('add-more-line-camping')
    await waitFor(() => expect(line).not.toHaveTextContent(/Checking availability/))
    expect(getAvailability).toHaveBeenCalledWith('camping', '2026-11-02', '2026-11-03', undefined)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    const body = vi.mocked(submitBooking).mock.calls[0]![0]
    expect(body.products).toEqual([
      expect.objectContaining({ product_id: 'main', quantity: 1, selected_days: ['2026-11-02', '2026-11-03'] }),
      { product_id: 'camping', quantity: 1, selected_days: ['2026-11-02', '2026-11-03'] },
    ])
  })

  it('shows an unavailable inherited date inline and blocks Confirm until it is removed', async () => {
    vi.mocked(getAvailability).mockResolvedValue([
      {
        availability_id: 'n1',
        date: '2026-11-03',
        start_time: null,
        end_time: null,
        capacity: 1,
        capacity_reserved: 1,
        available_seats: 0,
        status: 'open',
      },
    ])
    vi.mocked(submitBooking).mockResolvedValue({ booking_id: 'b-2', semantic_state: 'pending' })
    render(<Harness />)
    const add = await screen.findByTestId('add-more-candidate-camping')
    await act(async () => {
      fireEvent.click(add)
    })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/Not available on/)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    expect(submitBooking).not.toHaveBeenCalled()

    // Remove the taken night: the line re-checks and the booking goes through
    // with the remaining night only (never silently dropped).
    const removeBtns = screen.getAllByRole('button', { name: /^Remove / })
    await act(async () => {
      fireEvent.click(removeBtns[removeBtns.length - 1]!)
    })
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    expect(vi.mocked(submitBooking).mock.calls[0]![0].products[1]).toEqual({
      product_id: 'camping',
      quantity: 1,
      selected_days: ['2026-11-02'],
    })
  })
})
