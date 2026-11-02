import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AvailabilitySlot,
  BookingLookupResult,
  EvaluatedOffer,
  Hotel,
  OfferEvaluateRequest,
  OfferEvaluateResponse,
  Product,
} from '@/api/types'
import { AccommodationStep } from './AccommodationStep'
import { stayNightIsos } from './accommodationCalc'
import { newPick, roomExtraQty, type OfferPick } from './offerCart'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getHotelsForOperator: vi.fn<(slug: string) => Promise<Hotel[]>>(),
    getHotelRoomsForHotel:
      vi.fn<(slug: string, hotelId: string) => Promise<Product[]>>(),
    // Each booked room type's extras come from the offers evaluator
    // (useOffers -> getOffers). The default answer offers nothing.
    getOffers: vi.fn<
      (body: OfferEvaluateRequest) => Promise<OfferEvaluateResponse>
    >(),
    // landr-t869m.2: AccommodationStep re-fetches the first selected day's
    // availability row to read accommodation_bookable. Default resolves []
    // (no matching row → fail-open, accommodationBookability(undefined) =
    // null) so every existing test — none of which exercises the "hotel too
    // late" warning — keeps passing unchanged.
    getAvailability: vi.fn<
      (id: string, from: string, to: string) => Promise<AvailabilitySlot[]>
    >(),
    // landr-otml0.3: shared-double reference masked lookup.
    lookupBookingReference:
      vi.fn<(op: string, ref: string) => Promise<BookingLookupResult>>(),
  },
}))

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>(
    '@/api/client',
  )
  return {
    ...actual,
    getHotelsForOperator: mocks.getHotelsForOperator,
    getHotelRoomsForHotel: mocks.getHotelRoomsForHotel,
    getOffers: mocks.getOffers,
    getAvailability: mocks.getAvailability,
    lookupBookingReference: mocks.lookupBookingReference,
  }
})

/** A free-quantity breakfast offered by room type `roomId`. */
function breakfastOffer(
  roomId: string,
  over: Partial<EvaluatedOffer> = {},
): EvaluatedOffer {
  return {
    id: `bf-${roomId}`,
    parent_product_id: roomId,
    product_id: 'bf-1',
    rules: { mode: 'all', items: [] },
    binding: 'free',
    schedule: 'locked',
    collection: 'online',
    mode: 'optional',
    options: [],
    min_qty: 0,
    max_qty: null,
    sort_order: 10,
    name: 'Breakfast',
    product_kind: 'hotel_room',
    in_cart: false,
    price_preview: null,
    draft: false,
    ...over,
  }
}

/**
 * Answer the offers evaluator: every room-type line (`r-<id>`) offers
 * `offersFor(id)`; the main line offers nothing. `withBreakfast` offers a
 * free-quantity breakfast under every room type.
 */
function mockRoomOffers(
  withBreakfast: boolean | ((roomId: string) => EvaluatedOffer[]) = false,
) {
  mocks.getOffers.mockImplementation(async (body) => ({
    lines: body.lines.map((l) => ({
      line_id: l.line_id,
      eligible: true,
      draft: false,
      offers: l.line_id.startsWith('r-')
        ? typeof withBreakfast === 'function'
          ? withBreakfast(l.line_id.slice(2))
          : withBreakfast
            ? [breakfastOffer(l.line_id.slice(2))]
            : []
        : [],
    })),
    required_attribute_keys: [],
  }))
}

/** A taken breakfast pick under room type `roomId` (as initialRoomPicks). */
function bfPick(roomId: string, quantity: number, lineId = 'a1'): OfferPick {
  return {
    ...newPick(breakfastOffer(roomId), `r-${roomId}`, lineId, []),
    quantity,
  }
}

const bfPlus = (roomId: string) => screen.getByTestId(`offer-qty-plus-bf-${roomId}`)
const bfQty = (roomId: string) => screen.getByTestId(`offer-qty-bf-${roomId}`)

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

// Continue stays disabled until the room pick and the async bookability check
// settle; a click in that window is silently ignored (a loaded full-suite run
// hit it), so wait for the button to enable before clicking.
async function clickContinue() {
  const btn = screen.getByRole('button', { name: /Continue/i })
  await waitFor(() => expect(btn).not.toBeDisabled())
  fireEvent.click(btn)
}

