import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Product, ProductAddon } from '@/api/types'
import { ServiceAddonsStep } from './ServiceAddonsStep'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getProductAddons: vi.fn<(productId: string) => Promise<ProductAddon[]>>(),
  },
}))

vi.mock('@/api/client', () => ({
  getProductAddons: mocks.getProductAddons,
}))

function makeProduct(): Product {
  return {
    product_id: 'service-1',
    slug: 'tandem-long',
    name: 'Tandem Long',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'time_slot',
    is_contiguous: false,
    duration_minutes: 45,
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
    hotel_location_id: null,
    price_per_unit: null,
    currency: 'EUR',
  }
}

function makeAddon(overrides: Partial<ProductAddon> = {}): ProductAddon {
  return {
    product_addon_id: 'pa-1',
    addon_product_id: 'addon-1',
    name: 'Video Package',
    name_localized: null,
    is_required: false,
    min_qty: 0,
    max_qty: null,
    sort_order: 10,
    price_per_unit: 39,
    currency: 'EUR',
    product_kind: 'service',
    ...overrides,
  }
}

describe('ServiceAddonsStep (landr-cip6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders fetched add-ons and emits selected line items on Continue', async () => {
    mocks.getProductAddons.mockResolvedValue([
      makeAddon({ addon_product_id: 'video-1', name: 'Video Package' }),
    ])
    const onConfirm = vi.fn()

    render(
      <ServiceAddonsStep
        product={makeProduct()}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Video Package')).toBeInTheDocument(),
    )

    // Bump video to 1.
    fireEvent.click(
      screen.getByRole('button', { name: /Increase Video Package/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(onConfirm).toHaveBeenCalledWith([
      { productId: 'video-1', quantity: 1, productKind: 'service' },
    ])
  })

  it('shows the orange overbook warning when qty > 1 (parent qty is implicitly 1)', async () => {
    mocks.getProductAddons.mockResolvedValue([
      makeAddon({ addon_product_id: 'video-1', name: 'Video Package' }),
    ])

    render(
      <ServiceAddonsStep
        product={makeProduct()}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Video Package')).toBeInTheDocument(),
    )

    const plus = screen.getByRole('button', { name: /Increase Video Package/i })
    fireEvent.click(plus)
    fireEvent.click(plus)

    expect(screen.getByTestId('addon-overbook-video-1')).toBeInTheDocument()
    // Continue must still be enabled — overbook warning is non-blocking.
    expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled()
  })

  it('blocks Continue when a required add-on is below min_qty', async () => {
    // Required + min_qty=1 seeds at 1 (Continue enabled). The user
    // then decrements to 0 and Continue must lock until they bump
    // back up.
    mocks.getProductAddons.mockResolvedValue([
      makeAddon({
        addon_product_id: 'insurance-1',
        name: 'Insurance',
        is_required: true,
        min_qty: 1,
      }),
    ])

    render(
      <ServiceAddonsStep
        product={makeProduct()}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Insurance')).toBeInTheDocument(),
    )

    // Seeded to 1 → Continue enabled.
    const continueBtn = screen.getByRole('button', { name: /Continue/i })
    expect(continueBtn).not.toBeDisabled()

    // Decrement to 0 → required-error appears + Continue blocks.
    fireEvent.click(
      screen.getByRole('button', { name: /Decrease Insurance/i }),
    )
    expect(screen.getByTestId('addon-required-error-insurance-1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDisabled()
  })

  it('seeds required add-ons at their min_qty by default', async () => {
    mocks.getProductAddons.mockResolvedValue([
      makeAddon({
        addon_product_id: 'pack-1',
        name: 'Pack',
        is_required: true,
        min_qty: 3,
      }),
    ])
    const onConfirm = vi.fn()

    render(
      <ServiceAddonsStep
        product={makeProduct()}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    await waitFor(() => expect(screen.getByText('Pack')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(onConfirm).toHaveBeenCalledWith([
      { productId: 'pack-1', quantity: 3, productKind: 'service' },
    ])
  })

  // ── Back-nav state restoration (landr-yf0n) ──────────────────────
  // App.tsx threads the previously confirmed add-on line items back as
  // initialAddons so the step re-mounts with the customer's prior picks
  // restored — not reset to the min_qty seed.

  it('restores prior add-on selection from initialAddons on back-nav re-entry', async () => {
    mocks.getProductAddons.mockResolvedValue([
      makeAddon({ addon_product_id: 'video-1', name: 'Video Package' }),
    ])
    const onConfirm = vi.fn()

    render(
      <ServiceAddonsStep
        product={makeProduct()}
        initialAddons={[{ productId: 'video-1', quantity: 2 }]}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Video Package')).toBeInTheDocument(),
    )

    // Continue without further interaction → emits the restored line
    // items unchanged (quantity=2, not the min_qty default of 0).
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(onConfirm).toHaveBeenCalledWith([
      { productId: 'video-1', quantity: 2, productKind: 'service' },
    ])
  })

  it('initialAddons override the required-min seed (customer pick wins)', async () => {
    // The catalogue has a required add-on with min_qty=3. The seed would
    // normally start it at 3, but the initialAddons map carries qty=5
    // (the customer's prior pick) — that wins.
    mocks.getProductAddons.mockResolvedValue([
      makeAddon({
        addon_product_id: 'pack-1',
        name: 'Pack',
        is_required: true,
        min_qty: 3,
      }),
    ])
    const onConfirm = vi.fn()

    render(
      <ServiceAddonsStep
        product={makeProduct()}
        initialAddons={[{ productId: 'pack-1', quantity: 5 }]}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    await waitFor(() => expect(screen.getByText('Pack')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(onConfirm).toHaveBeenCalledWith([
      { productId: 'pack-1', quantity: 5, productKind: 'service' },
    ])
  })

  it('shows an empty-state message when the add-ons fetch returns []', async () => {
    mocks.getProductAddons.mockResolvedValue([])

    render(
      <ServiceAddonsStep
        product={makeProduct()}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByText(/No add-ons available/i),
      ).toBeInTheDocument(),
    )
    // Continue must be enabled — empty add-ons is a valid "nothing to do" path.
    expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled()
  })
})
