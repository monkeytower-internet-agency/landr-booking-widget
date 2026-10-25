/**
 * Standalone stay, App-level walk with a mocked API: the range picker →
 * participants → add-ons (priced per guest per night) → review → submit. The
 * stay line and its add-on are both submitted with the stay's NIGHT LIST, and
 * the price sidebar shows nights × rate plus the cleaning fee.
 */
import { fillBillingFields } from '@/test/fillBilling'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EstimateResponse, Product, ProductAddon } from '@/api/types'
import App from '@/App'
import { startOfToday } from './calendarStart'
import { dateFromIso, isoDate } from './dateUtils'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    listProducts: vi.fn(),
    listProductGroups: vi.fn(),
    getOperatorSettings: vi.fn(),
    getOperatorServiceRoles: vi.fn(),
    getAvailability: vi.fn(),
    getFixedDateWindows: vi.fn(),
    getProductAlternatives: vi.fn(),
    listLocations: vi.fn(),
    listPickupLocationsForOperator: vi.fn(),
    submitBooking: vi.fn(),
    getHotelsForOperator: vi.fn(),
    getHotelRoomsForHotel: vi.fn(),
    getProductAddons: vi.fn(),
    estimateBookingPrice: vi.fn(),
    getProductFlow: vi.fn(),
  },
}))

vi.mock('@/api/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/api/client')>()
  return { ...real, ...mocks }
})

const TOKEN = 'mock-token-stay'
const SLOW_FLOW = { timeout: 8000 }
vi.setConfig({ testTimeout: 30_000 })

const TODAY = isoDate(startOfToday())
const addDays = (iso: string, n: number) => {
  const d = dateFromIso(iso)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}
const CHECK_IN = addDays(TODAY, 3)
const CHECK_OUT = addDays(TODAY, 6)
const NIGHTS = [CHECK_IN, addDays(TODAY, 4), addDays(TODAY, 5)]

const stay: Product = {
  product_id: 'p-stay',
  slug: 'sea-view',
  name: 'Sea view apartment',
  name_localized: null,
  short_description: null,
  short_description_localized: null,
  description: null,
  product_kind: 'stay',
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
  needs_pickup: true,
  hotel_offering: 'none',
  bookable: true,
  guide_languages: null,
  stay: {
    min_nights: 2,
    max_nights: null,
    cleaning_fee_cents: 4000,
    check_in_time: '15:00',
    check_out_time: '11:00',
    sleeps: 2,
  },
} as Product

const breakfast: ProductAddon = {
  product_addon_id: 'pa-1',
  addon_product_id: 'p-breakfast',
  name: 'Breakfast',
  name_localized: null,
  is_required: false,
  min_qty: 0,
  max_qty: null,
  sort_order: 0,
  price_per_unit: 12,
  currency: 'EUR',
  product_kind: 'service',
  addon_quantity_rule: 'one_per_booking',
  price_unit: 'guest_night',
}

const estimate: EstimateResponse = {
  line_items: [
    {
      product_id: 'p-stay', label: 'Sea view apartment', qty: 1, units: 3,
      unit_price: '90.00', line_total: '310.00', paid_to: 'operator', cleaning_fee: '40.00',
    },
    {
      product_id: 'p-breakfast', label: 'Breakfast', qty: 1, units: 3,
      unit_price: '12.00', line_total: '36.00', paid_to: 'operator', price_unit: 'guest_night',
    },
  ],
  operator_total: '346.00',
  hotel_total: '0.00',
  grand_total: '346.00',
  currency: 'EUR',
  applied_rules: [],
  warnings: [],
  un_priceable: false,
  stay: { check_in: CHECK_IN, check_out: CHECK_OUT, nights: 3, cleaning_fee: '40.00', errors: [] },
}

function nightRows() {
  return Array.from({ length: 60 }, (_, i) => ({
    availability_id: null,
    date: addDays(TODAY, i),
    start_time: '15:00:00',
    end_time: '11:00:00',
    capacity: 2,
    capacity_reserved: 0,
    available_seats: 2,
    status: 'open',
    activity_bookable: true,
  }))
}

async function clickDay(iso: string) {
  for (let i = 0; i < 3; i += 1) {
    const btn = document.querySelector<HTMLButtonElement>(
      `button[data-day="${dateFromIso(iso).toLocaleDateString()}"]`,
    )
    if (btn) {
      fireEvent.click(btn)
      return
    }
    fireEvent.click(screen.getByRole('button', { name: /next month/i }))
  }
  throw new Error(`no day button for ${iso}`)
}