describe('AccommodationStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default to no offers so the existing room-flow tests don't have
    // to know about the evaluator at all.
    mockRoomOffers()
    // landr-t869m.2: default to "no row for this day" so the "hotel too
    // late" fetch is a harmless no-op for every test that doesn't set it up.
    mocks.getAvailability.mockResolvedValue([])
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

  // ── landr-t869m.2: "activity still bookable, hotel too late" ───────

  it('shows the too-late warning when the day is activity_bookable but accommodation_bookable=false (optional offering)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])
    mocks.getAvailability.mockResolvedValue([
      {
        availability_id: 'a-1',
        date: '2026-06-10',
        start_time: null,
        end_time: null,
        capacity: 5,
        capacity_reserved: 0,
        available_seats: 5,
        status: 'open',
        activity_bookable: true,
        accommodation_bookable: false,
      },
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
        screen.getByTestId('accommodation-too-late-warning'),
      ).toBeInTheDocument(),
    )
    // Quotes the check-in date the stay would have needed (default offset 1:
    // 2026-06-10 - 1 day = 2026-06-09).
    expect(
      screen.getByTestId('accommodation-too-late-warning'),
    ).toHaveTextContent('still book this date')
  })

  it('does NOT show the too-late warning when accommodation_bookable is true', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])
    mocks.getAvailability.mockResolvedValue([
      {
        availability_id: 'a-1',
        date: '2026-06-10',
        start_time: null,
        end_time: null,
        capacity: 5,
        capacity_reserved: 0,
        available_seats: 5,
        status: 'open',
        activity_bookable: true,
        accommodation_bookable: true,
      },
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
      screen.queryByTestId('accommodation-too-late-warning'),
    ).not.toBeInTheDocument()
  })

  it('does NOT show the too-late warning for a mandatory offering (the day is simply not offered upstream)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])
    // Even if accommodation_bookable happened to be false here, 'mandatory'
    // never renders the warning — the picker already excludes such a day.
    mocks.getAvailability.mockResolvedValue([
      {
        availability_id: 'a-1',
        date: '2026-06-10',
        start_time: null,
        end_time: null,
        capacity: 5,
        capacity_reserved: 0,
        available_seats: 5,
        status: 'open',
        activity_bookable: true,
        accommodation_bookable: false,
      },
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
      expect(screen.getByTestId('accommodation-mode')).toBeInTheDocument(),
    )
    expect(
      screen.queryByTestId('accommodation-too-late-warning'),
    ).not.toBeInTheDocument()
  })

  // landr-t869m.2 review fix (finding #2): the banner must not be the ONLY
  // thing that changes — the too-late state must also be ENFORCED. Package
  // and shared-double must disappear from the mode choice, and mode must
  // be forced to guiding-only, so the customer cannot walk the hotel path
  // into a guaranteed accommodation_lead_time_not_met 422 at Confirm.
  it('optional + too-late: removes package/shared-double from the mode choice and forces guiding-only', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])
    mocks.getAvailability.mockResolvedValue([
      {
        availability_id: 'a-1',
        date: '2026-06-10',
        start_time: null,
        end_time: null,
        capacity: 5,
        capacity_reserved: 0,
        available_seats: 5,
        status: 'open',
        activity_bookable: true,
        accommodation_bookable: false,
      },
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
        screen.getByTestId('accommodation-too-late-warning'),
      ).toBeInTheDocument(),
    )
    // The mode fieldset never renders at all once the only remaining
    // option is guiding-only and no hotel context is needed — but the
    // guiding-only mode itself must still be the one in effect. Assert via
    // the ABSENCE of the hotel-bearing option testids and the presence of
    // guiding-only-only behaviour: no room qty steppers, no hotel picker.
    expect(
      screen.queryByTestId('accommodation-mode-package'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('accommodation-mode-shared-double'),
    ).not.toBeInTheDocument()
    // The mode-forcing effect flips `mode` to 'guiding-only' asynchronously
    // (an extra tick after the banner's own state settles) — wait for its
    // effect (no room/hotel UI) rather than asserting synchronously.
    await waitFor(() => {
      expect(screen.queryByText('Single Room')).not.toBeInTheDocument()
      expect(screen.queryByText('Hotel Mirador')).not.toBeInTheDocument()
    })
    // guiding-only needs no further input — Continue is enabled once the
    // check has settled (it has, by the waitFor above).
    expect(
      screen.getByRole('button', { name: 'Continue' }),
    ).not.toBeDisabled()
  })

  // landr-t869m.2 review fix (finding #2): before the accommodation_bookable
  // fetch settles, Continue must not be clickable — otherwise a customer
  // who picks a room in the brief window before the GET lands could reach
  // Confirm and 422.
  it('optional: Continue is disabled while the too-late check is still in flight', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])
    let resolveAvailability: (rows: AvailabilitySlot[]) => void = () => {}
    mocks.getAvailability.mockReturnValue(
      new Promise<AvailabilitySlot[]>((resolve) => {
        resolveAvailability = resolve
      }),
    )

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
      expect(screen.getByTestId('accommodation-checking-notice')).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    resolveAvailability([
      {
        availability_id: 'a-1',
        date: '2026-06-10',
        start_time: null,
        end_time: null,
        capacity: 5,
        capacity_reserved: 0,
        available_seats: 5,
        status: 'open',
        activity_bookable: true,
        accommodation_bookable: true,
      },
    ])

    await waitFor(() =>
      expect(
        screen.queryByTestId('accommodation-checking-notice'),
      ).not.toBeInTheDocument(),
    )
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

    // landr-t869m.5 (flake fix): this is an 'optional' offering with a day
    // selected, so canContinue also waits on the mount-effect
    // accommodation_bookable fetch (accommodationCheckSettled) landing —
    // not just the room pick. Under full-suite load that mocked promise can
    // still be in flight here; wait for the button to actually enable
    // instead of asserting synchronously right after the click.
    const continueBtn = screen.getByRole('button', { name: /Continue/i })
    await waitFor(() => expect(continueBtn).not.toBeDisabled())
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
      // landr-gb2f.5: room product names map.
      { 'single-room': 'Single Room' },
      // landr-a4fy: breakfast map (empty — no addons configured).
      expect.objectContaining({}),
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
    await clickContinue()
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
      // landr-gb2f.5: room product names map.
      { 'single-room': 'Single Room' },
      // landr-a4fy: breakfast map (empty — no addons configured).
      expect.objectContaining({}),
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
    // landr-t869m.5 (flake fix): 'optional' offering, so Continue also
    // waits on the mount-effect accommodation_bookable fetch to settle —
    // wait for enabled rather than clicking straight away.
    const continueBtn = screen.getByRole('button', { name: /Continue/i })
    await waitFor(() => expect(continueBtn).not.toBeDisabled())
    fireEvent.click(continueBtn)
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
    // landr-wnhg7 / landr-genericity-northstar: the shared-double copy must
    // stay sport-neutral — a kayak or dive operator uses this step too.
    expect(document.body).not.toHaveTextContent(/pilot|paraglid/i)
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
    // landr-t869m.5 (flake fix): 'optional' offering — wait for the
    // mount-effect accommodation_bookable fetch to settle before clicking.
    const continueBtn = screen.getByRole('button', { name: /Continue/i })
    await waitFor(() => expect(continueBtn).not.toBeDisabled())
    fireEvent.click(continueBtn)
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

    await clickContinue()
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

  it('a breakfast offer capped at 1 disables + at 1 and shows no aggregate warning (landr-yybu)', async () => {
    // The evaluator caps a single room's breakfast (max_qty 1): the stepper
    // stops there and the old bottom aggregate warning is gone.
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 98, 1),
    ])
    mockRoomOffers((id) => [breakfastOffer(id, { max_qty: 1 })])

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
    fireEvent.click(
      screen.getByRole('button', { name: /Increase Single Room quantity/i }),
    )
    await waitFor(() => expect(bfPlus('single-room')).toBeInTheDocument())

    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(bfPlus('single-room'))
    }

    await waitFor(() => expect(bfPlus('single-room')).toBeDisabled())
    expect(bfQty('single-room')).toHaveTextContent('1')
    expect(
      screen.queryByTestId('overbook-breakfast-warning'),
    ).not.toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled(),
    )
  })

  it('dropping a room type to 0 drops the extras taken under it (landr-u4fl)', async () => {
    // Removing the last room of a type removes the offers hanging off it, so
    // the review never shows a breakfast for a room that is gone.
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 98, 1),
    ])
    mockRoomOffers(true)
    const onLive = vi.fn()

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        participantCount={1}
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
    await waitFor(() => expect(bfPlus('single-room')).toBeInTheDocument())
    fireEvent.click(bfPlus('single-room'))
    await waitFor(() => expect(bfQty('single-room')).toHaveTextContent('1'))

    fireEvent.click(
      screen.getByRole('button', { name: /Decrease Single Room quantity/i }),
    )
    expect(onLive).toHaveBeenLastCalledWith([], [])
    expect(screen.queryByTestId('offer-row-bf-single-room')).toBeNull()
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

    await clickContinue()
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
      // landr-gb2f.5: room product names map.
      { 'single-room': 'Single Room' },
      // landr-a4fy: breakfast map (empty — no addons configured).
      expect.objectContaining({}),
    )
  })

  it('restores prior extras from initialRoomPicks (landr-yf0n)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('double-room', 'Double Room', 73, 2),
    ])
    mockRoomOffers(true)
    const onConfirm = vi.fn()

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        // Two guests fully occupy the capacity-2 double so the occupancy gate
        // lets Continue enable.
        participantCount={2}
        onConfirm={onConfirm}
        onBack={vi.fn()}
        initialHotelLocationId="hotel-a"
        initialRooms={[{ productId: 'double-room', quantity: 1 }]}
        initialRoomPicks={[bfPick('double-room', 3)]}
        initialMode="package"
      />,
    )

    await waitFor(() =>
      expect(bfQty('double-room')).toHaveTextContent('3'),
    )

    await clickContinue()
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(
      [{ productId: 'double-room', quantity: 1 }],
      'hotel-a',
      [expect.objectContaining({ offerId: 'bf-double-room', quantity: 3 })],
      undefined,
      false,
      // Both guests auto-assigned to the double room's only unit.
      {
        0: { roomProductId: 'double-room', unitIndex: 0 },
        1: { roomProductId: 'double-room', unitIndex: 0 },
      },
      // landr-doam.1: no age overrides -> empty ageMap.
      {},
      // landr-gb2f.5: room product names map.
      { 'double-room': 'Double Room' },
      // landr-a4fy: breakfast map (derived from the picks + assignment).
      expect.objectContaining({}),
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

    await clickContinue()
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
    mockRoomOffers(true)

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
    mockRoomOffers(true)
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

    // Two breakfast offer rows should now be visible (one per room type).
    await waitFor(() =>
      expect(screen.getAllByText('Breakfast')).toHaveLength(2),
    )

    // Increase breakfast under the FIRST room (Single Room) once.
    fireEvent.click(bfPlus('single-room'))

    // The second room's breakfast stepper should still show 0.
    expect(bfQty('single-room')).toHaveTextContent('1')
    expect(bfQty('double-room')).toHaveTextContent('0')

    // Increase Double Room's breakfast twice -> independent of Single.
    fireEvent.click(bfPlus('double-room'))
    fireEvent.click(bfPlus('double-room'))

    expect(bfQty('single-room')).toHaveTextContent('1')
    expect(bfQty('double-room')).toHaveTextContent('2')

    // Continue: each room type reports its own pick.
    await clickContinue()
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [rooms, , picks] = onConfirm.mock.calls[0] as Parameters<typeof onConfirm>
    expect(rooms).toHaveLength(2)
    expect(roomExtraQty(picks as OfferPick[])).toEqual({
      'single-room': { 'bf-1': 1 },
      'double-room': { 'bf-1': 2 },
    })
  })

  it('aggregate breakfast warning is GONE; no aggregate warning renders (landr-yybu)', async () => {
    // The bottom aggregate paragraph (overbook-breakfast-warning) must NOT
    // render, whatever the breakfast count.
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('double-room', 'Double Room', 73, 2),
    ])
    mockRoomOffers(true)

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

    // 1 breakfast in a room that sleeps 2.
    fireEvent.click(bfPlus('double-room'))
    await waitFor(() => expect(bfQty('double-room')).toHaveTextContent('1'))

    // Bottom aggregate breakfast warning MUST NOT be present (landr-yybu removed it)
    expect(
      screen.queryByTestId('overbook-breakfast-warning'),
    ).not.toBeInTheDocument()
  })

  it('onConfirm reports one pick per room type, summed by roomExtraQty (landr-yybu)', async () => {
    // Two Double Rooms (capacity=2 each), both offering the same breakfast.
    // Room A orders 1 breakfast, Room B orders 2.
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('room-a', 'Room A', 73, 2),
      makeRoom('room-b', 'Room B', 73, 2),
    ])
    mockRoomOffers(true)
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

    // Room A: 1 breakfast
    fireEvent.click(bfPlus('room-a'))
    // Room B: 2 breakfasts
    fireEvent.click(bfPlus('room-b'))
    fireEvent.click(bfPlus('room-b'))

    // landr-87n9.3: wait for the whole-party auto-assign to occupy both
    // units so the occupancy gate enables Continue.
    await waitFor(() =>
      expect(screen.getByText(/Everyone has a room/i)).toBeInTheDocument(),
    )
    await clickContinue()

    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [, , picks] = onConfirm.mock.calls[0] as Parameters<typeof onConfirm>
    expect(picks).toHaveLength(2)
    expect(roomExtraQty(picks as OfferPick[])).toEqual({
      'room-a': { 'bf-1': 1 },
      'room-b': { 'bf-1': 2 },
    })
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

    it('fires the room picks as the customer bumps a per-room breakfast', async () => {
      mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
      mocks.getHotelRoomsForHotel.mockResolvedValue([
        makeRoom('single-room', 'Single Room', 49, 1),
      ])
      mockRoomOffers(true)
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
      await waitFor(() => expect(bfPlus('single-room')).toBeInTheDocument())
      fireEvent.click(bfPlus('single-room'))
      await waitFor(() =>
        expect(onLive).toHaveBeenLastCalledWith(
          [{ productId: 'single-room', quantity: 1 }],
          [
            expect.objectContaining({
              offerId: 'bf-single-room',
              parentLineId: 'r-single-room',
              productId: 'bf-1',
              quantity: 1,
            }),
          ],
        ),
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
    mockRoomOffers()
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
    // The room offers are evaluated after a room is added: wait for Continue.
    await waitFor(() => expect(cont).not.toBeDisabled())
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

// ── landr-abme: back-nav re-entry must not re-derive restored state ──────
//
// Reported by the operator against dev booking c3842d1d: a customer picked a
// Single + a Double, hand-assigned Matthias to the Single and Olaf + Alyda to
// the Double, continued, then jumped back to the date picker via the
// breadcrumb, changed the dates and walked forward again. The rooms came back
// but the people had been shuffled — and the booking was SUBMITTED that way
// (booking_participants had Olaf in the Single, Matthias in the Double).
//
// Root cause: AccommodationStep restores `initialAssignment` synchronously in
// useState, but the room catalogue arrives over the network. The whole-party
// auto-assign effect fired once on mount, while `rooms` was still null — so
// `roomUnits` was [] and `pruneAssignments(prev, [])` threw the restored map
// away. `initialAssignment` is never read again, so when the catalogue landed
// the effect re-filled the party in raw index order. These tests pin the
// distinction the fix turns on: an empty `roomUnits` means "empty cart" ONLY
// once the catalogue has resolved.
describe('AccommodationStep — restored state survives re-entry (landr-abme)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoomOffers()
  })

  const TWO_ROOMS = () => [
    makeRoom('single-room', 'Single Room', 49, 1),
    makeRoom('double-room', 'Double Room', 73, 2),
  ]
  const RESTORED_ROOMS = [
    { productId: 'single-room', quantity: 1 },
    { productId: 'double-room', quantity: 1 },
  ]
  // The party as DetailsStep builds it: participants[0] is the booker (Olaf),
  // then the additional participant (Matthias), then companions (Alyda).
  // Party index space: 0=Olaf, 1=Matthias, 2=Alyda.
  const PARTY = {
    participantCount: 2,
    participantNames: ['Olaf', 'Matthias'],
    companionNames: ['Alyda'],
  }
  // What the customer actually arranged by hand: Matthias alone in the Single,
  // Olaf + Alyda in the Double. Deliberately NOT the index-order default,
  // which would be 0→single, 1→double, 2→double.
  const MANUAL_ASSIGNMENT = {
    0: { roomProductId: 'double-room', unitIndex: 0, slot: 0 },
    1: { roomProductId: 'single-room', unitIndex: 0, slot: 0 },
    2: { roomProductId: 'double-room', unitIndex: 0, slot: 1 },
  }

  function renderRestored(extra: Record<string, unknown> = {}) {
    return render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10', '2026-06-11']}
        operatorToken="para42"
        onBack={vi.fn()}
        initialMode="package"
        initialHotelLocationId="hotel-a"
        initialRooms={RESTORED_ROOMS}
        initialAssignment={MANUAL_ASSIGNMENT}
        onConfirm={vi.fn()}
        {...PARTY}
        {...extra}
      />,
    )
  }

  it('keeps a hand-made room assignment that differs from the auto-assign default', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue(TWO_ROOMS())

    renderRestored()

    await waitFor(() =>
      expect(screen.getByTestId('room-unit-single-room::0')).toBeInTheDocument(),
    )
    const single = screen.getByTestId('room-unit-single-room::0')
    const double = screen.getByTestId('room-unit-double-room::0')

    // Matthias (party index 1) is in the Single — NOT Olaf (index 0), which is
    // what a from-scratch index-order auto-assign would have produced and what
    // the operator actually saw.
    expect(within(single).getByTestId('occupant-row-1')).toBeInTheDocument()
    expect(within(single).queryByTestId('occupant-row-0')).toBeNull()
    expect(within(double).getByTestId('occupant-row-0')).toBeInTheDocument()
    expect(within(double).getByTestId('occupant-row-2')).toBeInTheDocument()
  })

  it('submits the restored assignment verbatim, slots intact (never rebuilt)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue(TWO_ROOMS())
    const onConfirm = vi.fn()

    renderRestored({ onConfirm })

    await waitFor(() =>
      expect(screen.getByText(/Everyone has a room/i)).toBeInTheDocument(),
    )
    const cont = screen.getByRole('button', { name: /Continue/i })
    await waitFor(() => expect(cont).not.toBeDisabled())
    fireEvent.click(cont)

    const [, , , , , roomAssignment] = onConfirm.mock.calls[0]!
    // Byte-for-byte the map that came in. A rebuilt map would be slot-less
    // (autoAssignParticipants writes no `slot`), so asserting the slots is
    // what actually distinguishes "preserved" from "coincidentally the same".
    expect(roomAssignment).toEqual(MANUAL_ASSIGNMENT)
  })

  it('keeps the restored breakfast-chip holders instead of re-seeding the default', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue(TWO_ROOMS())
    mockRoomOffers(true)
    const onConfirm = vi.fn()

    // ONE breakfast on the Double (capacity 2) → 'partial' mode, exactly one
    // holder. The customer gave it to Alyda (index 2); the deterministic
    // default would hand it to the lowest-index occupant, Olaf (index 0).
    renderRestored({
      onConfirm,
      initialRoomPicks: [bfPick('double-room', 1)],
      initialBreakfastMap: { 2: true },
    })

    await waitFor(() =>
      expect(screen.getByTestId('room-unit-double-room::0')).toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(screen.getByTestId('breakfast-chip-2')).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('breakfast-chip-0')).toBeNull()

    const cont = screen.getByRole('button', { name: /Continue/i })
    await waitFor(() => expect(cont).not.toBeDisabled())
    fireEvent.click(cont)
    const [, , , , , , , , breakfastMap] = onConfirm.mock.calls[0]!
    expect(breakfastMap).toEqual({ 2: true })
  })

  it('blocks Continue until the room offers have been evaluated', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue(TWO_ROOMS())
    // Hold the evaluator open: the rooms resolve (so occupancy is complete)
    // while the offers are still unanswered. Clicking Continue in that window
    // used to submit an empty extras set and wipe the customer's restored
    // breakfast.
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    mocks.getOffers.mockImplementation(async (body) => {
      await held
      return {
        lines: body.lines.map((l) => ({
          line_id: l.line_id,
          eligible: true,
          draft: false,
          offers: l.line_id.startsWith('r-') ? [breakfastOffer(l.line_id.slice(2))] : [],
        })),
        required_attribute_keys: [],
      }
    })

    renderRestored({ initialRoomPicks: [bfPick('double-room', 1)] })

    await waitFor(() =>
      expect(screen.getByText(/Everyone has a room/i)).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDisabled()

    release()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled(),
    )
  })

  it('does not flash a false "0 beds" overbook warning while the catalogue loads', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    let releaseRooms: (v: Product[]) => void = () => {}
    mocks.getHotelRoomsForHotel.mockReturnValue(
      new Promise<Product[]>((resolve) => {
        releaseRooms = resolve
      }),
    )

    renderRestored()

    // `selection` is restored synchronously, so totalRoomsPicked > 0 from the
    // first render while totalCapacity is still 0. The warning is role="alert"
    // — screen readers announced it on every single re-entry.
    await waitFor(() =>
      expect(screen.getByTestId('accommodation-mode')).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('overbook-capacity-warning')).toBeNull()

    releaseRooms(TWO_ROOMS())
    await waitFor(() =>
      expect(screen.getByTestId('room-unit-single-room::0')).toBeInTheDocument(),
    )
    // 3 people, 3 beds — still no warning once the truth is known.
    expect(screen.queryByTestId('overbook-capacity-warning')).toBeNull()
  })

  it('pads short participantNames so companion chips keep their party index', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue(TWO_ROOMS())

    // participantCount=2 but only one name typed so far. The companion must
    // stay at party index 2 — the index the assignment map is keyed on.
    renderRestored({ participantNames: ['Olaf'] })

    await waitFor(() =>
      expect(screen.getByTestId('room-unit-double-room::0')).toBeInTheDocument(),
    )
    const double = screen.getByTestId('room-unit-double-room::0')
    expect(within(double).getByTestId('occupant-row-2')).toHaveTextContent(
      /Alyda/,
    )
  })
})

