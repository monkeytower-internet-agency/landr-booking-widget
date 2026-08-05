/**
 * landr-7jgo: ProductList visibility + "Fully booked" + date-model gate tests.
 *
 * Covers:
 *  - non-bookable (bookable=false) products HIDDEN by default
 *  - bookable products always shown
 *  - absent `bookable` treated as bookable (fail-open / back-compat)
 *  - showSoldOut=true renders sold-out products as "Fully booked" cards
 *    (badge present, no Select CTA)
 *  - a deep-link to a SOLD-OUT product calls onPreselectSoldOut, not onSelect
 *  - a deep-link to a BOOKABLE product calls onSelect (existing behaviour)
 *  - the date-model chip is gated by showDateModelDetail()
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import { ProductList } from './ProductList'
import { VIEW_MODE_STORAGE_KEY } from './browse/useViewMode'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    listProducts: vi.fn<() => Promise<Product[]>>(),
    showDateModelDetail: vi.fn<() => boolean>(),
  },
}))

vi.mock('@/api/client', () => ({
  listProducts: mocks.listProducts,
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

describe('ProductList — bookability visibility (landr-7jgo)', () => {
  beforeEach(() => {
    // Default: prod-like (no date-model chip) unless a test overrides.
    mocks.showDateModelDetail.mockReturnValue(false)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('hides non-bookable products by default', async () => {
    mocks.listProducts.mockResolvedValue([
      makeProduct({ product_id: 'a', name: 'Open Product', bookable: true }),
      makeProduct({ product_id: 'b', name: 'Sold Out Product', bookable: false }),
    ])
    render(<ProductList operatorToken="tok" onSelect={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByText('Open Product')).toBeInTheDocument(),
    )
    expect(screen.queryByText('Sold Out Product')).not.toBeInTheDocument()
    expect(screen.queryByTestId('fully-booked-badge')).not.toBeInTheDocument()
  })

  it('treats an absent bookable flag as bookable (back-compat)', async () => {
    const onSelect = vi.fn()
    mocks.listProducts.mockResolvedValue([
      makeProduct({ product_id: 'a', name: 'Legacy Product' }), // no bookable
    ])
    render(<ProductList operatorToken="tok" onSelect={onSelect} />)
    await waitFor(() =>
      expect(screen.getByText('Legacy Product')).toBeInTheDocument(),
    )
    // landr-d8rg.6: the whole card is the selectable affordance (role=button,
    // labelled by the product name) — the per-card "Select" button is gone.
    const card = screen.getByRole('button', { name: 'Legacy Product' })
    expect(card).toBeInTheDocument()
    card.click()
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('shows sold-out products as "Fully booked" (no Select) when showSoldOut=true', async () => {
    mocks.listProducts.mockResolvedValue([
      makeProduct({ product_id: 'a', name: 'Open Product', bookable: true }),
      makeProduct({ product_id: 'b', name: 'Sold Out Product', bookable: false }),
    ])
    render(
      <ProductList operatorToken="tok" showSoldOut onSelect={vi.fn()} />,
    )
    await waitFor(() =>
      expect(screen.getByText('Sold Out Product')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('fully-booked-badge')).toHaveTextContent(
      /fully booked/i,
    )
    // landr-d8rg.6: the bookable product renders a selectable card (role=button
    // labelled by its name); the sold-out one renders a FullyBookedNotice with
    // NO selectable card. So exactly the bookable product is clickable.
    expect(
      screen.getByRole('button', { name: 'Open Product' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Sold Out Product' }),
    ).not.toBeInTheDocument()
  })

  it('landr-872c: renders every product as "Fully booked" (not the empty-state dead end) when every product is sold out, even with showSoldOut off', async () => {
    // Supersedes the pre-landr-872c behaviour (dead-end "No products in this
    // category" copy for a fully sold-out fetch) — that was the exact bug
    // this ticket fixes for a ?group=<slug> deep link into a fully sold-out
    // category: the category itself is real (products exist), just sold out.
    mocks.listProducts.mockResolvedValue([
      makeProduct({ product_id: 'a', name: 'Sold Out A', bookable: false }),
      makeProduct({ product_id: 'b', name: 'Sold Out B', bookable: false }),
    ])
    render(<ProductList operatorToken="tok" onSelect={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByText('Sold Out A')).toBeInTheDocument(),
    )
    expect(screen.getByText('Sold Out B')).toBeInTheDocument()
    expect(screen.getAllByTestId('fully-booked-badge')).toHaveLength(2)
    expect(
      screen.queryByText('No products in this category.'),
    ).not.toBeInTheDocument()
  })

  it('keeps the dead-end empty-state for a genuinely EMPTY group (no products fetched at all)', async () => {
    mocks.listProducts.mockResolvedValue([])
    render(<ProductList operatorToken="tok" onSelect={vi.fn()} />)
    await waitFor(() =>
      expect(
        screen.getByText(/No products in this category/i),
      ).toBeInTheDocument(),
    )
  })
})

describe('ProductList — deep-link preselect (landr-7jgo)', () => {
  beforeEach(() => {
    mocks.showDateModelDetail.mockReturnValue(false)
  })
  afterEach(() => vi.clearAllMocks())

  it('calls onSelect for a bookable deep-linked product', async () => {
    const onSelect = vi.fn()
    const onPreselectSoldOut = vi.fn()
    mocks.listProducts.mockResolvedValue([
      makeProduct({ product_id: 'a', slug: 'tandem', name: 'Tandem', bookable: true }),
    ])
    render(
      <ProductList
        operatorToken="tok"
        preselectSlug="tandem"
        onSelect={onSelect}
        onPreselectSoldOut={onPreselectSoldOut}
      />,
    )
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1))
    expect(onPreselectSoldOut).not.toHaveBeenCalled()
  })

  it('calls onPreselectSoldOut (not onSelect) for a sold-out deep-linked product', async () => {
    const onSelect = vi.fn()
    const onPreselectSoldOut = vi.fn()
    mocks.listProducts.mockResolvedValue([
      makeProduct({
        product_id: 'a',
        slug: 'tandem',
        name: 'Tandem',
        bookable: false,
      }),
    ])
    render(
      <ProductList
        operatorToken="tok"
        preselectSlug="tandem"
        onSelect={onSelect}
        onPreselectSoldOut={onPreselectSoldOut}
      />,
    )
    await waitFor(() => expect(onPreselectSoldOut).toHaveBeenCalledTimes(1))
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('ProductList — date-model chip env gate (landr-7jgo)', () => {
  afterEach(() => vi.clearAllMocks())

  it('shows the service_time_shape chip in dev/staging (showDateModelDetail=true)', async () => {
    mocks.showDateModelDetail.mockReturnValue(true)
    mocks.listProducts.mockResolvedValue([
      makeProduct({
        product_id: 'a',
        name: 'Course',
        bookable: true,
        duration_minutes: null,
        service_time_shape: 'days_range',
      }),
    ])
    render(<ProductList operatorToken="tok" onSelect={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Course')).toBeInTheDocument())
    expect(screen.getByText('days range')).toBeInTheDocument()
  })

  it('hides the service_time_shape chip in production (showDateModelDetail=false)', async () => {
    mocks.showDateModelDetail.mockReturnValue(false)
    mocks.listProducts.mockResolvedValue([
      makeProduct({
        product_id: 'a',
        name: 'Course',
        bookable: true,
        duration_minutes: null,
        service_time_shape: 'days_range',
      }),
    ])
    render(<ProductList operatorToken="tok" onSelect={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Course')).toBeInTheDocument())
    expect(screen.queryByText('days range')).not.toBeInTheDocument()
    // Falls back to the generic 'service' label instead of the date-model chip.
    expect(screen.getByText('service')).toBeInTheDocument()
  })
})

describe('ProductList — grid/list toggle (landr-d8rg.6)', () => {
  beforeEach(() => {
    mocks.showDateModelDetail.mockReturnValue(false)
    // jsdom has no matchMedia ⇒ default view resolves to grid.
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('switches layout when the toggle is used and persists the choice', async () => {
    mocks.listProducts.mockResolvedValue([
      makeProduct({ product_id: 'a', slug: 'open', name: 'Open Product', bookable: true }),
    ])
    const { unmount } = render(
      <ProductList operatorToken="tok" onSelect={vi.fn()} />,
    )
    // Default (no stored pref, no matchMedia) is grid.
    await waitFor(() =>
      expect(screen.getByTestId('product-grid')).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('product-list')).not.toBeInTheDocument()

    // Flip to list.
    fireEvent.click(screen.getByTestId('view-toggle-list'))
    expect(screen.getByTestId('product-list')).toBeInTheDocument()
    expect(screen.queryByTestId('product-grid')).not.toBeInTheDocument()
    // Persisted to localStorage under the contract key.
    expect(window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)).toBe('list')

    // A fresh mount reads the persisted preference (list), not the default.
    unmount()
    render(<ProductList operatorToken="tok" onSelect={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByTestId('product-list')).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('product-grid')).not.toBeInTheDocument()
  })
})

describe('ProductList — card content (landr-d8rg.6)', () => {
  beforeEach(() => {
    mocks.showDateModelDetail.mockReturnValue(false)
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('renders a "from €X" price when price_from is set', async () => {
    mocks.listProducts.mockResolvedValue([
      makeProduct({
        product_id: 'a',
        slug: 'priced',
        name: 'Priced',
        bookable: true,
        price_from: '59.00',
        currency: 'EUR',
      }),
    ])
    render(<ProductList operatorToken="tok" onSelect={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Priced')).toBeInTheDocument())
    expect(screen.getByText(/from .*59/)).toBeInTheDocument()
  })

  it('hides the price when price_from is null', async () => {
    mocks.listProducts.mockResolvedValue([
      makeProduct({
        product_id: 'a',
        slug: 'free',
        name: 'No Price',
        bookable: true,
        price_from: null,
        currency: 'EUR',
      }),
    ])
    render(<ProductList operatorToken="tok" onSelect={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('No Price')).toBeInTheDocument())
    expect(screen.queryByText(/from/i)).not.toBeInTheDocument()
  })

  it('hides the price when price_from is undefined (rolling deploy)', async () => {
    mocks.listProducts.mockResolvedValue([
      // price_from omitted entirely (pre-d8rg.1 API).
      makeProduct({ product_id: 'a', slug: 'legacy', name: 'Legacy', bookable: true }),
    ])
    render(<ProductList operatorToken="tok" onSelect={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Legacy')).toBeInTheDocument())
    expect(screen.queryByText(/from/i)).not.toBeInTheDocument()
  })

  it('renders the uploaded thumbnail when thumb_url is set', async () => {
    mocks.listProducts.mockResolvedValue([
      makeProduct({
        product_id: 'a',
        slug: 'with-img',
        name: 'With Image',
        bookable: true,
        thumb_url: 'https://cdn.example/thumb.webp',
        images: [
          {
            thumb_url: 'https://cdn.example/thumb.webp',
            hero_url: 'https://cdn.example/hero.webp',
            alt: 'A lovely flight',
          },
        ],
      }),
    ])
    render(<ProductList operatorToken="tok" onSelect={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByText('With Image')).toBeInTheDocument(),
    )
    const img = screen.getByAltText('A lovely flight')
    expect(img).toHaveAttribute('src', 'https://cdn.example/thumb.webp')
  })

  it('falls back to the designed ProductArt when no thumb_url (no <img>)', async () => {
    mocks.listProducts.mockResolvedValue([
      makeProduct({
        product_id: 'a',
        slug: 'no-img',
        name: 'No Image',
        bookable: true,
        thumb_url: null,
        images: [],
      }),
    ])
    const { container } = render(
      <ProductList operatorToken="tok" onSelect={vi.fn()} />,
    )
    await waitFor(() => expect(screen.getByText('No Image')).toBeInTheDocument())
    // No <img> tag — the SVG ProductArt fallback is used instead.
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })
})

describe('ProductList — sold-out across layouts (landr-d8rg.6)', () => {
  beforeEach(() => {
    mocks.showDateModelDetail.mockReturnValue(false)
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  function soldOutFixture() {
    return [
      makeProduct({ product_id: 'a', slug: 'open', name: 'Open Product', bookable: true }),
      makeProduct({ product_id: 'b', slug: 'gone', name: 'Sold Out Product', bookable: false }),
    ]
  }

  it('renders the "Fully booked" card in GRID layout', async () => {
    // Default layout is grid (no stored pref, no matchMedia).
    mocks.listProducts.mockResolvedValue(soldOutFixture())
    render(<ProductList operatorToken="tok" showSoldOut onSelect={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByTestId('product-grid')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('fully-booked-badge')).toHaveTextContent(
      /fully booked/i,
    )
    // Sold-out has no selectable card; the bookable one does.
    expect(
      screen.getByRole('button', { name: 'Open Product' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Sold Out Product' }),
    ).not.toBeInTheDocument()
  })

  it('renders the "Fully booked" card in LIST layout', async () => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, 'list')
    mocks.listProducts.mockResolvedValue(soldOutFixture())
    render(<ProductList operatorToken="tok" showSoldOut onSelect={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByTestId('product-list')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('fully-booked-badge')).toHaveTextContent(
      /fully booked/i,
    )
    expect(
      screen.getByRole('button', { name: 'Open Product' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Sold Out Product' }),
    ).not.toBeInTheDocument()
  })
})
