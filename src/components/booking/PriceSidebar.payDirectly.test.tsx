import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from '@/api/client'
import type { EstimateResponse, Product } from '@/api/types'
import PriceSidebar from './PriceSidebar'

const PRODUCT = {
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
} as unknown as Product

const ESTIMATE: EstimateResponse = {
  line_items: [
    {
      product_id: 'svc',
      label: 'Tandem Classic',
      qty: 1,
      units: 1,
      unit_price: '120.00',
      line_total: '120.00',
      paid_to: 'operator',
    },
  ],
  operator_total: '120.00',
  hotel_total: '0.00',
  grand_total: '120.00',
  currency: 'EUR',
  applied_rules: [],
  warnings: [],
  un_priceable: false,
}

function renderSidebar(extra: {
  payDirectly?: boolean
  operatorName?: string | null
  paymentTerms?: React.ComponentProps<typeof PriceSidebar>['paymentTerms']
}) {
  vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(ESTIMATE)
  render(
    <PriceSidebar
      operatorToken="tok"
      product={PRODUCT}
      selectedDays={['2031-03-10']}
      participantCount={1}
      accommodationRooms={[]}
      offerPicks={[]}
      {...extra}
    />,
  )
}

describe('PriceSidebar: operator without online payment', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the price with "pay directly to <operator>"', async () => {
    renderSidebar({ payDirectly: true, operatorName: 'Sky Club' })
    await waitFor(() => {
      expect(screen.getAllByTestId('price-sidebar-pay-directly').length).toBeGreaterThan(0)
    })
    const desktop = screen.getByTestId('price-sidebar-desktop')
    expect(desktop).toHaveTextContent('120')
    expect(desktop).toHaveTextContent('Pay directly to Sky Club. There is no online payment.')
  })

  it('shows the German wording for a German browser', async () => {
    const spy = vi.spyOn(navigator, 'language', 'get').mockReturnValue('de-DE')
    try {
      renderSidebar({ payDirectly: true, operatorName: 'Sky Club' })
      await waitFor(() => {
        expect(screen.getAllByTestId('price-sidebar-pay-directly').length).toBeGreaterThan(0)
      })
      expect(screen.getByTestId('price-sidebar-desktop')).toHaveTextContent(
        'Bitte zahlen Sie direkt an Sky Club. Es gibt keine Online-Zahlung.',
      )
    } finally {
      spy.mockRestore()
    }
  })

  it('uses generic wording when the operator has no name', async () => {
    renderSidebar({ payDirectly: true, operatorName: null })
    await waitFor(() => {
      expect(screen.getAllByTestId('price-sidebar-pay-directly').length).toBeGreaterThan(0)
    })
    expect(screen.getByTestId('price-sidebar-desktop')).toHaveTextContent(
      'Pay directly to the operator.',
    )
  })

  it('shows no such line for an operator that takes online payment', async () => {
    renderSidebar({ operatorName: 'Sky Club' })
    await waitFor(() => {
      expect(screen.getAllByTestId('price-sidebar-amount-due').length).toBeGreaterThan(0)
    })
    expect(screen.queryAllByTestId('price-sidebar-pay-directly')).toHaveLength(0)
  })
})


describe('PriceSidebar: payment terms before booking', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('states the non-refundable deposit and the balance due date in the summary', async () => {
    renderSidebar({
      paymentTerms: {
        payment_methods: ['bank_transfer'],
        deposit_percent: 30,
        deposit_refundable: false,
        balance_due_days_before_arrival: 30,
      },
    })
    await waitFor(() => {
      expect(screen.getAllByTestId('price-sidebar-payment-terms').length).toBeGreaterThan(0)
    })
    // selectedDays 2031-03-10 minus 30 days = 8 Feb 2031.
    expect(screen.getByTestId('price-sidebar-desktop')).toHaveTextContent(
      /30% deposit today \(non-refundable\), the rest by .*(Feb 8|8 Feb)/,
    )
  })

  it('shows nothing extra with default terms', async () => {
    renderSidebar({ paymentTerms: { payment_methods: ['online'], deposit_percent: 30 } })
    await waitFor(() => {
      expect(screen.getByTestId('price-sidebar-desktop')).toHaveTextContent('120')
    })
    expect(screen.queryByTestId('price-sidebar-payment-terms')).not.toBeInTheDocument()
  })
})
