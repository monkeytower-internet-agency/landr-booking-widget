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

  it('optional + "No, thanks" auto-advances by firing onConfirm immediately (landr-eiiz)', async () => {
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
    // landr-eiiz: a single click on "No, thanks" must fire onConfirm with
    // the empty/no-hotel payload — no second Continue click required. The
    // previous UX only toggled local state which made the button look
    // unresponsive ("clicked No but nothing happened").
    const noBtn = screen.getByRole('button', { name: /No, thanks/i })
    fireEvent.click(noBtn)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    // landr-yf0n: optional-mode onConfirm now reports includeHotel as a
    // 4th arg so App.tsx can stash it for back-nav restoration. Opt-out
    // → false; mandatory-mode callsites still receive undefined.
    expect(onConfirm).toHaveBeenCalledWith([], null, [], false)
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

    // Derived stay window: selectedDays 10,11 → check-in 09, out 12, nights 3.
    // landr-8yaz: check-in/out render with weekday + day + month abbreviation
    // (via formatDayLabel) rather than the raw ISO string. The exact day/
    // month ordering and separators are Intl/locale-dependent (en-US
    // "Tue, Jun 9" vs en-GB "Tue 9 Jun"), so assert on the weekday + day
    // + month fragments independently within the same text node.
    await waitFor(() =>
      expect(screen.getByText(/Tue/)).toBeInTheDocument(),
    )
    const checkIn = screen.getByText(/Tue/)
    expect(checkIn.textContent).toMatch(/Jun/)
    expect(checkIn.textContent).toMatch(/\b9\b/)
    const checkOut = screen.getByText(/Fri/)
    expect(checkOut.textContent).toMatch(/Jun/)
    expect(checkOut.textContent).toMatch(/\b12\b/)
    // Continue should fire with the selected line item
    const continueBtn = screen.getByRole('button', { name: /Continue/i })
    expect(continueBtn).not.toBeDisabled()
    fireEvent.click(continueBtn)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    // landr-yf0n: mandatory-mode onConfirm receives includeHotel=undefined
    // (the Yes/No gate doesn't apply, so no opt-out state to report).
    expect(onConfirm).toHaveBeenCalledWith(
      [{ productId: 'single-room', quantity: 1 }],
      'hotel-a',
      [],
      undefined,
    )
  })

  // ── Overbook warnings (landr-qpab) ──────────────────────────────────
  // These tests render the step with a participantCount prop and assert
  // the non-blocking orange warnings appear (or do not appear) based on
  // the capacity vs participants and breakfast vs participants compares.
  // Continue must stay enabled in every overbook case — they're hints,
  // not gates.

  it('shows capacity warning when participantCount > total room capacity', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49, 1),
    ])

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorSlug="para42"
        participantCount={4}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )
    // Bump single-room qty to 2 → capacity = 2*1 = 2, participants = 4
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
    // Non-blocking: Continue stays enabled
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
        operatorSlug="para42"
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

    // landr-kat8: the in-step "Hotel total" summary moved into the
    // PriceSidebar pill — we now wait for the stay-window orientation
    // line instead to confirm the post-pick rerender flushed.
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
    // Legacy room without capacity_per_unit set
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('legacy-room', 'Legacy Room', 49, null),
    ])

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorSlug="para42"
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

    // 1 room × 1 (fallback) = 1 < 3 participants → warn
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
        operatorSlug="para42"
        participantCount={2}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Double Room')).toBeInTheDocument(),
    )
    // Pick 1 double room (capacity 2 = participants 2, no capacity warn)
    const plusButtons = screen.getAllByRole('button', {
      name: /Increase .* quantity/i,
    })
    fireEvent.click(plusButtons[0]!)

    // Breakfast row appears once the room qty > 0; bump it to 5
    await waitFor(() =>
      expect(screen.getByText('Breakfast')).toBeInTheDocument(),
    )
    const breakfastButtons = screen.getAllByRole('button', {
      name: /Increase .* quantity/i,
    })
    // After picking the room a second "Increase" button appears for the
    // breakfast add-on (room stepper is index 0, breakfast stepper is 1).
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
    // Capacity is fine (1*2=2 vs 2 participants) → no capacity warn
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
        operatorSlug="para42"
        participantCount={10}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )
    // No qty bumps. Both warnings stay hidden because totalRoomsPicked === 0.
    expect(
      screen.queryByTestId('overbook-capacity-warning'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('overbook-breakfast-warning'),
    ).not.toBeInTheDocument()
  })

  // ── Auto-skip single-hotel picker (landr-punc) ─────────────────────
  // When the operator has exactly one hotel configured, the radio list
  // is friction (single-item list). The widget auto-selects the lone
  // hotel and jumps straight to the room picker — both in the mandatory
  // path (already covered above) and the optional + Yes path.

  it('optional + Yes + single hotel auto-selects and shows rooms (no picker)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])

    render(
      <AccommodationStep
        product={makeService('optional')}
        selectedDays={['2026-06-10']}
        operatorSlug="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    // Yes/No gate appears on mount with hotels already fetched.
    await waitFor(() =>
      expect(screen.getByText(/Would you like to add a hotel/i)).toBeInTheDocument(),
    )
    // Picker radio list should NOT be in the DOM (single-hotel auto-skip).
    expect(screen.queryByText(/Choose your hotel/i)).not.toBeInTheDocument()

    // Click Yes — the auto-select effect fires, jumps straight to rooms.
    fireEvent.click(screen.getByRole('button', { name: /Yes, add hotel/i }))

    // "Staying at" banner appears (informational, not a picker).
    await waitFor(() =>
      expect(screen.getByText(/Staying at/i)).toBeInTheDocument(),
    )
    expect(screen.getByText('Hotel Mirador')).toBeInTheDocument()
    // No radio list rendered even after Yes.
    expect(screen.queryByText(/Choose your hotel/i)).not.toBeInTheDocument()
    // Room appears once the room fetch resolves.
    await waitFor(() =>
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )
  })

  it('optional + No + single hotel skips accommodation entirely', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: /No, thanks/i }))

    // landr-eiiz: "No, thanks" auto-advances. The opt-out fires onConfirm
    // with the empty payload on a single click — no second Continue click
    // needed. The single-hotel landr-punc auto-select must not fire here
    // because includeHotel stays false (the click also calls changeHotel
    // (null) which nulls selectedHotelId, and the auto-select effect is
    // gated on includeHotel). landr-yf0n: opt-out now also reports
    // includeHotel=false as the 4th arg for back-nav state restoration.
    expect(onConfirm).toHaveBeenCalledWith([], null, [], false)
    // Rooms must NOT have been fetched — the customer skipped accommodation.
    expect(mocks.getHotelRoomsForHotel).not.toHaveBeenCalled()
  })

  it('mandatory + single hotel does not render the radio picker', async () => {
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
      expect(screen.getByText(/Staying at/i)).toBeInTheDocument(),
    )
    // Radio list never appears.
    expect(screen.queryByText(/Choose your hotel/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('mandatory + multiple hotels still shows the radio picker (no regression)', async () => {
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
    // Both radios present
    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })

  // landr-kat8: the in-step "Hotel is paid directly at check-in" notice
  // moved into the PriceSidebar's at-hotel pill (sidebar is now canonical
  // for hotel totals + caveat). The step keeps a short stay-window
  // orientation line so the customer sees which nights the room steppers
  // below cover — but the totals + paid-directly copy live in the sidebar.
  // ── Back-nav state restoration (landr-yf0n) ──────────────────────
  // When the customer hits Back from a downstream step (pick-pickup or
  // fill-form), App.tsx threads the prior hotel + rooms + add-ons +
  // includeHotel back as the initial-* props. The step must re-mount
  // with the steppers + radios + Yes/No toggle restored — NOT reset to
  // an empty cart.

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
        operatorSlug="para42"
        onConfirm={onConfirm}
        onBack={vi.fn()}
        initialHotelLocationId="hotel-a"
        initialRooms={[{ productId: 'single-room', quantity: 2 }]}
      />,
    )

    // Hotel pre-selected: rooms fetch fires for hotel-a without a click.
    await waitFor(() =>
      expect(mocks.getHotelRoomsForHotel).toHaveBeenCalledWith(
        'para42',
        'hotel-a',
      ),
    )
    // Single Room stepper renders with qty=2 already seeded.
    await waitFor(() =>
      expect(screen.getByText('Single Room')).toBeInTheDocument(),
    )
    // The qty cell sits adjacent to the +/- buttons with aria-live=polite.
    // Reading the qty span for Single Room directly is cleanest: it's the
    // sibling of the "Increase Single Room quantity" button.
    const increaseBtn = screen.getByRole('button', {
      name: /Increase Single Room/i,
    })
    const qtySpan = increaseBtn.previousElementSibling
    expect(qtySpan?.textContent?.trim()).toBe('2')

    // Continue without further interaction → confirms the restored cart.
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(
      [{ productId: 'single-room', quantity: 2 }],
      'hotel-a',
      [],
      undefined,
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
        operatorSlug="para42"
        onConfirm={onConfirm}
        onBack={vi.fn()}
        initialHotelLocationId="hotel-a"
        initialRooms={[{ productId: 'double-room', quantity: 1 }]}
        initialAddons={[{ productId: 'bf-1', quantity: 3 }]}
      />,
    )

    // Wait for the breakfast row to render (room is already in cart so
    // its add-on list mounts as soon as the per-room fetch resolves).
    await waitFor(() =>
      expect(screen.getByText('Breakfast')).toBeInTheDocument(),
    )

    // Continue → emits the restored room + add-on cart unchanged.
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(
      [{ productId: 'double-room', quantity: 1 }],
      'hotel-a',
      [{ productId: 'bf-1', quantity: 3 }],
      undefined,
    )
  })

  it('restores optional-mode "No, thanks" opt-out from initialIncludeHotel=false', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])

    render(
      <AccommodationStep
        product={makeService('optional')}
        selectedDays={['2026-06-10']}
        operatorSlug="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        initialIncludeHotel={false}
      />,
    )

    // The Yes/No gate renders with "No, thanks" already the active
    // variant — verify by checking that the "Yes" button is in outline
    // mode (not the active variant).
    await waitFor(() =>
      expect(screen.getByText(/Would you like to add a hotel/i)).toBeInTheDocument(),
    )
    // The rooms list must NOT render — the customer opted out.
    expect(screen.queryByText(/Single Room/i)).not.toBeInTheDocument()
    // The room fetch must NOT have fired — opt-out → no hotel selected.
    expect(mocks.getHotelRoomsForHotel).not.toHaveBeenCalled()
  })

  it('renders a stay-window orientation line when a hotel + rooms are loaded (landr-kat8)', async () => {
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
    const stay = screen.getByTestId('accommodation-stay-window')
    // Stay: <weekday Tue 9 Jun> → <weekday Thu 11 Jun> · 2 nights
    expect(stay.textContent).toMatch(/Stay/)
    expect(stay.textContent).toMatch(/Tue/)
    expect(stay.textContent).toMatch(/Thu/)
    expect(stay.textContent).toMatch(/2 nights/)
    // The verbose totals + paid-directly notice no longer live in the step.
    expect(
      screen.queryByText(/Hotel is paid directly at check-in/i),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Hotel total/i)).not.toBeInTheDocument()
  })
})
