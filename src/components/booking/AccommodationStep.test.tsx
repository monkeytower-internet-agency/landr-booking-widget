import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Hotel, Product, ProductAddon } from '@/api/types'
import { AccommodationStep } from './AccommodationStep'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getHotelsForOperator: vi.fn<(slug: string) => Promise<Hotel[]>>(),
    getHotelRoomsForHotel:
      vi.fn<(slug: string, hotelId: string) => Promise<Product[]>>(),
    // landr-cip6: AccommodationStep now fetches add-ons per room. Default
    // mock returns [] so existing tests don't need to thread add-on
    // catalogue mocks unless they specifically exercise add-on UX.
    getProductAddons: vi.fn<(productId: string) => Promise<ProductAddon[]>>(),
  },
}))

vi.mock('@/api/client', () => ({
  getHotelsForOperator: mocks.getHotelsForOperator,
  getHotelRoomsForHotel: mocks.getHotelRoomsForHotel,
  getProductAddons: mocks.getProductAddons,
}))

const HOTEL_A: Hotel = {
  location_id: 'hotel-a',
  name: 'Hotel Mirador',
  name_localized: { de: 'Hotel Mirador (DE)', en: 'Hotel Mirador' },
  parent_id: null,
  role_type: { code: 'hotel', label: 'Hotel' },
}

const HOTEL_B: Hotel = {
  location_id: 'hotel-b',
  name: 'Hotel del Mar',
  name_localized: null,
  parent_id: null,
  role_type: { code: 'hotel', label: 'Hotel' },
}

function makeService(
  hotelOffering: 'none' | 'optional' | 'mandatory',
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
    service_time_shape: 'days_range',
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
    hotel_offering: hotelOffering,
    hotel_location_id: null,
    price_per_unit: null,
    currency: 'EUR',
  }
}

function makeRoom(id: string, name: string, price: number): Product {
  return {
    product_id: id,
    slug: id,
    name,
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'hotel_room',
    service_time_shape: null,
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
    hotel_offering: 'none',
    hotel_location_id: 'hotel-a',
    price_per_unit: price,
    currency: 'EUR',
  }
}

describe('AccommodationStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default to no add-ons so the existing room-flow tests don't have
    // to know about the add-on RPC at all.
    mocks.getProductAddons.mockResolvedValue([])
  })

  it('mandatory + single hotel auto-selects + shows rooms immediately', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10', '2026-06-11']}
        operatorSlug="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    // The auto-select banner appears once the hotel list resolves
    await waitFor(() =>
      expect(screen.getByText(/Staying at/i)).toBeInTheDocument(),
    )
    // Hotel name shown
    expect(screen.getByText('Hotel Mirador')).toBeInTheDocument()
    // Room appears once room fetch resolves
    await waitFor(() =>
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )
    // Per-night price chip
    expect(screen.getByText(/49.*\/ night/)).toBeInTheDocument()
  })

  it('mandatory + multiple hotels renders a radio list (no auto-select)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A, HOTEL_B])
    mocks.getHotelRoomsForHotel.mockResolvedValue([])

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorSlug="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText(/Choose your hotel/i)).toBeInTheDocument(),
    )
    expect(screen.getByText('Hotel Mirador')).toBeInTheDocument()
    expect(screen.getByText('Hotel del Mar')).toBeInTheDocument()
    // Continue is disabled until a hotel + room is picked
    const continueBtn = screen.getByRole('button', { name: /Continue/i })
    expect(continueBtn).toBeDisabled()
  })

  it('optional starts with no hotel context and "No, thanks" lets Continue fire empty', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])
    const onConfirm = vi.fn()

    render(
      <AccommodationStep
        product={makeService('optional')}
        selectedDays={['2026-06-10']}
        operatorSlug="para42"
        onConfirm={onConfirm}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText(/Would you like to add a hotel/i)).toBeInTheDocument(),
    )
    // The Yes/No gate appears; Continue should be enabled even when "No"
    // is the default-untouched state since onConfirm([], null) is a valid
    // skip outcome.
    const noBtn = screen.getByRole('button', { name: /No, thanks/i })
    fireEvent.click(noBtn)

    const continueBtn = screen.getByRole('button', { name: /Continue/i })
    expect(continueBtn).not.toBeDisabled()
    fireEvent.click(continueBtn)
    expect(onConfirm).toHaveBeenCalledWith([], null, [])
  })

  it('renders per-room qty steppers and computes nights × price × qty totals', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
      makeRoom('double-room', 'Double Room', 73),
    ])
    const onConfirm = vi.fn()

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10', '2026-06-11']}
        operatorSlug="para42"
        onConfirm={onConfirm}
        onBack={vi.fn()}
      />,
    )

    // wait for rooms to render
    await waitFor(() =>
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )

    // Bump single-room qty to 1
    const plusButtons = screen.getAllByRole('button', {
      name: /Increase .* quantity/i,
    })
    fireEvent.click(plusButtons[0]!)

    // Derived stay window: selectedDays 10,11 → check-in 09, out 12, nights 3
    await waitFor(() =>
      expect(screen.getByText('2026-06-09')).toBeInTheDocument(),
    )
    expect(screen.getByText('2026-06-12')).toBeInTheDocument()
    // Continue should fire with the selected line item
    const continueBtn = screen.getByRole('button', { name: /Continue/i })
    expect(continueBtn).not.toBeDisabled()
    fireEvent.click(continueBtn)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(
      [{ productId: 'single-room', quantity: 1 }],
      'hotel-a',
      [],
    )
  })

  it('shows the paid-directly-to-hotel notice when a hotel is selected', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorSlug="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )
    expect(
      screen.getByText(/Hotel is paid directly at check-in/i),
    ).toBeInTheDocument()
  })
})
