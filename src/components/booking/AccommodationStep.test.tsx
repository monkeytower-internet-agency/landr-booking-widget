import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Hotel, Product, ProductAddon } from '@/api/types'
import { AccommodationStep } from './AccommodationStep'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getHotelsForOperator: vi.fn<(slug: string) => Promise<Hotel[]>>(),
    getHotelRoomsForHotel:
      vi.fn<(slug: string, hotelId: string) => Promise<Product[]>>(),
    // landr-cip6: AccommodationStep fetches add-ons per room. Default mock
    // returns [] so existing tests don't need add-on catalogue mocks unless
    // they specifically exercise add-on UX.
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

function makeRoom(
  id: string,
  name: string,
  price: number,
  capacityPerUnit: number | null = null,
): Product {
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
    capacity_per_unit: capacityPerUnit,
  }
}

describe('AccommodationStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default to no add-ons so the existing room-flow tests don't have
    // to know about the add-on RPC at all.
    mocks.getProductAddons.mockResolvedValue([])
  })

  // ── landr-ffyg.2: top-level mode choice ────────────────────────────
  // The step opens with a mode radio group whenever a hotel is configured.
  // 'guiding-only' is offered ONLY for an optional offering; 'package' +
  // 'shared-double' are always offered. 'package' is the default mode.

  it('mandatory offering shows package + shared-double modes (NOT guiding-only)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10', '2026-06-11']}
        operatorToken="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByTestId('accommodation-mode')).toBeInTheDocument(),
    )
    expect(
      screen.getByTestId('accommodation-mode-package'),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('accommodation-mode-shared-double'),
    ).toBeInTheDocument()
    // No guiding-only mode for a mandatory hotel offering.
    expect(
      screen.queryByTestId('accommodation-mode-guiding-only'),
    ).not.toBeInTheDocument()
  })

  it('optional offering shows all three modes including guiding-only', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])

    render(
      <AccommodationStep
        product={makeService('optional')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByTestId('accommodation-mode')).toBeInTheDocument(),
    )
    expect(
      screen.getByTestId('accommodation-mode-guiding-only'),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('accommodation-mode-package'),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('accommodation-mode-shared-double'),
    ).toBeInTheDocument()
  })

  // ── Package mode (the existing hotel + rooms flow) ─────────────────

  it('package + single hotel auto-selects + shows rooms immediately (default mode)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10', '2026-06-11']}
        operatorToken="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    // Package is the default mode → auto-select banner appears.
    await waitFor(() =>
      expect(screen.getByText(/Staying at/i)).toBeInTheDocument(),
    )
    expect(screen.getByText('Hotel Mirador')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )
    expect(screen.getByText(/49.*\/ night/)).toBeInTheDocument()
  })

  it('package + multiple hotels renders a radio list (no auto-select)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A, HOTEL_B])
    mocks.getHotelRoomsForHotel.mockResolvedValue([])

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText(/Choose your hotel/i)).toBeInTheDocument(),
    )
    expect(screen.getByText('Hotel Mirador')).toBeInTheDocument()
    expect(screen.getByText('Hotel del Mar')).toBeInTheDocument()
    // Continue disabled until a hotel + room is picked.
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDisabled()
  })

  it('package mode renders per-room qty steppers and confirms the picked room (optional → includeHotel=true)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
      makeRoom('double-room', 'Double Room', 73),
    ])
    const onConfirm = vi.fn()

    render(
      <AccommodationStep
        product={makeService('optional')}
        selectedDays={['2026-06-10', '2026-06-11']}
        operatorToken="para42"
        onConfirm={onConfirm}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )
    const plusButtons = screen.getAllByRole('button', {
      name: /Increase .* quantity/i,
    })
    fireEvent.click(plusButtons[0]!)

    const continueBtn = screen.getByRole('button', { name: /Continue/i })
    expect(continueBtn).not.toBeDisabled()
    fireEvent.click(continueBtn)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    // landr-ffyg.2: optional + package mode reports includeHotel=true (the
    // hotel context IS in play); isSharedDouble=false.
    expect(onConfirm).toHaveBeenCalledWith(
      [{ productId: 'single-room', quantity: 1 }],
      'hotel-a',
      [],
      true,
      false,
    )
  })

  it('package mode mandatory offering reports includeHotel=undefined', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])
    const onConfirm = vi.fn()

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={onConfirm}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Increase Single Room quantity/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(onConfirm).toHaveBeenCalledWith(
      [{ productId: 'single-room', quantity: 1 }],
      'hotel-a',
      [],
      undefined,
      false,
    )
  })

  // ── Guiding-only mode (the former optional "No, thanks" opt-out) ───

  it('guiding-only mode confirms with empty payload + no hotel context', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])
    const onConfirm = vi.fn()

    render(
      <AccommodationStep
        product={makeService('optional')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={onConfirm}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByTestId('accommodation-mode-guiding-only'),
      ).toBeInTheDocument(),
    )
    // Pick guiding-only.
    fireEvent.click(
      screen.getByTestId('accommodation-mode-guiding-only').querySelector('input')!,
    )
    // Rooms must not render and no hotel context shows.
    expect(screen.queryByText('Single Room')).not.toBeInTheDocument()
    // Continue → empty payload, no hotel, includeHotel=false,
    // isSharedDouble=false.
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith([], null, [], false, false)
  })

  it('guiding-only mode does not fetch rooms', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])

    render(
      <AccommodationStep
        product={makeService('optional')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByTestId('accommodation-mode-guiding-only'),
      ).toBeInTheDocument(),
    )
    fireEvent.click(
      screen.getByTestId('accommodation-mode-guiding-only').querySelector('input')!,
    )
    // No rooms render after opting into guiding-only — the hotel context
    // is cleared so the room list is gone regardless of any eager fetch
    // the default package mode may have kicked off on mount.
    await waitFor(() =>
      expect(screen.queryByText('Single Room')).not.toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('button', { name: /Increase .* quantity/i }),
    ).not.toBeInTheDocument()
  })

  it('guiding-only mode from initialMode never fetches rooms', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])

    render(
      <AccommodationStep
        product={makeService('optional')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        initialMode="guiding-only"
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByTestId('accommodation-mode-guiding-only'),
      ).toBeInTheDocument(),
    )
    // Starting in guiding-only mode (no eager package fetch) → rooms never
    // requested.
    expect(mocks.getHotelRoomsForHotel).not.toHaveBeenCalled()
  })

  // ── landr-ffyg.2: shared-double mode ───────────────────────────────
  // The bypass: no room steppers; hotel picker only when >1 hotel
  // (auto-select when 1); pickup forced to the hotel (no free pickup);
  // submit carries is_shared_double=true + zero room lines.

  it('shared-double mode + single hotel: auto-selects, hides room steppers, confirms no rooms + hotel pickup', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('double-room', 'Double Room', 73, 2),
    ])
    const onConfirm = vi.fn()

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={onConfirm}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByTestId('accommodation-mode-shared-double'),
      ).toBeInTheDocument(),
    )
    fireEvent.click(
      screen
        .getByTestId('accommodation-mode-shared-double')
        .querySelector('input')!,
    )

    // Lone hotel auto-selects → "Staying at" banner + the explanatory notice.
    await waitFor(() =>
      expect(screen.getByTestId('shared-double-notice')).toBeInTheDocument(),
    )
    expect(screen.getByText(/Staying at/i)).toBeInTheDocument()
    // NO room steppers render in shared-double mode (even if the default
    // package mode eagerly fetched the room catalogue on mount).
    expect(screen.queryByText('Double Room')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Increase .* quantity/i }),
    ).not.toBeInTheDocument()

    // Continue enabled (hotel chosen) → no rooms, hotel pickup,
    // isSharedDouble=true. Mandatory offering → includeHotel=undefined.
    const continueBtn = screen.getByRole('button', { name: /Continue/i })
    expect(continueBtn).not.toBeDisabled()
    fireEvent.click(continueBtn)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith([], 'hotel-a', [], undefined, true)
  })

  it('shared-double mode optional offering reports includeHotel=true', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    const onConfirm = vi.fn()

    render(
      <AccommodationStep
        product={makeService('optional')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={onConfirm}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByTestId('accommodation-mode-shared-double'),
      ).toBeInTheDocument(),
    )
    fireEvent.click(
      screen
        .getByTestId('accommodation-mode-shared-double')
        .querySelector('input')!,
    )
    await waitFor(() =>
      expect(screen.getByTestId('shared-double-notice')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(onConfirm).toHaveBeenCalledWith([], 'hotel-a', [], true, true)
  })

  it('shared-double mode + multiple hotels shows the picker (no auto-select); Continue gated until a hotel is chosen', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A, HOTEL_B])
    const onConfirm = vi.fn()

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={onConfirm}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByTestId('accommodation-mode-shared-double'),
      ).toBeInTheDocument(),
    )
    fireEvent.click(
      screen
        .getByTestId('accommodation-mode-shared-double')
        .querySelector('input')!,
    )

    // Hotel picker appears (two hotels → no auto-select).
    await waitFor(() =>
      expect(screen.getByText(/Choose your hotel/i)).toBeInTheDocument(),
    )
    // Continue disabled until a hotel is chosen.
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDisabled()

    // Pick Hotel del Mar.
    fireEvent.click(screen.getByDisplayValue('hotel-b'))
    const continueBtn = screen.getByRole('button', { name: /Continue/i })
    await waitFor(() => expect(continueBtn).not.toBeDisabled())
    fireEvent.click(continueBtn)
    // No rooms, the CHOSEN hotel is the pickup, isSharedDouble=true.
    expect(onConfirm).toHaveBeenCalledWith([], 'hotel-b', [], undefined, true)
    // Rooms never fetched in shared-double mode.
    expect(mocks.getHotelRoomsForHotel).not.toHaveBeenCalled()
  })

  it('switching from package (rooms picked) to shared-double clears rooms and submits zero room lines', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('double-room', 'Double Room', 73, 2),
    ])
    const onConfirm = vi.fn()

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={onConfirm}
        onBack={vi.fn()}
      />,
    )

    // Default package mode → pick a room.
    await waitFor(() =>
      expect(screen.getByText('Double Room')).toBeInTheDocument(),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Increase Double Room quantity/i }),
    )

    // Flip to shared-double → the room stepper disappears.
    fireEvent.click(
      screen
        .getByTestId('accommodation-mode-shared-double')
        .querySelector('input')!,
    )
    await waitFor(() =>
      expect(screen.getByTestId('shared-double-notice')).toBeInTheDocument(),
    )
    expect(screen.queryByText('Double Room')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    // Zero room lines despite having picked a room in package mode first.
    expect(onConfirm).toHaveBeenCalledWith([], 'hotel-a', [], undefined, true)
  })

  // ── Overbook warnings (landr-qpab) — package mode only ─────────────

  it('shows capacity warning when participantCount > total room capacity', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49, 1),
    ])

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        participantCount={4}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )
    const plusButtons = screen.getAllByRole('button', {
      name: /Increase .* quantity/i,
    })
    fireEvent.click(plusButtons[0]!)
    fireEvent.click(plusButtons[0]!)

    await waitFor(() =>
      expect(
        screen.getByTestId('overbook-capacity-warning'),
      ).toBeInTheDocument(),
    )
    expect(screen.getByTestId('overbook-capacity-warning')).toHaveTextContent(
      /4 people.*only 2 beds/i,
    )
    expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled()
  })

  it('hides capacity warning when capacity meets participantCount', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('double-room', 'Double Room', 73, 2),
    ])

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        participantCount={2}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Double Room')).toBeInTheDocument(),
    )
    const plusButtons = screen.getAllByRole('button', {
      name: /Increase .* quantity/i,
    })
    fireEvent.click(plusButtons[0]!)

    await waitFor(() =>
      expect(
        screen.getByTestId('accommodation-stay-window'),
      ).toBeInTheDocument(),
    )
    expect(
      screen.queryByTestId('overbook-capacity-warning'),
    ).not.toBeInTheDocument()
  })

  it('treats null capacity_per_unit as 1 (lenient default)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('legacy-room', 'Legacy Room', 49, null),
    ])

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        participantCount={3}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Legacy Room')).toBeInTheDocument(),
    )
    const plusButtons = screen.getAllByRole('button', {
      name: /Increase .* quantity/i,
    })
    fireEvent.click(plusButtons[0]!)

    await waitFor(() =>
      expect(
        screen.getByTestId('overbook-capacity-warning'),
      ).toBeInTheDocument(),
    )
  })

  it('shows breakfast warning when breakfast qty > participantCount', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('double-room', 'Double Room', 73, 2),
    ])
    const breakfastAddon: ProductAddon = {
      product_addon_id: 'pa-bf',
      addon_product_id: 'bf-1',
      name: 'Breakfast',
      name_localized: null,
      is_required: false,
      min_qty: 0,
      max_qty: null,
      sort_order: 10,
      price_per_unit: 10,
      currency: 'EUR',
    }
    mocks.getProductAddons.mockResolvedValue([breakfastAddon])

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        participantCount={2}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Double Room')).toBeInTheDocument(),
    )
    const plusButtons = screen.getAllByRole('button', {
      name: /Increase .* quantity/i,
    })
    fireEvent.click(plusButtons[0]!)

    await waitFor(() =>
      expect(screen.getByText('Breakfast')).toBeInTheDocument(),
    )
    const breakfastButtons = screen.getAllByRole('button', {
      name: /Increase .* quantity/i,
    })
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(breakfastButtons[1]!)
    }

    await waitFor(() =>
      expect(
        screen.getByTestId('overbook-breakfast-warning'),
      ).toBeInTheDocument(),
    )
    expect(screen.getByTestId('overbook-breakfast-warning')).toHaveTextContent(
      /5 breakfasts for 2 people/i,
    )
    expect(
      screen.queryByTestId('overbook-capacity-warning'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled()
  })

  it('shows no warnings when no rooms are picked', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49, 1),
    ])

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        participantCount={10}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )
    expect(
      screen.queryByTestId('overbook-capacity-warning'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('overbook-breakfast-warning'),
    ).not.toBeInTheDocument()
  })

  // ── Auto-skip single-hotel picker (landr-punc) ─────────────────────

  it('package + single hotel does not render the radio picker', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText(/Staying at/i)).toBeInTheDocument(),
    )
    expect(screen.queryByText(/Choose your hotel/i)).not.toBeInTheDocument()
    // Only the mode radios exist (package + shared-double) — no "hotel" radio.
    expect(
      screen.queryByRole('radio', { name: /Hotel Mirador/i }),
    ).not.toBeInTheDocument()
  })

  it('package + multiple hotels still shows the radio picker (no regression)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A, HOTEL_B])
    mocks.getHotelRoomsForHotel.mockResolvedValue([])

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText(/Choose your hotel/i)).toBeInTheDocument(),
    )
    // Two hotel radios (named "hotel") in the picker.
    expect(screen.getByDisplayValue('hotel-a')).toBeInTheDocument()
    expect(screen.getByDisplayValue('hotel-b')).toBeInTheDocument()
  })

  // ── Back-nav state restoration (landr-yf0n / landr-ffyg.2) ─────────

  it('restores prior hotel + room selection from initial* props on back-nav re-entry', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A, HOTEL_B])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
      makeRoom('double-room', 'Double Room', 73),
    ])
    const onConfirm = vi.fn()

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={onConfirm}
        onBack={vi.fn()}
        initialHotelLocationId="hotel-a"
        initialRooms={[{ productId: 'single-room', quantity: 2 }]}
        initialMode="package"
      />,
    )

    await waitFor(() =>
      expect(mocks.getHotelRoomsForHotel).toHaveBeenCalledWith(
        'para42',
        'hotel-a',
      ),
    )
    await waitFor(() =>
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )
    const increaseBtn = screen.getByRole('button', {
      name: /Increase Single Room/i,
    })
    const qtySpan = increaseBtn.previousElementSibling
    expect(qtySpan?.textContent?.trim()).toBe('2')

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(
      [{ productId: 'single-room', quantity: 2 }],
      'hotel-a',
      [],
      undefined,
      false,
    )
  })

  it('restores prior add-on selection from initialAddons (landr-yf0n)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('double-room', 'Double Room', 73, 2),
    ])
    const breakfastAddon: ProductAddon = {
      product_addon_id: 'pa-bf',
      addon_product_id: 'bf-1',
      name: 'Breakfast',
      name_localized: null,
      is_required: false,
      min_qty: 0,
      max_qty: null,
      sort_order: 10,
      price_per_unit: 10,
      currency: 'EUR',
    }
    mocks.getProductAddons.mockResolvedValue([breakfastAddon])
    const onConfirm = vi.fn()

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={onConfirm}
        onBack={vi.fn()}
        initialHotelLocationId="hotel-a"
        initialRooms={[{ productId: 'double-room', quantity: 1 }]}
        initialAddons={[{ productId: 'bf-1', quantity: 3 }]}
        initialMode="package"
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Breakfast')).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(
      [{ productId: 'double-room', quantity: 1 }],
      'hotel-a',
      [{ productId: 'bf-1', quantity: 3 }],
      undefined,
      false,
    )
  })

  it('restores guiding-only mode from initialMode on back-nav re-entry', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])

    render(
      <AccommodationStep
        product={makeService('optional')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        initialMode="guiding-only"
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByTestId('accommodation-mode-guiding-only'),
      ).toBeInTheDocument(),
    )
    // guiding-only radio is the selected mode.
    expect(
      screen
        .getByTestId('accommodation-mode-guiding-only')
        .querySelector('input'),
    ).toBeChecked()
    // No rooms render and no room fetch fired.
    expect(screen.queryByText('Single Room')).not.toBeInTheDocument()
    expect(mocks.getHotelRoomsForHotel).not.toHaveBeenCalled()
  })

  it('restores shared-double mode from initialMode on back-nav re-entry', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    const onConfirm = vi.fn()

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={onConfirm}
        onBack={vi.fn()}
        initialHotelLocationId="hotel-a"
        initialMode="shared-double"
      />,
    )

    await waitFor(() =>
      expect(screen.getByTestId('shared-double-notice')).toBeInTheDocument(),
    )
    expect(
      screen
        .getByTestId('accommodation-mode-shared-double')
        .querySelector('input'),
    ).toBeChecked()
    // No room steppers; room fetch never fires.
    expect(
      screen.queryByRole('button', { name: /Increase .* quantity/i }),
    ).not.toBeInTheDocument()
    expect(mocks.getHotelRoomsForHotel).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(onConfirm).toHaveBeenCalledWith([], 'hotel-a', [], undefined, true)
  })

  it('coerces a stale guiding-only initialMode to package on a mandatory offering', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        initialMode="guiding-only"
      />,
    )

    await waitFor(() =>
      expect(screen.getByTestId('accommodation-mode')).toBeInTheDocument(),
    )
    // guiding-only isn't even offered for a mandatory product, so the
    // mode falls back to package and rooms load.
    expect(
      screen.queryByTestId('accommodation-mode-guiding-only'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByTestId('accommodation-mode-package').querySelector('input'),
    ).toBeChecked()
    await waitFor(() =>
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )
  })

  // landr-kat8 / landr-sbhz.4: the in-step "Hotel is paid directly at
  // check-in" notice + stay-window orientation live in the package mode.

  it('renders a stay-window orientation line and payment notice when a hotel + rooms are loaded (package mode)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )
    const stay = screen.getByTestId('accommodation-stay-window')
    expect(stay.textContent).toMatch(/Stay/)
    expect(stay.textContent).toMatch(/Tue/)
    expect(stay.textContent).toMatch(/Thu/)
    expect(stay.textContent).toMatch(/2 nights/)
    expect(
      screen.getByTestId('accommodation-payment-notice'),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('accommodation-payment-notice').textContent,
    ).toMatch(/paid directly at check-in.*cash.*card/i)
    expect(screen.queryByText(/Hotel total/i)).not.toBeInTheDocument()
  })

  // ── landr-sbhz.4: premium-includes-breakfast rooms ────────────────

  it('hides breakfast add-on for premium-with-breakfast room (landr-sbhz.4)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom(
        'premium-single-room-with-breakfast',
        'Premium Single Room w/ Breakfast',
        105,
        1,
      ),
    ])
    const breakfastAddon: ProductAddon = {
      product_addon_id: 'pa-bf',
      addon_product_id: 'bf-1',
      name: 'Breakfast',
      name_localized: null,
      is_required: false,
      min_qty: 0,
      max_qty: null,
      sort_order: 10,
      price_per_unit: 10,
      currency: 'EUR',
    }
    mocks.getProductAddons.mockResolvedValue([breakfastAddon])

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByText('Premium Single Room w/ Breakfast'),
      ).toBeInTheDocument(),
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: /Increase Premium Single Room w\/ Breakfast quantity/i,
      }),
    )

    await waitFor(() =>
      expect(
        screen.getByTestId('accommodation-stay-window'),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByText(/Add-ons/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Breakfast$/i)).not.toBeInTheDocument()
  })
})
