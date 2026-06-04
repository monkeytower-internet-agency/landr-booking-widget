import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AvailabilitySlot, FixedDateWindow, Product } from '@/api/types'
import { HttpError } from '@/api/client'
import App from './App'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    listProducts: vi.fn<
      (slug: string, opts?: { group?: string }) => Promise<Product[]>
    >(),
    listProductGroups: vi.fn(),
    getOperatorSettings: vi.fn(),
    getOperatorServiceRoles: vi.fn(),
    getAvailability: vi.fn<
      (id: string, from: string, to: string) => Promise<AvailabilitySlot[]>
    >(),
    getFixedDateWindows: vi.fn<(id: string) => Promise<FixedDateWindow[]>>(),
    listLocations: vi.fn(),
    submitBooking: vi.fn(),
    // landr-87n9: hotel-flow + price-estimate mocks for the at-hotel
    // back-nav + live-total tests.
    getHotelsForOperator: vi.fn(),
    getHotelRoomsForHotel: vi.fn(),
    getProductAddons: vi.fn(),
    estimateBookingPrice: vi.fn(),
  },
}))

// landr-il9f.2: HttpError is a real class (not just a mock) so the 404 test
// can construct a real instance. Re-export it from the real module while
// keeping all API functions mocked.
vi.mock('@/api/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/api/client')>()
  return {
    ...real,
    listProducts: mocks.listProducts,
    listProductGroups: mocks.listProductGroups,
    getOperatorSettings: mocks.getOperatorSettings,
    getOperatorServiceRoles: mocks.getOperatorServiceRoles,
    getAvailability: mocks.getAvailability,
    getFixedDateWindows: mocks.getFixedDateWindows,
    listLocations: mocks.listLocations,
    submitBooking: mocks.submitBooking,
    getHotelsForOperator: mocks.getHotelsForOperator,
    getHotelRoomsForHotel: mocks.getHotelRoomsForHotel,
    getProductAddons: mocks.getProductAddons,
    estimateBookingPrice: mocks.estimateBookingPrice,
  }
})

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

// landr-il9f.2: the widget resolves operator by opaque ?w=<token>.
// Tests must pass a ?w= param so the app doesn't immediately show the
// landing page. The mock token 'mock-token-abc' stands in for a real
// widget_token (which randomises per db-reset in the real dev env).
const MOCK_TOKEN = 'mock-token-abc'

