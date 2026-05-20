import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import { BookingForm, type BookingSelection } from './BookingForm'
import { submitBooking } from '@/api/client'

vi.mock('@/api/client', () => ({
  submitBooking: vi.fn(),
}))

function makeServiceProduct(
  shape: 'days_range' | 'time_slot' = 'days_range',
): Product {
  return {
    product_id: 'service-1',
    slug: 'guided-day',
    name: 'Guided day',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: shape,
    is_contiguous: true,
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
    hotel_offering: 'optional',
    hotel_location_id: null,
    price_per_unit: null,
    currency: 'EUR',
  }
}

const DAYS_SELECTION: BookingSelection = {
  kind: 'days',
  selectedDays: ['2024-11-23', '2024-11-24', '2024-11-25'],
}

describe('BookingForm — hotel stay block (landr-iu3s)', () => {
  it('renders the hotel block when accommodationRooms is non-empty', () => {
    render(
      <BookingForm
        operatorSlug="para42"
        product={makeServiceProduct('days_range')}
        selection={DAYS_SELECTION}
        pickupLocationId={null}
        accommodationRooms={[{ productId: 'room-1', quantity: 1 }]}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    const stay = screen.getByTestId('hotel-stay-block')
    // 2024-11-23 - 1 day = 2024-11-22 (Fri) check-in,
    // 2024-11-25 + 1 day = 2024-11-26 (Tue) check-out, 4 nights.
    expect(stay.textContent).toMatch(/check-in/)
    expect(stay.textContent).toMatch(/check-out/)
    expect(stay.textContent).toMatch(/4 nights/)
  })

  it('omits the hotel block when accommodationRooms is empty or absent', () => {
    render(
      <BookingForm
        operatorSlug="para42"
        product={makeServiceProduct('days_range')}
        selection={DAYS_SELECTION}
        pickupLocationId={null}
        accommodationRooms={[]}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('hotel-stay-block')).toBeNull()
  })
})

describe('BookingForm — timezone line (landr-iu3s)', () => {
  it('shows the timezone for time_slot products', () => {
    render(
      <BookingForm
        operatorSlug="para42"
        product={makeServiceProduct('time_slot')}
        selection={{
          kind: 'slot',
          slot: {
            slot_id: 's1',
            date: '2024-11-23',
            start_time: '09:00:00',
            end_time: '11:00:00',
            capacity: 10,
            capacity_reserved: 0,
          } as never,
        }}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    // Browser timezone string varies by environment, but the
    // separator dot before it must be present when the product
    // is time_slot.
    const desc = screen.getByText(/Guided day/)
    expect(desc.textContent).toMatch(/·.*·/) // name · date · tz
  })

  it('hides the timezone for non-time_slot products', () => {
    render(
      <BookingForm
        operatorSlug="para42"
        product={makeServiceProduct('days_range')}
        selection={DAYS_SELECTION}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    const desc = screen.getByText(/Guided day/)
    // Only one separator dot when the timezone is hidden.
    expect(desc.textContent?.match(/·/g)?.length).toBe(1)
  })
})

describe('BookingForm — add-on line items (landr-cip6)', () => {
  function byName(name: string): HTMLInputElement {
    const el = document.querySelector<HTMLInputElement>(`input[name="${name}"]`)
    if (!el) throw new Error(`No input named ${name}`)
    return el
  }

  it('appends each add-on as its own product line in the submit payload', async () => {
    const submitMock = vi.mocked(submitBooking)
    submitMock.mockResolvedValue({
      booking_id: 'b-1',
      reference: 'REF-1',
      state: 'pending',
    })

    render(
      <BookingForm
        operatorSlug="para42"
        product={makeServiceProduct('days_range')}
        selection={DAYS_SELECTION}
        pickupLocationId={null}
        accommodationRooms={[{ productId: 'room-1', quantity: 1 }]}
        addons={[
          { productId: 'breakfast-1', quantity: 2 },
          { productId: 'video-1', quantity: 1 },
        ]}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )

    // Minimum-valid booker + participant data.
    fireEvent.change(byName('first_name'), { target: { value: 'Ada' } })
    fireEvent.change(byName('last_name'), { target: { value: 'Lovelace' } })
    fireEvent.change(byName('email'), { target: { value: 'ada@example.com' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Request booking/i }))
    })

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))
    const body = submitMock.mock.calls[0]![0]
    expect(body.products).toEqual([
      // primary service line
      expect.objectContaining({ product_id: 'service-1', quantity: 1 }),
      // hotel room
      expect.objectContaining({ product_id: 'room-1', quantity: 1 }),
      // add-ons
      expect.objectContaining({ product_id: 'breakfast-1', quantity: 2 }),
      expect.objectContaining({ product_id: 'video-1', quantity: 1 }),
    ])
  })
})

describe('BookingForm — first-participant pre-fill (landr-iu3s)', () => {
  function byName(name: string): HTMLInputElement {
    const el = document.querySelector<HTMLInputElement>(`input[name="${name}"]`)
    if (!el) throw new Error(`No input named ${name}`)
    return el
  }

  it('mirrors booker first/last name into participant 0 while untouched', () => {
    render(
      <BookingForm
        operatorSlug="para42"
        product={makeServiceProduct('days_range')}
        selection={DAYS_SELECTION}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    fireEvent.change(byName('first_name'), { target: { value: 'Ada' } })
    fireEvent.change(byName('last_name'), { target: { value: 'Lovelace' } })
    expect(byName('participants.0.first_name').value).toBe('Ada')
    expect(byName('participants.0.last_name').value).toBe('Lovelace')
  })

  it('stops syncing once the participant field diverges', () => {
    render(
      <BookingForm
        operatorSlug="para42"
        product={makeServiceProduct('days_range')}
        selection={DAYS_SELECTION}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    fireEvent.change(byName('first_name'), { target: { value: 'Ada' } })
    expect(byName('participants.0.first_name').value).toBe('Ada')
    // User overrides the participant name explicitly.
    fireEvent.change(byName('participants.0.first_name'), {
      target: { value: 'Grace' },
    })
    expect(byName('participants.0.first_name').value).toBe('Grace')
    // Further booker edits must NOT overwrite the overridden value.
    fireEvent.change(byName('first_name'), { target: { value: 'Alan' } })
    expect(byName('participants.0.first_name').value).toBe('Grace')
  })
})
