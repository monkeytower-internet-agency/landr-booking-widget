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
    // landr-mg0a: empty role code exercises the BookingForm fallback
    // ('participant') so legacy review-only tests don't need to know
    // about the operator's role catalogue.
    service_role_code: '',
  }
}

describe('BookingForm — review-only screen (landr-8c03)', () => {
  it('renders the "Review your booking" header and the booker + participants summary', () => {
    render(
      <BookingForm
        widgetToken="para42"
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
        widgetToken="para42"
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
            service_role_code: '',
          },
          {
            first_name: 'Alan',
            last_name: 'Turing',
            email: '',
            phone: '',
            service_role_code: '',
          },
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
        widgetToken="para42"
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
        widgetToken="para42"
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
        widgetToken="para42"
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
        widgetToken="para42"
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
        widgetToken="para42"
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

  // landr-wv0m: companion_kind label in the review step's "Others joining"
  // section. 'separate_guiding' must render distinctly from 'guest'.
  it('labels a separate_guiding companion as "joining the activity" in the review screen', () => {
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct('days_range')}
        selection={DAYS_SELECTION}
        booker={ADA_BOOKER}
        participants={[bookerAsParticipant(ADA_BOOKER)]}
        companions={[
          {
            first_name: 'Sophie',
            last_name: 'Müller',
            email: '',
            phone: '',
            companion_kind: 'separate_guiding',
          },
          {
            first_name: 'Tim',
            last_name: 'Müller',
            email: '',
            phone: '',
            companion_kind: 'guest',
          },
        ]}
        pickupLocationId={null}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    const companions = screen.getByTestId('review-companions')
    expect(companions).toHaveTextContent('Sophie Müller')
    expect(companions).toHaveTextContent('Tim Müller')
    // Self-paying participant gets the "joining the activity" label.
    const sophieLabel = screen.getByTestId('companion-kind-label-0')
    expect(sophieLabel).toHaveTextContent(/joining the activity/i)
    // Non-participating guest gets the "not doing the activity" label.
    const timLabel = screen.getByTestId('companion-kind-label-1')
    expect(timLabel).toHaveTextContent(/not doing the activity/i)
  })

  // landr-gb2f.4 / gb2f.5: per-room breakfast display in the review.
  describe('per-room breakfast section (landr-gb2f.4)', () => {
    it('shows the room breakfast section when perRoomAddons has qty > 0', () => {
      render(
        <BookingForm
          widgetToken="para42"
          product={makeServiceProduct('days_range')}
          selection={DAYS_SELECTION}
          booker={ADA_BOOKER}
          participants={[
            bookerAsParticipant(ADA_BOOKER),
            {
              first_name: 'Grace',
              last_name: 'Hopper',
              email: '',
              phone: '',
              service_role_code: '',
            },
          ]}
          pickupLocationId={null}
          accommodationRooms={[{ productId: 'single-room', quantity: 2 }]}
          perRoomAddons={{ 'single-room': { 'bf-1': 1 } }}
          roomProductNames={{ 'single-room': 'Single Room' }}
          roomAssignment={{
            0: { roomProductId: 'single-room', unitIndex: 0 },
            1: { roomProductId: 'single-room', unitIndex: 1 },
          }}
          onBack={vi.fn()}
          onConfirmed={vi.fn()}
        />,
      )
      const section = screen.getByTestId('review-per-room-breakfast')
      expect(section).toBeInTheDocument()
      // Unit 0 gets breakfast (qty=1, first unit).
      const status0 = screen.getByTestId('room-breakfast-status-0')
      expect(status0).toHaveTextContent('with breakfast')
      // Unit 1 has no breakfast.
      const status1 = screen.getByTestId('room-breakfast-status-1')
      expect(status1).toHaveTextContent('without breakfast')
      // Room names are shown.
      expect(section).toHaveTextContent('Single Room 1')
      expect(section).toHaveTextContent('Single Room 2')
      // Occupant names are shown.
      expect(section).toHaveTextContent('Ada')
      expect(section).toHaveTextContent('Grace')
    })

    it('hides the per-room breakfast section when perRoomAddons is absent', () => {
      render(
        <BookingForm
          widgetToken="para42"
          product={makeServiceProduct('days_range')}
          selection={DAYS_SELECTION}
          booker={ADA_BOOKER}
          participants={[bookerAsParticipant(ADA_BOOKER)]}
          pickupLocationId={null}
          accommodationRooms={[{ productId: 'single-room', quantity: 1 }]}
          onBack={vi.fn()}
          onConfirmed={vi.fn()}
        />,
      )
      expect(screen.queryByTestId('review-per-room-breakfast')).toBeNull()
    })

    it('hides the per-room breakfast section when all add-on quantities are 0', () => {
      render(
        <BookingForm
          widgetToken="para42"
          product={makeServiceProduct('days_range')}
          selection={DAYS_SELECTION}
          booker={ADA_BOOKER}
          participants={[bookerAsParticipant(ADA_BOOKER)]}
          pickupLocationId={null}
          accommodationRooms={[{ productId: 'single-room', quantity: 1 }]}
          perRoomAddons={{ 'single-room': { 'bf-1': 0 } }}
          roomProductNames={{ 'single-room': 'Single Room' }}
          onBack={vi.fn()}
          onConfirmed={vi.fn()}
        />,
      )
      expect(screen.queryByTestId('review-per-room-breakfast')).toBeNull()
    })

    it('shows a single room without a number suffix when qty=1', () => {
      render(
        <BookingForm
          widgetToken="para42"
          product={makeServiceProduct('days_range')}
          selection={DAYS_SELECTION}
          booker={ADA_BOOKER}
          participants={[bookerAsParticipant(ADA_BOOKER)]}
          pickupLocationId={null}
          accommodationRooms={[{ productId: 'double-room', quantity: 1 }]}
          perRoomAddons={{ 'double-room': { 'bf-1': 1 } }}
          roomProductNames={{ 'double-room': 'Double Room' }}
          onBack={vi.fn()}
          onConfirmed={vi.fn()}
        />,
      )
      const section = screen.getByTestId('review-per-room-breakfast')
      // Single unit → no "1" suffix.
      expect(section).toHaveTextContent('Double Room')
      expect(section).not.toHaveTextContent('Double Room 1')
      const status0 = screen.getByTestId('room-breakfast-status-0')
      expect(status0).toHaveTextContent('with breakfast')
    })
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
      semantic_state: 'pending',
    })
    const onConfirmed = vi.fn()

    render(
      <BookingForm
        widgetToken="para42"
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
            service_role_code: '',
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
        expect.objectContaining({ booking_id: 'b-1', semantic_state: 'pending' }),
        'ada@example.com',
      ),
    )
  })

  it('coerces empty participant email to null in the submit payload', async () => {
    const submitMock = vi.mocked(submitBooking)
    submitMock.mockResolvedValue({
      booking_id: 'b-2',
      semantic_state: 'pending',
    })
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct('days_range')}
        selection={DAYS_SELECTION}
        booker={ADA_BOOKER}
        participants={[
          bookerAsParticipant(ADA_BOOKER),
          {
            first_name: 'Grace',
            last_name: 'Hopper',
            email: '',
            phone: '',
            service_role_code: '',
          },
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

  it('forwards per-participant phone on submit (landr-zaan)', async () => {
    const submitMock = vi.mocked(submitBooking)
    submitMock.mockResolvedValue({
      booking_id: 'b-zaan',
      semantic_state: 'pending',
    })
    render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct('days_range')}
        selection={DAYS_SELECTION}
        booker={ADA_BOOKER}
        participants={[
          bookerAsParticipant(ADA_BOOKER),
          {
            first_name: 'Grace',
            last_name: 'Hopper',
            email: 'grace@example.com',
            phone: '+34 600 111 222',
            service_role_code: '',
          },
          {
            first_name: 'Linus',
            last_name: 'Torvalds',
            email: '',
            phone: '',
            service_role_code: '',
          },
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
    // Booker's phone always rides on the body's customer_phone AND on
    // participants[0].phone (booker is auto-mirrored into participants[0]).
    expect(body.customer_phone).toBe('+34 600 000 000')
    expect(body.participants[0]!.phone).toBe('+34 600 000 000')
    // Participant 2 supplied a phone → forwarded verbatim.
    expect(body.participants[1]!.phone).toBe('+34 600 111 222')
    // Participant 3 left phone blank → normalised to null so the RPC's
    // COALESCE-update never wipes a phone already on file.
    expect(body.participants[2]!.phone).toBeNull()
  })

  it('surfaces a server error message and re-enables the Confirm button', async () => {
    const submitMock = vi.mocked(submitBooking)
    submitMock.mockRejectedValue(new Error('boom'))
    render(
      <BookingForm
        widgetToken="para42"
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