describe('AccommodationStep — shared-double reference field (landr-otml0.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoomOffers()
    mocks.getAvailability.mockResolvedValue([])
  })

  async function enterSharedDouble() {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([])
    const onConfirm = vi.fn()
    const onJoinRefChange = vi.fn()
    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={onConfirm}
        onBack={vi.fn()}
        onJoinRefChange={onJoinRefChange}
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('accommodation-mode')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByTestId('accommodation-mode-shared-double'))
    await waitFor(() =>
      expect(screen.getByTestId('shared-double-notice')).toBeInTheDocument(),
    )
    return { onJoinRefChange }
  }

  it('shows the reference field in shared-double mode, hidden in package/guiding-only', async () => {
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
      expect(screen.getByTestId('accommodation-mode')).toBeInTheDocument(),
    )
    // Default mode is 'package' — no reference field.
    expect(
      screen.queryByTestId('shared-double-reference'),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('accommodation-mode-shared-double'))
    await waitFor(() =>
      expect(
        screen.getByTestId('shared-double-reference'),
      ).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByTestId('accommodation-mode-package'))
    await waitFor(() =>
      expect(
        screen.queryByTestId('shared-double-reference'),
      ).not.toBeInTheDocument(),
    )
  })

  it('is hidden entirely in invite mode even when shared-double is selected', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([])
    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        inviteMode
        initialMode="shared-double"
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('shared-double-notice')).toBeInTheDocument(),
    )
    expect(
      screen.queryByTestId('shared-double-reference'),
    ).not.toBeInTheDocument()
  })

  // landr-jsu3n.3: invitee sharing the inviter's room gets the inviter's hotel.
  it('invite mode with the inviter hotel: read-only "Staying at", no hotel radios', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A, HOTEL_B])
    mocks.getHotelRoomsForHotel.mockResolvedValue([])
    const onConfirm = vi.fn()
    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={onConfirm}
        onBack={vi.fn()}
        inviteMode
        initialHotelLocationId="hotel-b"
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('staying-at-hotel')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('staying-at-hotel')).toHaveTextContent(
      'Hotel del Mar',
    )
    expect(screen.queryByText('Hotel Mirador')).not.toBeInTheDocument()
    expect(document.querySelector('input[name="hotel"]')).toBeNull()
  })

  it('invite mode without an inviter hotel keeps the hotel picker', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A, HOTEL_B])
    mocks.getHotelRoomsForHotel.mockResolvedValue([])
    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        inviteMode
      />,
    )
    await waitFor(() =>
      expect(document.querySelectorAll('input[name="hotel"]')).toHaveLength(2),
    )
  })

  it('looks up a complete 8-char reference and shows the masked confirm card', async () => {
    await enterSharedDouble()
    mocks.lookupBookingReference.mockResolvedValue({
      reference: 'A1B2C3D4',
      masked_name: 'O**f K***n',
      created_at: new Date().toISOString(),
    })

    fireEvent.change(screen.getByTestId('shared-double-reference-input'), {
      target: { value: 'a1b2c3d4' },
    })

    await waitFor(() =>
      expect(mocks.lookupBookingReference).toHaveBeenCalledWith(
        'para42',
        'A1B2C3D4',
      ),
    )
    await waitFor(() =>
      expect(
        screen.getByTestId('shared-double-reference-confirm'),
      ).toBeInTheDocument(),
    )
    expect(
      screen.getByTestId('shared-double-reference-confirm'),
    ).toHaveTextContent('O**f K***n')
  })

  it('confirming "Yes, link us" reports the reference via onJoinRefChange', async () => {
    const { onJoinRefChange } = await enterSharedDouble()
    mocks.lookupBookingReference.mockResolvedValue({
      reference: 'A1B2C3D4',
      masked_name: 'O**f K***n',
      created_at: new Date().toISOString(),
    })
    fireEvent.change(screen.getByTestId('shared-double-reference-input'), {
      target: { value: 'A1B2C3D4' },
    })
    await waitFor(() =>
      expect(
        screen.getByTestId('shared-double-reference-confirm'),
      ).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByTestId('shared-double-reference-confirm-yes'))

    expect(onJoinRefChange).toHaveBeenLastCalledWith('A1B2C3D4')
    expect(
      screen.getByTestId('shared-double-reference-linked'),
    ).toBeInTheDocument()
  })

  it('picking "No" clears the field and reports null', async () => {
    const { onJoinRefChange } = await enterSharedDouble()
    mocks.lookupBookingReference.mockResolvedValue({
      reference: 'A1B2C3D4',
      masked_name: 'O**f K***n',
      created_at: new Date().toISOString(),
    })
    fireEvent.change(screen.getByTestId('shared-double-reference-input'), {
      target: { value: 'A1B2C3D4' },
    })
    await waitFor(() =>
      expect(
        screen.getByTestId('shared-double-reference-confirm'),
      ).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByTestId('shared-double-reference-confirm-no'))

    expect(onJoinRefChange).toHaveBeenLastCalledWith(null)
    expect(
      screen.queryByTestId('shared-double-reference-confirm'),
    ).not.toBeInTheDocument()
    expect(
      (screen.getByTestId('shared-double-reference-input') as HTMLInputElement)
        .value,
    ).toBe('')
  })

  it('shows "not found" for an unknown reference and never calls onJoinRefChange', async () => {
    const { onJoinRefChange } = await enterSharedDouble()
    mocks.lookupBookingReference.mockRejectedValue(new Error('404'))
    fireEvent.change(screen.getByTestId('shared-double-reference-input'), {
      target: { value: 'FFFFFFFF' },
    })
    await waitFor(() =>
      expect(
        screen.getByTestId('shared-double-reference-not-found'),
      ).toBeInTheDocument(),
    )
    expect(onJoinRefChange).not.toHaveBeenCalled()
  })
})

