/**
 * landr-5aih0.27 — widget German UI.
 *
 * AccommodationStep's shared-double reference lookup (landr-otml0.3) and
 * capacity overbook warning (landr-qpab) render in German when the
 * browser reports a German locale. Mirrors the mock/fixture setup in
 * AccommodationStep.test.tsx (same component, same API surface) rather
 * than re-deriving it, but is a SEPARATE file per this ticket's NOTES so
 * the German-only assertions don't bloat the main (much larger) suite.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AvailabilitySlot,
  BookingLookupResult,
  Hotel,
  Product,
  ProductAddon,
} from '@/api/types'
import { AccommodationStep } from './AccommodationStep'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getHotelsForOperator: vi.fn<(slug: string) => Promise<Hotel[]>>(),
    getHotelRoomsForHotel:
      vi.fn<(slug: string, hotelId: string) => Promise<Product[]>>(),
    getProductAddons: vi.fn<(productId: string) => Promise<ProductAddon[]>>(),
    getAvailability: vi.fn<
      (id: string, from: string, to: string) => Promise<AvailabilitySlot[]>
    >(),
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
    getProductAddons: mocks.getProductAddons,
    getAvailability: mocks.getAvailability,
    lookupBookingReference: mocks.lookupBookingReference,
  }
})

const HOTEL_A: Hotel = {
  location_id: 'hotel-a',
  name: 'Hotel Mirador',
  name_localized: { de: 'Hotel Mirador (DE)', en: 'Hotel Mirador' },
  parent_id: null,
  role_type: { code: 'hotel', label: 'Hotel' },
}

function makeService(hotelOffering: 'none' | 'optional' | 'mandatory'): Product {
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

function setBrowserLanguage(language: string) {
  vi.stubGlobal('navigator', { ...navigator, language })
}

describe('AccommodationStep — German UI (landr-5aih0.27)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getProductAddons.mockResolvedValue([])
    mocks.getAvailability.mockResolvedValue([])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the shared-double reference lookup (found + confirm) in German', async () => {
    setBrowserLanguage('de-DE')
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
    mocks.getHotelRoomsForHotel.mockResolvedValue([])
    const onJoinRefChange = vi.fn()

    render(
      <AccommodationStep
        product={makeService('mandatory')}
        selectedDays={['2026-06-10']}
        operatorToken="para42"
        onConfirm={vi.fn()}
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
    // The reference field's own help copy is German.
    expect(screen.getByTestId('shared-double-reference')).toHaveTextContent(
      'Schön, wenn Sie den Code zur Hand haben',
    )

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
    const confirmCard = screen.getByTestId('shared-double-reference-confirm')
    expect(confirmCard).toHaveTextContent('O**f K***n')
    expect(screen.getByTestId('shared-double-reference-confirm-yes')).toHaveTextContent(
      'Ja, verknüpfen',
    )
    expect(screen.getByTestId('shared-double-reference-confirm-no')).toHaveTextContent('Nein')
    expect(confirmCard).not.toHaveTextContent('Yes, link us')

    fireEvent.click(screen.getByTestId('shared-double-reference-confirm-yes'))
    expect(onJoinRefChange).toHaveBeenLastCalledWith('A1B2C3D4')
    expect(screen.getByTestId('shared-double-reference-linked')).toBeInTheDocument()
  })

  it('renders the shared-double "reference not found" state in German', async () => {
    setBrowserLanguage('de-DE')
    mocks.getHotelsForOperator.mockResolvedValue([HOTEL_A])
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
      expect(screen.getByTestId('accommodation-mode')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByTestId('accommodation-mode-shared-double'))
    await waitFor(() =>
      expect(screen.getByTestId('shared-double-notice')).toBeInTheDocument(),
    )
    mocks.lookupBookingReference.mockRejectedValue(new Error('404'))
    fireEvent.change(screen.getByTestId('shared-double-reference-input'), {
      target: { value: 'FFFFFFFF' },
    })
    await waitFor(() =>
      expect(
        screen.getByTestId('shared-double-reference-not-found'),
      ).toBeInTheDocument(),
    )
    const notFound = screen.getByTestId('shared-double-reference-not-found')
    expect(notFound.textContent).not.toMatch(/we couldn't find/i)
  })

  it('renders the capacity overbook warning in German', async () => {
    setBrowserLanguage('de-DE')
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
      name: /(Increase|Menge von).*(quantity|erhöhen)/i,
    })
    fireEvent.click(plusButtons[0]!)
    fireEvent.click(plusButtons[0]!)

    await waitFor(() =>
      expect(
        screen.getByTestId('overbook-capacity-warning'),
      ).toBeInTheDocument(),
    )
    expect(screen.getByTestId('overbook-capacity-warning')).toHaveTextContent(
      'Sie haben 4 Personen, aber nur 2 Betten — sind Sie sicher?',
    )
    expect(screen.getByTestId('overbook-capacity-warning')).not.toHaveTextContent(
      /4 people/,
    )
  })
})
