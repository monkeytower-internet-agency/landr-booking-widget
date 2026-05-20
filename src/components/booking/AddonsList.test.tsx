import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ProductAddon } from '@/api/types'
import { AddonsList } from './AddonsList'

function makeAddon(overrides: Partial<ProductAddon> = {}): ProductAddon {
  return {
    product_addon_id: 'pa-1',
    addon_product_id: 'addon-1',
    name: 'Breakfast',
    name_localized: null,
    is_required: false,
    min_qty: 0,
    max_qty: null,
    sort_order: 10,
    price_per_unit: 10,
    currency: 'EUR',
    ...overrides,
  }
}

describe('AddonsList (landr-cip6)', () => {
  it('renders one row per add-on with the localized name + per-unit price', () => {
    const onChange = vi.fn()
    render(
      <AddonsList
        addons={[
          makeAddon({ addon_product_id: 'a1', name: 'Breakfast', price_per_unit: 10 }),
          makeAddon({ addon_product_id: 'a2', name: 'Video Package', price_per_unit: 39 }),
        ]}
        selection={{}}
        onChange={onChange}
        parentQty={1}
      />,
    )

    expect(screen.getByText('Breakfast')).toBeInTheDocument()
    expect(screen.getByText('Video Package')).toBeInTheDocument()
    // Currency formatting is locale-dependent — assert on the digits.
    expect(screen.getAllByText(/10/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/39/).length).toBeGreaterThan(0)
  })

  it('renders nothing when given an empty addons list', () => {
    const { container } = render(
      <AddonsList
        addons={[]}
        selection={{}}
        onChange={vi.fn()}
        parentQty={1}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the orange overbook warning when qty > parent qty', () => {
    const addon = makeAddon({ addon_product_id: 'a1', name: 'Breakfast' })
    render(
      <AddonsList
        addons={[addon]}
        selection={{ a1: 3 }}
        onChange={vi.fn()}
        parentQty={2}
      />,
    )
    expect(
      screen.getByTestId('addon-overbook-a1'),
    ).toBeInTheDocument()
  })

  it('does NOT show overbook warning when qty equals parent qty', () => {
    const addon = makeAddon({ addon_product_id: 'a1', name: 'Breakfast' })
    render(
      <AddonsList
        addons={[addon]}
        selection={{ a1: 2 }}
        onChange={vi.fn()}
        parentQty={2}
      />,
    )
    expect(screen.queryByTestId('addon-overbook-a1')).toBeNull()
  })

  it('shows the required-error helper when a required add-on is at 0', () => {
    const addon = makeAddon({
      addon_product_id: 'a1',
      name: 'Insurance',
      is_required: true,
      min_qty: 1,
    })
    render(
      <AddonsList
        addons={[addon]}
        selection={{}}
        onChange={vi.fn()}
        parentQty={1}
      />,
    )
    expect(screen.getByTestId('addon-required-error-a1')).toHaveTextContent(
      /Required/,
    )
  })

  it('disables the plus button at max_qty', () => {
    const addon = makeAddon({
      addon_product_id: 'a1',
      name: 'Breakfast',
      max_qty: 2,
    })
    render(
      <AddonsList
        addons={[addon]}
        selection={{ a1: 2 }}
        onChange={vi.fn()}
        parentQty={1}
      />,
    )
    const plus = screen.getByRole('button', { name: /Increase Breakfast/i })
    expect(plus).toBeDisabled()
  })

  it('bumps quantity via the +/- buttons and propagates the change', () => {
    const addon = makeAddon({ addon_product_id: 'a1', name: 'Breakfast' })
    const onChange = vi.fn()
    render(
      <AddonsList
        addons={[addon]}
        selection={{ a1: 1 }}
        onChange={onChange}
        parentQty={1}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Increase Breakfast/i }))
    expect(onChange).toHaveBeenCalledWith({ a1: 2 })
  })
})
