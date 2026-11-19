import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockOccupancyStay } from '@/api/mocks'
import type { BookingSelection } from './BookingForm'
import { DetailsStep } from './DetailsStep'

const SELECTION: BookingSelection = { kind: 'days', selectedDays: ['2026-12-01', '2026-12-03'] }

function setup(collectGuestAges: boolean) {
  const onLive = vi.fn()
  render(
    <DetailsStep
      product={mockOccupancyStay}
      selection={SELECTION}
      onBack={vi.fn()}
      onConfirm={vi.fn()}
      onLiveParticipantsChange={onLive}
      collectGuestAges={collectGuestAges}
    />,
  )
  fireEvent.click(screen.getByTestId('add-participant'))
  return onLive
}

describe('DetailsStep guest ages (landr-hfvyc.2)', () => {
  it('shows no adult/child controls without an occupancy rule', () => {
    setup(false)
    expect(screen.queryByTestId('guest-age-controls-2')).not.toBeInTheDocument()
  })

  it('shows controls for added guests and reports child ages live', () => {
    const onLive = setup(true)
    expect(screen.getByTestId('guest-age-controls-2')).toBeInTheDocument()
    fireEvent.change(screen.getByTestId('guest-age-band-2'), { target: { value: 'c:7' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onLive).toHaveBeenLastCalledWith(2, [], 0, [7])
    fireEvent.change(screen.getByTestId('guest-age-band-2'), { target: { value: 'a:adult' } })
    expect(onLive).toHaveBeenLastCalledWith(2, [], 0, [])
  })
})
