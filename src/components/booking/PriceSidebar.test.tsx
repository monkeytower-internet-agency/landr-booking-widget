import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  warnings: [],
  un_priceable: false,
}

describe('PriceSidebar (landr-qez0)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the operator/hotel split with booking total and a discount tag (landr-kat8)', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(SAMPLE)
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        selectedDays={['2026-05-23', '2026-05-24', '2026-05-25']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    await waitFor(() => {
      // landr-kat8: the grand-total testid is replaced by
      // price-sidebar-amount-due (operator-only) + a separate hotel
      // pill. Both render on desktop and mobile.
      expect(
        screen.getAllByTestId('price-sidebar-amount-due').length,
      ).toBeGreaterThan(0)
    })
    const desktop = screen.getByTestId('price-sidebar-desktop')
    expect(desktop).toHaveTextContent('Booking overview')
    expect(desktop).toHaveTextContent('You pay now')
    // landr-kat8: hotel pill header replaces the old "Pay at hotel" label.
    expect(desktop).toHaveTextContent('At-hotel total')
    expect(desktop).toHaveTextContent('Guided Day Dive')
    expect(desktop).toHaveTextContent('Single Room')
    expect(desktop).toHaveTextContent('Breakfast')
    // Booking total = operator only (180), NOT the old grand_total (456).
    const bookingTotal = desktop.querySelector(
      '[data-testid="price-sidebar-amount-due"]',
    )
    expect(bookingTotal?.textContent).toMatch(/Amount due/)
    expect(bookingTotal?.textContent).toMatch(/180/)
    expect(bookingTotal?.textContent).not.toMatch(/456/)
    // Hotel pill carries its own subtotal (276) and the caveat copy.
    const hotelSection = desktop.querySelector(
      '[data-testid="price-sidebar-hotel-section"]',
    )
    expect(hotelSection?.textContent).toMatch(/276/)
    const caveat = desktop.querySelector(
      '[data-testid="price-sidebar-hotel-caveat"]',
    )
    expect(caveat?.textContent).toMatch(/Paid directly to the hotel at check-in/)
    expect(caveat?.textContent).toMatch(/Not included in your booking total/)
    expect(desktop).toHaveTextContent('Multi-day discount')
  })

  it('shows the "Calculating…" placeholder before the first response lands', () => {
    vi.spyOn(client, 'estimateBookingPrice').mockImplementation(
      () => new Promise(() => {}),
    )
    render(
      <PriceSidebar
        operatorToken="para42"
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
        operatorToken="para42"
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
        operatorToken="para42"
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

describe('PriceSidebar — day chips + hotel span + names (landr-2wyi)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders one chip per selected day in the operator section (contiguous selection)', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(SAMPLE)
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        selectedDays={['2026-05-25', '2026-05-26', '2026-05-27']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    await waitFor(() => {
      expect(screen.getAllByTestId('day-chips').length).toBeGreaterThan(0)
    })
    const desktop = screen.getByTestId('price-sidebar-desktop')
    // Each picked day shows as its own chip — weekday + day + month.
    // Locale-agnostic regex: match any "<weekday short>, <month> <day>"
    // or "<weekday short> <day> <month>" the test env's Intl produces.
    expect(desktop).toHaveTextContent(/25/)
    expect(desktop).toHaveTextContent(/Mon/)
    expect(desktop).toHaveTextContent(/Tue/)
    expect(desktop).toHaveTextContent(/Wed/)
    // Three discrete chips inside the operator section.
    const chips = desktop.querySelectorAll(
      '[data-testid="day-chips"] [data-day]',
    )
    expect(chips.length).toBe(3)
  })

  it('renders separate chips (not a contiguous range) for a NON-contiguous selection', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(SAMPLE)
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        // 25 + 27 skipping 26 — the regression chips guard against.
        selectedDays={['2026-05-25', '2026-05-27']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    await waitFor(() => {
      expect(screen.getAllByTestId('day-chips').length).toBeGreaterThan(0)
    })
    const desktop = screen.getByTestId('price-sidebar-desktop')
    // Two chips, NOT a "25 → 27" range.
    const chips = desktop.querySelectorAll(
      '[data-testid="day-chips"] [data-day]',
    )
    expect(chips.length).toBe(2)
    expect(desktop).toHaveTextContent(/Mon/) // 25
    expect(desktop).toHaveTextContent(/Wed/) // 27
    // The middle day (Tue 26) is NOT in any chip.
    const chipsText = Array.from(chips).map((c) => c.textContent ?? '')
    expect(chipsText.some((t) => /Tue/.test(t))).toBe(false)
  })

  it('renders the explicit hotel span with weekday + nights above the hotel rows', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(SAMPLE)
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        // Guided days 25, 26, 27 → check-in Sun 24, check-out Thu 28
        // (deriveStayWindow shifts ±1 day; 3 days → 4 nights).
        selectedDays={['2026-05-25', '2026-05-26', '2026-05-27']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    await waitFor(() => {
      expect(
        screen.getAllByTestId('price-sidebar-hotel-span').length,
      ).toBeGreaterThan(0)
    })
    const desktop = screen.getByTestId('price-sidebar-desktop')
    const span = desktop.querySelector(
      '[data-testid="price-sidebar-hotel-span"]',
    )
    // Weekday is asserted explicitly to lock the spec's "with weekday"
    // requirement. Day/month digits are asserted separately so the test
    // tolerates US-style ("Sun, May 24") vs EU-style ("Sun 24 May").
    expect(span?.textContent).toMatch(/Sun/)
    expect(span?.textContent).toMatch(/Thu/)
    expect(span?.textContent).toMatch(/24/)
    expect(span?.textContent).toMatch(/28/)
    expect(span?.textContent).toMatch(/4 nights/)
  })

  it('omits the hotel span when there are no hotel-paid line items', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue({
      ...SAMPLE,
      line_items: SAMPLE.line_items.filter((li) => li.paid_to === 'operator'),
      hotel_total: '0.00',
      grand_total: '180.00',
      applied_rules: [],
    })
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        selectedDays={['2026-05-25', '2026-05-26', '2026-05-27']}
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
    expect(screen.queryAllByTestId('price-sidebar-hotel-span')).toHaveLength(0)
  })

  it('renders the participant names line under the Booking overview header', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(SAMPLE)
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        selectedDays={['2026-05-25']}
        participantCount={2}
        participantNames={['Ada', 'Grace']}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    const desktop = screen.getByTestId('price-sidebar-desktop')
    const names = desktop.querySelector('[data-testid="price-sidebar-names"]')
    expect(names?.textContent).toMatch(/Ada/)
    expect(names?.textContent).toMatch(/Grace/)
    expect(names?.textContent).toMatch(/For/)
  })

  // landr-kat8: dedicated coverage for the hotel pill restructure.
  // Spec: booking total = operator only; hotel rendered as a distinct
  // visual pill with a header, per-line breakdown, subtotal, and an
  // explicit "paid at check-in" caveat. Mobile collapsed bar shows the
  // booking total + a small "+ €X at hotel" sub-line.
  it('booking total reflects operator only, not operator + hotel (landr-kat8)', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(SAMPLE)
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        selectedDays={['2026-05-23', '2026-05-24', '2026-05-25']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    await waitFor(() =>
      expect(
        screen.getAllByTestId('price-sidebar-amount-due').length,
      ).toBeGreaterThan(0),
    )
    const desktop = screen.getByTestId('price-sidebar-desktop')
    const bookingTotal = desktop.querySelector(
      '[data-testid="price-sidebar-amount-due"]',
    )
    // 180 = operator_total, NOT 456 (operator + hotel).
    expect(bookingTotal?.textContent).toMatch(/180/)
    expect(bookingTotal?.textContent).not.toMatch(/456/)
  })

  it('hotel pill carries the explicit pay-at-check-in caveat (landr-kat8)', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(SAMPLE)
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        selectedDays={['2026-05-23', '2026-05-24', '2026-05-25']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    await waitFor(() =>
      expect(
        screen.getAllByTestId('price-sidebar-hotel-caveat').length,
      ).toBeGreaterThan(0),
    )
    const desktop = screen.getByTestId('price-sidebar-desktop')
    const caveat = desktop.querySelector(
      '[data-testid="price-sidebar-hotel-caveat"]',
    )
    expect(caveat?.textContent).toMatch(/Paid directly to the hotel at check-in/)
    expect(caveat?.textContent).toMatch(/Not included in your booking total/)
    // Hotel pill also gets its own subtotal-bearing row.
    const hotelTotal = desktop.querySelector(
      '[data-testid="price-sidebar-hotel-total"]',
    )
    expect(hotelTotal?.textContent).toMatch(/276/)
  })

  it('mobile collapsed bar shows booking total + "+ €X at hotel" sub-line (landr-kat8)', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(SAMPLE)
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        selectedDays={['2026-05-23']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    await waitFor(() =>
      expect(
        screen.getAllByTestId('price-sidebar-mobile-athotel').length,
      ).toBeGreaterThan(0),
    )
    const mobile = screen.getByTestId('price-sidebar-mobile')
    expect(mobile.textContent).toMatch(/Amount due/)
    expect(mobile.textContent).toMatch(/180/) // operator only
    const athotel = mobile.querySelector(
      '[data-testid="price-sidebar-mobile-athotel"]',
    )
    expect(athotel?.textContent).toMatch(/at hotel/)
    expect(athotel?.textContent).toMatch(/276/)
  })

  it('hides the mobile at-hotel sub-line when there are no hotel lines (landr-kat8)', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue({
      ...SAMPLE,
      line_items: SAMPLE.line_items.filter((li) => li.paid_to === 'operator'),
      hotel_total: '0.00',
      grand_total: '180.00',
      applied_rules: [],
    })
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        selectedDays={['2026-05-23']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    await waitFor(() =>
      expect(
        screen.getAllByTestId('price-sidebar-amount-due').length,
      ).toBeGreaterThan(0),
    )
    expect(
      screen.queryByTestId('price-sidebar-mobile-athotel'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('price-sidebar-hotel-caveat'),
    ).not.toBeInTheDocument()
  })

  // landr-8s6c: each discount tag now carries a plain-language
  // explanation of why the price dropped — the consecutive-day count
  // + the applied per-day rate — so the customer sees the multi-day
  // rate working, not just a terse "Streak discount" pill.
  it('renders the consecutive-day explanation under a per_streak_tier discount tag (landr-8s6c)', async () => {
    // Realistic Para42 guided-day fixture: a 3-day consecutive run
    // priced at €75/day via the streak brackets (1-2=90, 3-5=75).
    const streakSample: EstimateResponse = {
      line_items: [
        {
          product_id: 'svc',
          label: 'Guided Day Dive',
          qty: 1,
          units: 3,
          unit_price: '75.00',
          line_total: '225.00',
          paid_to: 'operator',
        },
      ],
      operator_total: '225.00',
      hotel_total: '0.00',
      grand_total: '225.00',
      currency: 'EUR',
      applied_rules: [
        {
          kind: 'per_streak_tier',
          detail: {
            streaks: [[3, 75.0]],
            per_participant: false,
            participants: null,
          },
        },
      ],
      warnings: [],
      un_priceable: false,
    }
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(streakSample)
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        selectedDays={['2026-05-23', '2026-05-24', '2026-05-25']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    await waitFor(() =>
      expect(
        screen.getAllByTestId('price-sidebar-discount-explanation').length,
      ).toBeGreaterThan(0),
    )
    const desktop = screen.getByTestId('price-sidebar-desktop')
    // Terse tag still present.
    expect(desktop).toHaveTextContent('Streak discount')
    // The WHY is now explicit.
    const explanation = desktop.querySelector(
      '[data-testid="price-sidebar-discount-explanation"]',
    )
    expect(explanation?.textContent).toMatch(/Multi-day rate applied/)
    expect(explanation?.textContent).toMatch(/3 consecutive days/)
    expect(explanation?.textContent).toMatch(/75/)
    expect(explanation?.textContent).toMatch(/\/day/)
  })

  it('reflects the per-participant multiplier in the discount explanation (landr-8s6c)', async () => {
    const perParticipantSample: EstimateResponse = {
      line_items: [
        {
          product_id: 'svc',
          label: 'Guided Day Dive',
          qty: 2,
          units: 3,
          unit_price: '75.00',
          line_total: '450.00',
          paid_to: 'operator',
        },
      ],
      operator_total: '450.00',
      hotel_total: '0.00',
      grand_total: '450.00',
      currency: 'EUR',
      applied_rules: [
        {
          kind: 'per_streak_tier',
          detail: {
            streaks: [[3, 75.0]],
            per_participant: true,
            participants: 2,
          },
        },
      ],
      warnings: [],
      un_priceable: false,
    }
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(
      perParticipantSample,
    )
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        selectedDays={['2026-05-23', '2026-05-24', '2026-05-25']}
        participantCount={2}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    await waitFor(() =>
      expect(
        screen.getAllByTestId('price-sidebar-discount-explanation').length,
      ).toBeGreaterThan(0),
    )
    const desktop = screen.getByTestId('price-sidebar-desktop')
    const explanation = desktop.querySelector(
      '[data-testid="price-sidebar-discount-explanation"]',
    )
    expect(explanation?.textContent).toMatch(/3 consecutive days/)
    expect(explanation?.textContent).toMatch(/× 2 participants/)
  })

  it('collapses long name lists with a "+N others" suffix', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(SAMPLE)
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        selectedDays={['2026-05-25']}
        participantCount={5}
        participantNames={['Ada', 'Grace', 'Alan', 'Linus', 'Margaret']}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    const desktop = screen.getByTestId('price-sidebar-desktop')
    const names = desktop.querySelector('[data-testid="price-sidebar-names"]')
    // First two named + "+3 others" (plural).
    expect(names?.textContent).toMatch(/Ada, Grace/)
    expect(names?.textContent).toMatch(/\+ 3 others/)
  })
})

