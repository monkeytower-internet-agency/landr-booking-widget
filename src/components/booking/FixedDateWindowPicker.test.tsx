import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FixedDateWindow, Product } from '@/api/types'
import { FixedDateWindowPicker } from './FixedDateWindowPicker'
import { expandWindowDays } from './expandWindowDays'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getFixedDateWindows: vi.fn<(id: string) => Promise<FixedDateWindow[]>>(),
  },
}))

vi.mock('@/api/client', () => ({
  getProductAlternatives: vi.fn().mockResolvedValue([]),
  getFixedDateWindows: mocks.getFixedDateWindows,
}))

function makeProduct(): Product {
  return {
    product_id: 'p-1',
    slug: 'siv-course',
    name: 'SIV Course',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'fixed_window',
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
    needs_pickup: false,
  }
}

describe('FixedDateWindowPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders one card per window and disables full ones', async () => {
    mocks.getFixedDateWindows.mockResolvedValue([
      { id: 'w-1', start_date: '2027-07-07', end_date: '2027-07-13', capacity: 8, capacity_reserved: 0 },
      { id: 'w-2', start_date: '2027-08-04', end_date: '2027-08-10', capacity: 8, capacity_reserved: 8 },
    ])
    const onConfirm = vi.fn()
    render(
      <FixedDateWindowPicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={onConfirm}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText(/Jul 7, 2027/)).toBeInTheDocument()
      expect(screen.getByText(/Aug 4, 2027/)).toBeInTheDocument()
    })
    expect(screen.getByText('8 seats left')).toBeInTheDocument()
    expect(screen.getByText('Full')).toBeInTheDocument()
  })

  it('hides seat counts when exposeSeats is false', async () => {
    mocks.getFixedDateWindows.mockResolvedValue([
      { id: 'w-1', start_date: '2027-07-07', end_date: '2027-07-13', capacity: 8, capacity_reserved: 0 },
    ])
    render(
      <FixedDateWindowPicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={() => {}}
        exposeSeats={false}
      />,
    )
    await waitFor(() => expect(screen.getByText('Available')).toBeInTheDocument())
    expect(screen.queryByText(/seats? left/i)).not.toBeInTheDocument()
  })

  it('confirms selected window with a synthesised slot', async () => {
    const dateWindow: FixedDateWindow = {
      id: 'w-1',
      start_date: '2027-07-07',
      end_date: '2027-07-13',
      capacity: 8,
      capacity_reserved: 2,
    }
    mocks.getFixedDateWindows.mockResolvedValue([dateWindow])
    const onConfirm = vi.fn()
    render(
      <FixedDateWindowPicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={onConfirm}
      />,
    )

    await waitFor(() => screen.getByText(/Jul 7, 2027/))
    fireEvent.click(screen.getByText(/Jul 7, 2027/))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [slot, returnedWindow] = onConfirm.mock.calls[0]
    expect(slot.date).toBe('2027-07-07')
    expect(slot.availability_id).toBe('w-1')
    expect(slot.capacity).toBe(8)
    expect(slot.available_seats).toBe(6)
    expect(returnedWindow).toBe(dateWindow)
  })

  it('renders error state on API failure', async () => {
    mocks.getFixedDateWindows.mockRejectedValue(new Error('nope'))
    render(
      <FixedDateWindowPicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText(/Could not load course windows/i)).toBeInTheDocument(),
    )
  })

  it('landr-t869m.5: a window inside the lead-time window is shown but not bookable', async () => {
    mocks.getFixedDateWindows.mockResolvedValue([
      {
        id: 'w-1',
        start_date: '2027-07-07',
        end_date: '2027-07-13',
        capacity: 8,
        capacity_reserved: 0,
        activity_bookable: false,
      },
    ])
    render(
      <FixedDateWindowPicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    )
    await waitFor(() => expect(screen.getByText(/Jul 7, 2027/)).toBeInTheDocument())
    expect(screen.getByText('Too late to book')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Jul 7, 2027/ })).toBeDisabled()
  })

  it('landr-t869m.5: a mandatory-hotel window with a too-late stay is not bookable, even with activity_bookable true', async () => {
    mocks.getFixedDateWindows.mockResolvedValue([
      {
        id: 'w-1',
        start_date: '2027-07-07',
        end_date: '2027-07-13',
        capacity: 8,
        capacity_reserved: 0,
        activity_bookable: true,
        accommodation_bookable: false,
      },
    ])
    render(
      <FixedDateWindowPicker
        product={{ ...makeProduct(), hotel_offering: 'mandatory' }}
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    )
    await waitFor(() => expect(screen.getByText(/Jul 7, 2027/)).toBeInTheDocument())
    expect(screen.getByText('Too late to book')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Jul 7, 2027/ })).toBeDisabled()
  })

  it('landr-t869m.5: an optional-hotel window with a too-late stay stays bookable (accommodation gates separately)', async () => {
    mocks.getFixedDateWindows.mockResolvedValue([
      {
        id: 'w-1',
        start_date: '2027-07-07',
        end_date: '2027-07-13',
        capacity: 8,
        capacity_reserved: 0,
        activity_bookable: true,
        accommodation_bookable: false,
      },
    ])
    render(
      <FixedDateWindowPicker
        product={{ ...makeProduct(), hotel_offering: 'optional' }}
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    )
    await waitFor(() => expect(screen.getByText(/Jul 7, 2027/)).toBeInTheDocument())
    expect(screen.queryByText('Too late to book')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Jul 7, 2027/ })).not.toBeDisabled()
  })

  it('landr-t869m.5: an absent lead-time flag fails open (bookable)', async () => {
    mocks.getFixedDateWindows.mockResolvedValue([
      { id: 'w-1', start_date: '2027-07-07', end_date: '2027-07-13', capacity: 8, capacity_reserved: 0 },
    ])
    render(
      <FixedDateWindowPicker
        product={{ ...makeProduct(), hotel_offering: 'mandatory' }}
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    )
    await waitFor(() => expect(screen.getByText(/Jul 7, 2027/)).toBeInTheDocument())
    expect(screen.queryByText('Too late to book')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Jul 7, 2027/ })).not.toBeDisabled()
  })

  it('landr-my6fc.5: overlapping windows are both selectable and submit their own exact range', async () => {
    // A Sat 3 -> Sat 10 Jul, B Fri 9 -> Fri 16 Jul: Jul 9-10 is shared.
    const a: FixedDateWindow = { id: 'w-a', start_date: '2027-07-03', end_date: '2027-07-10', capacity: 8, capacity_reserved: 0 }
    const b: FixedDateWindow = { id: 'w-b', start_date: '2027-07-09', end_date: '2027-07-16', capacity: 8, capacity_reserved: 2 }
    // Returned out of order on purpose: the picker lists chronologically.
    mocks.getFixedDateWindows.mockResolvedValue([b, a])
    const onConfirm = vi.fn()
    render(<FixedDateWindowPicker product={makeProduct()} onBack={() => {}} onConfirm={onConfirm} />)

    await waitFor(() => expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(2))
    const cards = screen.getAllByRole('button', { pressed: false })
    expect(cards[0]).toHaveTextContent(/Jul 3, 2027/)
    expect(cards[1]).toHaveTextContent(/Jul 9, 2027/)
    expect(cards[0]).toBeEnabled()
    expect(cards[1]).toBeEnabled()

    fireEvent.click(cards[1])
    fireEvent.click(screen.getByTestId('fixed-date-window-picker-submit'))
    expect(onConfirm).toHaveBeenLastCalledWith(
      expect.objectContaining({ availability_id: 'w-b', date: '2027-07-09' }),
      b,
      false,
      undefined,
    )
    expect(expandWindowDays(onConfirm.mock.calls[0][1])[0]).toBe('2027-07-09')
    expect(expandWindowDays(onConfirm.mock.calls[0][1]).at(-1)).toBe('2027-07-16')

    // Switch to the other overlapping window: only it is selected.
    fireEvent.click(screen.getAllByRole('button', { pressed: false })[0])
    fireEvent.click(screen.getByTestId('fixed-date-window-picker-submit'))
    expect(onConfirm).toHaveBeenLastCalledWith(
      expect.objectContaining({ availability_id: 'w-a', date: '2027-07-03' }),
      a,
      false,
      undefined,
    )
    expect(expandWindowDays(a).at(-1)).toBe('2027-07-10')
  })

  it('landr-my6fc.5: windows chained on one shared day (Sat->Sat, Sat->Sat) stay distinct; a full one stays disabled', async () => {
    mocks.getFixedDateWindows.mockResolvedValue([
      { id: 'w-a', start_date: '2027-07-03', end_date: '2027-07-10', capacity: 8, capacity_reserved: 8 },
      { id: 'w-b', start_date: '2027-07-10', end_date: '2027-07-17', capacity: 8, capacity_reserved: 0 },
    ])
    const onConfirm = vi.fn()
    render(<FixedDateWindowPicker product={makeProduct()} onBack={() => {}} onConfirm={onConfirm} />)
    await waitFor(() => expect(screen.getByText('Full')).toBeInTheDocument())
    const cards = screen.getAllByRole('button', { pressed: false })
    expect(cards[0]).toBeDisabled()
    expect(cards[1]).toBeEnabled()
    fireEvent.click(cards[1])
    fireEvent.click(screen.getByTestId('fixed-date-window-picker-submit'))
    expect(onConfirm.mock.calls[0][1].id).toBe('w-b')
  })

  it('landr-my6fc.11: same-start windows show their labels and submit the chosen id', async () => {
    const a: FixedDateWindow = { id: 'w-a', label: 'Bus 2', start_date: '2027-07-03', end_date: '2027-07-10', capacity: 8, capacity_reserved: 0 }
    const b: FixedDateWindow = { id: 'w-b', label: 'Bus 1', start_date: '2027-07-03', end_date: '2027-07-10', capacity: 8, capacity_reserved: 0 }
    mocks.getFixedDateWindows.mockResolvedValue([a, b])
    const onConfirm = vi.fn()
    render(<FixedDateWindowPicker product={makeProduct()} onBack={() => {}} onConfirm={onConfirm} />)
    await waitFor(() => expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(2))
    const cards = screen.getAllByRole('button', { pressed: false })
    expect(cards[0]).toHaveTextContent('Bus 1')
    expect(cards[1]).toHaveTextContent('Bus 2')
    fireEvent.click(cards[1])
    fireEvent.click(screen.getByTestId('fixed-date-window-picker-submit'))
    expect(onConfirm.mock.calls[0][1]).toBe(a)
    expect(onConfirm.mock.calls[0][0]).toMatchObject({ availability_id: 'w-a' })
  })

  it('landr-my6fc.11: unlabeled identical windows get distinct fallback names; a lone one gets none', async () => {
    const mk = (id: string, start: string, end: string): FixedDateWindow => ({ id, start_date: start, end_date: end, capacity: 8, capacity_reserved: 0 })
    mocks.getFixedDateWindows.mockResolvedValue([
      mk('w-1', '2027-07-03', '2027-07-10'),
      mk('w-2', '2027-07-03', '2027-07-10'),
      mk('w-3', '2027-08-03', '2027-08-10'),
    ])
    render(<FixedDateWindowPicker product={makeProduct()} onBack={() => {}} onConfirm={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('fixed-date-window-name-w-1')).toHaveTextContent('Course 1'))
    expect(screen.getByTestId('fixed-date-window-name-w-2')).toHaveTextContent('Course 2')
    expect(screen.queryByTestId('fixed-date-window-name-w-3')).toBeNull()
  })

  it('landr-my6fc.11: initialWindowId (invite host window) preselects the right same-start card', async () => {
    const a: FixedDateWindow = { id: 'w-a', label: 'Bus 1', start_date: '2027-07-03', end_date: '2027-07-10', capacity: 8, capacity_reserved: 0 }
    const b: FixedDateWindow = { id: 'w-b', label: 'Bus 2', start_date: '2027-07-03', end_date: '2027-07-10', capacity: 8, capacity_reserved: 0 }
    mocks.getFixedDateWindows.mockResolvedValue([a, b])
    const onConfirm = vi.fn()
    render(<FixedDateWindowPicker product={makeProduct()} onBack={() => {}} onConfirm={onConfirm} initialWindowId="w-b" />)
    await waitFor(() => expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1))
    fireEvent.click(screen.getByTestId('fixed-date-window-picker-submit'))
    expect(onConfirm.mock.calls[0][1]).toBe(b)
  })

  it('expandWindowDays covers inclusive range', () => {
    const days = expandWindowDays({
      id: 'w',
      start_date: '2027-07-07',
      end_date: '2027-07-10',
      capacity: 1,
      capacity_reserved: 0,
    })
    expect(days).toEqual(['2027-07-07', '2027-07-08', '2027-07-09', '2027-07-10'])
  })
})