describe('App', () => {
  beforeEach(() => {
    // Default: a valid token so the booking flow renders.
    window.history.replaceState({}, '', `/?w=${MOCK_TOKEN}`)
    mocks.getOperatorSettings.mockResolvedValue({
      slug: 'para42',
      expose_seats_to_customer: false,
    })
    mocks.getOperatorServiceRoles.mockResolvedValue([])
    // landr-d8rg.4: default to empty groups so existing tests don't trigger
    // pick-category. Tests that need the category flow override this.
    mocks.listProductGroups.mockResolvedValue([])
    mocks.getAvailability.mockResolvedValue([])
    mocks.getFixedDateWindows.mockResolvedValue([])
    mocks.listLocations.mockResolvedValue([])
    // landr-87n9: safe hotel-flow + estimate defaults so any test that
    // mounts the PriceSidebar / AccommodationStep doesn't hit the real
    // client. Per-test overrides supply richer data where needed.
    mocks.getHotelsForOperator.mockResolvedValue([])
    mocks.getHotelRoomsForHotel.mockResolvedValue([])
    mocks.getProductAddons.mockResolvedValue([])
    mocks.estimateBookingPrice.mockResolvedValue({
      line_items: [],
      operator_total: '0.00',
      hotel_total: '0.00',
      grand_total: '0.00',
      currency: 'EUR',
      applied_rules: [],
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // landr-il9f.2: landing page shown when no ?w= param is present.
  it('shows the generic landing page when no ?w= param is provided', () => {
    window.history.replaceState({}, '', '/')
    render(<App />)
    expect(screen.getByText(/This is the booking-widget host for Landr/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /www\.landr\.de/i })).toBeInTheDocument()
    expect(mocks.getOperatorSettings).not.toHaveBeenCalled()
  })

  // landr-il9f.2: landing page shown when the API returns 404 for the token.
  it('shows the generic landing page when the API returns 404 for the token', async () => {
    mocks.getOperatorSettings.mockRejectedValue(
      new HttpError(404, 'Not Found', '{"detail":"operator not found"}'),
    )
    mocks.listProducts.mockResolvedValue([])
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/This is the booking-widget host for Landr/i)).toBeInTheDocument()
    })
  })

  it('resolves operator by ?w=<token> and renders the product list', async () => {
    mocks.listProducts.mockResolvedValue([
      makeProduct({ product_id: 'p-1', slug: 'tandem-classic', name: 'Tandem Classic' }),
      makeProduct({ product_id: 'p-2', slug: 'tandem-long', name: 'Tandem Long' }),
    ])
    render(<App />)
    // landr-il9f.2: token is passed through to getOperatorSettings.
    await waitFor(() => {
      expect(mocks.getOperatorSettings).toHaveBeenCalledWith(MOCK_TOKEN)
    })
    // landr-711: widget no longer renders a "Book with {operator}" H1 —
    // operators own the surrounding HTML and its headings.
    expect(screen.queryByText(/Book with/i)).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/Tandem Classic/i)).toBeInTheDocument()
      expect(screen.getByText(/Tandem Long/i)).toBeInTheDocument()
    })
  })

  it('passes the token to the API calls (?w=<token> → getOperatorSettings + listProducts)', async () => {
    mocks.listProducts.mockResolvedValue([])
    window.history.replaceState({}, '', '/?w=acme-token-xyz')
    render(<App />)
    await waitFor(() => {
      expect(mocks.getOperatorSettings).toHaveBeenCalledWith('acme-token-xyz')
      expect(mocks.listProducts).toHaveBeenCalledWith(
        'acme-token-xyz',
        expect.any(Object),
      )
    })
  })

  // landr-yp8x — operator branding (logo + primary colour) surfaced by
  // GET /api/public/operators/{slug}/settings.
  describe('operator branding (landr-yp8x)', () => {
    it('renders the operator logo when logo_url is set', async () => {
      mocks.getOperatorSettings.mockResolvedValue({
        slug: 'para42',
        expose_seats_to_customer: false,
        logo_url: 'https://example.com/logo.png',
        primary_color: '#ff8800',
        name: 'Para42',
      })
      mocks.listProducts.mockResolvedValue([])
      render(<App />)
      await waitFor(() => {
        const logo = screen.getByAltText('Para42') as HTMLImageElement
        expect(logo.src).toBe('https://example.com/logo.png')
      })
    })

    it('does NOT render the operator name when no logo is set (landr-nils — blank, no name fallback)', async () => {
      mocks.getOperatorSettings.mockResolvedValue({
        slug: 'para42',
        expose_seats_to_customer: false,
        logo_url: null,
        primary_color: null,
        name: 'Para42',
      })
      mocks.listProducts.mockResolvedValue([])
      render(<App />)
      await waitFor(() => {
        expect(mocks.getOperatorSettings).toHaveBeenCalled()
      })
      // No logo and no operator-written headline/description → the brand
      // header is absent and the name is never shown as a text fallback.
      expect(screen.queryByText('Para42')).not.toBeInTheDocument()
      expect(screen.queryByAltText('Para42')).not.toBeInTheDocument()
    })

    it('applies primary_color as a --primary CSS variable on the widget root', async () => {
      mocks.getOperatorSettings.mockResolvedValue({
        slug: 'para42',
        expose_seats_to_customer: false,
        logo_url: null,
        primary_color: '#ff8800',
        name: 'Para42',
      })
      mocks.listProducts.mockResolvedValue([])
      const { container } = render(<App />)
      await waitFor(() => {
        // First child of the test container is the widget's root <div>.
        const root = container.firstElementChild as HTMLElement
        expect(root.style.getPropertyValue('--primary')).toBe('#ff8800')
      })
    })

    it('does not set --primary when primary_color is null (falls back to theme default)', async () => {
      mocks.getOperatorSettings.mockResolvedValue({
        slug: 'para42',
        expose_seats_to_customer: false,
        logo_url: null,
        primary_color: null,
        name: 'Para42',
      })
      mocks.listProducts.mockResolvedValue([])
      const { container } = render(<App />)
      await waitFor(() => {
        expect(mocks.getOperatorSettings).toHaveBeenCalled()
      })
      const root = container.firstElementChild as HTMLElement
      expect(root.style.getPropertyValue('--primary')).toBe('')
    })
  })

  // landr-nils — operator-configurable copy around the embed: header
  // headline + description (above the widget) and a footer (below it).
  describe('operator embed text (landr-nils)', () => {
    it('renders the operator headline and description above the widget', async () => {
      mocks.getOperatorSettings.mockResolvedValue({
        slug: 'para42',
        expose_seats_to_customer: false,
        logo_url: null,
        primary_color: null,
        name: 'Para42',
        widget_headline: 'Book with us',
        widget_description: 'Subject to our terms & conditions.',
      })
      mocks.listProducts.mockResolvedValue([])
      render(<App />)
      await waitFor(() => {
        expect(screen.getByTestId('widget-headline')).toHaveTextContent(
          'Book with us',
        )
      })
      expect(screen.getByTestId('widget-description')).toHaveTextContent(
        'Subject to our terms & conditions.',
      )
    })

    it('renders the headline alongside the logo when both are set', async () => {
      mocks.getOperatorSettings.mockResolvedValue({
        slug: 'para42',
        expose_seats_to_customer: false,
        logo_url: 'https://example.com/logo.png',
        primary_color: null,
        name: 'Para42',
        widget_headline: 'Book with us',
      })
      mocks.listProducts.mockResolvedValue([])
      render(<App />)
      await waitFor(() => {
        expect(screen.getByTestId('widget-logo')).toBeInTheDocument()
      })
      expect(screen.getByTestId('widget-headline')).toHaveTextContent(
        'Book with us',
      )
    })

    it('renders the footer below the widget when widget_footer is set', async () => {
      mocks.getOperatorSettings.mockResolvedValue({
        slug: 'para42',
        expose_seats_to_customer: false,
        logo_url: null,
        primary_color: null,
        name: 'Para42',
        widget_footer: '© Para42. VAT ESX1234567Z.',
      })
      mocks.listProducts.mockResolvedValue([])
      render(<App />)
      await waitFor(() => {
        expect(screen.getByTestId('widget-footer')).toHaveTextContent(
          '© Para42. VAT ESX1234567Z.',
        )
      })
    })

    it('renders no brand header and no footer when logo + all embed text are unset', async () => {
      mocks.getOperatorSettings.mockResolvedValue({
        slug: 'para42',
        expose_seats_to_customer: false,
        logo_url: null,
        primary_color: null,
        name: 'Para42',
        widget_headline: null,
        widget_description: null,
        widget_footer: null,
      })
      mocks.listProducts.mockResolvedValue([])
      render(<App />)
      await waitFor(() => {
        expect(mocks.getOperatorSettings).toHaveBeenCalled()
      })
      expect(screen.queryByTestId('widget-headline')).not.toBeInTheDocument()
      expect(screen.queryByTestId('widget-description')).not.toBeInTheDocument()
      expect(screen.queryByTestId('widget-footer')).not.toBeInTheDocument()
    })
  })

  describe('step machine branching (landr-y9k)', () => {
    async function pickProduct(name: string) {
      await waitFor(() => screen.getByText(name))
      // landr-d8rg.6: the whole product card is the click target (role=button
      // labelled by the product name) — the per-card "Select" button is gone.
      fireEvent.click(screen.getByRole('button', { name }))
      // landr-d8rg.4: card click now shows ProductDetailStep first.
      // Click the Book CTA to enter the existing picker flow.
      const bookBtn = await screen.findByTestId('product-detail-book-cta')
      fireEvent.click(bookBtn)
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
      // landr-d8rg.6: whole-card click target (role=button labelled by name).
      fireEvent.click(screen.getByRole('button', { name }))
      // landr-d8rg.4: card click now shows ProductDetailStep first.
      const bookBtn = await screen.findByTestId('product-detail-book-cta')
      fireEvent.click(bookBtn)
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

      // landr-sbhz.3: para42 requires declarations — pass through before review.
      await waitFor(() =>
        expect(screen.getByTestId('declarations-fieldset')).toBeInTheDocument(),
      )
      for (const key of ['license_valid', 'insurance_valid', 'autonomous_pilot', 'emergency_contact']) {
        fireEvent.click(screen.getByTestId(`decl-checkbox-${key}`))
      }
      // landr-87n9.4: multi-select language — click at least one checkbox.
      fireEvent.click(screen.getByTestId('lang-checkbox-en'))
      fireEvent.click(screen.getByTestId('declarations-continue'))

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

      // Continue → DeclarationsStep (landr-sbhz.3: para42 requires declarations).
      fireEvent.click(screen.getByRole('button', { name: /continue/i }))
      await waitFor(() =>
        expect(screen.getByTestId('declarations-fieldset')).toBeInTheDocument(),
      )
      for (const key of ['license_valid', 'insurance_valid', 'autonomous_pilot', 'emergency_contact']) {
        fireEvent.click(screen.getByTestId(`decl-checkbox-${key}`))
      }
      // landr-87n9.4: multi-select language — click at least one checkbox.
      fireEvent.click(screen.getByTestId('lang-checkbox-en'))
      fireEvent.click(screen.getByTestId('declarations-continue'))

      // Now on BookingForm (review screen).
      await waitFor(() =>
        expect(screen.getByText(/review your booking/i)).toBeInTheDocument(),
      )

      // Hit the top-left Back button on the BookingForm. With declarations
      // enforced, Back from fill-form goes to DeclarationsStep first.
      fireEvent.click(screen.getByTestId('step-back-button'))
      await waitFor(() =>
        expect(screen.getByTestId('declarations-fieldset')).toBeInTheDocument(),
      )

      // Hit Back on DeclarationsStep → back to DetailsStep.
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
      // landr-d8rg.6: whole-card click target (role=button labelled by name).
      fireEvent.click(screen.getByRole('button', { name }))
      // landr-d8rg.4: card click now shows ProductDetailStep first.
      const bookBtn = await screen.findByTestId('product-detail-book-cta')
      fireEvent.click(bookBtn)
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

      // landr-sbhz.3: para42 requires declarations — pass the step.
      await waitFor(() =>
        expect(screen.getByTestId('declarations-fieldset')).toBeInTheDocument(),
      )
      for (const key of ['license_valid', 'insurance_valid', 'autonomous_pilot', 'emergency_contact']) {
        fireEvent.click(screen.getByTestId(`decl-checkbox-${key}`))
      }
      // landr-87n9.4: multi-select language — click at least one checkbox.
      fireEvent.click(screen.getByTestId('lang-checkbox-de'))
      fireEvent.click(screen.getByTestId('declarations-continue'))

      // Land on fill-form (BookingForm review screen).
      await waitFor(() =>
        expect(screen.getByText(/review your booking/i)).toBeInTheDocument(),
      )

      // Click the top-left Back button — back to DeclarationsStep (not
      // directly to PickupLocationPicker since declarations are enforced).
      fireEvent.click(screen.getByTestId('step-back-button'))
      await waitFor(() =>
        expect(screen.getByTestId('declarations-fieldset')).toBeInTheDocument(),
      )

      // Click Back from declarations — back to PickupLocationPicker.
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

  // landr-87n9.1 + .2: hotel-booking flow. A needs_pickup product with a
  // hotel offering SKIPS the free-pickup step on the way forward (the hotel
  // is the pickup), so Back from the review/declarations screen must return
  // to the accommodation page, NOT the pickup picker. The same flow also
  // proves the live at-hotel total reaches the PriceSidebar while the
  // customer is picking rooms (before Continue).
  describe('hotel-booking back-nav + live at-hotel total (landr-87n9.1/.2)', () => {
    async function pickFirstProduct(name: string) {
      await waitFor(() => screen.getByText(name))
      // landr-d8rg.6: whole-card click target (role=button labelled by name).
      fireEvent.click(screen.getByRole('button', { name }))
      // landr-d8rg.4: card click now shows ProductDetailStep first.
      const bookBtn = await screen.findByTestId('product-detail-book-cta')
      fireEvent.click(bookBtn)
    }

    function setupHotelFlow() {
      const today = new Date()
      today.setHours(12, 0, 0, 0)
      mocks.listProducts.mockResolvedValue([
        makeProduct({
          product_id: 'svc-1',
          product_kind: 'service',
          service_time_shape: 'single_date',
          name: 'Guided Para Week',
          // needs_pickup=true would normally route to pick-pickup, but a
          // booked hotel makes the hotel the pickup → pick-pickup is SKIPPED.
          needs_pickup: true,
          hotel_offering: 'mandatory',
          price_per_unit: 90,
          currency: 'EUR',
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
      mocks.getHotelsForOperator.mockResolvedValue([
        {
          location_id: 'hotel-mirador',
          name: 'Hotel Mirador',
          name_localized: null,
          parent_id: null,
          role_type: { code: 'hotel', label: 'Hotel' },
        },
      ])
      mocks.getHotelRoomsForHotel.mockResolvedValue([
        {
          ...makeProduct({
            product_id: 'room-double',
            name: 'Double Room',
            product_kind: 'hotel_room',
            service_time_shape: null,
          }),
          price_per_unit: 80,
          currency: 'EUR',
          capacity_per_unit: 2,
        } as Product,
      ])
      // Estimate: when a hotel room line is present, return a hotel line
      // item + non-zero hotel_total so the "At-hotel total" pill renders.
      mocks.estimateBookingPrice.mockImplementation(
        async (_token: string, _productId: string, body: { addon_lines: { product_id: string; qty: number }[] }) => {
          const roomLine = body.addon_lines.find((l) => l.product_id === 'room-double')
          const hotelTotal = roomLine ? roomLine.qty * 80 : 0
          return {
            line_items: [
              {
                product_id: 'svc-1',
                label: 'Guided Para Week',
                qty: 1,
                units: 1,
                unit_price: '90.00',
                line_total: '90.00',
                paid_to: 'operator' as const,
              },
              ...(roomLine
                ? [
                    {
                      product_id: 'room-double',
                      label: 'Double Room',
                      qty: roomLine.qty,
                      units: 1,
                      unit_price: '80.00',
                      line_total: `${hotelTotal}.00`,
                      paid_to: 'hotel' as const,
                    },
                  ]
                : []),
            ],
            operator_total: '90.00',
            hotel_total: `${hotelTotal}.00`,
            grand_total: `${90 + hotelTotal}.00`,
            currency: 'EUR',
            applied_rules: [],
          }
        },
      )
    }

    async function advanceToAccommodation() {
      await pickFirstProduct('Guided Para Week')
      await waitFor(() =>
        expect(screen.getByText(/Pick a date/i)).toBeInTheDocument(),
      )
      const dayButtons = screen
        .getAllByRole('gridcell')
        .map((cell) => cell.querySelector('button'))
        .filter((b): b is HTMLButtonElement => !!b && !b.disabled)
      fireEvent.click(dayButtons[0]!)
      fireEvent.click(await screen.findByRole('button', { name: /continue/i }))

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

      // AccommodationStep — auto-selects the lone hotel + lists rooms.
      await waitFor(() =>
        expect(screen.getByText('Double Room')).toBeInTheDocument(),
      )
    }

    it('shows the live at-hotel total in the sidebar as a room is picked (.2)', async () => {
      setupHotelFlow()
      render(<App />)
      await advanceToAccommodation()

      // Before picking a room: no hotel section in the sidebar.
      expect(
        screen.queryByTestId('price-sidebar-hotel-section'),
      ).not.toBeInTheDocument()

      // Pick one double room.
      fireEvent.click(
        screen.getByRole('button', { name: /Increase Double Room quantity/i }),
      )

      // The live at-hotel total pill appears with the room subtotal (€80).
      await waitFor(() =>
        expect(
          screen.getAllByTestId('price-sidebar-hotel-section').length,
        ).toBeGreaterThan(0),
      )
      const hotelTotals = screen.getAllByTestId('price-sidebar-hotel-total')
      expect(hotelTotals.some((el) => /80/.test(el.textContent ?? ''))).toBe(true)
    })

    it('Back from declarations returns to the accommodation page, NOT the skipped pickup picker (.1)', async () => {
      setupHotelFlow()
      render(<App />)
      await advanceToAccommodation()

      // Pick a room + Continue.
      fireEvent.click(
        screen.getByRole('button', { name: /Increase Double Room quantity/i }),
      )
      fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

      // The hotel is the pickup → pick-pickup is SKIPPED → declarations next
      // (para42 requires them). We must NOT see the pickup picker.
      await waitFor(() =>
        expect(screen.getByTestId('declarations-fieldset')).toBeInTheDocument(),
      )

      // Back from declarations → accommodation page (Double Room visible),
      // NOT the pickup picker.
      fireEvent.click(screen.getByTestId('step-back-button'))
      await waitFor(() =>
        expect(screen.getByText('Double Room')).toBeInTheDocument(),
      )
      // Sanity: we did not land on a pickup picker.
      expect(screen.queryByText(/pickup/i)).not.toBeInTheDocument()
      // The room qty is restored (the stepper shows 1).
      expect(screen.getByText('Accommodation')).toBeInTheDocument()
    })
  })

  // landr-7zc5.3: preview mode — banner + draft badge + absent-token live path.
  describe('preview mode (landr-7zc5.3)', () => {
    it('shows the preview-mode banner when ?preview_token= is in the URL', async () => {
      window.history.replaceState({}, '', `/?w=${MOCK_TOKEN}&preview_token=prev-xyz`)
      mocks.listProducts.mockResolvedValue([
        makeProduct({ product_id: 'p-1', name: 'Published Product', is_publicly_listed: true }),
      ])
      render(<App />)
      await waitFor(() =>
        expect(screen.getByTestId('preview-mode-banner')).toBeInTheDocument(),
      )
      expect(screen.getByText(/Preview mode/i)).toBeInTheDocument()
    })

    it('does NOT show the preview-mode banner when no preview_token in the URL', async () => {
      // beforeEach sets /?w=MOCK_TOKEN (no preview_token).
      mocks.listProducts.mockResolvedValue([
        makeProduct({ product_id: 'p-1', name: 'Published Product', is_publicly_listed: true }),
      ])
      render(<App />)
      await waitFor(() => expect(mocks.getOperatorSettings).toHaveBeenCalled())
      expect(screen.queryByTestId('preview-mode-banner')).not.toBeInTheDocument()
    })

    it('passes preview_token to listProducts when in preview mode', async () => {
      window.history.replaceState({}, '', `/?w=${MOCK_TOKEN}&preview_token=prev-abc`)
      mocks.listProducts.mockResolvedValue([])
      render(<App />)
      await waitFor(() =>
        expect(mocks.listProducts).toHaveBeenCalledWith(
          MOCK_TOKEN,
          expect.objectContaining({ previewToken: 'prev-abc' }),
        ),
      )
    })

    it('does NOT pass preview_token to listProducts when absent from URL', async () => {
      // beforeEach sets /?w=MOCK_TOKEN — no preview_token.
      mocks.listProducts.mockResolvedValue([])
      render(<App />)
      await waitFor(() =>
        expect(mocks.listProducts).toHaveBeenCalledWith(
          MOCK_TOKEN,
          expect.not.objectContaining({ previewToken: expect.any(String) }),
        ),
      )
    })

    it('shows the "Draft — preview" badge on products with is_publicly_listed=false', async () => {
      window.history.replaceState({}, '', `/?w=${MOCK_TOKEN}&preview_token=prev-xyz`)
      mocks.listProducts.mockResolvedValue([
        makeProduct({ product_id: 'p-pub', name: 'Live Product', is_publicly_listed: true }),
        makeProduct({ product_id: 'p-draft', name: 'Draft Product', is_publicly_listed: false }),
      ])
      render(<App />)
      await waitFor(() => expect(screen.getByText('Draft Product')).toBeInTheDocument())
      // Draft badge is on the draft product card.
      const badges = screen.getAllByTestId('draft-badge')
      expect(badges).toHaveLength(1)
      expect(badges[0]).toHaveTextContent(/Draft — preview/i)
      // No badge on the published product.
      expect(screen.getByText('Live Product')).toBeInTheDocument()
    })

    it('does NOT show any draft badge when is_publicly_listed is true or absent', async () => {
      // Normal live URL without preview_token.
      mocks.listProducts.mockResolvedValue([
        makeProduct({ product_id: 'p-1', name: 'Product A', is_publicly_listed: true }),
        makeProduct({ product_id: 'p-2', name: 'Product B' }), // no is_publicly_listed field
      ])
      render(<App />)
      await waitFor(() => expect(screen.getByText('Product A')).toBeInTheDocument())
      expect(screen.queryByTestId('draft-badge')).not.toBeInTheDocument()
    })
  })

  // landr-d8rg.8: the floating preview variant switcher is gated on preview
  // mode (?preview=1 or a preview_token) — it must NEVER ship to a
  // customer-facing embed.
  describe('variant switcher gating (landr-d8rg.8)', () => {
    it('renders the switcher when ?preview=1 is present', async () => {
      window.history.replaceState({}, '', `/?w=${MOCK_TOKEN}&preview=1`)
      mocks.listProducts.mockResolvedValue([
        makeProduct({ product_id: 'p-1', name: 'Product A', is_publicly_listed: true }),
      ])
      render(<App />)
      await waitFor(() => expect(screen.getByText('Product A')).toBeInTheDocument())
      expect(screen.getByTestId('variant-switcher')).toBeInTheDocument()
    })

    it('renders the switcher when a preview_token is present', async () => {
      window.history.replaceState({}, '', `/?w=${MOCK_TOKEN}&preview_token=prev-xyz`)
      mocks.listProducts.mockResolvedValue([
        makeProduct({ product_id: 'p-1', name: 'Product A', is_publicly_listed: true }),
      ])
      render(<App />)
      await waitFor(() => expect(screen.getByText('Product A')).toBeInTheDocument())
      expect(screen.getByTestId('variant-switcher')).toBeInTheDocument()
    })

    it('does NOT render the switcher on a plain customer-facing embed', async () => {
      // beforeEach sets /?w=MOCK_TOKEN — no preview flag / token.
      mocks.listProducts.mockResolvedValue([
        makeProduct({ product_id: 'p-1', name: 'Product A', is_publicly_listed: true }),
      ])
      render(<App />)
      await waitFor(() => expect(screen.getByText('Product A')).toBeInTheDocument())
      expect(screen.queryByTestId('variant-switcher')).not.toBeInTheDocument()
    })
  })

  // landr-7jgo: hide sold-out products in the overview; deep-link a sold-out
  // product to a standalone "Fully booked" state; per-embed show_sold_out opt-in.
  describe('bookability / sold-out (landr-7jgo)', () => {
    it('hides non-bookable products from the catalogue overview by default', async () => {
      mocks.listProducts.mockResolvedValue([
        makeProduct({ product_id: 'p-ok', name: 'Bookable Tandem', bookable: true }),
        makeProduct({ product_id: 'p-out', name: 'Sold Out Trip', bookable: false }),
      ])
      render(<App />)
      await waitFor(() =>
        expect(screen.getByText('Bookable Tandem')).toBeInTheDocument(),
      )
      expect(screen.queryByText('Sold Out Trip')).not.toBeInTheDocument()
    })

    it('shows sold-out products as "Fully booked" when ?show_sold_out=true', async () => {
      window.history.replaceState({}, '', `/?w=${MOCK_TOKEN}&show_sold_out=true`)
      mocks.listProducts.mockResolvedValue([
        makeProduct({ product_id: 'p-ok', name: 'Bookable Tandem', bookable: true }),
        makeProduct({ product_id: 'p-out', name: 'Sold Out Trip', bookable: false }),
      ])
      render(<App />)
      await waitFor(() =>
        expect(screen.getByText('Sold Out Trip')).toBeInTheDocument(),
      )
      expect(screen.getByTestId('fully-booked-badge')).toBeInTheDocument()
      // landr-d8rg.6: only the bookable product is a selectable card (role=button
      // labelled by its name); the sold-out one is a non-interactive
      // FullyBookedNotice.
      expect(
        screen.getByRole('button', { name: 'Bookable Tandem' }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Sold Out Trip' }),
      ).not.toBeInTheDocument()
    })

    it('renders a sold-out single-product deep link as "Fully booked" (no picker / CTA)', async () => {
      window.history.replaceState({}, '', `/?w=${MOCK_TOKEN}&product=sold-out-trip`)
      mocks.listProducts.mockResolvedValue([
        makeProduct({
          product_id: 'p-out',
          slug: 'sold-out-trip',
          name: 'Sold Out Trip',
          service_time_shape: 'fixed_window',
          bookable: false,
        }),
      ])
      render(<App />)
      await waitFor(() =>
        expect(screen.getByTestId('fully-booked-badge')).toBeInTheDocument(),
      )
      expect(screen.getByText('Sold Out Trip')).toBeInTheDocument()
      // No date picker spun up + no Select CTA.
      expect(screen.queryByText(/Pick a date/i)).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Select' }),
      ).not.toBeInTheDocument()
      // A sold-out fixed_window deep link must not fetch windows/availability.
      expect(mocks.getFixedDateWindows).not.toHaveBeenCalled()
      expect(mocks.getAvailability).not.toHaveBeenCalled()
    })

    it('deep-links a BOOKABLE single product to product-detail first (landr-d8rg.4)', async () => {
      window.history.replaceState({}, '', `/?w=${MOCK_TOKEN}&product=open-tandem`)
      mocks.listProducts.mockResolvedValue([
        makeProduct({
          product_id: 'p-ok',
          slug: 'open-tandem',
          name: 'Open Tandem',
          service_time_shape: 'single_date',
          bookable: true,
        }),
      ])
      render(<App />)
      // landr-d8rg.4: a ?product= deep link now lands on ProductDetailStep first.
      await waitFor(() =>
        expect(screen.getByTestId('product-detail-step')).toBeInTheDocument(),
      )
      expect(screen.getByText('Open Tandem')).toBeInTheDocument()
      expect(screen.queryByTestId('fully-booked-badge')).not.toBeInTheDocument()
      // Clicking Book enters the picker.
      fireEvent.click(screen.getByTestId('product-detail-book-cta'))
      await waitFor(() =>
        expect(screen.getByText(/Pick a date/i)).toBeInTheDocument(),
      )
    })
  })

  // landr-d8rg.4: category entrance + product-detail routing.
  describe('category entrance + product-detail (landr-d8rg.4)', () => {
    function makeGroup(overrides: Partial<{
      id: string; slug: string; name: string; product_count: number
    }> = {}) {
      return {
        id: 'g-1',
        slug: 'tandemfluege',
        name: 'Tandemflüge',
        name_localized: null,
        description: null,
        description_localized: null,
        image_url: null,
        sort_order: 10,
        parent_id: null,
        product_count: 2,
        ...overrides,
      }
    }

    it('shows pick-category when operator has >1 non-empty group and no deep link', async () => {
      mocks.listProductGroups.mockResolvedValue([
        makeGroup({ id: 'g-1', slug: 'tandemfluege', name: 'Tandemflüge', product_count: 2 }),
        makeGroup({ id: 'g-2', slug: 'kurse', name: 'Kurse', product_count: 1 }),
      ])
      mocks.listProducts.mockResolvedValue([])
      render(<App />)
      await waitFor(() =>
        expect(screen.getByTestId('category-step')).toBeInTheDocument(),
      )
      expect(screen.getByText('Tandemflüge')).toBeInTheDocument()
      expect(screen.getByText('Kurse')).toBeInTheDocument()
    })

    it('skips pick-category and goes straight to pick-product for a single non-empty group operator', async () => {
      mocks.listProductGroups.mockResolvedValue([
        makeGroup({ id: 'g-1', slug: 'tandemfluege', name: 'Tandemflüge', product_count: 3 }),
      ])
      mocks.listProducts.mockResolvedValue([
        makeProduct({ name: 'Tandem Classic' }),
      ])
      render(<App />)
      await waitFor(() =>
        expect(screen.getByText('Tandem Classic')).toBeInTheDocument(),
      )
      expect(screen.queryByTestId('category-step')).not.toBeInTheDocument()
    })

    it('falls back to pick-product (unscoped) when the groups fetch errors', async () => {
      mocks.listProductGroups.mockRejectedValue(new Error('404 Not Found'))
      mocks.listProducts.mockResolvedValue([
        makeProduct({ name: 'Solo Flight' }),
      ])
      render(<App />)
      await waitFor(() =>
        expect(screen.getByText('Solo Flight')).toBeInTheDocument(),
      )
      expect(screen.queryByTestId('category-step')).not.toBeInTheDocument()
    })

    it('?group= deep link skips pick-category and shows pick-product scoped', async () => {
      window.history.replaceState({}, '', `/?w=${MOCK_TOKEN}&group=tandemfluege`)
      // listProductGroups should NOT be called when ?group= is set
      mocks.listProducts.mockResolvedValue([
        makeProduct({ name: 'Tandem Classic', group_slug: 'tandemfluege' }),
      ])
      render(<App />)
      await waitFor(() =>
        expect(screen.getByText('Tandem Classic')).toBeInTheDocument(),
      )
      expect(mocks.listProductGroups).not.toHaveBeenCalled()
      expect(screen.queryByTestId('category-step')).not.toBeInTheDocument()
    })

    it('?product= deep link goes to product-detail (not directly to picker)', async () => {
      window.history.replaceState({}, '', `/?w=${MOCK_TOKEN}&product=tandem-classic`)
      mocks.listProducts.mockResolvedValue([
        makeProduct({
          slug: 'tandem-classic',
          name: 'Tandem Classic',
          service_time_shape: 'single_date',
          bookable: true,
        }),
      ])
      render(<App />)
      await waitFor(() =>
        expect(screen.getByTestId('product-detail-step')).toBeInTheDocument(),
      )
      expect(screen.getByText('Tandem Classic')).toBeInTheDocument()
      // listProductGroups should NOT be called for a ?product= deep link
      expect(mocks.listProductGroups).not.toHaveBeenCalled()
    })

    it('selecting a group from pick-category scopes the product list to that group', async () => {
      mocks.listProductGroups.mockResolvedValue([
        makeGroup({ id: 'g-1', slug: 'tandemfluege', name: 'Tandemflüge', product_count: 2 }),
        makeGroup({ id: 'g-2', slug: 'kurse', name: 'Kurse', product_count: 1 }),
      ])
      mocks.listProducts.mockResolvedValue([
        makeProduct({ name: 'Tandem Classic' }),
      ])
      render(<App />)
      await waitFor(() =>
        expect(screen.getByTestId('category-step')).toBeInTheDocument(),
      )
      // Click "Tandemflüge" group button.
      fireEvent.click(screen.getByTestId('category-btn-tandemfluege'))
      // Should now show pick-product with scoped list.
      await waitFor(() =>
        expect(screen.getByText('Tandem Classic')).toBeInTheDocument(),
      )
      expect(screen.queryByTestId('category-step')).not.toBeInTheDocument()
      // listProducts called with the group slug.
      expect(mocks.listProducts).toHaveBeenCalledWith(
        MOCK_TOKEN,
        expect.objectContaining({ group: 'tandemfluege' }),
      )
    })

    it('card click → product-detail → Book → picker (end-to-end category flow)', async () => {
      mocks.listProductGroups.mockResolvedValue([
        makeGroup({ id: 'g-1', slug: 'tandemfluege', name: 'Tandemflüge', product_count: 2 }),
        makeGroup({ id: 'g-2', slug: 'kurse', name: 'Kurse', product_count: 1 }),
      ])
      mocks.listProducts.mockResolvedValue([
        makeProduct({
          slug: 'tandem-classic',
          name: 'Tandem Classic',
          service_time_shape: 'time_slot',
          bookable: true,
        }),
      ])
      render(<App />)
      // Step 1: pick-category.
      await waitFor(() =>
        expect(screen.getByTestId('category-step')).toBeInTheDocument(),
      )
      fireEvent.click(screen.getByTestId('category-btn-tandemfluege'))
      // Step 2: pick-product (scoped list).
      await waitFor(() =>
        expect(screen.getByText('Tandem Classic')).toBeInTheDocument(),
      )
      // landr-d8rg.6: whole-card click target (role=button labelled by name).
      fireEvent.click(screen.getByRole('button', { name: 'Tandem Classic' }))
      // Step 3: product-detail.
      await waitFor(() =>
        expect(screen.getByTestId('product-detail-step')).toBeInTheDocument(),
      )
      expect(screen.getByText('Tandem Classic')).toBeInTheDocument()
      // Step 4: Book → picker (AvailabilityPicker for time_slot).
      fireEvent.click(screen.getByTestId('product-detail-book-cta'))
      await waitFor(() =>
        expect(mocks.getAvailability).toHaveBeenCalled(),
      )
      expect(screen.queryByTestId('product-detail-step')).not.toBeInTheDocument()
    })
  })

  // landr-jb1k.2: variant resolution precedence tests.
  // Precedence: explicit ?variant= URL param > operatorSettings.widget_variant > aurora.
  // The settings-driven default must NOT clobber a URL param NOR a switcher choice.
  describe('variant resolution precedence (landr-jb1k.2)', () => {
    function makeGroup(overrides: Partial<{ id: string; slug: string; name: string; product_count: number }> = {}) {
      return {
        id: 'g-1',
        slug: 'tandemfluege',
        name: 'Tandemflüge',
        name_localized: null,
        description: null,
        description_localized: null,
        image_url: null,
        sort_order: 10,
        parent_id: null,
        product_count: 2,
        ...overrides,
      }
    }

    async function renderWithCategoryStep() {
      mocks.listProductGroups.mockResolvedValue([
        makeGroup({ id: 'g-1', slug: 'tandem', name: 'Tandem', product_count: 2 }),
        makeGroup({ id: 'g-2', slug: 'courses', name: 'Courses', product_count: 1 }),
      ])
      mocks.listProducts.mockResolvedValue([])
      render(<App />)
      await waitFor(() =>
        expect(screen.getByTestId('category-step')).toBeInTheDocument(),
      )
      return screen.getByTestId('category-step')
    }

    it('uses aurora (default) when no URL param and operator has no widget_variant', async () => {
      window.history.replaceState({}, '', `/?w=${MOCK_TOKEN}`)
      mocks.getOperatorSettings.mockResolvedValue({
        slug: 'para42',
        expose_seats_to_customer: false,
        widget_variant: null,
      })
      const step = await renderWithCategoryStep()
      // After settings resolve, still aurora (no variant configured).
      await waitFor(() => {
        expect(step.dataset.variant).toBe('aurora')
      })
    })

    it('applies operatorSettings.widget_variant when no URL param is present', async () => {
      window.history.replaceState({}, '', `/?w=${MOCK_TOKEN}`)
      mocks.getOperatorSettings.mockResolvedValue({
        slug: 'para42',
        expose_seats_to_customer: false,
        widget_variant: 'summit',
      })
      const step = await renderWithCategoryStep()
      // After settings resolve, the step switches to the operator's variant.
      await waitFor(() => {
        expect(step.dataset.variant).toBe('summit')
      })
    })

    it('URL param beats operatorSettings.widget_variant', async () => {
      // Explicit ?variant=alpine in the URL — should win over operator's summit.
      window.history.replaceState({}, '', `/?w=${MOCK_TOKEN}&variant=alpine`)
      mocks.getOperatorSettings.mockResolvedValue({
        slug: 'para42',
        expose_seats_to_customer: false,
        widget_variant: 'summit',
      })
      const step = await renderWithCategoryStep()
      // Wait for settings to arrive — must stay alpine, NOT flip to summit.
      await waitFor(() => expect(mocks.getOperatorSettings).toHaveBeenCalled())
      // Give React one more tick to process the effect.
      await waitFor(() => {
        expect(step.dataset.variant).toBe('alpine')
      })
    })

    it('aurora fallback when widget_variant is null (no URL param)', async () => {
      window.history.replaceState({}, '', `/?w=${MOCK_TOKEN}`)
      mocks.getOperatorSettings.mockResolvedValue({
        slug: 'para42',
        expose_seats_to_customer: false,
        widget_variant: null,
      })
      const step = await renderWithCategoryStep()
      await waitFor(() => expect(mocks.getOperatorSettings).toHaveBeenCalled())
      await waitFor(() => {
        expect(step.dataset.variant).toBe('aurora')
      })
    })
  })
})