// landr-hpyn: a fixed-window course with zero upcoming windows rendered
// "No upcoming windows" next to a €450 Booking overview — the estimate
// endpoint returns the base price for selected_days=[]. The sidebar must
// neither fetch nor show a price until at least one day is selected.
describe('PriceSidebar empty selection (landr-hpyn)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderSidebar(selectedDays: string[]) {
    return render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct({ service_time_shape: 'fixed_window' })}
        selectedDays={selectedDays}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
        debounceMs={0}
      />,
    )
  }

  it('does not fetch an estimate and shows the pick-prompt when nothing is selected', async () => {
    const spy = vi
      .spyOn(client, 'estimateBookingPrice')
      .mockResolvedValue(SAMPLE)
    renderSidebar([])
    const desktop = screen.getByTestId('price-sidebar-desktop')
    expect(desktop).toHaveTextContent('Pick your options to see the price.')
    // Mobile collapsed bar shows the em-dash placeholder, not a number.
    expect(screen.getByTestId('price-sidebar-mobile')).toHaveTextContent('—')
    // Let the (zero-ms) debounce and any microtasks flush, then verify
    // the estimate endpoint was never hit with the empty selection.
    await new Promise((r) => setTimeout(r, 20))
    expect(spy).not.toHaveBeenCalled()
    expect(
      screen.queryByTestId('price-sidebar-amount-due'),
    ).not.toBeInTheDocument()
  })

  it('clears the previously fetched price when the selection is emptied again', async () => {
    const spy = vi
      .spyOn(client, 'estimateBookingPrice')
      .mockResolvedValue(SAMPLE)
    const { rerender } = renderSidebar(['2026-07-04'])
    await waitFor(() => {
      expect(
        screen.getAllByTestId('price-sidebar-amount-due').length,
      ).toBeGreaterThan(0)
    })
    // Customer deselects the last day: the hook keeps its previous data
    // for stale-while-loading, but the sidebar must NOT keep showing it.
    rerender(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct({ service_time_shape: 'fixed_window' })}
        selectedDays={[]}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
        debounceMs={0}
      />,
    )
    expect(
      screen.queryByTestId('price-sidebar-amount-due'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByTestId('price-sidebar-desktop'),
    ).toHaveTextContent('Pick your options to see the price.')
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

// landr-zenj.1: a misconfigured operator price list (tier gap / no active
// rules / deleted-in-use scheme) makes the engine un-priceable rather than
// silently returning gross_total 0.00 as a real, bookable price. The
// sidebar must block the whole breakdown behind an explanatory message —
// never render any of the response's totals — and must report the flag up
// via onUnPriceableChange so BookingForm can block its Confirm CTA too.
describe('PriceSidebar un_priceable (landr-zenj.1)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const UN_PRICEABLE_SAMPLE: EstimateResponse = {
    ...SAMPLE,
    un_priceable: true,
    warnings: ['Pricing is not available for one or more selected days.'],
  }

  it('blocks the breakdown behind a message and never renders a total', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(
      UN_PRICEABLE_SAMPLE,
    )
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        selectedDays={['2026-05-23', '2026-05-24', '2026-05-25']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    await waitFor(() => {
      expect(
        screen.getAllByTestId('price-sidebar-unpriceable').length,
      ).toBeGreaterThan(0)
    })
    const desktop = screen.getByTestId('price-sidebar-desktop')
    expect(desktop).toHaveTextContent(
      "Pricing for this selection isn't available right now",
    )
    expect(desktop).toHaveTextContent(
      'Pricing is not available for one or more selected days.',
    )
    // None of the (non-zero, but not-a-real-quote) SAMPLE totals leak
    // through — the whole breakdown is replaced by the message.
    expect(
      screen.queryByTestId('price-sidebar-amount-due'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('price-sidebar-grand-total'),
    ).not.toBeInTheDocument()
    expect(desktop).not.toHaveTextContent('180')
    expect(desktop).not.toHaveTextContent('456')
  })

  it('reports un_priceable=true via onUnPriceableChange', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(
      UN_PRICEABLE_SAMPLE,
    )
    const onUnPriceableChange = vi.fn()
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        selectedDays={['2026-05-23', '2026-05-24', '2026-05-25']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
        onUnPriceableChange={onUnPriceableChange}
      />,
    )
    await waitFor(() => {
      expect(onUnPriceableChange).toHaveBeenCalledWith(true)
    })
  })

  it('reports un_priceable=false for a normal priceable estimate', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(SAMPLE)
    const onUnPriceableChange = vi.fn()
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        selectedDays={['2026-05-23', '2026-05-24', '2026-05-25']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
        onUnPriceableChange={onUnPriceableChange}
      />,
    )
    await waitFor(() => {
      expect(
        screen.getAllByTestId('price-sidebar-amount-due').length,
      ).toBeGreaterThan(0)
    })
    expect(onUnPriceableChange).toHaveBeenCalledWith(false)
    expect(onUnPriceableChange).not.toHaveBeenCalledWith(true)
  })
})