describe('FixedDateWindowPicker — next action + zen (landr-80ubl.2)', () => {
  it('moves the one active NextAction from the window list to Continue once a window is picked', async () => {
    mocks.getFixedDateWindows.mockResolvedValue([
      { id: 'w-1', start_date: '2027-07-07', end_date: '2027-07-13', capacity: 8, capacity_reserved: 0 },
    ])
    render(
      <FixedDateWindowPicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    )
    await waitFor(() => expect(screen.getByText(/Jul 7, 2027/)).toBeInTheDocument())
    expect(
      document.querySelectorAll('[data-next-action="active"]'),
    ).toHaveLength(1)
    expect(screen.getByTestId('next-action-cue')).toHaveTextContent(
      'Next: choose a window',
    )
    fireEvent.click(screen.getByRole('button', { name: /Jul 7, 2027/ }))
    expect(
      document.querySelectorAll('[data-next-action="active"]'),
    ).toHaveLength(1)
    expect(screen.getByTestId('next-action-cue')).toHaveTextContent('Next: continue')
  })
})

// landr-rmcsu.7: course windows honour the group size.
describe('FixedDateWindowPicker seat-aware windows (landr-rmcsu.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  const WINDOWS: FixedDateWindow[] = [
    { id: 'w-1', start_date: '2027-07-07', end_date: '2027-07-13', capacity: 8, capacity_reserved: 6 },
    { id: 'w-2', start_date: '2027-08-04', end_date: '2027-08-10', capacity: 8, capacity_reserved: 0 },
    { id: 'w-3', start_date: '2027-09-01', end_date: '2027-09-07', capacity: 8, capacity_reserved: 8 },
  ]
  const windowButton = (re: RegExp) => screen.getByText(re).closest('button')!

  it('marks a window with too few seats "Only n left" (not Full) and disables it', async () => {
    mocks.getFixedDateWindows.mockResolvedValue(WINDOWS)
    render(
      <FixedDateWindowPicker
        product={makeProduct()}
        seatsNeeded={3}
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    )
    await waitFor(() => screen.getByText(/Jul 7, 2027/))
    expect(windowButton(/Jul 7, 2027/)).toBeDisabled()
    expect(screen.getByText('Only 2 left (you need 3)')).toBeInTheDocument()
    expect(windowButton(/Aug 4, 2027/)).not.toBeDisabled()
    expect(screen.getByText('Full')).toBeInTheDocument()
    expect(screen.getByTestId('seat-fit-count')).toHaveTextContent('1 course date fits 3 people')
  })

  it('hides the seat count on a short window when exposeSeats is false', async () => {
    mocks.getFixedDateWindows.mockResolvedValue(WINDOWS)
    render(
      <FixedDateWindowPicker
        product={makeProduct()}
        seatsNeeded={3}
        exposeSeats={false}
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    )
    await waitFor(() => screen.getByText(/Jul 7, 2027/))
    expect(screen.getByText('Not enough seats for 3')).toBeInTheDocument()
    expect(screen.queryByText(/Only 2 left/)).not.toBeInTheDocument()
  })

  it('offers fewer people / a group inquiry when no window fits (never stranded)', async () => {
    mocks.getFixedDateWindows.mockResolvedValue(WINDOWS)
    render(
      <FixedDateWindowPicker
        product={{ ...makeProduct(), max_party_size: 10 }}
        seatsNeeded={9}
        showPartySizeStepper
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    )
    await waitFor(() => screen.getByTestId('seat-fit-none'))
    expect(screen.getByTestId('seat-fit-none')).toHaveTextContent(
      'No upcoming course dates with room for 9 people.',
    )
    expect(screen.getByTestId('seat-fit-fewer')).toBeInTheDocument()
    expect(screen.getByTestId('seat-fit-inquiry')).toBeInTheDocument()
  })

  it('the stepper re-filters the windows, reports the size and blocks a pick that stops fitting', async () => {
    mocks.getFixedDateWindows.mockResolvedValue(WINDOWS)
    const onPartySizeChange = vi.fn()
    const onConfirm = vi.fn()
    render(
      <FixedDateWindowPicker
        product={makeProduct()}
        seatsNeeded={2}
        showPartySizeStepper
        onPartySizeChange={onPartySizeChange}
        onBack={() => {}}
        onConfirm={onConfirm}
      />,
    )
    await waitFor(() => screen.getByText(/Jul 7, 2027/))
    expect(windowButton(/Jul 7, 2027/)).not.toBeDisabled()
    fireEvent.click(windowButton(/Jul 7, 2027/))
    expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled()

    fireEvent.click(screen.getByTestId('party-size-increase'))
    expect(onPartySizeChange).toHaveBeenCalledWith(3)
    expect(windowButton(/Jul 7, 2027/)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('one person keeps the old any-seat rule', async () => {
    mocks.getFixedDateWindows.mockResolvedValue(WINDOWS)
    render(
      <FixedDateWindowPicker
        product={makeProduct()}
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    )
    await waitFor(() => screen.getByText(/Jul 7, 2027/))
    expect(windowButton(/Jul 7, 2027/)).not.toBeDisabled()
    expect(screen.queryByText(/you need/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('seat-fit-count')).not.toBeInTheDocument()
  })
})
