/**
 * landr-4a5j: ExpandedCatalog — the operator-configurable "expanded catalog"
 * first step. All products grouped under category headers, no drill-in.
 *
 * Covers:
 *  - products are grouped under the correct category header (by group_slug)
 *  - a group with zero visible products is omitted entirely (non-empty only)
 *  - ONE unscoped listProducts call — no per-group N+1 fetch
 *  - sold-out products are hidden by default, shown (within their section)
 *    as "Fully booked" cards when showSoldOut=true — mirrors ProductList
 *  - a full date-window chip row (same data as the "Dates" tab) renders for
 *    fixed-window products with an upcoming window, and is absent otherwise
 *  - clicking a bookable card calls onSelect with that product
 */
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FixedDateWindow, Product, ProductGroup } from '@/api/types'
import { ExpandedCatalog } from './ExpandedCatalog'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    listProducts: vi.fn<() => Promise<Product[]>>(),
    getFixedDateWindows: vi.fn<(id: string) => Promise<FixedDateWindow[]>>(),
    showDateModelDetail: vi.fn<() => boolean>(),
  },
}))

vi.mock('@/api/client', () => ({
  listProducts: mocks.listProducts,
  getFixedDateWindows: mocks.getFixedDateWindows,
}))

vi.mock('@/lib/tier', () => ({
  showDateModelDetail: mocks.showDateModelDetail,
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

function makeGroup(overrides: Partial<ProductGroup> = {}): ProductGroup {
  return {
    id: 'g-1',
    slug: 'guiding',
    name: 'Guiding',
    name_localized: null,
    description: null,
    description_localized: null,
    image_url: null,
    sort_order: 10,
    parent_id: null,
    product_count: 1,
    ...overrides,
  }
}

describe('ExpandedCatalog — grouping (landr-4a5j)', () => {
  beforeEach(() => {
    mocks.showDateModelDetail.mockReturnValue(false)
  })
  afterEach(() => vi.clearAllMocks())

  it('groups products under the correct category header', async () => {
    mocks.listProducts.mockResolvedValue([
      makeProduct({
        product_id: 'a', slug: 'guided-day', name: 'Guided paragliding day',
        group_slug: 'guiding', bookable: true,
      }),
      makeProduct({
        product_id: 'b', slug: 'tandem-intro', name: 'Tandem intro flight',
        group_slug: 'guiding', bookable: true,
      }),
      makeProduct({
        product_id: 'c', slug: 'denmark-trip', name: 'Denmark paragliding trip',
        group_slug: 'travels', bookable: true,
      }),
    ])
    render(
      <ExpandedCatalog
        operatorToken="tok"
        groups={[
          makeGroup({ id: 'g-1', slug: 'guiding', name: 'Guiding', product_count: 2 }),
          makeGroup({ id: 'g-2', slug: 'travels', name: 'Travels', product_count: 1 }),
        ]}
        onSelect={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('Guided paragliding day')).toBeInTheDocument(),
    )
    const guidingSection = screen.getByTestId('catalog-section-products-guiding')
    expect(guidingSection).toHaveTextContent('Guided paragliding day')
    expect(guidingSection).toHaveTextContent('Tandem intro flight')
    expect(guidingSection).not.toHaveTextContent('Denmark paragliding trip')

    const travelsSection = screen.getByTestId('catalog-section-products-travels')
    expect(travelsSection).toHaveTextContent('Denmark paragliding trip')
    expect(travelsSection).not.toHaveTextContent('Guided paragliding day')

    expect(screen.getByText('Guiding')).toBeInTheDocument()
    expect(screen.getByText('Travels')).toBeInTheDocument()
  })

  it('omits a group with zero visible products (non-empty only)', async () => {
    mocks.listProducts.mockResolvedValue([
      makeProduct({
        product_id: 'a', slug: 'guided-day', name: 'Guided paragliding day',
        group_slug: 'guiding', bookable: true,
      }),
    ])
    render(
      <ExpandedCatalog
        operatorToken="tok"
        groups={[
          makeGroup({ id: 'g-1', slug: 'guiding', name: 'Guiding', product_count: 1 }),
          makeGroup({ id: 'g-2', slug: 'travels', name: 'Travels', product_count: 0 }),
        ]}
        onSelect={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('Guided paragliding day')).toBeInTheDocument(),
    )
    expect(screen.queryByText('Travels')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('catalog-section-products-travels'),
    ).not.toBeInTheDocument()
  })

  it('issues ONE unscoped listProducts call — no per-group fetch', async () => {
    mocks.listProducts.mockResolvedValue([])
    render(
      <ExpandedCatalog
        operatorToken="tok"
        groups={[makeGroup()]}
        onSelect={vi.fn()}
      />,
    )
    await waitFor(() => expect(mocks.listProducts).toHaveBeenCalledTimes(1))
    // No `group` filter — grouping happens client-side from the flat list.
    expect(mocks.listProducts).toHaveBeenCalledWith(
      'tok',
      expect.not.objectContaining({ group: expect.anything() }),
    )
  })

  it('clicking a bookable card calls onSelect with that product', async () => {
    const onSelect = vi.fn()
    const product = makeProduct({
      product_id: 'a', slug: 'guided-day', name: 'Guided paragliding day',
      group_slug: 'guiding', bookable: true,
    })
    mocks.listProducts.mockResolvedValue([product])
    render(
      <ExpandedCatalog
        operatorToken="tok"
        groups={[makeGroup({ product_count: 1 })]}
        onSelect={onSelect}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('Guided paragliding day')).toBeInTheDocument(),
    )
    screen.getByRole('button', { name: 'Guided paragliding day' }).click()
    expect(onSelect).toHaveBeenCalledWith(product)
  })
})

describe('ExpandedCatalog — sold-out placement (landr-4a5j)', () => {
  beforeEach(() => {
    mocks.showDateModelDetail.mockReturnValue(false)
  })
  afterEach(() => vi.clearAllMocks())

  function fixture() {
    return [
      makeProduct({
        product_id: 'a', slug: 'open', name: 'Open Product',
        group_slug: 'guiding', bookable: true,
      }),
      makeProduct({
        product_id: 'b', slug: 'gone', name: 'Sold Out Product',
        group_slug: 'guiding', bookable: false,
      }),
    ]
  }

  it('hides sold-out products by default', async () => {
    mocks.listProducts.mockResolvedValue(fixture())
    render(
      <ExpandedCatalog
        operatorToken="tok"
        groups={[makeGroup({ product_count: 2 })]}
        onSelect={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('Open Product')).toBeInTheDocument(),
    )
    expect(screen.queryByText('Sold Out Product')).not.toBeInTheDocument()
  })

  it('shows sold-out products within their section when showSoldOut=true', async () => {
    mocks.listProducts.mockResolvedValue(fixture())
    render(
      <ExpandedCatalog
        operatorToken="tok"
        groups={[makeGroup({ product_count: 2 })]}
        showSoldOut
        onSelect={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('Sold Out Product')).toBeInTheDocument(),
    )
    const section = screen.getByTestId('catalog-section-products-guiding')
    expect(section).toHaveTextContent('Open Product')
    expect(section).toHaveTextContent('Sold Out Product')
    expect(screen.getByTestId('fully-booked-badge')).toBeInTheDocument()
    // Bookable renders a selectable card; sold-out does not.
    expect(
      screen.getByRole('button', { name: 'Open Product' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Sold Out Product' }),
    ).not.toBeInTheDocument()
  })

  it('a group whose only product is sold-out is hidden when showSoldOut is off', async () => {
    mocks.listProducts.mockResolvedValue([
      makeProduct({
        product_id: 'b', slug: 'gone', name: 'Sold Out Product',
        group_slug: 'guiding', bookable: false,
      }),
    ])
    render(
      <ExpandedCatalog
        operatorToken="tok"
        groups={[makeGroup({ product_count: 1 })]}
        onSelect={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(
        screen.getByText('No products in this category.'),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByText('Guiding')).not.toBeInTheDocument()
  })
})

describe('ExpandedCatalog — date-window chips (landr-4a5j)', () => {
  beforeEach(() => {
    mocks.showDateModelDetail.mockReturnValue(false)
  })
  afterEach(() => vi.clearAllMocks())

  it('renders the full chip row (same data as the Dates tab) when next_window_start/end are present', async () => {
    mocks.listProducts.mockResolvedValue([
      makeProduct({
        product_id: 'a', slug: 'siv-course', name: 'SIV Course',
        group_slug: 'courses', bookable: true,
        next_window_start: '2026-08-04', next_window_end: '2026-08-10',
      }),
    ])
    mocks.getFixedDateWindows.mockResolvedValue([
      { id: 'w-1', start_date: '2026-08-04', end_date: '2026-08-10', capacity: 8, capacity_reserved: 0 },
      { id: 'w-2', start_date: '2026-08-18', end_date: '2026-08-24', capacity: 8, capacity_reserved: 8 },
    ])
    render(
      <ExpandedCatalog
        operatorToken="tok"
        groups={[makeGroup({ id: 'g-2', slug: 'courses', name: 'Courses', product_count: 1 })]}
        onSelect={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('SIV Course')).toBeInTheDocument(),
    )
    expect(mocks.getFixedDateWindows).toHaveBeenCalledWith('a')
    const chips = await waitFor(() =>
      screen.getByTestId('product-date-chips-siv-course'),
    )
    expect(chips).toHaveTextContent(/Aug 4, 2026.*Aug 10, 2026/)
    expect(chips).toHaveTextContent('8 seats left')
    expect(chips).toHaveTextContent(/Aug 18, 2026.*Aug 24, 2026/)
    expect(chips).toHaveTextContent('Full')
  })

  it('hides seat counts and just shows Available when exposeSeats is false', async () => {
    mocks.listProducts.mockResolvedValue([
      makeProduct({
        product_id: 'a', slug: 'siv-course', name: 'SIV Course',
        group_slug: 'courses', bookable: true,
        next_window_start: '2026-08-04', next_window_end: '2026-08-10',
      }),
    ])
    mocks.getFixedDateWindows.mockResolvedValue([
      { id: 'w-1', start_date: '2026-08-04', end_date: '2026-08-10', capacity: 8, capacity_reserved: 2 },
    ])
    render(
      <ExpandedCatalog
        operatorToken="tok"
        groups={[makeGroup({ id: 'g-2', slug: 'courses', name: 'Courses', product_count: 1 })]}
        exposeSeats={false}
        onSelect={vi.fn()}
      />,
    )
    const chips = await waitFor(() =>
      screen.getByTestId('product-date-chips-siv-course'),
    )
    expect(chips).toHaveTextContent('Available')
    expect(chips).not.toHaveTextContent(/seats? left/i)
  })

  it('does not fetch windows or render chips when next_window_start/end are absent', async () => {
    mocks.listProducts.mockResolvedValue([
      makeProduct({
        product_id: 'a', slug: 'guided-day', name: 'Guided paragliding day',
        group_slug: 'guiding', bookable: true,
      }),
    ])
    render(
      <ExpandedCatalog
        operatorToken="tok"
        groups={[makeGroup({ product_count: 1 })]}
        onSelect={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('Guided paragliding day')).toBeInTheDocument(),
    )
    expect(
      screen.queryByTestId('product-date-chips-guided-day'),
    ).not.toBeInTheDocument()
    expect(mocks.getFixedDateWindows).not.toHaveBeenCalled()
  })
})
