import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import { BookingForm, type BookingSelection } from './BookingForm'
import { submitBooking } from '@/api/client'
import type { BookerDetails, ParticipantDetails } from './detailsTypes'

vi.mock('@/api/client', async (importOriginal) => {
  // Keep the real HttpError class (BookingForm uses `err instanceof HttpError`)
  // while replacing only the network function.
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    submitBooking: vi.fn(),
  }
})

function makeServiceProduct(
  shape: 'days_range' | 'time_slot' = 'days_range',
): Product {
  return {
    product_id: 'service-1',
    slug: 'guided-day',
    name: 'Guided day',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: shape,
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
    hotel_offering: 'optional',
    hotel_location_id: null,
    price_per_unit: null,
    currency: 'EUR',
  }
}

const DAYS_SELECTION: BookingSelection = {
  kind: 'days',
  selectedDays: ['2024-11-23', '2024-11-24', '2024-11-25'],
}

const ADA_BOOKER: BookerDetails = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone: '+34 600 000 000',
}

function bookerAsParticipant(b: BookerDetails): ParticipantDetails {
  return {
    first_name: b.first_name,
    last_name: b.last_name,
    email: b.email,
    phone: b.phone,
  }
}

describe('BookingForm — review-only screen (landr-8c03)', () => {
  it('renders the "Review your booking" header and the booker + participants summary', () => {
    render(
      <BookingForm
        operatorSlug="para42"
        product={makeServiceProduct('days_range')}
        selection={DAYS_SELECTION}
        booker={ADA_BOOKER}
        participants={[bookerAsParticipant(ADA_BOOKER)]}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    expect(screen.getByText(/review your booking/i)).toBeInTheDocument()
    const booker = screen.getByTestId('review-booker')
    expect(booker).toHaveTextContent('Ada Lovelace')
    expect(booker).toHaveTextContent('ada@example.com')
    expect(booker).toHaveTextContent('+34 600 000 000')
    const participants = screen.getByTestId('review-participants')
    expect(participants).toHaveTextContent(/Participants \(1\)/)
    expect(participants).toHaveTextContent(/1\. Ada Lovelace/)
  })

  it('renders every participant in the summary list', () => {
    render(
      <BookingForm
        operatorSlug="para42"
        product={makeServiceProduct('days_range')}
        selection={DAYS_SELECTION}
        booker={ADA_BOOKER}
        participants={[
          bookerAsParticipant(ADA_BOOKER),
          {
            first_name: 'Grace',
            last_name: 'Hopper',
            email: 'grace@example.com',
            phone: '',
          },
          { first_name: 'Alan', last_name: 'Turing', email: '', phone: '' },
        ]}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    const list = screen.getByTestId('review-participants')
    expect(list).toHaveTextContent(/Participants \(3\)/)
    expect(list).toHaveTextContent(/Ada Lovelace/)
    expect(list).toHaveTextContent(/Grace Hopper/)
    expect(list).toHaveTextContent(/Alan Turing/)
  })

  it('does NOT render any form input fields (data flows in via props)', () => {
    render(
      <BookingForm
        operatorSlug="para42"
        product={makeServiceProduct('days_range')}
        selection={DAYS_SELECTION}
        booker={ADA_BOOKER}
        participants={[bookerAsParticipant(ADA_BOOKER)]}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    // No editable inputs (the review screen is read-only).
    expect(document.querySelectorAll('input').length).toBe(0)
  })

  it('renders the hotel block when accommodationRooms is non-empty (landr-iu3s)', () => {
    render(
      <BookingForm
        operatorSlug="para42"
        product={makeServiceProduct('days_range')}
        selection={DAYS_SELECTION}
        booker={ADA_BOOKER}
        participants={[bookerAsParticipant(ADA_BOOKER)]}
        pickupLocationId={null}
        accommodationRooms={[{ productId: 'room-1', quantity: 1 }]}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    const stay = screen.getByTestId('hotel-stay-block')
    // landr-8yaz: the block now reads "Hotel: Fri … Nov → Tue … Nov, 4 nights"
    // (weekday-prefixed date range via formatDayRange + nights count).
    // Assert on stable substrings: weekday abbreviations + arrow + nights.
    expect(stay.textContent).toMatch(/Hotel:/)
    expect(stay.textContent).toMatch(/Fri/)
    expect(stay.textContent).toMatch(/Tue/)
    expect(stay.textContent).toMatch(/→/)
    expect(stay.textContent).toMatch(/4 nights/)
  })

  it('omits the hotel block when accommodationRooms is empty or absent', () => {
    render(
      <BookingForm
        operatorSlug="para42"
        product={makeServiceProduct('days_range')}
        selection={DAYS_SELECTION}
        booker={ADA_BOOKER}
        participants={[bookerAsParticipant(ADA_BOOKER)]}
        pickupLocationId={null}
        accommodationRooms={[]}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('hotel-stay-block')).toBeNull()
  })

  it('shows the timezone for time_slot products (landr-iu3s)', () => {
    render(
      <BookingForm
        operatorSlug="para42"
        product={makeServiceProduct('time_slot')}
        selection={{
          kind: 'slot',
          slot: {
            slot_id: 's1',
            date: '2024-11-23',
            start_time: '09:00:00',
            end_time: '11:00:00',
            capacity: 10,
            capacity_reserved: 0,
          } as never,
        }}
        booker={ADA_BOOKER}
        participants={[bookerAsParticipant(ADA_BOOKER)]}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    const desc = screen.getByText(/Guided day/)
    expect(desc.textContent).toMatch(/·.*·/) // name · date · tz
  })

  it('hides the timezone for non-time_slot products', () => {
    render(
      <BookingForm
        operatorSlug="para42"
        product={makeServiceProduct('days_range')}
        selection={DAYS_SELECTION}
        booker={ADA_BOOKER}
        participants={[bookerAsParticipant(ADA_BOOKER)]}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    const desc = screen.getByText(/Guided day/)
    expect(desc.textContent?.match(/·/g)?.length).toBe(1)
  })
})

describe('BookingForm — submit payload (landr-8c03 + landr-cip6 + landr-vyaz)', () => {
  beforeEach(() => {
    vi.mocked(submitBooking).mockReset()
  })

  it('builds the submit body from booker + participants + line items and calls onConfirmed', async () => {
    const submitMock = vi.mocked(submitBooking)
    submitMock.mockResolvedValue({
      booking_id: 'b-1',
      reference: 'REF-1',
      state: 'pending',
    })
    const onConfirmed = vi.fn()

    render(
      <BookingForm
        operatorSlug="para42"
        product={makeServiceProduct('days_range')}
        selection={DAYS_SELECTION}
        booker={ADA_BOOKER}
        participants={[
          bookerAsParticipant(ADA_BOOKER),
          {
            first_name: 'Grace',
            last_name: 'Hopper',
            email: 'grace@example.com',
            phone: '',
          },
        ]}
        pickupLocationId="loc-pickup-1"
        accommodationRooms={[{ productId: 'room-1', quantity: 1 }]}
        addons={[
          { productId: 'breakfast-1', quantity: 2 },
          { productId: 'video-1', quantity: 1 },
        ]}
        onBack={vi.fn()}
        onConfirmed={onConfirmed}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))
    const body = submitMock.mock.calls[0]![0]
    expect(body.customer_first_name).toBe('Ada')
    expect(body.customer_last_name).toBe('Lovelace')
    expect(body.customer_email).toBe('ada@example.com')
    expect(body.customer_phone).toBe('+34 600 000 000')
    expect(body.products).toEqual([
      expect.objectContaining({ product_id: 'service-1', quantity: 1 }),
      expect.objectContaining({ product_id: 'room-1', quantity: 1 }),
      expect.objectContaining({ product_id: 'breakfast-1', quantity: 2 }),
      expect.objectContaining({ product_id: 'video-1', quantity: 1 }),
    ])
    expect(body.participants).toEqual([
      expect.objectContaining({
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        service_role_code: 'participant',
        pickup_location_id: 'loc-pickup-1',
      }),
      expect.objectContaining({
        first_name: 'Grace',
        last_name: 'Hopper',
        email: 'grace@example.com',
        pickup_location_id: 'loc-pickup-1',
      }),
    ])
    await waitFor(() =>
      expect(onConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({ reference: 'REF-1' }),
        'ada@example.com',
      ),
    )
  })

  it('coerces empty participant email to null in the submit payload', async () => {
    const submitMock = vi.mocked(submitBooking)
    submitMock.mockResolvedValue({
      booking_id: 'b-2',
      reference: 'REF-2',
      state: 'pending',
    })
    render(
      <BookingForm
        operatorSlug="para42"
        product={makeServiceProduct('days_range')}
        selection={DAYS_SELECTION}
        booker={ADA_BOOKER}
        participants={[
          bookerAsParticipant(ADA_BOOKER),
          { first_name: 'Grace', last_name: 'Hopper', email: '', phone: '' },
        ]}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))
    const body = submitMock.mock.calls[0]![0]
    expect(body.participants[1]!.email).toBeNull()
    expect(body.participants[1]!.last_name).toBe('Hopper')
  })

  it('surfaces a server error message and re-enables the Confirm button', async () => {
    const submitMock = vi.mocked(submitBooking)
    submitMock.mockRejectedValue(new Error('boom'))
    render(
      <BookingForm
        operatorSlug="para42"
        product={makeServiceProduct('days_range')}
        selection={DAYS_SELECTION}
        booker={ADA_BOOKER}
        participants={[bookerAsParticipant(ADA_BOOKER)]}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() =>
      expect(screen.getByTestId('review-error')).toHaveTextContent('boom'),
    )
    const btn = screen.getByRole('button', { name: /Confirm booking/i })
    expect(btn).not.toBeDisabled()
  })
})
