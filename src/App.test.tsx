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

  describe('details step (landr-8c03, replacing landr-mbge participants count)', () => {
    async function pickProduct(name: string) {
      await waitFor(() => screen.getByText(name))
      const selectBtns = screen.getAllByRole('button', { name: 'Select' })
      fireEvent.click(selectBtns[0]!)
    }

    it('inserts a DetailsStep between pick-selection and fill-form for a service product with no hotel/pickup/addons', async () => {
      // single_date product, needs_pickup=false, hotel_offering='none'
      // → AFTER pick-selection the customer sees the details step,
      // NOT fill-form directly.
      const today = new Date()
      today.setHours(12, 0, 0, 0)
      mocks.listProducts.mockResolvedValue([
        makeProduct({
          product_kind: 'service',
          service_time_shape: 'single_date',
          name: 'Solo Lesson',
          needs_pickup: false,
          hotel_offering: 'none',
        }),
      ])
      // SingleDatePicker calls getAvailability — feed it one slot for today.
      mocks.getAvailability.mockResolvedValue([
        {
          availability_id: 'a-1',
          date: today.toISOString().slice(0, 10),
          start_time: null,
          end_time: null,
          capacity: 10,
          capacity_reserved: 0,
          available_seats: 10,
          status: 'open',
        },
      ])

      render(<App />)
      await pickProduct('Solo Lesson')

      // Land on SingleDatePicker.
      await waitFor(() =>
        expect(screen.getByText(/Pick a date/i)).toBeInTheDocument(),
      )

      // Pick the date cell + continue. The SingleDatePicker exposes a
      // button-grid via react-day-picker; clicking the date enables
      // Continue. We just click any enabled date cell, then Continue.
      const dayButtons = screen
        .getAllByRole('gridcell')
        .map((cell) => cell.querySelector('button'))
        .filter((b): b is HTMLButtonElement => !!b && !b.disabled)
      expect(dayButtons.length).toBeGreaterThan(0)
      fireEvent.click(dayButtons[0]!)

      const continueBtn = await screen.findByRole('button', {
        name: /continue/i,
      })
      fireEvent.click(continueBtn)

      // Now we should land on the DetailsStep — the booker contact
      // heading is the unambiguous marker.
      await waitFor(() =>
        expect(
          screen.getByText(/your contact details/i),
        ).toBeInTheDocument(),
      )

      // Fill in booker, click Continue → BookingForm (review screen).
      const bookerFirst = document.querySelector<HTMLInputElement>(
        'input[name="booker_first_name"]',
      )!
      const bookerLast = document.querySelector<HTMLInputElement>(
        'input[name="booker_last_name"]',
      )!
      const bookerEmail = document.querySelector<HTMLInputElement>(
        'input[name="booker_email"]',
      )!
      const bookerPhone = document.querySelector<HTMLInputElement>(
        'input[name="booker_phone"]',
      )!
      fireEvent.change(bookerFirst, { target: { value: 'Ada' } })
      fireEvent.change(bookerLast, { target: { value: 'Lovelace' } })
      fireEvent.change(bookerEmail, { target: { value: 'ada@example.com' } })
      fireEvent.change(bookerPhone, { target: { value: '+34 600000000' } })

      const detailsContinue = screen.getByRole('button', { name: /continue/i })
      fireEvent.click(detailsContinue)
      await waitFor(() =>
        expect(screen.getByText(/review your booking/i)).toBeInTheDocument(),
      )
    })

    // landr-b3g5: regression test — back-navigating from a downstream
    // step into the DetailsStep must restore the previously entered
    // booker + participants instead of wiping the form. The bug surfaced
    // because the App.tsx Back handlers reset the details step state to
    // { name: 'details', product, selection } — dropping booker and
    // participants — and DetailsStep had no way to recover them on
    // re-mount. The fix threads them through every Back transition and
    // hands them to DetailsStep as initialBooker / initialParticipants.
    it('restores booker + additional participants when back-navigating into DetailsStep', async () => {
      const today = new Date()
      today.setHours(12, 0, 0, 0)
      mocks.listProducts.mockResolvedValue([
        makeProduct({
          product_kind: 'service',
          service_time_shape: 'single_date',
          name: 'Solo Lesson',
          needs_pickup: false,
          hotel_offering: 'none',
        }),
      ])
      mocks.getAvailability.mockResolvedValue([
        {
          availability_id: 'a-1',
          date: today.toISOString().slice(0, 10),
          start_time: null,
          end_time: null,
          capacity: 10,
          capacity_reserved: 0,
          available_seats: 10,
          status: 'open',
        },
      ])

      render(<App />)
      await pickProduct('Solo Lesson')

      // SingleDatePicker → pick a date → Continue.
      await waitFor(() =>
        expect(screen.getByText(/Pick a date/i)).toBeInTheDocument(),
      )
      const dayButtons = screen
        .getAllByRole('gridcell')
        .map((cell) => cell.querySelector('button'))
        .filter((b): b is HTMLButtonElement => !!b && !b.disabled)
      fireEvent.click(dayButtons[0]!)
      fireEvent.click(
        await screen.findByRole('button', { name: /continue/i }),
      )

      // Land on DetailsStep — fill booker and add one extra participant.
      await waitFor(() =>
        expect(
          screen.getByText(/your contact details/i),
        ).toBeInTheDocument(),
      )
      const setInput = (name: string, value: string) =>
        fireEvent.change(
          document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!,
          { target: { value } },
        )
      setInput('booker_first_name', 'Ada')
      setInput('booker_last_name', 'Lovelace')
      setInput('booker_email', 'ada@example.com')
      setInput('booker_phone', '+34 600000000')
      fireEvent.click(
        screen.getByRole('button', { name: /add participant/i }),
      )
      setInput('participant_2_first_name', 'Grace')
      setInput('participant_2_last_name', 'Hopper')

      // Continue → BookingForm (review screen).
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))
      await waitFor(() =>
        expect(screen.getByText(/review your booking/i)).toBeInTheDocument(),
      )

      // Hit the top-left Back button on the BookingForm. The fill-form
      // Back path with needs_pickup=false + hotel_offering=none routes
      // straight back to DetailsStep.
      fireEvent.click(screen.getByTestId('step-back-button'))

      // We should be back on DetailsStep with every field restored.
      await waitFor(() =>
        expect(
          screen.getByText(/your contact details/i),
        ).toBeInTheDocument(),
      )
      const value = (name: string) =>
        document.querySelector<HTMLInputElement>(`input[name="${name}"]`)
          ?.value
      expect(value('booker_first_name')).toBe('Ada')
      expect(value('booker_last_name')).toBe('Lovelace')
      expect(value('booker_email')).toBe('ada@example.com')
      expect(value('booker_phone')).toBe('+34 600000000')
      // Additional participant row restored with both name fields filled.
      expect(value('participant_2_first_name')).toBe('Grace')
      expect(value('participant_2_last_name')).toBe('Hopper')
    })
  })

  // landr-yf0n: same pattern as landr-b3g5 (DetailsStep) but for the
  // downstream steps. PickupLocationPicker is the easiest to exercise
  // at the App level — the only extra mock it needs is listLocations,
  // already wired in the suite's beforeEach. The AccommodationStep +
  // ServiceAddonsStep paths require getHotelsForOperator /
  // getProductAddons mocks which the per-step tests already cover; this
  // App-level test just guards the App.tsx wiring for pick-pickup.
  describe('back-nav state restoration (landr-yf0n)', () => {
    async function pickProduct(name: string) {
      await waitFor(() => screen.getByText(name))
      const selectBtns = screen.getAllByRole('button', { name: 'Select' })
      fireEvent.click(selectBtns[0]!)
    }

    it('restores the PickupLocationPicker radio choice when back-navigating from fill-form', async () => {
      const today = new Date()
      today.setHours(12, 0, 0, 0)
      mocks.listProducts.mockResolvedValue([
        // needs_pickup=true + hotel_offering='none' → details → pickup
        // → fill-form. The Back button on fill-form must restore the
        // pickup choice.
        makeProduct({
          product_kind: 'service',
          service_time_shape: 'single_date',
          name: 'Tandem Flight',
          needs_pickup: true,
          hotel_offering: 'none',
        }),
      ])
      mocks.getAvailability.mockResolvedValue([
        {
          availability_id: 'a-1',
          date: today.toISOString().slice(0, 10),
          start_time: null,
          end_time: null,
          capacity: 10,
          capacity_reserved: 0,
          available_seats: 10,
          status: 'open',
        },
      ])
      mocks.listLocations.mockResolvedValue([
        {
          location_id: 'loc-a',
          name: 'Main Square',
          name_localized: null,
          parent_id: null,
          role_type: { code: 'pickup', label: 'Pickup' },
        },
        {
          location_id: 'loc-b',
          name: 'Beach Parking',
          name_localized: null,
          parent_id: null,
          role_type: { code: 'pickup', label: 'Pickup' },
        },
      ])

      render(<App />)
      await pickProduct('Tandem Flight')

      // SingleDatePicker → pick a date → Continue.
      await waitFor(() =>
        expect(screen.getByText(/Pick a date/i)).toBeInTheDocument(),
      )
      const dayButtons = screen
        .getAllByRole('gridcell')
        .map((cell) => cell.querySelector('button'))
        .filter((b): b is HTMLButtonElement => !!b && !b.disabled)
      fireEvent.click(dayButtons[0]!)
      fireEvent.click(
        await screen.findByRole('button', { name: /continue/i }),
      )

      // DetailsStep → fill booker → Continue.
      await waitFor(() =>
        expect(screen.getByText(/your contact details/i)).toBeInTheDocument(),
      )
      const setInput = (name: string, value: string) =>
        fireEvent.change(
          document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!,
          { target: { value } },
        )
      setInput('booker_first_name', 'Ada')
      setInput('booker_last_name', 'Lovelace')
      setInput('booker_email', 'ada@example.com')
      setInput('booker_phone', '+34 600000000')
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      // PickupLocationPicker → pick "Beach Parking" → Continue.
      await waitFor(() =>
        expect(screen.getByText('Beach Parking')).toBeInTheDocument(),
      )
      fireEvent.click(screen.getByRole('radio', { name: /Beach Parking/i }))
      fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

      // Land on fill-form (BookingForm review screen).
      await waitFor(() =>
        expect(screen.getByText(/review your booking/i)).toBeInTheDocument(),
      )

      // Click the top-left Back button — back to PickupLocationPicker.
      fireEvent.click(screen.getByTestId('step-back-button'))

      // The picker re-mounts with Beach Parking still selected.
      await waitFor(() =>
        expect(screen.getByText('Beach Parking')).toBeInTheDocument(),
      )
      const beach = screen.getByRole('radio', { name: /Beach Parking/i })
      expect(beach).toBeChecked()
      // Continue stays enabled — the restored selection counts as a pick.
      expect(
        screen.getByRole('button', { name: /Continue/i }),
      ).not.toBeDisabled()
    })
  })
})