// ── landr-zeg4u.4: invitee accommodation ─────────────────────────────────
//
// An invitee (/i/<token>) already has their bed: the host's shared double.
// So the only mode is shared-double (no guiding-only, no package for
// themselves), with a clear "your room is already booked" note. Companions
// they bring along (partner, kids) can get ADDITIONAL rooms in the same
// booking — only the companions are placed in those rooms.
describe('AccommodationStep — invitee accommodation (landr-zeg4u.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoomOffers()
    mocks.getAvailability.mockResolvedValue([])
  })

  it('invite mode offers only shared-double, preselected, with the room-already-booked note', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([])
    render(
      <AccommodationStep
        product={makeService('optional')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        inviteMode
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('invite-room-booked-notice')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('invite-room-booked-notice')).toHaveTextContent(
      /already booked/i,
    )
    expect(screen.getByTestId('shared-double-notice')).not.toHaveTextContent(/double/i)
    expect(
      screen.queryByTestId('accommodation-mode-guiding-only'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('accommodation-mode-package'),
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByTestId('accommodation-mode-shared-double')).getByRole(
        'radio',
      ),
    ).toBeChecked()
  })

  it('invite mode without companions: no rooms fetched, confirms shared-double with no rooms', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([])
    const onConfirm = vi.fn()
    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        participantCount={1}
        participantNames={['Thomas']}
        onConfirm={onConfirm}
        onBack={vi.fn()}
        inviteMode
      />,
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled(),
    )
    expect(
      screen.queryByTestId('additional-accommodation'),
    ).not.toBeInTheDocument()
    expect(mocks.getHotelRoomsForHotel).not.toHaveBeenCalled()
    await clickContinue()
    const [rooms, hotelId, , , isSharedDouble, assignment] =
      onConfirm.mock.calls[0]!
    expect(rooms).toEqual([])
    expect(hotelId).toBe('hotel-a')
    expect(isSharedDouble).toBe(true)
    expect(assignment).toEqual({})
  })

  it('companions get an additional room; the invitee is never placed in it', async () => {
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
        participantCount={1}
        participantNames={['Thomas']}
        companionNames={['Mia', 'Leo']}
        onConfirm={onConfirm}
        onBack={vi.fn()}
        inviteMode
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('additional-accommodation')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('additional-accommodation')).toHaveTextContent(
      /Additional accommodation/,
    )
    // Rooms are optional for companions: Continue works with none picked.
    await waitFor(() =>
      expect(screen.getByText('Double Room')).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled()

    fireEvent.click(
      screen.getByRole('button', { name: /Increase Double Room quantity/i }),
    )
    // Only the companions get chips — the invitee's bed is the shared double.
    await waitFor(() =>
      expect(screen.getByText(/Everyone has a room/i)).toBeInTheDocument(),
    )
    const chips = screen.getAllByTestId(/^participant-chip-/)
    expect(chips.map((c) => c.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Mia'), expect.stringContaining('Leo')]),
    )
    expect(chips.some((c) => c.textContent?.includes('Thomas'))).toBe(false)

    const cont = screen.getByRole('button', { name: /Continue/i })
    // The room offers are evaluated after a room is added: wait for Continue.
    await waitFor(() => expect(cont).not.toBeDisabled())
    fireEvent.click(cont)
    const [rooms, hotelId, , , isSharedDouble, assignment] =
      onConfirm.mock.calls[0]!
    expect(rooms).toEqual([{ productId: 'double-room', quantity: 1 }])
    expect(hotelId).toBe('hotel-a')
    expect(isSharedDouble).toBe(true)
    // Unified party index: participant 0 (invitee) unassigned; companions 1, 2.
    expect(Object.keys(assignment as object).sort()).toEqual(['1', '2'])
    expect((assignment as Record<number, { roomProductId: string }>)[1]!.roomProductId).toBe(
      'double-room',
    )
  })

  it('a restored room selection whose companions were removed never ships a room', async () => {
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
        participantCount={1}
        participantNames={['Thomas']}
        onConfirm={onConfirm}
        onBack={vi.fn()}
        inviteMode
        initialMode="shared-double"
        initialHotelLocationId="hotel-a"
        initialRooms={[{ productId: 'double-room', quantity: 1 }]}
      />,
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled(),
    )
    await clickContinue()
    const [rooms, , , , isSharedDouble] = onConfirm.mock.calls[0]!
    expect(rooms).toEqual([])
    expect(isSharedDouble).toBe(true)
  })

  it('invite copy names the real room and host, never "double" (landr-wp8e9.2)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([])
    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        inviteMode
        hostDisplayName="Olaf"
        hostRoomName="Premium Single"
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('invite-room-booked-notice')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('invite-room-booked-notice')).toHaveTextContent(
      'Your room is already booked by Olaf: Premium Single.',
    )
    const mode = screen.getByTestId('accommodation-mode-shared-double')
    expect(mode).toHaveTextContent('My room is booked by Olaf')
    expect(mode).not.toHaveTextContent(/double/i)
  })

  it('invite copy without a known room omits the room clause (landr-wp8e9.2)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([])
    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        inviteMode
        hostDisplayName="Olaf"
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('invite-room-booked-notice')).toHaveTextContent(
        'Your room is already booked by Olaf. You will',
      ),
    )
  })

  it('blocks Continue when the inviter room is full and the companion has no room (landr-wp8e9.2)', async () => {
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
        participantNames={['Thomas']}
        companionNames={['Mia']}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        inviteMode
        hostRoomFreeBeds={0}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('Double Room')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('host-room-full')).toHaveTextContent(
      "The room you're sharing is full",
    )
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDisabled()
    expect(screen.queryByText(/swap/i)).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: /Increase Double Room quantity/i }),
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled(),
    )
    expect(screen.queryByTestId('host-room-full')).not.toBeInTheDocument()
  })

  it('lets the companion share the inviter room while it has a free bed (landr-wp8e9.2)', async () => {
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
        participantNames={['Thomas']}
        companionNames={['Mia']}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        inviteMode
        hostRoomFreeBeds={1}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('Double Room')).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('host-room-full')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled()
  })

  it('blocks only the overflow: 2 companions, 1 free bed (landr-wp8e9.2)', async () => {
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
        participantNames={['Thomas']}
        companionNames={['Mia', 'Leo']}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        inviteMode
        hostRoomFreeBeds={1}
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('host-room-full')).toHaveTextContent(
        'Only 1 more bed is free',
      ),
    )
    await waitFor(() =>
      expect(screen.getByText('Double Room')).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDisabled()
    fireEvent.click(
      screen.getByRole('button', { name: /Increase Double Room quantity/i }),
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled(),
    )
  })

  it('a lone companion may take a double — partial rooms are allowed (landr-zeg4u.5)', async () => {
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
        participantCount={1}
        participantNames={['Thomas']}
        companionNames={['Mia']}
        onConfirm={onConfirm}
        onBack={vi.fn()}
        inviteMode
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('Double Room')).toBeInTheDocument(),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Increase Double Room quantity/i }),
    )
    // One companion in a double — the invitee does NOT fill the second bed,
    // and that is fine: the room is priced per unit either way.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled(),
    )
    expect(screen.queryByTestId('occupancy-hint')).not.toBeInTheDocument()
    // landr-395ks: allowed, but the booker is told they pay for the empty bed.
    expect(screen.getByTestId('empty-beds-notice')).toHaveTextContent(
      'Double Room #1 has 1 empty bed — you pay for the whole room.',
    )
    await clickContinue()
    const [rooms, , , , , assignment] = onConfirm.mock.calls[0]!
    expect(rooms).toEqual([{ productId: 'double-room', quantity: 1 }])
    expect(Object.keys(assignment as object)).toEqual(['1'])
  })

  it('a full double shows no empty-beds notice (landr-395ks)', async () => {
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
        participantNames={['Thomas']}
        companionNames={['Mia', 'Leo']}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        inviteMode
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('Double Room')).toBeInTheDocument(),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Increase Double Room quantity/i }),
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled(),
    )
    expect(screen.queryByTestId('empty-beds-notice')).not.toBeInTheDocument()
  })

  it('not every companion has to be placed (landr-zeg4u.5)', async () => {
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
        participantNames={['Thomas']}
        companionNames={['Mia', 'Leo', 'Ben']}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        inviteMode
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('Double Room')).toBeInTheDocument(),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Increase Double Room quantity/i }),
    )
    await waitFor(() =>
      expect(screen.getAllByTestId(/^participant-chip-/)).toHaveLength(3),
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled(),
    )
    expect(screen.queryByTestId('occupancy-hint')).not.toBeInTheDocument()
  })

  it('another guiding participant must get a room; only the booker shares the double (landr-zeg4u.5)', async () => {
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
        participantCount={2}
        participantNames={['Thomas', 'Anna']}
        onConfirm={onConfirm}
        onBack={vi.fn()}
        inviteMode
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('additional-accommodation')).toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(screen.getByText('Double Room')).toBeInTheDocument(),
    )
    // No room yet: Anna has no bed, so Continue is blocked and says why.
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDisabled()
    expect(screen.getByTestId('additional-accommodation')).toHaveTextContent(
      /Anna/,
    )

    fireEvent.click(
      screen.getByRole('button', { name: /Increase Double Room quantity/i }),
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled(),
    )
    const chips = screen.getAllByTestId(/^participant-chip-/)
    expect(chips.some((c) => c.textContent?.includes('Anna'))).toBe(true)
    expect(chips.some((c) => c.textContent?.includes('Thomas'))).toBe(false)

    await clickContinue()
    const [rooms, , , , isSharedDouble, assignment] = onConfirm.mock.calls[0]!
    expect(rooms).toEqual([{ productId: 'double-room', quantity: 1 }])
    expect(isSharedDouble).toBe(true)
    expect(Object.keys(assignment as object)).toEqual(['1'])
  })

  it('too late for rooms + another guiding participant: explains and blocks Continue (landr-zeg4u.6)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('double-room', 'Double Room', 73, 2),
    ])
    mocks.getAvailability.mockResolvedValue([
      {
        availability_id: 'a-1',
        date: '2026-06-10',
        start_time: null,
        end_time: null,
        capacity: 5,
        capacity_reserved: 0,
        available_seats: 5,
        status: 'open',
        activity_bookable: true,
        accommodation_bookable: false,
      },
    ])
    const onConfirm = vi.fn()
    render(
      <AccommodationStep
        product={makeService('optional')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        participantCount={2}
        participantNames={['Thomas', 'Anna']}
        onConfirm={onConfirm}
        onBack={vi.fn()}
        inviteMode
      />,
    )
    await waitFor(() =>
      expect(
        screen.getByTestId('shared-double-too-late-others'),
      ).toBeInTheDocument(),
    )
    const note = screen.getByTestId('shared-double-too-late-others')
    expect(note).toHaveTextContent(/Only you share the host's room/)
    expect(note).toHaveTextContent(/Anna/)
    expect(note).toHaveTextContent(/remove them or contact the operator/)
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('too late for rooms with only the invitee: Continue stays enabled, no extra note (landr-zeg4u.6)', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([])
    mocks.getAvailability.mockResolvedValue([
      {
        availability_id: 'a-1',
        date: '2026-06-10',
        start_time: null,
        end_time: null,
        capacity: 5,
        capacity_reserved: 0,
        available_seats: 5,
        status: 'open',
        activity_bookable: true,
        accommodation_bookable: false,
      },
    ])
    render(
      <AccommodationStep
        product={makeService('optional')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        participantCount={1}
        participantNames={['Thomas']}
        companionNames={['Mia']}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        inviteMode
      />,
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled(),
    )
    expect(
      screen.queryByTestId('shared-double-too-late-others'),
    ).not.toBeInTheDocument()
  })

  // ── landr-jiagg.2: booker books for someone else ───────────────────
  // The shared double covers the BOOKER'S own bed — without the booker in
  // the party it is not offered, and a restored shared-double falls back.

  it('allowSharedDouble=false hides the shared-double mode', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])
    render(
      <AccommodationStep
        product={makeService('optional')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        allowSharedDouble={false}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('accommodation-mode')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('accommodation-mode-package')).toBeInTheDocument()
    expect(screen.getByTestId('accommodation-mode-guiding-only')).toBeInTheDocument()
    expect(
      screen.queryByTestId('accommodation-mode-shared-double'),
    ).not.toBeInTheDocument()
  })

  it('allowSharedDouble=false turns a restored shared-double mode into package', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])
    render(
      <AccommodationStep
        product={makeService('optional')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        initialMode="shared-double"
        allowSharedDouble={false}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('accommodation-mode')).toBeInTheDocument(),
    )
    const packageRadio = screen
      .getByTestId('accommodation-mode-package')
      .querySelector('input[type="radio"]') as HTMLInputElement
    expect(packageRadio.checked).toBe(true)
  })

  it('allowSharedDouble=false on a restored shared-double clears the lifted join_ref', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])
    const onJoinRefChange = vi.fn()
    render(
      <AccommodationStep
        product={makeService('optional')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        initialMode="shared-double"
        allowSharedDouble={false}
        onJoinRefChange={onJoinRefChange}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )
    await waitFor(() => expect(onJoinRefChange).toHaveBeenCalledWith(null))
  })

  it('a restored shared-double with the booker joining leaves the join_ref alone', async () => {
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])
    const onJoinRefChange = vi.fn()
    render(
      <AccommodationStep
        product={makeService('optional')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        initialMode="shared-double"
        onJoinRefChange={onJoinRefChange}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('accommodation-mode')).toBeInTheDocument(),
    )
    expect(onJoinRefChange).not.toHaveBeenCalledWith(null)
  })

  // ───────────────────────────────────────────────────────────────────────
  // landr-qw2v8.2: invitee of a companion booked WITHOUT a room
  // ("arranges own accommodation"): no host room to share.
  // ───────────────────────────────────────────────────────────────────────
  describe('invite of an own-accommodation companion (landr-qw2v8.2)', () => {
    it('offers guiding only (default) and "Book a room with us" - never the shared room', async () => {
      mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
      mocks.getHotelRoomsForHotel.mockResolvedValue([])
      render(
        <AccommodationStep
          product={makeService('optional')}
          selectedDays={['2026-06-10']}
          operatorToken="para42"
          onConfirm={vi.fn()}
          onBack={vi.fn()}
          hostDisplayName="Olaf"
          inviteOwnAccommodation
          allowSharedDouble={false}
          initialHotelLocationId="hotel-a"
        />,
      )
      await waitFor(() =>
        expect(screen.getByTestId('accommodation-mode')).toBeInTheDocument(),
      )
      const guidingOnly = screen.getByTestId('accommodation-mode-guiding-only')
      expect(guidingOnly).toHaveTextContent(
        'Guiding only — I will take care of accommodation myself',
      )
      expect(guidingOnly.querySelector('input')!).toBeChecked()
      expect(screen.getByTestId('accommodation-mode-package')).toHaveTextContent(
        'Book a room with us',
      )
      expect(
        screen.queryByTestId('accommodation-mode-shared-double'),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByTestId('invite-room-booked-notice'),
      ).not.toBeInTheDocument()
    })

    it('guiding only confirms with no hotel and is not a shared double (own pickup follows)', async () => {
      mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
      mocks.getHotelRoomsForHotel.mockResolvedValue([])
      const onConfirm = vi.fn()
      render(
        <AccommodationStep
          product={makeService('optional')}
          selectedDays={['2026-06-10']}
          operatorToken="para42"
          onConfirm={onConfirm}
          onBack={vi.fn()}
          inviteOwnAccommodation
          allowSharedDouble={false}
          initialHotelLocationId="hotel-a"
        />,
      )
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled(),
      )
      await clickContinue()
      const [rooms, hotelId, , includeHotel, isSharedDouble] =
        onConfirm.mock.calls[0]!
      expect(rooms).toEqual([])
      expect(hotelId).toBeNull()
      expect(includeHotel).toBe(false)
      expect(isSharedDouble).toBe(false)
    })

    it('own rooms: the inviter hotel is preselected but changeable, and the booking is not a shared double', async () => {
      mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A, HOTEL_B])
      mocks.getHotelRoomsForHotel.mockResolvedValue([
        makeRoom('single-room', 'Single Room', 60, 1),
      ])
      const onConfirm = vi.fn()
      render(
        <AccommodationStep
          product={makeService('mandatory')}
          selectedDays={['2026-06-10']}
          operatorToken="para42"
          participantCount={1}
          participantNames={['Mia']}
          onConfirm={onConfirm}
          onBack={vi.fn()}
          inviteOwnAccommodation
          allowSharedDouble={false}
          initialHotelLocationId="hotel-a"
        />,
      )
      // Mandatory offering: no guiding-only, package is the only mode.
      await waitFor(() =>
        expect(screen.getByText('Single Room')).toBeInTheDocument(),
      )
      expect(
        screen.queryByTestId('accommodation-mode-guiding-only'),
      ).not.toBeInTheDocument()
      expect(mocks.getHotelRoomsForHotel).toHaveBeenCalledWith('para42', 'hotel-a')
      // Not read-only: both hotels are offered as radios, A is checked.
      const radioA = screen.getByRole('radio', { name: /Hotel Mirador/i })
      const radioB = screen.getByRole('radio', { name: /Hotel del Mar/i })
      expect(radioA).toBeChecked()
      expect(radioB).not.toBeDisabled()
      expect(screen.queryByTestId('staying-at-hotel')).not.toBeInTheDocument()

      fireEvent.click(
        screen.getByRole('button', { name: /Increase Single Room quantity/i }),
      )
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled(),
      )
      await clickContinue()
      const [rooms, hotelId, , , isSharedDouble] = onConfirm.mock.calls[0]!
      expect(rooms).toEqual([{ productId: 'single-room', quantity: 1 }])
      expect(hotelId).toBe('hotel-a')
      expect(isSharedDouble).toBe(false)
    })

    it('falls back to the lone hotel when the inviter hotel is not offered', async () => {
      mocks.getHotelsForOperator.mockResolvedValue([HOTEL_B])
      mocks.getHotelRoomsForHotel.mockResolvedValue([])
      render(
        <AccommodationStep
          product={makeService('mandatory')}
          selectedDays={['2026-06-10']}
          operatorToken="para42"
          participantCount={1}
          participantNames={['Mia']}
          onConfirm={vi.fn()}
          onBack={vi.fn()}
          inviteOwnAccommodation
          allowSharedDouble={false}
          initialHotelLocationId="hotel-unknown"
        />,
      )
      await waitFor(() =>
        expect(mocks.getHotelRoomsForHotel).toHaveBeenCalledWith(
          'para42',
          'hotel-b',
        ),
      )
    })
  })

  it('a host party with only the booker + own-accommodation companions needs no additional rooms (landr-qw2v8.2)', async () => {
    // App.tsx hands AccommodationStep the ROOMED party only, so a flagged
    // companion is simply absent from companionNames.
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([])
    const onConfirm = vi.fn()
    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        participantCount={1}
        participantNames={['Thomas']}
        companionNames={[]}
        initialMode="shared-double"
        initialHotelLocationId="hotel-a"
        onConfirm={onConfirm}
        onBack={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled(),
    )
    await clickContinue()
    const [rooms, , , , isSharedDouble] = onConfirm.mock.calls[0]!
    expect(rooms).toEqual([])
    expect(isSharedDouble).toBe(true)
  })
})

