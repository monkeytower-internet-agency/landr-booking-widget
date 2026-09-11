/**
 * landr-r6e5x.4 — per-participant guide language on the submit body.
 *
 * Epic decision D3: the language board's party-index → ISO 639-1 map becomes
 * `language` on every participants[] AND companions[] entry, which the API
 * persists to booking_participants.language so the calendar can show a flag
 * per person instead of inheriting the booking-level list.
 *
 * Stubs `fetch` rather than mocking submitBooking, for the same reason the
 * landr-piyv contract test does: a mocked client would have made the earlier
 * payload drifts invisible.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import { BookingForm, type BookingSelection } from './BookingForm'
import type {
  BookerDetails,
  CompanionDetails,
  ParticipantDetails,
} from './detailsTypes'

vi.stubEnv('VITE_USE_MOCKS', '0')
vi.stubEnv('VITE_API_BASE_URL', 'http://api.test.invalid')

function makeServiceProduct(): Product {
  return {
    product_id: 'svc-main',
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

const SELECTION: BookingSelection = {
  kind: 'days',
  selectedDays: ['2026-06-10', '2026-06-11'],
}
const BOOKER: BookerDetails = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone: '+34 600 111 222',
}
const PARTICIPANTS: ParticipantDetails[] = [
  { ...BOOKER, service_role_code: 'participant' },
  {
    first_name: 'Grace',
    last_name: 'Hopper',
    email: 'grace@example.com',
    phone: '',
    service_role_code: 'participant',
  },
]
const COMPANIONS: CompanionDetails[] = [
  { first_name: 'Kay', last_name: 'Jones', email: '', phone: '', companion_kind: 'guest' },
]

/** Party index space: participants 0..1, then the companion at 2. */
const ASSIGNMENT = { 0: 'es', 1: 'de', 2: 'de' }

function renderForm(
  overrides: Partial<React.ComponentProps<typeof BookingForm>> = {},
) {
  render(
    <BookingForm
      widgetToken="para42"
      product={makeServiceProduct()}
      selection={SELECTION}
      booker={BOOKER}
      participants={PARTICIPANTS}
      companions={COMPANIONS}
      participantLanguages={ASSIGNMENT}
      pickupLocationId={null}
      accommodationRooms={[]}
      addons={[]}
      onBack={vi.fn()}
      onConfirmed={vi.fn()}
      {...overrides}
    />,
  )
}

async function confirm() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
  })
}

