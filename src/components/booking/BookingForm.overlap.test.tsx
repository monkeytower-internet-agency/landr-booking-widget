/**
 * landr-my6fc.7: staff-only overlap warning on the review step (confirm, never
 * block) + the chosen course window id on submit.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import { BookingForm, type BookingSelection } from './BookingForm'
import { getStaffBookingOverlaps, submitBooking, submitStaffBooking } from '@/api/client'
import type { BookerDetails, ParticipantDetails } from './detailsTypes'
import { StaffModeProvider } from '@/lib/staffMode.tsx'
import { ALL_STAFF_POWERS, type StaffSession } from '@/lib/staffMode'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    submitBooking: vi.fn(),
    submitStaffBooking: vi.fn(),
    getStaffBookingOverlaps: vi.fn(),
  }
})

const OPERATOR_ID = 'a1b2c3d4-0001-0001-0001-000000000002'

const STAFF: StaffSession = {
  active: true,
  token: 'staff.signed.token',
  powers: ALL_STAFF_POWERS,
  operatorId: OPERATOR_ID,
}

function makeServiceProduct(): Product {
  return {
    product_id: 'service-1',
    slug: 'guided-day',
    name: 'Guided day',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'days_range',
    is_contiguous: true,
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
    hotel_offering: 'none',
    hotel_location_id: null,
    price_per_unit: null,
    currency: 'EUR',
  }
}

const ADA_BOOKER: BookerDetails = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone: '+34 600 000 000',
}

const ADA_PARTICIPANT: ParticipantDetails = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone: '+34 600 000 000',
  service_role_code: '',
}

function renderForm(
  selection: BookingSelection,
  staffActive: boolean,
  onConfirmed = vi.fn(),
  staffSession: StaffSession = STAFF,
) {
  return render(
    <StaffModeProvider value={staffActive ? staffSession : undefined}>
      <BookingForm
        widgetToken="op-x"
        product={makeServiceProduct()}
        selection={selection}
        booker={ADA_BOOKER}
        participants={[ADA_PARTICIPANT]}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={onConfirmed}
      />
    </StaffModeProvider>,
  )
}

const DAYS: BookingSelection = {
  kind: 'days',
  selectedDays: ['2026-10-03', '2026-10-04', '2026-10-10'],
  fixedDateWindowId: 'win-2',
}

const OVERLAP = {
  booking_id: 'bk-old',
  reference: 'LND-1',
  product_name: 'Thermal course',
  start: '2026-10-03',
  end: '2026-10-10',
  status: 'confirmed',
}

describe('BookingForm — overlap warning + window id', () => {
  beforeEach(() => {
    vi.mocked(submitBooking).mockReset()
    vi.mocked(submitStaffBooking).mockReset()
    vi.mocked(getStaffBookingOverlaps).mockReset()
    vi.mocked(submitBooking).mockResolvedValue({
      booking_id: 'bk-public-1',
      semantic_state: 'awaiting_payment',
    })
    vi.mocked(submitStaffBooking).mockResolvedValue({
      booking_id: 'bk-staff-1',
      semantic_state: 'pending',
      stage_code: 'awaiting_payment',
      approval_outcome: 'staff_authorized',
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('staff: shows the warning, needs "Book anyway", then still submits', async () => {
    vi.mocked(getStaffBookingOverlaps).mockResolvedValue([OVERLAP])
    renderForm(DAYS, true)
    expect(await screen.findByTestId('review-overlap-warning')).toHaveTextContent(
      /Thermal course/,
    )
    expect(getStaffBookingOverlaps).toHaveBeenCalledWith(
      OPERATOR_ID,
      'staff.signed.token',
      'ada@example.com',
      '2026-10-03',
      '2026-10-10',
    )
    expect(screen.queryByRole('button', { name: /Confirm booking/i })).toBeNull()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Book anyway/i }))
    })
    await waitFor(() => expect(submitStaffBooking).toHaveBeenCalledTimes(1))
  })

  it('staff: no overlaps -> no warning, normal confirm label', async () => {
    vi.mocked(getStaffBookingOverlaps).mockResolvedValue([])
    renderForm(DAYS, true)
    await waitFor(() => expect(getStaffBookingOverlaps).toHaveBeenCalled())
    expect(screen.queryByTestId('review-overlap-warning')).toBeNull()
    expect(screen.getByRole('button', { name: /Confirm booking/i })).toBeInTheDocument()
  })

  it('staff: a failed lookup never blocks the booking', async () => {
    vi.mocked(getStaffBookingOverlaps).mockRejectedValue(new Error('boom'))
    renderForm(DAYS, true)
    await waitFor(() => expect(getStaffBookingOverlaps).toHaveBeenCalled())
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(submitStaffBooking).toHaveBeenCalledTimes(1))
  })

  it('public mode never calls the overlap endpoint', async () => {
    vi.mocked(getStaffBookingOverlaps).mockResolvedValue([OVERLAP])
    renderForm(DAYS, false)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    expect(getStaffBookingOverlaps).not.toHaveBeenCalled()
    expect(screen.queryByTestId('review-overlap-warning')).toBeNull()
  })

  it('submit carries fixed_date_window_id on the primary line (public)', async () => {
    renderForm(DAYS, false)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    const body = vi.mocked(submitBooking).mock.calls[0]![0]
    expect(body.products[0]!.fixed_date_window_id).toBe('win-2')
  })

  it('omits fixed_date_window_id for a non-window selection', async () => {
    renderForm({ kind: 'days', selectedDays: ['2026-10-03'] }, false)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    const body = vi.mocked(submitBooking).mock.calls[0]![0]
    expect(body.products[0]).not.toHaveProperty('fixed_date_window_id')
  })

  it('groups multi-line bookings into one entry (min start..max end)', async () => {
    vi.mocked(getStaffBookingOverlaps).mockResolvedValue([
      { ...OVERLAP, product_name: 'Thermal course', start: '2026-10-03', end: '2026-10-05' },
      { ...OVERLAP, product_name: 'Hotel', start: '2026-10-04', end: '2026-10-10' },
    ])
    renderForm(DAYS, true)
    await screen.findByTestId('review-overlap-warning')
    const items = screen.getAllByTestId('review-overlap-item')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent(/Thermal course, Hotel/)
  })

  it('staff: submit waits for an in-flight lookup and shows Book anyway instead of submitting', async () => {
    let resolve!: (r: (typeof OVERLAP)[]) => void
    vi.mocked(getStaffBookingOverlaps).mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    renderForm(DAYS, true)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await act(async () => {
      resolve([OVERLAP])
    })
    expect(await screen.findByTestId('review-overlap-warning')).toBeInTheDocument()
    expect(submitStaffBooking).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Book anyway/i }))
    })
    await waitFor(() => expect(submitStaffBooking).toHaveBeenCalledTimes(1))
  })

  it('staff: a lookup that never returns times out (3s) and the booking proceeds', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(getStaffBookingOverlaps).mockReturnValue(new Promise(() => {}))
      renderForm(DAYS, true)
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })
      expect(submitStaffBooking).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