// landr-c88o5: the room offers are evaluated for the stay's nights.
describe('AccommodationStep offers evaluation (landr-c88o5)', () => {
  it('evaluates each room type line on the stay nights and re-evaluates when the dates change', async () => {
    mocks.getAvailability.mockResolvedValue([])
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('single-room', 'Single Room', 49),
    ])
    mockRoomOffers(true)
    const props = {
      product: makeService('mandatory'),
      operatorToken: 'para42',
      participantCount: 2,
      onConfirm: vi.fn(),
      onBack: vi.fn(),
      initialHotelLocationId: 'hotel-a',
      initialRooms: [{ productId: 'single-room', quantity: 1 }],
      initialMode: 'package' as const,
    }
    const roomLine = () => {
      const calls = mocks.getOffers.mock.calls
      for (let i = calls.length - 1; i >= 0; i -= 1) {
        const l = calls[i]![0].lines.find((x) => x.line_id === 'r-single-room')
        if (l) return l
      }
      return undefined
    }
    const { rerender } = render(
      <AccommodationStep {...props} selectedDays={['2026-06-10']} />,
    )
    const firstNights = stayNightIsos(['2026-06-10'], props.product.accommodation_checkin_offset_days)
    expect(firstNights.length).toBeGreaterThan(0)
    await waitFor(() =>
      expect(roomLine()?.selected_days).toEqual(firstNights),
    )
    const callsBefore = mocks.getOffers.mock.calls.length

    rerender(
      <AccommodationStep {...props} selectedDays={['2026-06-10', '2026-06-11']} />,
    )
    const secondNights = stayNightIsos(
      ['2026-06-10', '2026-06-11'],
      props.product.accommodation_checkin_offset_days,
    )
    expect(secondNights).not.toEqual(firstNights)
    await waitFor(() =>
      expect(roomLine()?.selected_days).toEqual(secondNights),
    )
    expect(mocks.getOffers.mock.calls.length).toBeGreaterThan(callsBefore)
  })
})

