/**
 * landr-aoak.2 [S3]: staff-mode behaviour on the BookingForm review step.
 * Covers the price-override field (presence + value flowing through the submit
 * adapter), the force flag from a forced selection, and the completion
 * postMessage to the parent. The normal-customer review path is covered by
 * BookingForm.test.tsx and is untouched here.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import { BookingForm, type BookingSelection } from './BookingForm'
import type { StaffSubmitBody } from './staffSubmitAdapter'
import { submitBooking } from '@/api/client'
import type { BookerDetails, ParticipantDetails } from './detailsTypes'
import { StaffModeProvider } from '@/lib/staffMode.tsx'
import { ALL_STAFF_POWERS, type StaffSession } from '@/lib/staffMode'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return { ...actual, submitBooking: vi.fn() }
})

const STAFF: StaffSession = {
  active: true,
  token: 'staff.signed.token',
  powers: ALL_STAFF_POWERS,
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
) {
  return render(
    <StaffModeProvider value={staffActive ? STAFF : undefined}>
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
  selectedDays: ['2026-02-01', '2026-02-02'],
}

const FORCED_DAYS: BookingSelection = {
  kind: 'days',
  selectedDays: ['2026-02-01', '2026-02-02'],
  forcedDays: ['2026-02-02'],
}

describe('BookingForm — staff mode', () => {
  beforeEach(() => {
    vi.mocked(submitBooking).mockReset()
    vi.mocked(submitBooking).mockResolvedValue({
      booking_id: 'bk-staff-1',
      semantic_state: 'awaiting_payment',
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does NOT show the price-override field for a normal customer', () => {
    renderForm(DAYS, false)
    expect(screen.queryByTestId('staff-price-override')).not.toBeInTheDocument()
  })

  it('shows the price-override field in staff mode and flows the value through the adapter', async () => {
    renderForm(DAYS, true)
    expect(screen.getByTestId('staff-price-override')).toBeInTheDocument()

    fireEvent.change(screen.getByTestId('override-amount'), {
      target: { value: '199.95' },
    })
    fireEvent.change(screen.getByTestId('override-reason'), {
      target: { value: 'loyalty discount' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))

    const body = vi.mocked(submitBooking).mock.calls[0]![0] as StaffSubmitBody
    expect(body.staff_session).toBe('staff.signed.token')
    expect(body.channel).toBe('staff')
    expect(body.override_gross_total).toBe(199.95)
    expect(body.override_reason).toBe('loyalty discount')
  })

  it('blocks submit when an override amount is set without a reason', async () => {
    renderForm(DAYS, true)
    fireEvent.change(screen.getByTestId('override-amount'), {
      target: { value: '50' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    expect(submitBooking).not.toHaveBeenCalled()
    expect(screen.getByTestId('review-error')).toHaveTextContent(/reason/i)
  })

  it('raises ignore_capacity for a forced selection + shows the override summary', async () => {
    renderForm(FORCED_DAYS, true)
    expect(screen.getByTestId('review-forced')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    const body = vi.mocked(submitBooking).mock.calls[0]![0] as StaffSubmitBody
    expect(body.ignore_capacity).toBe(true)
  })

  it('posts landr:booking-created to the parent on a successful staff submit', async () => {
    const postSpy = vi.fn()
    // Make window.parent a distinct object so the guard (parent !== window) holds.
    const parentStub = { postMessage: postSpy } as unknown as Window
    const parentSpy = vi
      .spyOn(window, 'parent', 'get')
      .mockReturnValue(parentStub)

    renderForm(DAYS, true)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))

    expect(postSpy).toHaveBeenCalledTimes(1)
    const [payload, targetOrigin] = postSpy.mock.calls[0]!
    expect(payload).toEqual({
      type: 'landr:booking-created',
      booking_id: 'bk-staff-1',
    })
    expect(targetOrigin).not.toBe('*')
    parentSpy.mockRestore()
  })

  it('does NOT post to the parent in the normal (non-staff) flow', async () => {
    const postSpy = vi.fn()
    const parentStub = { postMessage: postSpy } as unknown as Window
    const parentSpy = vi
      .spyOn(window, 'parent', 'get')
      .mockReturnValue(parentStub)

    renderForm(DAYS, false)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    expect(postSpy).not.toHaveBeenCalled()
    parentSpy.mockRestore()
  })
})
