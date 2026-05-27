import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import { ShopComingSoonStub } from './ShopComingSoonStub'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    product_id: 'p-shop',
    slug: 'pdf-guide',
    name: 'PDF Guide',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'digital_good',
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
    ...overrides,
  }
}

describe('ShopComingSoonStub (landr-y9k)', () => {
  it('renders the product name + shop-coming-soon copy', () => {
    render(<ShopComingSoonStub product={makeProduct()} onBack={() => {}} />)
    expect(screen.getByText('PDF Guide')).toBeInTheDocument()
    expect(screen.getByText(/Shop, which is coming soon/i)).toBeInTheDocument()
    expect(screen.getByText(/digital product/i)).toBeInTheDocument()
  })

  it('uses the right kind label for gift_card', () => {
    render(
      <ShopComingSoonStub
        product={makeProduct({ product_kind: 'gift_card', name: '50 EUR Gift' })}
        onBack={() => {}}
      />,
    )
    expect(screen.getByText(/gift card/i)).toBeInTheDocument()
  })

  it('fires onBack when the Back button is clicked', () => {
    const onBack = vi.fn()
    render(<ShopComingSoonStub product={makeProduct()} onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