describe('BookingForm — per-participant language (landr-r6e5x.4)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  const okResponse = () =>
    new Response(
      JSON.stringify({ booking_id: 'b-1', semantic_state: 'pending' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    )

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('sends each participant AND companion their assigned language', async () => {
    renderForm()
    await confirm()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as {
      participants: Array<Record<string, unknown>>
      companions: Array<Record<string, unknown>>
    }

    expect(body.participants[0]).toMatchObject({ first_name: 'Ada', language: 'es' })
    expect(body.participants[1]).toMatchObject({
      first_name: 'Grace',
      language: 'de',
    })
    // The companion sits at party index 2 — participants.length + 0.
    expect(body.companions[0]).toMatchObject({ first_name: 'Kay', language: 'de' })
  })

  it('derives the booking-level customer_languages from the assignment, booker first', async () => {
    renderForm()
    await confirm()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    // Ada (index 0, the booker) speaks Spanish, so 'es' leads — the backend
    // picks the confirmation email's locale off entry 0.
    expect(body.customer_languages).toEqual(['es', 'de'])
  })

  it('shows each person their assigned language on the review screen', () => {
    renderForm()
    expect(screen.getByTestId('review-participant-language-0').textContent).toContain(
      'Spanish',
    )
    expect(screen.getByTestId('review-participant-language-1').textContent).toContain(
      'German',
    )
    expect(screen.getByTestId('review-companion-language-0').textContent).toContain(
      'German',
    )
  })

  // The 422 fixtures below copy the exact shapes the API asserts in
  // `app/tests/test_participant_language_required.py` — `role` plus a 1-BASED
  // index WITHIN THAT ROLE'S OWN LIST, every offender aggregated into one
  // response. Getting this wrong is invisible in a widget-only suite: a
  // mis-parsed detail still renders *a* message, just the wrong one.
  const languageDetail = (detail: unknown) =>
    new Response(JSON.stringify({ detail }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    })

  it('names the missing participant from role + 1-based index', async () => {
    fetchSpy.mockResolvedValue(
      languageDetail({
        error: 'participant_language_missing',
        missing: [{ role: 'participant', index: 2 }],
        message:
          'Every participant must be assigned a spoken language. Please select a language for each listed participant.',
      }),
    )
    renderForm()
    await confirm()

    await waitFor(() =>
      expect(
        screen.getByText(/Assign every participant to a language/i),
      ).toBeInTheDocument(),
    )
    // index 2 of the PARTICIPANTS list is party index 1 — Grace, not Ada.
    expect(screen.getByTestId('review-error').textContent).toContain(
      'Grace still needs one',
    )
    expect(screen.getByTestId('review-error').textContent).not.toContain('Ada')
  })

  it('maps a COMPANION index past the end of the participants list', async () => {
    fetchSpy.mockResolvedValue(
      languageDetail({
        error: 'participant_language_missing',
        missing: [{ role: 'companion', index: 1 }],
        message: 'Every participant must be assigned a spoken language.',
      }),
    )
    renderForm()
    await confirm()

    // companion 1 → party index participants.length + 0 = 2 → Kay.
    await waitFor(() =>
      expect(screen.getByTestId('review-error').textContent).toContain(
        'Kay still needs one',
      ),
    )
  })

  it('names EVERY offender the API aggregated, not just the first', async () => {
    fetchSpy.mockResolvedValue(
      languageDetail({
        error: 'participant_language_missing',
        missing: [
          { role: 'participant', index: 1 },
          { role: 'companion', index: 1 },
        ],
        message: 'Every participant must be assigned a spoken language.',
      }),
    )
    renderForm()
    await confirm()

    await waitFor(() =>
      expect(screen.getByTestId('review-error').textContent).toContain('Ada'),
    )
    const text = screen.getByTestId('review-error').textContent ?? ''
    expect(text).toContain('Kay')
    // Plural agreement, so the sentence reads as written rather than as a
    // template with a list dropped into it.
    expect(text).toContain('need one')
  })

  it('quotes the operator offered set on an invalid language', async () => {
    fetchSpy.mockResolvedValue(
      languageDetail({
        error: 'participant_language_invalid',
        invalid: [{ role: 'participant', index: 1, language: 'zh' }],
        offered: ['de', 'en'],
        message:
          'One or more participants were assigned a language this operator does not offer.',
      }),
    )
    renderForm()
    await confirm()

    await waitFor(() =>
      expect(screen.getByText(/does not offer/i)).toBeInTheDocument(),
    )
    const text = screen.getByTestId('review-error').textContent ?? ''
    expect(text).toContain('Ada')
    // "pick one of: German, English" — actionable, not a guessing game.
    expect(text).toContain('German')
    expect(text).toContain('English')
    // Neither the raw code nor the raw language reaches the customer.
    expect(text).not.toContain('participant_language_invalid')
    expect(text).not.toContain('zh')
  })

  it('leaves an UNRELATED 422 on the generic path', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: [{ loc: ['body', 'customer_email'], msg: 'field required' }],
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    renderForm()
    await confirm()

    await waitFor(() =>
      expect(screen.getByText(/Booking rejected \(422\)/i)).toBeInTheDocument(),
    )
    expect(
      screen.queryByText(/Assign every participant to a language/i),
    ).not.toBeInTheDocument()
  })
})
