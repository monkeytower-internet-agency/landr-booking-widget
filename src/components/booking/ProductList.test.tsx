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
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import { ProductList } from './ProductList'

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
    mocks.listProducts.mockResolvedValue([
      makeProduct({ product_id: 'a', name: 'Legacy Product' }), // no bookable
    ])
    render(<ProductList operatorToken="tok" onSelect={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByText('Legacy Product')).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument()
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
    // The bookable product has a Select CTA; the sold-out one does not, so
    // exactly one Select button is present.
    expect(screen.getAllByRole('button', { name: 'Select' })).toHaveLength(1)
  })

  it('renders an empty-state when every product is sold out and showSoldOut is off', async () => {
    mocks.listProducts.mockResolvedValue([
      makeProduct({ product_id: 'a', name: 'Sold Out A', bookable: false }),
      makeProduct({ product_id: 'b', name: 'Sold Out B', bookable: false }),
    ])
    render(<ProductList operatorToken="tok" onSelect={vi.fn()} />)
    await waitFor(() =>
      expect(
        screen.getByText(/No products available right now/i),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByText('Sold Out A')).not.toBeInTheDocument()
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
