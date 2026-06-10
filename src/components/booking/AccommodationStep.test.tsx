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
      // landr-gb2f.2: auto-assign placed the lone participant (default
      // count 1) into the single room's only unit.
      { 0: { roomProductId: 'single-room', unitIndex: 0 } },
      // landr-doam.1: no age overrides → empty ageMap.
      {},
      // landr-gb2f.5: per-room add-on map (empty — no addons configured).
      {},
      // landr-gb2f.5: room product names map.
      { 'single-room': 'Single Room' },
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
      // landr-gb2f.2: lone participant auto-assigned to the single unit.
      { 0: { roomProductId: 'single-room', unitIndex: 0 } },
      // landr-doam.1: no age overrides → empty ageMap.
      {},
      // landr-gb2f.5: per-room add-on map (empty — no addons configured).
      {},
      // landr-gb2f.5: room product names map.
      { 'single-room': 'Single Room' },
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
    expect(onConfirm).toHaveBeenCalledWith([], null, [], false, false, {}, {}, {}, {})
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
    expect(onConfirm).toHaveBeenCalledWith([], 'hotel-a', [], undefined, true, {}, {}, {}, {})
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
    expect(onConfirm).toHaveBeenCalledWith([], 'hotel-a', [], true, true, {}, {}, {}, {})
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
    expect(onConfirm).toHaveBeenCalledWith([], 'hotel-b', [], undefined, true, {}, {}, {}, {})
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
    expect(onConfirm).toHaveBeenCalledWith([], 'hotel-a', [], undefined, true, {}, {}, {}, {})
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
    // landr-87n9.3: the capacity warning itself stays advisory ("sure?"),
    // but the new OCCUPANCY GATE blocks Continue here — 4 people cannot all
    // be assigned to 2 single-bed units, so 2 stay unassigned and the gate
    // keeps Continue disabled with an inline hint.
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDisabled()
    expect(screen.getByTestId('occupancy-hint')).toBeInTheDocument()
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

  it('breakfast hard-capped at single-room occupancy — + disables at 1 (landr-yybu)', async () => {
    // landr-yybu (reported bug): a Single Room (capacity 1) must NOT accept
    // more than 1 breakfast. The room passes occupancyLimited so the + button
    // disables at the occupancy. The bottom aggregate breakfast warning is gone.
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 98, 1),
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
        participantCount={1}
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

    await waitFor(() =>
      expect(screen.getByText('Breakfast')).toBeInTheDocument(),
    )

    const getBreakfastPlus = () =>
      screen.getAllByRole('button', { name: /Increase .* quantity/i })[1]!

    // Try to click + several times — qty must cap at 1 (room sleeps 1)
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(getBreakfastPlus())
    }

    // + button is disabled at the occupancy cap of 1 — cannot over-book
    await waitFor(() => expect(getBreakfastPlus()).toBeDisabled())
    // The breakfast qty shows 1, not 6
    const breakfastRow = screen.getByTestId('addon-row-bf-1')
    expect(breakfastRow).toHaveTextContent(/\b1\b/)

    // No over-warning (can't exceed occupancy) and the bottom aggregate
    // breakfast warning is gone (landr-yybu).
    expect(screen.queryByTestId('addon-overbook-bf-1')).toBeNull()
    expect(
      screen.queryByTestId('overbook-breakfast-warning'),
    ).not.toBeInTheDocument()
    // Continue stays enabled
    expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled()
  })

  it('reducing room qty re-clamps linked add-ons to the new occupancy cap (landr-u4fl)', async () => {
    // landr-u4fl (reported bug): 2 single rooms + 2 breakfasts, then
    // reducing rooms to 1 left the breakfast count at 2 — a state the
    // stepper itself could never create (the + cap is 1 at one room).
    // bumpQty must re-clamp the room's add-on slice on decrease.
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 98, 1),
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
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )
    // Book TWO single rooms.
    const roomPlus = () =>
      screen.getAllByRole('button', { name: /Increase .* quantity/i })[0]!
    fireEvent.click(roomPlus())
    await waitFor(() =>
      expect(screen.getByText('Breakfast')).toBeInTheDocument(),
    )
    fireEvent.click(roomPlus())

    // Two breakfasts — allowed while 2 rooms × capacity 1 = cap 2.
    const breakfastPlus = () =>
      screen.getAllByRole('button', { name: /Increase .* quantity/i })[1]!
    fireEvent.click(breakfastPlus())
    fireEvent.click(breakfastPlus())
    const breakfastRow = () => screen.getByTestId('addon-row-bf-1')
    await waitFor(() => expect(breakfastRow()).toHaveTextContent(/\b2\b/))

    // Reduce rooms 2 → 1: the breakfast slice must clamp 2 → 1 with it.
    const roomMinus = screen.getByRole('button', {
      name: /Decrease Single Room quantity/i,
    })
    fireEvent.click(roomMinus)
    await waitFor(() => expect(breakfastRow()).toHaveTextContent(/\b1\b/))
    // And the + button sits disabled at the new cap — state is coherent.
    await waitFor(() => expect(breakfastPlus()).toBeDisabled())
  })

  it('shows no capacity warning when no rooms are picked', async () => {
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
    // No room picked → capacity warning hidden.
    expect(
      screen.queryByTestId('overbook-capacity-warning'),
    ).not.toBeInTheDocument()
    // Bottom aggregate breakfast warning is gone (landr-yybu).
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
        // landr-87n9.3: 2 people so both restored single-room units get an
        // occupant — the occupancy gate then passes and Continue enables.
        participantCount={2}
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

    // landr-gb2f.2 / landr-87n9.3: wait for the whole-party auto-assign
    // effect to settle (both participants land in the two units, emptying
    // the unassigned tray + occupying every room) before confirming so the
    // occupancy gate is satisfied and the assignment is captured
    // deterministically.
    await waitFor(() =>
      expect(screen.getByText(/Everyone has a room/i)).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(
      [{ productId: 'single-room', quantity: 2 }],
      'hotel-a',
      [],
      undefined,
      false,
      // landr-87n9.3: both participants auto-assigned, one per unit.
      {
        0: { roomProductId: 'single-room', unitIndex: 0 },
        1: { roomProductId: 'single-room', unitIndex: 1 },
      },
      // landr-doam.1: no age overrides → empty ageMap.
      {},
      // landr-gb2f.5: per-room add-on map (empty — no addons configured).
      {},
      // landr-gb2f.5: room product names map.
      { 'single-room': 'Single Room' },
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
        // Two guests fully occupy the capacity-2 double so the occupancy gate
        // (a double needs both spots filled) lets Continue enable.
        participantCount={2}
        onConfirm={onConfirm}
        onBack={vi.fn()}
        initialHotelLocationId="hotel-a"
        initialRooms={[{ productId: 'double-room', quantity: 1 }]}
        initialAddons={[{ productId: 'bf-1', quantity: 3 }]}
        initialMode="package"
      />,
    )

    // Wait for Breakfast to appear AND for the seeded qty (3) to show.
    // The seeding effect fires asynchronously after addonsByRoom arrives.
    await waitFor(() =>
      expect(screen.getByText('Breakfast')).toBeInTheDocument(),
    )
    // The seeded qty=3 should be visible in the stepper.
    await waitFor(() => {
      const qtySpan = screen
        .getByRole('button', { name: /Decrease Breakfast quantity/i })
        .nextElementSibling
      expect(qtySpan?.textContent?.trim()).toBe('3')
    })

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(
      [{ productId: 'double-room', quantity: 1 }],
      'hotel-a',
      [{ productId: 'bf-1', quantity: 3 }],
      undefined,
      false,
      // Both guests auto-assigned to the double room's only unit → it is full.
      {
        0: { roomProductId: 'double-room', unitIndex: 0 },
        1: { roomProductId: 'double-room', unitIndex: 0 },
      },
      // landr-doam.1: no age overrides → empty ageMap.
      {},
      // landr-gb2f.5: per-room add-on map (seeded from initialAddons → bf-1=3
      // placed on the first room matching the catalogue).
      { 'double-room': { 'bf-1': 3 } },
      // landr-gb2f.5: room product names map.
      { 'double-room': 'Double Room' },
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
    expect(onConfirm).toHaveBeenCalledWith([], 'hotel-a', [], undefined, true, {}, {}, {}, {})
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

  // ── landr-yybu: per-room add-on independence ────────────────────────

  it('two rooms sharing a breakfast add-on hold INDEPENDENT quantities (landr-yybu)', async () => {
    // Para42 scenario: Single Room + Double Room, both linked to the same
    // breakfast add-on. Editing under Single must NOT change the Double's qty.
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49, 1),
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
        participantCount={3}
        onConfirm={onConfirm}
        onBack={vi.fn()}
      />,
    )

    // Pick 1 Single Room and 1 Double Room.
    await waitFor(() =>
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Increase Single Room quantity/i }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Increase Double Room quantity/i }),
    )

    // Two breakfast add-on rows should now be visible (one per room).
    await waitFor(() =>
      expect(screen.getAllByText('Breakfast')).toHaveLength(2),
    )

    // Increase breakfast under the FIRST room (Single Room) once.
    const [bfPlus1, bfPlus2] = screen.getAllByRole('button', {
      name: /Increase Breakfast quantity/i,
    })
    fireEvent.click(bfPlus1!)

    // The second room's breakfast stepper should still show 0.
    // The qty spans sit between the − and + buttons for each add-on row.
    const bfQtySpans = screen
      .getAllByRole('button', { name: /Decrease Breakfast quantity/i })
      .map((btn) => btn.nextElementSibling?.textContent?.trim())

    expect(bfQtySpans[0]).toBe('1')  // Single Room: 1 breakfast
    expect(bfQtySpans[1]).toBe('0')  // Double Room: still 0

    // Increase Double Room's breakfast twice → independent of Single.
    fireEvent.click(bfPlus2!)
    fireEvent.click(bfPlus2!)

    const bfQtySpans2 = screen
      .getAllByRole('button', { name: /Decrease Breakfast quantity/i })
      .map((btn) => btn.nextElementSibling?.textContent?.trim())

    expect(bfQtySpans2[0]).toBe('1')  // Single: unchanged
    expect(bfQtySpans2[1]).toBe('2')  // Double: 2

    // Continue and check the FLATTENED submit payload sums across rooms.
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [rooms, , addons] = onConfirm.mock.calls[0] as Parameters<typeof onConfirm>
    expect(rooms).toHaveLength(2)
    // bf-1 total = 1 (single) + 2 (double) = 3
    expect(addons).toEqual([{ productId: 'bf-1', quantity: 3 }])
  })

  it('aggregate breakfast warning is GONE; per-room under-warning fires (landr-yybu)', async () => {
    // Double Room (capacity=2) with 1 breakfast → per-room UNDER-warning
    // ("one per guest?"). Over-booking is impossible (the + caps at occupancy),
    // and the bottom aggregate paragraph (overbook-breakfast-warning) must NOT render.
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
    fireEvent.click(
      screen.getByRole('button', { name: /Increase Double Room quantity/i }),
    )

    await waitFor(() =>
      expect(screen.getByText('Breakfast')).toBeInTheDocument(),
    )

    // 1 breakfast in a room that sleeps 2 → under-warning
    fireEvent.click(
      screen.getByRole('button', { name: /Increase Breakfast quantity/i }),
    )

    await waitFor(() =>
      expect(screen.getByTestId('addon-underbook-bf-1')).toBeInTheDocument(),
    )

    // Bottom aggregate breakfast warning MUST NOT be present (landr-yybu removed it)
    expect(
      screen.queryByTestId('overbook-breakfast-warning'),
    ).not.toBeInTheDocument()
  })

  it('flattened onConfirm sums per addon_product_id across rooms (landr-yybu)', async () => {
    // Two Double Rooms (capacity=2 each), both linked to the same breakfast.
    // Room A orders 1 breakfast, Room B orders 2 (within each room's cap=2).
    // onConfirm should receive [{ productId: 'bf-1', quantity: 3 }].
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('room-a', 'Room A', 73, 2),
      makeRoom('room-b', 'Room B', 73, 2),
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
        // landr (full-occupancy): 4 people so the greedy whole-party
        // auto-assign FILLS both capacity-2 units (Room A gets 2, Room B gets
        // 2). Every booked unit is fully occupied + everyone is assigned, so
        // the occupancy gate passes and Continue enables.
        participantCount={4}
        onConfirm={onConfirm}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByText('Room A')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Increase Room A quantity/i }))
    fireEvent.click(screen.getByRole('button', { name: /Increase Room B quantity/i }))

    await waitFor(() => expect(screen.getAllByText('Breakfast')).toHaveLength(2))

    const [bfPlusA, bfPlusB] = screen.getAllByRole('button', {
      name: /Increase Breakfast quantity/i,
    })
    // Room A: 1 breakfast
    fireEvent.click(bfPlusA!)
    // Room B: 2 breakfasts
    fireEvent.click(bfPlusB!)
    fireEvent.click(bfPlusB!)

    // landr-87n9.3: wait for the whole-party auto-assign to occupy both
    // units so the occupancy gate enables Continue.
    await waitFor(() =>
      expect(screen.getByText(/Everyone has a room/i)).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [, , addonLines] = onConfirm.mock.calls[0] as Parameters<typeof onConfirm>
    // Flattened: 1 + 2 = 3
    expect(addonLines).toEqual([{ productId: 'bf-1', quantity: 3 }])
  })

  // ── landr-87n9.2: live-lift room + add-on selection ─────────────────
  // onLiveAccommodationChange fires WHILE the customer picks (not just at
  // Continue) so the App can feed the PriceSidebar's at-hotel total live.
  describe('onLiveAccommodationChange (landr-87n9.2)', () => {
    it('fires the same flattened room lines as the customer bumps a room qty', async () => {
      mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
      mocks.getHotelRoomsForHotel.mockResolvedValue([
        makeRoom('single-room', 'Single Room', 49),
      ])
      const onLive = vi.fn()

      render(
        <AccommodationStep
          product={makeService('mandatory')}
          selectedDays={['2026-06-10', '2026-06-11']}
          operatorToken="para42"
          onConfirm={vi.fn()}
          onBack={vi.fn()}
          onLiveAccommodationChange={onLive}
        />,
      )

      await waitFor(() =>
        expect(screen.getByText('Single Room')).toBeInTheDocument(),
      )
      const plus = screen.getByRole('button', {
        name: /Increase Single Room quantity/i,
      })
      fireEvent.click(plus)
      expect(onLive).toHaveBeenLastCalledWith(
        [{ productId: 'single-room', quantity: 1 }],
        [],
      )
      fireEvent.click(plus)
      expect(onLive).toHaveBeenLastCalledWith(
        [{ productId: 'single-room', quantity: 2 }],
        [],
      )
    })

    it('fires the flattened add-on lines as the customer bumps a per-room breakfast', async () => {
      mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
      mocks.getHotelRoomsForHotel.mockResolvedValue([
        makeRoom('single-room', 'Single Room', 49, 1),
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
      const onLive = vi.fn()

      render(
        <AccommodationStep
          product={makeService('mandatory')}
          selectedDays={['2026-06-10']}
          operatorToken="para42"
          onConfirm={vi.fn()}
          onBack={vi.fn()}
          onLiveAccommodationChange={onLive}
        />,
      )

      await waitFor(() =>
        expect(screen.getByText('Single Room')).toBeInTheDocument(),
      )
      fireEvent.click(
        screen.getByRole('button', { name: /Increase Single Room quantity/i }),
      )
      await waitFor(() => expect(screen.getByText('Breakfast')).toBeInTheDocument())
      fireEvent.click(
        screen.getByRole('button', { name: /Increase Breakfast quantity/i }),
      )
      expect(onLive).toHaveBeenLastCalledWith(
        [{ productId: 'single-room', quantity: 1 }],
        [{ productId: 'bf-1', quantity: 1 }],
      )
    })

    it('emits empty arrays in shared-double mode (no rooms booked)', async () => {
      mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
      const onLive = vi.fn()

      render(
        <AccommodationStep
          product={makeService('mandatory')}
          selectedDays={['2026-06-10']}
          operatorToken="para42"
          onConfirm={vi.fn()}
          onBack={vi.fn()}
          onLiveAccommodationChange={onLive}
        />,
      )

      await waitFor(() =>
        expect(
          screen.getByTestId('accommodation-mode-shared-double'),
        ).toBeInTheDocument(),
      )
      fireEvent.click(screen.getByTestId('accommodation-mode-shared-double'))
      expect(onLive).toHaveBeenLastCalledWith([], [])
    })
  })
})