beforeEach(() => {
  window.sessionStorage.clear()
  mocks.getOperatorSettings.mockResolvedValue({ slug: 'seaside', expose_seats_to_customer: false })
  mocks.getOperatorServiceRoles.mockResolvedValue([])
  mocks.listProductGroups.mockResolvedValue([])
  mocks.getAvailability.mockResolvedValue(nightRows())
  mocks.getFixedDateWindows.mockResolvedValue([])
  mocks.getProductAlternatives.mockResolvedValue([])
  mocks.listLocations.mockResolvedValue([])
  mocks.listPickupLocationsForOperator.mockResolvedValue([])
  mocks.getHotelsForOperator.mockResolvedValue([])
  mocks.getHotelRoomsForHotel.mockResolvedValue([])
  mocks.getProductAddons.mockResolvedValue([breakfast])
  mocks.getProductFlow.mockResolvedValue({ modules: null })
  mocks.estimateBookingPrice.mockResolvedValue(estimate)
  mocks.listProducts.mockResolvedValue([stay])
  mocks.submitBooking.mockResolvedValue({
    booking_id: '00000000-0000-0000-0000-0000000000cc',
    status: 'confirmed',
    share_secret: 's',
  })
  window.history.replaceState({}, '', `/?w=${TOKEN}&product=sea-view&start=dates`)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('standalone stay booking flow', () => {
  it('range → participants → add-ons → review submits the night list on both lines', async () => {
    render(<App />)
    await screen.findByText(/choose your dates/i, undefined, SLOW_FLOW)
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
    await waitFor(
      () =>
        expect(
          document.querySelector(`button[data-day="${dateFromIso(TODAY).toLocaleDateString()}"]`),
        ).not.toBeNull(),
      SLOW_FLOW,
    )
    await clickDay(CHECK_IN)
    await clickDay(CHECK_OUT)
    const pickerContinue = screen.getByTestId('stay-picker-submit')
    await waitFor(() => expect(pickerContinue).toBeEnabled())
    fireEvent.click(pickerContinue)

    await screen.findByText(/your contact details/i, undefined, SLOW_FLOW)
    const setInput = (name: string, value: string) =>
      fireEvent.change(document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!, {
        target: { value },
      })
    setInput('booker_first_name', 'Ada')
    setInput('booker_last_name', 'Lovelace')
    setInput('booker_email', 'ada@example.com')
    setInput('booker_phone', '+34 600000000')
    fillBillingFields()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    // No pickup and no guide-language step for a stay: straight to add-ons.
    const addonRow = await screen.findByTestId('addon-row-p-breakfast', undefined, SLOW_FLOW)
    expect(addonRow).toHaveTextContent('/ guest / night')
    fireEvent.click(screen.getByRole('button', { name: /increase.*breakfast/i }))
    fireEvent.click(screen.getByTestId('addons-step-submit'))

    await screen.findByText(/review your booking/i, undefined, SLOW_FLOW)
    expect(screen.queryByTestId('participant-language-board')).not.toBeInTheDocument()
    expect((await screen.findAllByTestId('price-sidebar-cleaning-fee'))[0]).toHaveTextContent(
      /Cleaning fee/,
    )
    expect(screen.getAllByTestId('price-sidebar-addon-units')[0]).toHaveTextContent(
      '/ guest / night',
    )
    fireEvent.click(screen.getByRole('button', { name: /confirm booking/i }))

    await waitFor(() => expect(mocks.submitBooking).toHaveBeenCalled(), SLOW_FLOW)
    const body = mocks.submitBooking.mock.calls[0]![0] as {
      products: Array<{ product_id: string; selected_days: string[] }>
      participants: Array<{ language?: string | null }>
    }
    const byId = Object.fromEntries(body.products.map((p) => [p.product_id, p]))
    expect(byId['p-stay']!.selected_days).toEqual(NIGHTS)
    expect(byId['p-breakfast']!.selected_days).toEqual(NIGHTS)
    // The guest carries the customer's own language (no guide to choose).
    expect(body.participants[0]!.language).toBe('en')
  })

  it('a stay error from the estimate blocks Confirm', async () => {
    mocks.getProductAddons.mockResolvedValue([])
    mocks.estimateBookingPrice.mockResolvedValue({
      ...estimate,
      line_items: [estimate.line_items[0]!],
      stay: { ...estimate.stay!, errors: [{ code: 'night_unavailable', date: NIGHTS[1] }] },
    })
    render(<App />)
    await screen.findByText(/choose your dates/i, undefined, SLOW_FLOW)
    await waitFor(
      () =>
        expect(
          document.querySelector(`button[data-day="${dateFromIso(TODAY).toLocaleDateString()}"]`),
        ).not.toBeNull(),
      SLOW_FLOW,
    )
    await clickDay(CHECK_IN)
    await clickDay(CHECK_OUT)
    fireEvent.click(screen.getByTestId('stay-picker-submit'))
    await screen.findByText(/your contact details/i, undefined, SLOW_FLOW)
    const setInput = (name: string, value: string) =>
      fireEvent.change(document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!, {
        target: { value },
      })
    setInput('booker_first_name', 'Ada')
    setInput('booker_last_name', 'Lovelace')
    setInput('booker_email', 'ada@example.com')
    setInput('booker_phone', '+34 600000000')
    fillBillingFields()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText(/review your booking/i, undefined, SLOW_FLOW)
    expect((await screen.findAllByTestId('price-sidebar-stay-errors'))[0]).toHaveTextContent(
      /already booked/,
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /confirm booking/i })).toBeDisabled(),
    )
  })
})
