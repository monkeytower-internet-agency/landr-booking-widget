import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Location } from '@/api/types'
import { PickupLocationPicker } from './PickupLocationPicker'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    listLocations: vi.fn<(slug: string) => Promise<Location[]>>(),
  },
}))

vi.mock('@/api/client', () => ({
  listLocations: mocks.listLocations,
}))

function makeLocation(id: string, name: string): Location {
  return {
    location_id: id,
    name,
    name_localized: null,
    parent_id: null,
    role_type: { code: 'pickup', label: 'Pickup' },
  }
}

describe('PickupLocationPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders fetched pickup locations and emits onConfirm with the picked id', async () => {
    mocks.listLocations.mockResolvedValue([
      makeLocation('loc-a', 'Main Square'),
      makeLocation('loc-b', 'Beach Parking'),
    ])
    const onConfirm = vi.fn()

    render(
      <PickupLocationPicker
        operatorSlug="para42"
        productName="Tandem Flight"
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Main Square')).toBeInTheDocument(),
    )

    // Continue starts disabled until a radio is picked.
    const continueBtn = screen.getByRole('button', { name: /Continue/i })
    expect(continueBtn).toBeDisabled()

    fireEvent.click(screen.getByRole('radio', { name: /Beach Parking/i }))
    expect(continueBtn).not.toBeDisabled()
    fireEvent.click(continueBtn)
    expect(onConfirm).toHaveBeenCalledWith('loc-b')
  })

  // ── Back-nav state restoration (landr-yf0n) ──────────────────────
  // App.tsx threads the previously confirmed pickup id back as
  // initialLocationId so the radio re-mounts with the prior choice
  // already selected — Continue stays enabled without a second click.

  it('restores the prior pickup choice from initialLocationId on back-nav re-entry', async () => {
    mocks.listLocations.mockResolvedValue([
      makeLocation('loc-a', 'Main Square'),
      makeLocation('loc-b', 'Beach Parking'),
    ])
    const onConfirm = vi.fn()

    render(
      <PickupLocationPicker
        operatorSlug="para42"
        productName="Tandem Flight"
        initialLocationId="loc-b"
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Beach Parking')).toBeInTheDocument(),
    )

    // The Beach Parking radio is pre-selected (initialLocationId='loc-b').
    const beachRadio = screen.getByRole('radio', { name: /Beach Parking/i })
    expect(beachRadio).toBeChecked()
    // Continue enabled without a click — the restored selection counts.
    const continueBtn = screen.getByRole('button', { name: /Continue/i })
    expect(continueBtn).not.toBeDisabled()

    fireEvent.click(continueBtn)
    expect(onConfirm).toHaveBeenCalledWith('loc-b')
  })

  it('treats initialLocationId=null as no prior selection (Continue stays disabled)', async () => {
    mocks.listLocations.mockResolvedValue([makeLocation('loc-a', 'Main Square')])

    render(
      <PickupLocationPicker
        operatorSlug="para42"
        productName="Tandem Flight"
        initialLocationId={null}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Main Square')).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDisabled()
  })
})