// landr-h8n0k: stock is the evaluator's word (it subtracts the whole cart).
describe('AccommodationStep offer stock (landr-h8n0k)', () => {
  it('caps a room type extra at the stock the evaluator reports', async () => {
    mocks.getAvailability.mockResolvedValue([])
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([
      makeRoom('room-a', 'Room A', 49, 2),
      makeRoom('room-b', 'Room B', 49, 2),
    ])
    mockRoomOffers((id) => [
      breakfastOffer(id, {
        stock: { available: true, stock_remaining: id === 'room-b' ? 1 : 2 },
      }),
    ])
    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        participantCount={4}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        initialHotelLocationId="hotel-a"
        initialRooms={[
          { productId: 'room-a', quantity: 1 },
          { productId: 'room-b', quantity: 1 },
        ]}
        initialMode="package"
      />,
    )
    await waitFor(() => expect(bfPlus('room-b')).toBeInTheDocument())
    expect(bfPlus('room-a')).not.toBeDisabled()
    fireEvent.click(bfPlus('room-b'))
    await waitFor(() => expect(bfPlus('room-b')).toBeDisabled())
    expect(bfQty('room-b')).toHaveTextContent('1')
    fireEvent.click(bfPlus('room-a'))
    fireEvent.click(bfPlus('room-a'))
    await waitFor(() => expect(bfPlus('room-a')).toBeDisabled())
  })
})
