import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FixedDateWindow } from '@/api/types'
import { FixedDateWindowChips } from './FixedDateWindowChips'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getFixedDateWindows: vi.fn<(id: string) => Promise<FixedDateWindow[]>>(),
  },
}))

vi.mock('@/api/client', () => ({
  getFixedDateWindows: mocks.getFixedDateWindows,
}))

describe('FixedDateWindowChips', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders one chip per window with its date range and status', async () => {
    mocks.getFixedDateWindows.mockResolvedValue([
      { id: 'w-1', start_date: '2026-08-04', end_date: '2026-08-10', capacity: 8, capacity_reserved: 0 },
      { id: 'w-2', start_date: '2026-08-18', end_date: '2026-08-24', capacity: 8, capacity_reserved: 8 },
    ])
    render(<FixedDateWindowChips productId="p-1" slug="siv-course" />)

    const chips = await waitFor(() =>
      screen.getByTestId('product-date-chips-siv-course'),
    )
    expect(chips).toHaveTextContent(/Aug 4, 2026.*Aug 10, 2026/)
    expect(chips).toHaveTextContent('8 seats left')
    expect(chips).toHaveTextContent(/Aug 18, 2026.*Aug 24, 2026/)
    expect(chips).toHaveTextContent('Full')
  })

  it('shows "Available" instead of a seat count when exposeSeats is false', async () => {
    mocks.getFixedDateWindows.mockResolvedValue([
      { id: 'w-1', start_date: '2026-08-04', end_date: '2026-08-10', capacity: 8, capacity_reserved: 2 },
    ])
    render(
      <FixedDateWindowChips productId="p-1" slug="siv-course" exposeSeats={false} />,
    )
    const chips = await waitFor(() =>
      screen.getByTestId('product-date-chips-siv-course'),
    )
    expect(chips).toHaveTextContent('Available')
    expect(chips).not.toHaveTextContent(/seats? left/i)
  })

  it('renders nothing once loaded with zero windows', async () => {
    mocks.getFixedDateWindows.mockResolvedValue([])
    render(<FixedDateWindowChips productId="p-1" slug="siv-course" />)

    await waitFor(() =>
      expect(mocks.getFixedDateWindows).toHaveBeenCalledWith('p-1'),
    )
    expect(
      screen.queryByTestId('product-date-chips-siv-course'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('product-date-chips-loading-siv-course'),
    ).not.toBeInTheDocument()
  })

  it('renders nothing (fails open) when the fetch errors', async () => {
    mocks.getFixedDateWindows.mockRejectedValue(new Error('nope'))
    render(<FixedDateWindowChips productId="p-1" slug="siv-course" />)

    await waitFor(() =>
      expect(mocks.getFixedDateWindows).toHaveBeenCalledWith('p-1'),
    )
    await waitFor(() =>
      expect(
        screen.queryByTestId('product-date-chips-loading-siv-course'),
      ).not.toBeInTheDocument(),
    )
    expect(
      screen.queryByTestId('product-date-chips-siv-course'),
    ).not.toBeInTheDocument()
  })
})
