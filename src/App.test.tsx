import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AvailabilitySlot, FixedDateWindow, Product } from '@/api/types'
import App from './App'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    listProducts: vi.fn<
      (slug: string, opts?: { group?: string }) => Promise<Product[]>
    >(),
    getOperatorSettings: vi.fn(),
    getAvailability: vi.fn<
      (id: string, from: string, to: string) => Promise<AvailabilitySlot[]>
    >(),
    getFixedDateWindows: vi.fn<(id: string) => Promise<FixedDateWindow[]>>(),
    listLocations: vi.fn(),
    submitBooking: vi.fn(),
  },
}))

vi.mock('@/api/client', () => ({
  listProducts: mocks.listProducts,
  getOperatorSettings: mocks.getOperatorSettings,
  getAvailability: mocks.getAvailability,
  getFixedDateWindows: mocks.getFixedDateWindows,
  listLocations: mocks.listLocations,
  submitBooking: mocks.submitBooking,
}))

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    product_id: 'p-1',
    slug: 'p-1',
    name: 'Test Product',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'time_slot',
    is_contiguous: false,
    duration_minutes: 30,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: null,
    group_slug: null,
    group_name: null,
    sort_order: 0,
    sport_subcategory_codes: [],
    location_ids: [],
    needs_pickup: false,
    ...overrides,
  }
}

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    mocks.getOperatorSettings.mockResolvedValue({
      slug: 'para42',
      expose_seats_to_customer: false,
    })
    mocks.getAvailability.mockResolvedValue([])
    mocks.getFixedDateWindows.mockResolvedValue([])
    mocks.listLocations.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the product list for the default operator (landr-711: no widget headline)', async () => {
    mocks.listProducts.mockResolvedValue([
      makeProduct({ product_id: 'p-1', slug: 'tandem-classic', name: 'Tandem Classic' }),
      makeProduct({ product_id: 'p-2', slug: 'tandem-long', name: 'Tandem Long' }),
    ])
    render(<App />)
    // landr-711: widget no longer renders a "Book with {operator}" H1 —
    // operators own the surrounding HTML and its headings.
    expect(screen.queryByText(/Book with/i)).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/Tandem Classic/i)).toBeInTheDocument()
      expect(screen.getByText(/Tandem Long/i)).toBeInTheDocument()
    })
  })

  it('honours ?operator= override by fetching that operator\'s products + settings', async () => {
    mocks.listProducts.mockResolvedValue([])
    window.history.replaceState({}, '', '/?operator=acme')
    render(<App />)
    await waitFor(() => {
      expect(mocks.getOperatorSettings).toHaveBeenCalledWith('acme')
      expect(mocks.listProducts).toHaveBeenCalledWith(
        'acme',
        expect.any(Object),
      )
    })
  })

  describe('step machine branching (landr-y9k)', () => {
    async function pickProduct(name: string) {
      await waitFor(() => screen.getByText(name))
      // Find the Select button inside the matching Card; just click the
      // first Select since each test only seeds one product.
      const selectBtns = screen.getAllByRole('button', { name: 'Select' })
      fireEvent.click(selectBtns[0]!)
    }

    it('product_kind=service + service_time_shape=time_slot → AvailabilityPicker', async () => {
      mocks.listProducts.mockResolvedValue([
        makeProduct({
          product_kind: 'service',
          service_time_shape: 'time_slot',
          name: 'Tandem Flight',
        }),
      ])
      render(<App />)
      await pickProduct('Tandem Flight')
      await waitFor(() => {
        // AvailabilityPicker renders its own heading; smoke test by looking
        // for the back button + lack of the stub testid.
        expect(
          screen.queryByTestId('shop-coming-soon-stub'),
        ).not.toBeInTheDocument()
        expect(mocks.getAvailability).toHaveBeenCalled()
      })
    })

    it('product_kind=service + service_time_shape=fixed_window → FixedDateWindowPicker', async () => {
      mocks.listProducts.mockResolvedValue([
        makeProduct({
          product_kind: 'service',
          service_time_shape: 'fixed_window',
          name: 'SIV Course',
        }),
      ])
      render(<App />)
      await pickProduct('SIV Course')
      await waitFor(() => {
        expect(mocks.getFixedDateWindows).toHaveBeenCalled()
      })
    })

    it('product_kind=service + service_time_shape=days_range → MultiDayStep', async () => {
      mocks.listProducts.mockResolvedValue([
        makeProduct({
          product_kind: 'service',
          service_time_shape: 'days_range',
          name: 'Hotel Stay',
        }),
      ])
      render(<App />)
      await pickProduct('Hotel Stay')
      await waitFor(() => {
        expect(screen.getByText(/Pick your dates/i)).toBeInTheDocument()
        expect(mocks.getAvailability).toHaveBeenCalled()
      })
    })

    it('product_kind=service + service_time_shape=single_date → SingleDatePicker', async () => {
      mocks.listProducts.mockResolvedValue([
        makeProduct({
          product_kind: 'service',
          service_time_shape: 'single_date',
          name: 'Equipment Rental',
        }),
      ])
      render(<App />)
      await pickProduct('Equipment Rental')
      await waitFor(() => {
        expect(screen.getByText(/Pick a date/i)).toBeInTheDocument()
        expect(mocks.getAvailability).toHaveBeenCalled()
      })
    })

    it('product_kind=digital_good → ShopComingSoonStub', async () => {
      mocks.listProducts.mockResolvedValue([
        makeProduct({
          product_kind: 'digital_good',
          service_time_shape: null,
          name: 'PDF Guide',
        }),
      ])
      render(<App />)
      await pickProduct('PDF Guide')
      await waitFor(() => {
        expect(screen.getByTestId('shop-coming-soon-stub')).toBeInTheDocument()
        expect(screen.getByText(/Shop, which is coming soon/i)).toBeInTheDocument()
      })
    })

    it('product_kind=gift_card → ShopComingSoonStub', async () => {
      mocks.listProducts.mockResolvedValue([
        makeProduct({
          product_kind: 'gift_card',
          service_time_shape: null,
          name: '50 EUR Gift Card',
        }),
      ])
      render(<App />)
      await pickProduct('50 EUR Gift Card')
      await waitFor(() => {
        expect(screen.getByTestId('shop-coming-soon-stub')).toBeInTheDocument()
      })
    })

    it('product_kind=physical_good → ShopComingSoonStub', async () => {
      mocks.listProducts.mockResolvedValue([
        makeProduct({
          product_kind: 'physical_good',
          service_time_shape: null,
          name: 'Branded Wing',
        }),
      ])
      render(<App />)
      await pickProduct('Branded Wing')
      await waitFor(() => {
        expect(screen.getByTestId('shop-coming-soon-stub')).toBeInTheDocument()
      })
    })
  })
})
