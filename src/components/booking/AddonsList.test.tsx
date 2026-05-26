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
        expectedQty={1}
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
        expectedQty={1}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the orange overbook warning when qty > expectedQty (service-flow, expectedQty=1)', () => {
    // landr-9p76: for service-flow add-ons (expectedQty=1) there is no
    // occupancy cap, so the over-warning rendering path is still reachable
    // (e.g. state hydrated from external source).  Occupancy-linked add-ons
    // (expectedQty > 1) cannot reach this state via the stepper — the + is
    // disabled at the ceiling — but the rendering branch is preserved for
    // defensive display of externally-set state.
    const addon = makeAddon({ addon_product_id: 'a1', name: 'Breakfast' })
    render(
      <AddonsList
        addons={[addon]}
        selection={{ a1: 2 }}
        onChange={vi.fn()}
        expectedQty={1}
      />,
    )
    expect(
      screen.getByTestId('addon-overbook-a1'),
    ).toBeInTheDocument()
  })

  it('does NOT show overbook or under warning when qty equals expectedQty', () => {
    const addon = makeAddon({ addon_product_id: 'a1', name: 'Breakfast' })
    render(
      <AddonsList
        addons={[addon]}
        selection={{ a1: 2 }}
        onChange={vi.fn()}
        expectedQty={2}
      />,
    )
    expect(screen.queryByTestId('addon-overbook-a1')).toBeNull()
    expect(screen.queryByTestId('addon-underbook-a1')).toBeNull()
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
        expectedQty={1}
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
        expectedQty={1}
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
        expectedQty={1}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Increase Breakfast/i }))
    expect(onChange).toHaveBeenCalledWith({ a1: 2 })
  })

  // landr-u4c7: occupancy-based warning tests.

  it('Double Room x1 (cap=2, expectedQty=2): 2 breakfast => no warning', () => {
    const addon = makeAddon({ addon_product_id: 'bf', name: 'Breakfast' })
    render(
      <AddonsList
        addons={[addon]}
        selection={{ bf: 2 }}
        onChange={vi.fn()}
        expectedQty={2}
      />,
    )
    expect(screen.queryByTestId('addon-overbook-bf')).toBeNull()
    expect(screen.queryByTestId('addon-underbook-bf')).toBeNull()
  })

  it('Double Room x1 (cap=2, expectedQty=2): 1 breakfast => under-warning', () => {
    const addon = makeAddon({ addon_product_id: 'bf', name: 'Breakfast' })
    render(
      <AddonsList
        addons={[addon]}
        selection={{ bf: 1 }}
        onChange={vi.fn()}
        expectedQty={2}
      />,
    )
    expect(screen.queryByTestId('addon-overbook-bf')).toBeNull()
    const underWarn = screen.getByTestId('addon-underbook-bf')
    expect(underWarn).toBeInTheDocument()
    expect(underWarn).toHaveTextContent(/only 1/i)
    expect(underWarn).toHaveTextContent(/sleeps 2/i)
  })

  it('Double Room x1 (cap=2, expectedQty=2): + button disabled at qty=2 (hard cap)', () => {
    // landr-9p76: occupancy-linked add-ons cannot exceed expectedQty via the
    // stepper — the + button must be disabled once qty >= expectedQty=2.
    const addon = makeAddon({ addon_product_id: 'bf', name: 'Breakfast' })
    render(
      <AddonsList
        addons={[addon]}
        selection={{ bf: 2 }}
        onChange={vi.fn()}
        expectedQty={2}
      />,
    )
    const plus = screen.getByRole('button', { name: /Increase Breakfast/i })
    expect(plus).toBeDisabled()
    // At the cap there is no overbook warning
    expect(screen.queryByTestId('addon-overbook-bf')).toBeNull()
    expect(screen.queryByTestId('addon-underbook-bf')).toBeNull()
  })

  it('Double Room x1 (cap=2, expectedQty=2): + enabled at qty=1 (under cap)', () => {
    // landr-9p76: booking fewer than occupancy is still allowed.
    const addon = makeAddon({ addon_product_id: 'bf', name: 'Breakfast' })
    render(
      <AddonsList
        addons={[addon]}
        selection={{ bf: 1 }}
        onChange={vi.fn()}
        expectedQty={2}
      />,
    )
    const plus = screen.getByRole('button', { name: /Increase Breakfast/i })
    expect(plus).not.toBeDisabled()
  })

  it('Single Room x1 (cap=1, expectedQty=1): 1 breakfast => no warning', () => {
    const addon = makeAddon({ addon_product_id: 'bf', name: 'Breakfast' })
    render(
      <AddonsList
        addons={[addon]}
        selection={{ bf: 1 }}
        onChange={vi.fn()}
        expectedQty={1}
      />,
    )
    expect(screen.queryByTestId('addon-overbook-bf')).toBeNull()
    expect(screen.queryByTestId('addon-underbook-bf')).toBeNull()
  })

  it('2 Double Rooms (cap=2 each, expectedQty=4): 4 breakfast => no warning', () => {
    const addon = makeAddon({ addon_product_id: 'bf', name: 'Breakfast' })
    render(
      <AddonsList
        addons={[addon]}
        selection={{ bf: 4 }}
        onChange={vi.fn()}
        expectedQty={4}
      />,
    )
    expect(screen.queryByTestId('addon-overbook-bf')).toBeNull()
    expect(screen.queryByTestId('addon-underbook-bf')).toBeNull()
  })

  it('2 Double Rooms (expectedQty=4): + disabled at qty=4 (hard cap)', () => {
    // landr-9p76: cap scales with room count — 2 doubles → cap at 4.
    const addon = makeAddon({ addon_product_id: 'bf', name: 'Breakfast' })
    render(
      <AddonsList
        addons={[addon]}
        selection={{ bf: 4 }}
        onChange={vi.fn()}
        expectedQty={4}
      />,
    )
    const plus = screen.getByRole('button', { name: /Increase Breakfast/i })
    expect(plus).toBeDisabled()
  })

  it('generic service add-on (expectedQty=1, max_qty=null): + still enabled above 1 (no occupancy cap)', () => {
    // landr-9p76: service-flow add-ons (expectedQty=1) must NOT receive an
    // occupancy hard-cap — they stay incrementable per their own max_qty.
    const addon = makeAddon({
      addon_product_id: 'svc',
      name: 'Video Package',
      max_qty: null,
    })
    render(
      <AddonsList
        addons={[addon]}
        selection={{ svc: 5 }}
        onChange={vi.fn()}
        expectedQty={1}
      />,
    )
    const plus = screen.getByRole('button', { name: /Increase Video Package/i })
    expect(plus).not.toBeDisabled()
  })

  it('service add-on with expectedQty=1: qty=2 shows over-warning, qty=1 is silent', () => {
    // "Tandem video package" — service flow, no room context, expectedQty=1.
    // Under-warning must never fire (qty is 0 or ≥1 for non-room add-ons).
    const addon = makeAddon({ addon_product_id: 'vid', name: 'Video Package' })

    // qty=2: over-warning visible
    const { rerender } = render(
      <AddonsList
        addons={[addon]}
        selection={{ vid: 2 }}
        onChange={vi.fn()}
        expectedQty={1}
      />,
    )
    expect(screen.getByTestId('addon-overbook-vid')).toBeInTheDocument()
    expect(screen.queryByTestId('addon-underbook-vid')).toBeNull()

    // qty=1: no warning
    rerender(
      <AddonsList
        addons={[addon]}
        selection={{ vid: 1 }}
        onChange={vi.fn()}
        expectedQty={1}
      />,
    )
    expect(screen.queryByTestId('addon-overbook-vid')).toBeNull()
    expect(screen.queryByTestId('addon-underbook-vid')).toBeNull()
  })

  it('shows no warning when qty is 0 regardless of expectedQty', () => {
    const addon = makeAddon({ addon_product_id: 'bf', name: 'Breakfast' })
    render(
      <AddonsList
        addons={[addon]}
        selection={{}}
        onChange={vi.fn()}
        expectedQty={2}
      />,
    )
    expect(screen.queryByTestId('addon-overbook-bf')).toBeNull()
    expect(screen.queryByTestId('addon-underbook-bf')).toBeNull()
  })
})