// landr-nva1a.4: Subtotal → savings rows → Amount due, sourced from the
// estimate's optional savings/subtotal_before_savings/amount_due fields.
// Absence (older API deploy) must fall back to exactly today's single
// total row — covered by the SAMPLE-based tests above, which carry none
// of these fields.
describe('PriceSidebar savings breakdown (landr-nva1a.4)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const SAVINGS_SAMPLE: EstimateResponse = {
    ...SAMPLE,
    line_items: SAMPLE.line_items.filter((li) => li.paid_to === 'operator'),
    hotel_total: '0.00',
    grand_total: '156.00',
    savings: [
      { kind: 'multi_day', label: 'Multi-day savings', amount: '15.00' },
      { kind: 'voucher', label: 'Voucher SUMMER10', amount: '9.00' },
    ],
    savings_total: '24.00',
    subtotal_before_savings: '180.00',
    amount_due: '156.00',
    multi_day_savings: { days: 3, amount: '15.00', consecutive: true },
  }

  it('renders Subtotal + savings rows above Amount due in the desktop well', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(SAVINGS_SAMPLE)
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        selectedDays={['2026-05-23', '2026-05-24', '2026-05-25']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    await waitFor(() => {
      expect(
        screen.getAllByTestId('price-sidebar-amount-due').length,
      ).toBeGreaterThan(0)
    })
    const desktop = screen.getByTestId('price-sidebar-desktop')
    const subtotal = desktop.querySelector(
      '[data-testid="price-sidebar-subtotal"]',
    )
    expect(subtotal?.textContent).toMatch(/Subtotal/)
    expect(subtotal?.textContent).toMatch(/180/)
    const rows = desktop.querySelectorAll('[data-testid="price-sidebar-saving"]')
    expect(rows.length).toBe(2)
    expect(rows[0].textContent).toMatch(/Multi-day savings/)
    expect(rows[0].textContent).toMatch(/−€15/)
    expect(rows[1].textContent).toMatch(/Voucher SUMMER10/)
    const amountDue = desktop.querySelector(
      '[data-testid="price-sidebar-amount-due"]',
    )
    expect(amountDue?.textContent).toMatch(/Amount due/)
    expect(amountDue?.textContent).toMatch(/156/)
  })

  it('mobile collapsed bar shows amount_due, not operator_total, when savings apply', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(SAVINGS_SAMPLE)
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        selectedDays={['2026-05-23', '2026-05-24', '2026-05-25']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    await waitFor(() => {
      expect(
        screen.getAllByTestId('price-sidebar-amount-due').length,
      ).toBeGreaterThan(0)
    })
    const mobile = screen.getByTestId('price-sidebar-mobile')
    expect(mobile.textContent).toMatch(/Amount due/)
    expect(mobile.textContent).toMatch(/156/)
    expect(mobile.textContent).not.toMatch(/180/)
  })

  it('falls back to operator_total with no Subtotal/savings rows when the API omits the new fields', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(SAMPLE)
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        selectedDays={['2026-05-23', '2026-05-24', '2026-05-25']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
      />,
    )
    await waitFor(() => {
      expect(
        screen.getAllByTestId('price-sidebar-amount-due').length,
      ).toBeGreaterThan(0)
    })
    const desktop = screen.getByTestId('price-sidebar-desktop')
    expect(
      desktop.querySelector('[data-testid="price-sidebar-subtotal"]'),
    ).toBeNull()
    expect(
      desktop.querySelector('[data-testid="price-sidebar-saving"]'),
    ).toBeNull()
    const amountDue = desktop.querySelector(
      '[data-testid="price-sidebar-amount-due"]',
    )
    expect(amountDue?.textContent).toMatch(/180/)
  })
})

