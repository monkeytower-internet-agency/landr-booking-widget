import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Location } from '@/api/types'
import { PickupLocationPicker } from './PickupLocationPicker'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    listPickupLocationsForOperator: vi.fn<(slug: string) => Promise<Location[]>>(),
  },
}))

vi.mock('@/api/client', () => ({
  listPickupLocationsForOperator: mocks.listPickupLocationsForOperator,
}))

function makeLocation(id: string, name: string): Location {
  return {
    location_id: id,
    name,
    name_localized: null,
    parent_id: null,
    role_type: { code: 'pickup', label: 'Pickup' },
    place_roles: ['pickup'],
  }
}

describe('PickupLocationPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders fetched pickup locations and emits onConfirm with the picked id', async () => {
    mocks.listPickupLocationsForOperator.mockResolvedValue([
      makeLocation('loc-a', 'Main Square'),
      makeLocation('loc-b', 'Beach Parking'),
    ])
    const onConfirm = vi.fn()

    render(
      <PickupLocationPicker
        operatorToken="para42"
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
    mocks.listPickupLocationsForOperator.mockResolvedValue([
      makeLocation('loc-a', 'Main Square'),
      makeLocation('loc-b', 'Beach Parking'),
    ])
    const onConfirm = vi.fn()

    render(
      <PickupLocationPicker
        operatorToken="para42"
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
    mocks.listPickupLocationsForOperator.mockResolvedValue([makeLocation('loc-a', 'Main Square')])

    render(
      <PickupLocationPicker
        operatorToken="para42"
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

  it('shows no chevron when a place has no details', async () => {
    mocks.listPickupLocationsForOperator.mockResolvedValue([makeLocation('loc-a', 'Main Square')])
    render(<PickupLocationPicker operatorToken="t" productName="P" onConfirm={vi.fn()} />)
    await screen.findByText('Main Square')
    expect(screen.queryByTestId('pickup-details-toggle-loc-a')).toBeNull()
  })

  it('chevron expands description, address, maps link and phone without selecting', async () => {
    mocks.listPickupLocationsForOperator.mockResolvedValue([
      {
        ...makeLocation('loc-a', 'Main Square'),
        description: 'Blue kiosk',
        address: 'Hafen 1',
        phone: '+49 30 123-456',
        maps_link: 'https://maps.example.com/x',
      },
    ])
    render(<PickupLocationPicker operatorToken="t" productName="P" onConfirm={vi.fn()} />)
    const toggle = await screen.findByTestId('pickup-details-toggle-loc-a')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const panel = screen.getByTestId('pickup-details-loc-a')
    expect(panel).toHaveTextContent('Blue kiosk')
    expect(panel).toHaveTextContent('Hafen 1')
    expect(screen.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute(
      'href',
      'https://maps.example.com/x',
    )
    expect(screen.getByRole('link', { name: '+49 30 123-456' })).toHaveAttribute(
      'href',
      'tel:+4930123456',
    )
    expect(screen.getByRole('radio')).not.toBeChecked()
  })

  it('derives the maps link from geo, then address, when maps_link is absent', async () => {
    const { placeDetails } = await import('@/lib/placeDetails')
    const base = makeLocation('a', 'A')
    expect(placeDetails({ ...base, geo: { lat: 28.05, lng: -16.73 } }, 'en').mapsUrl).toBe(
      'https://www.google.com/maps/search/?api=1&query=28.05,-16.73',
    )
    expect(placeDetails({ ...base, address: 'Hafen 1, Köln' }, 'en').mapsUrl).toBe(
      'https://www.google.com/maps/search/?api=1&query=Hafen+1%2C+K%C3%B6ln',
    )
    expect(placeDetails({ ...base, maps_link: 'javascript:x', address: 'X' }, 'en').mapsUrl).toContain(
      'query=X',
    )
  })
})
