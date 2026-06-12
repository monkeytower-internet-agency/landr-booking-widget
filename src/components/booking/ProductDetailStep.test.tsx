/**
 * landr-d8rg.7: ProductDetailStep tests.
 *
 * Covers: base render, gallery swap (thumbnail click swaps hero), facts
 * chips conditional rendering, price hidden when price_from is null,
 * onBook / onBack callbacks fire, sold-out (FullyBookedNotice + no Book
 * CTA), markdown description renders, and the variant-aware title
 * treatment (aurora overlay vs summit/alpine heading-below).
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import { VariantProvider } from '@/lib/variant.tsx'
import type { Variant } from '@/lib/variant'
import { ProductDetailStep } from './ProductDetailStep'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    product_id: 'p-1',
    slug: 'tandem-classic',
    name: 'Tandem Classic',
    name_localized: null,
    short_description: 'A great flight.',
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
    hotel_offering: 'none',
    currency: 'EUR',
    bookable: true,
    images: [],
    price_from: '59.00',
    ...overrides,
  }
}

function renderStep(
  product: Product,
  {
    onBook = vi.fn(),
    onBack = vi.fn(),
    variant = 'summit' as Variant,
  }: { onBook?: () => void; onBack?: () => void; variant?: Variant } = {},
) {
  render(
    <VariantProvider value={variant}>
      <ProductDetailStep product={product} onBook={onBook} onBack={onBack} />
    </VariantProvider>,
  )
  return { onBook, onBack }
}

const IMAGES = [
  {
    thumb_url: 'https://img/thumb-1.webp',
    hero_url: 'https://img/hero-1.webp',
    alt: 'First view',
  },
  {
    thumb_url: 'https://img/thumb-2.webp',
    hero_url: 'https://img/hero-2.webp',
    alt: 'Second view',
  },
]

describe('ProductDetailStep', () => {
  it('renders the name, facts and Book CTA for a bookable product', () => {
    renderStep(makeProduct())
    expect(screen.getByTestId('product-detail-step')).toBeInTheDocument()
    expect(screen.getByTestId('product-detail-name')).toHaveTextContent(
      'Tandem Classic',
    )
    expect(screen.getByTestId('product-detail-book-cta')).toBeInTheDocument()
    // duration chip present
    expect(screen.getByTestId('product-facts')).toHaveTextContent('25 min')
  })

  it('falls back to ProductArt when there are no images and shows no thumb strip', () => {
    renderStep(makeProduct({ images: [] }))
    expect(
      screen.queryByTestId('product-gallery-hero-image'),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('product-gallery-thumbs')).not.toBeInTheDocument()
  })

  it('renders a single image hero with no thumbnail strip', () => {
    renderStep(makeProduct({ images: [IMAGES[0]] }))
    expect(screen.getByTestId('product-gallery-hero-image')).toHaveAttribute(
      'src',
      IMAGES[0].hero_url,
    )
    expect(screen.queryByTestId('product-gallery-thumbs')).not.toBeInTheDocument()
  })

  it('swaps the hero when a thumbnail is clicked', () => {
    renderStep(makeProduct({ images: IMAGES }))
    const hero = screen.getByTestId('product-gallery-hero-image')
    expect(hero).toHaveAttribute('src', IMAGES[0].hero_url)

    const thumbs = screen.getAllByTestId('product-gallery-thumb')
    expect(thumbs).toHaveLength(2)
    fireEvent.click(thumbs[1])

    expect(screen.getByTestId('product-gallery-hero-image')).toHaveAttribute(
      'src',
      IMAGES[1].hero_url,
    )
    // selection ring follows the active thumb
    expect(thumbs[1]).toHaveAttribute('data-active', 'true')
    expect(thumbs[0]).toHaveAttribute('data-active', 'false')
  })

  it('conditionally renders facts chips (hotel + pickup)', () => {
    renderStep(
      makeProduct({
        duration_minutes: null,
        hotel_offering: 'optional',
        needs_pickup: true,
      }),
    )
    const facts = screen.getByTestId('product-facts')
    expect(facts).toHaveTextContent('Hotel optional')
    expect(facts).toHaveTextContent('Pickup available')
    expect(facts).not.toHaveTextContent('min')
  })

  it('shows the "from" price and hides it when price_from is null', () => {
    const { unmount } = render(
      <VariantProvider value="summit">
        <ProductDetailStep
          product={makeProduct({ price_from: '59.00' })}
          onBook={vi.fn()}
          onBack={vi.fn()}
        />
      </VariantProvider>,
    )
    expect(screen.getByTestId('product-detail-price')).toHaveTextContent(
      'from €59.00',
    )
    unmount()

    renderStep(makeProduct({ price_from: null }))
    expect(screen.queryByTestId('product-detail-price')).not.toBeInTheDocument()
  })

  it('fires onBook when the Book CTA is clicked', () => {
    const { onBook } = renderStep(makeProduct())
    fireEvent.click(screen.getByTestId('product-detail-book-cta'))
    expect(onBook).toHaveBeenCalledTimes(1)
  })

  it('fires onBack when the Back link is clicked', () => {
    const { onBack } = renderStep(makeProduct())
    fireEvent.click(screen.getByTestId('step-back-button'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('renders markdown description via the shared pipeline', () => {
    renderStep(
      makeProduct({ description: '# Heading\n\nSome **bold** body copy.' }),
    )
    const desc = screen.getByTestId('product-detail-description')
    expect(within(desc).getByRole('heading', { name: 'Heading' })).toBeInTheDocument()
    expect(within(desc).getByText('bold')).toBeInTheDocument()
  })

  it('shows the Fully booked state and no Book CTA when sold out', () => {
    renderStep(makeProduct({ bookable: false }))
    expect(screen.getByTestId('fully-booked-badge')).toBeInTheDocument()
    expect(
      screen.queryByTestId('product-detail-book-cta'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('product-detail-book-cta-mobile'),
    ).not.toBeInTheDocument()
  })

  it('overlays the title on the hero for the aurora variant (no separate heading)', () => {
    renderStep(makeProduct({ images: IMAGES }), { variant: 'aurora' })
    expect(
      screen.getByTestId('product-gallery-overlay-title'),
    ).toHaveTextContent('Tandem Classic')
    // aurora hides the standalone heading to avoid a duplicate title
    expect(screen.queryByTestId('product-detail-name')).not.toBeInTheDocument()
  })

  it('renders a heading below the hero for non-aurora variants', () => {
    renderStep(makeProduct({ images: IMAGES }), { variant: 'alpine' })
    expect(screen.getByTestId('product-detail-name')).toHaveTextContent(
      'Tandem Classic',
    )
    expect(
      screen.queryByTestId('product-gallery-overlay-title'),
    ).not.toBeInTheDocument()
  })
})

// User report 2026-06-04: products with ONLY a short_description (no long
// description) showed no copy at all on the detail page — the page rendered
// product.description exclusively. Long wins when present; short is the
// fallback; localized variants are picked like everywhere else.
describe('ProductDetailStep description fallback', () => {
  it('falls back to short_description when description is null', () => {
    renderStep(
      makeProduct({ description: null, short_description: 'A great flight.' }),
    )
    expect(
      screen.getByTestId('product-detail-description'),
    ).toHaveTextContent('A great flight.')
  })

  it('prefers the long description when both exist', () => {
    renderStep(
      makeProduct({
        description: 'Long form **copy**.',
        short_description: 'Short.',
      }),
    )
    const el = screen.getByTestId('product-detail-description')
    expect(el).toHaveTextContent('Long form copy.')
    expect(el).not.toHaveTextContent('Short.')
  })

  it('renders nothing when neither description exists', () => {
    renderStep(
      makeProduct({ description: null, short_description: null }),
    )
    expect(
      screen.queryByTestId('product-detail-description'),
    ).not.toBeInTheDocument()
  })
})
