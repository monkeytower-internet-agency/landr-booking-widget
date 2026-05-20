import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from '@/api/client'
import type { EstimateResponse, Product } from '@/api/types'
import PriceSidebar from './PriceSidebar'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    product_id: '00000000-0000-0000-0000-000000000001',
    slug: 'tandem-classic',
    name: 'Tandem Classic',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'time_slot',
    is_contiguous: false,
    duration_minutes: 25,
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
    ...overrides,
  }
}

const SAMPLE: EstimateResponse = {
  line_items: [
    {
      product_id: 'svc',
      label: 'Guided Day Dive',
      qty: 1,
      units: 3,
      unit_price: '60.00',
      line_total: '180.00',
      paid_to: 'operator',
    },
    {
      product_id: 'room',
      label: 'Single Room',
      qty: 1,
      units: 4,
      unit_price: '49.00',
      line_total: '196.00',
      paid_to: 'hotel',
    },
    {
      product_id: 'bf',
      label: 'Breakfast',
      qty: 2,
      units: 4,
      unit_price: '10.00',
      line_total: '80.00',
      paid_to: 'hotel',
    },
  ],
  operator_total: '180.00',
  hotel_total: '276.00',
  grand_total: '456.00',
  currency: 'EUR',
  applied_rules: [
    {
      kind: 'per_total_days_tier',
      detail: { days: 3, tier: { threshold_min: 3 } },
    },
  ],
}

describe('PriceSidebar (landr-qez0)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the operator/hotel split with grand total and a discount tag', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(SAMPLE)
    render(
      <PriceSidebar
        operatorSlug="para42"
        product={makeProduct()}
        selectedDays={['2026-05-23', '2026-05-24', '2026-05-25']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    await waitFor(() => {
      // grand total appears on both desktop and mobile renders
      expect(
        screen.getAllByTestId('price-sidebar-grand-total').length,
      ).toBeGreaterThan(0)
    })
    const desktop = screen.getByTestId('price-sidebar-desktop')
    expect(desktop).toHaveTextContent('Booking overview')
    expect(desktop).toHaveTextContent('You pay now')
    expect(desktop).toHaveTextContent('Pay at hotel')
    expect(desktop).toHaveTextContent('Guided Day Dive')
    expect(desktop).toHaveTextContent('Single Room')
    expect(desktop).toHaveTextContent('Breakfast')
    // Currency formatting comes through Intl — assert the digits/grand total
    expect(desktop).toHaveTextContent('456')
    expect(desktop).toHaveTextContent('Multi-day discount')
  })

  it('shows the "Calculating…" placeholder before the first response lands', () => {
    vi.spyOn(client, 'estimateBookingPrice').mockImplementation(
      () => new Promise(() => {}),
    )
    render(
      <PriceSidebar
        operatorSlug="para42"
        product={makeProduct()}
        selectedDays={['2026-05-23']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    expect(screen.getAllByText(/Calculating/).length).toBeGreaterThan(0)
  })

  it('renders only the operator section when no hotel-paid lines are present', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue({
      ...SAMPLE,
      line_items: SAMPLE.line_items.filter((li) => li.paid_to === 'operator'),
      hotel_total: '0.00',
      grand_total: '180.00',
      applied_rules: [],
    })
    render(
      <PriceSidebar
        operatorSlug="para42"
        product={makeProduct()}
        selectedDays={['2026-05-23', '2026-05-24', '2026-05-25']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    await waitFor(() => {
      expect(
        screen.getAllByTestId('price-sidebar-operator-section').length,
      ).toBeGreaterThan(0)
    })
    expect(screen.queryAllByTestId('price-sidebar-hotel-section')).toHaveLength(
      0,
    )
  })

  it('falls back to a friendly message when the API errors and no prior data exists', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockRejectedValue(
      new Error('500 boom'),
    )
    render(
      <PriceSidebar
        operatorSlug="para42"
        product={makeProduct()}
        selectedDays={['2026-05-23']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    await waitFor(() => {
      expect(
        screen.getAllByText(/your final total will be shown at confirmation/i)
          .length,
      ).toBeGreaterThan(0)
    })
  })
})