describe('AccommodationStep — companions + occupancy gating (landr-87n9.3)', () => {
  beforeEach(() => {
    mocks.getProductAddons.mockResolvedValue([])
  })

  it('renders companion chips (badged "guest") alongside participant chips', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('double-room', 'Double Room', 73, 2),
    ])
    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        participantCount={1}
        participantNames={['Ada']}
        companionNames={['Mia']}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('Double Room')).toBeInTheDocument(),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Increase Double Room quantity/i }),
    )
    // Participant chip (index 0) + companion chip (index 1, party space).
    await waitFor(() =>
      expect(screen.getByTestId('participant-chip-0')).toBeInTheDocument(),
    )
    const companionChip = screen.getByTestId('participant-chip-1')
    expect(companionChip).toHaveTextContent('Mia')
    // The companion chip is badged as a guest.
    expect(companionChip).toHaveAttribute('data-guest', 'true')
    // The participant chip is NOT a guest.
    expect(screen.getByTestId('participant-chip-0')).not.toHaveAttribute(
      'data-guest',
    )
  })

  it('blocks Continue while a booked room is unoccupied, with an inline hint', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49, 1),
    ])
    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        participantCount={1}
        participantNames={['Ada']}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )
    // Book TWO single units for a single person → unit 1 ends up empty.
    const plus = screen.getByRole('button', {
      name: /Increase Single Room quantity/i,
    })
    fireEvent.click(plus)
    fireEvent.click(plus)
    await waitFor(() =>
      expect(screen.getByTestId('occupancy-hint')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('occupancy-hint')).toHaveTextContent(
      /no guests/i,
    )
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDisabled()
  })

  it('whole-party occupancy: a companion filling the extra room unblocks Continue', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49, 1),
    ])
    const onConfirm = vi.fn()
    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        // 1 participant + 1 companion = a 2-person party.
        participantCount={1}
        participantNames={['Ada']}
        companionNames={['Mia']}
        onConfirm={onConfirm}
        onBack={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )
    // Two single units → participant in unit 0, companion in unit 1.
    const plus = screen.getByRole('button', {
      name: /Increase Single Room quantity/i,
    })
    fireEvent.click(plus)
    fireEvent.click(plus)
    // Auto-assign settles → everyone has a room, no empty rooms → enabled.
    await waitFor(() =>
      expect(screen.getByText(/Everyone has a room/i)).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('occupancy-hint')).not.toBeInTheDocument()
    const cont = screen.getByRole('button', { name: /Continue/i })
    expect(cont).not.toBeDisabled()
    fireEvent.click(cont)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    // The whole-party assignment map covers participant 0 + companion 1.
    const [, , , , , roomAssignment] = onConfirm.mock.calls[0]!
    expect(roomAssignment).toEqual({
      0: { roomProductId: 'single-room', unitIndex: 0 },
      1: { roomProductId: 'single-room', unitIndex: 1 },
    })
  })
})