describe('PriceSidebar mobile drawer (landr-v94dz)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.style.overflow = ''
  })

  async function renderLoaded() {
    vi.spyOn(client, 'estimateBookingPrice').mockResolvedValue(SAMPLE)
    render(
      <PriceSidebar
        operatorToken="para42"
        product={makeProduct()}
        selectedDays={['2026-05-23']}
        participantCount={1}
        accommodationRooms={[]}
        addons={[]}
        debounceMs={0}
      />,
    )
    await waitFor(() =>
      expect(
        screen.getAllByTestId('price-sidebar-mobile-athotel').length,
      ).toBeGreaterThan(0),
    )
    return {
      bar: screen.getByTestId('price-sidebar-mobile'),
      toggle: screen.getByTestId('price-sidebar-mobile-toggle'),
    }
  }

  it('keeps the toggle first in the DOM and pins it to the bottom with flex-col-reverse', async () => {
    const { bar, toggle } = await renderLoaded()
    // flex-col-reverse paints the first child (the toggle) at the bottom of
    // the bottom-anchored bar, so a panel added after it grows the bar
    // upward and the toggle never moves.
    expect(bar).toHaveClass('flex', 'flex-col-reverse', 'fixed', 'bottom-0')
    expect(bar.firstElementChild).toBe(toggle)
    expect(
      screen.queryByTestId('price-sidebar-mobile-panel'),
    ).not.toBeInTheDocument()

    fireEvent.click(toggle)

    const panel = screen.getByTestId('price-sidebar-mobile-panel')
    // The toggle is the SAME node (not remounted, keeps focus) and still
    // first; the revealed breakdown follows it, so Tab / a screen reader's
    // next item lands in the breakdown.
    expect(screen.getByTestId('price-sidebar-mobile-toggle')).toBe(toggle)
    expect(bar.firstElementChild).toBe(toggle)
    expect(toggle.nextElementSibling).toBe(panel)
    expect(toggle).toHaveAttribute('aria-controls', panel.id)
    // The breakdown really is inside the panel.
    expect(
      panel.querySelector('[data-testid="price-sidebar-amount-due"]'),
    ).not.toBeNull()
  })

  it('flips the chevron and the visible label with aria-expanded', async () => {
    const { toggle } = await renderLoaded()
    const chevron = screen.getByTestId('price-sidebar-mobile-chevron')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(chevron).not.toHaveClass('rotate-180')
    expect(toggle).toHaveAccessibleName(/Tap to expand/)
    expect(toggle).not.toHaveAccessibleName(/Tap to collapse/)

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(chevron).toHaveClass('rotate-180')
    expect(toggle).toHaveAccessibleName(/Tap to collapse/)
    expect(toggle).not.toHaveAccessibleName(/Tap to expand/)

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(chevron).not.toHaveClass('rotate-180')
    expect(
      screen.queryByTestId('price-sidebar-mobile-panel'),
    ).not.toBeInTheDocument()
  })

  it('keeps both pill labels mounted so the pill width never changes', async () => {
    const { toggle } = await renderLoaded()
    const pill = screen.getByTestId('price-sidebar-mobile-pill')
    const labels = () =>
      Array.from(pill.querySelectorAll('span.grid > span')).map((el) => ({
        text: el.textContent,
        hidden: el.classList.contains('invisible'),
      }))
    expect(labels()).toEqual([
      { text: 'Tap to expand', hidden: false },
      { text: 'Tap to collapse', hidden: true },
    ])
    fireEvent.click(toggle)
    expect(labels()).toEqual([
      { text: 'Tap to expand', hidden: true },
      { text: 'Tap to collapse', hidden: false },
    ])
  })

  it('renders the panel on the brand-tinted surface and locks body scroll while open', async () => {
    const { bar, toggle } = await renderLoaded()
    expect(bar).not.toHaveClass('border-t-primary')
    fireEvent.click(toggle)
    const panel = screen.getByTestId('price-sidebar-mobile-panel')
    expect(panel).toHaveClass('bg-surface-tint')
    expect(panel).not.toHaveClass('bg-surface-card')
    // Muted text is re-pointed at the AA-safe token inside the tint only.
    expect(panel).toHaveClass(
      '[--muted-foreground:var(--surface-tint-muted-foreground)]',
    )
    expect(bar).toHaveClass('border-t-primary', 'bg-surface-tint')
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(toggle)
    expect(document.body.style.overflow).toBe('')
  })

  it('pads the body and the bar by the scrollbar width while locked, so the pill does not slide', async () => {
    const { bar, toggle } = await renderLoaded()
    const html = document.documentElement
    const innerWidth = window.innerWidth
    Object.defineProperty(html, 'clientWidth', {
      configurable: true,
      get: () => 1009,
    })
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    })
    try {
      fireEvent.click(toggle)
      expect(document.body.style.paddingRight).toBe('15px')
      expect(bar.style.paddingRight).toBe('15px')
      fireEvent.click(toggle)
      expect(document.body.style.paddingRight).toBe('')
      expect(bar.style.paddingRight).toBe('')
    } finally {
      // Drop the own-property shadow so Element.prototype's getter applies again.
      delete (html as unknown as Record<string, unknown>).clientWidth
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: innerWidth,
      })
    }
  })

  it('adds no padding when the scrollbar takes no space (phones)', async () => {
    const { bar, toggle } = await renderLoaded()
    // jsdom has no layout: clientWidth is 0, which the lock treats as
    // "no scrollbar" instead of padding by the whole innerWidth.
    expect(document.documentElement.clientWidth).toBe(0)
    fireEvent.click(toggle)
    expect(document.body.style.paddingRight).toBe('')
    expect(bar.style.paddingRight).toBe('')
    expect(document.body.style.overflow).toBe('hidden')
  })
})
