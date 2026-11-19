/**
 * landr-hdk4y.2 — second guiding language on the submit body: the marker is
 * always sent, an answer only for a participant the cart's rule asks, and an
 * asked participant without an answer is asked again on the review screen.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import type { ExtraLine } from './crossSell'
import { BookingForm, type BookingSelection } from './BookingForm'
import type {
  BookerDetails,
  CompanionDetails,
  ParticipantDetails,
} from './detailsTypes'

// landr-rmcsu.7: the review's seat pre-check (any group > 1) reads
// availability before submit; stub that read so `fetch` only ever sees the
// submit POST these tests assert on.
vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    getAvailability: vi.fn().mockResolvedValue([]),
    listProducts: vi.fn().mockResolvedValue([]),
    getOffers: vi.fn().mockResolvedValue({ lines: [] }),
  }
})

vi.stubEnv('VITE_USE_MOCKS', '0')
vi.stubEnv('VITE_API_BASE_URL', 'http://api.test.invalid')

function makeServiceProduct(extra: Partial<Product> = {}): Product {
  return {
    ...extra,
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
    guide_languages: ['en', 'de', 'es', 'fr'],
    ...extra,
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
  billing: { address_line1: 'Calle Mayor 1', address_line2: '', postal_code: '28013', city: 'Madrid', region: '', country: 'ES', company: '', tax_id: '', name: '' },
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
const COMPANIONS: CompanionDetails[] = []

/** Ada speaks French, Grace German; preferred EN/DE, so only Ada is asked. */
const ASSIGNMENT = { 0: 'fr', 1: 'de' }

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


const ASKING: Partial<Product> = {
  second_language_mode: 'not_preferred',
  preferred_guide_languages: ['en', 'de'],
  second_language_options: 'all',
}

describe('BookingForm — second guiding language (landr-hdk4y.2)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ booking_id: 'b-1', semantic_state: 'pending' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
  })
  afterEach(() => {
    fetchSpy.mockRestore()
  })

  async function submitted() {
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    return JSON.parse(String(init.body)) as {
      accepted_languages_supported?: boolean
      participants: Array<Record<string, unknown>>
    }
  }

  it('declares support and sends no answer when the product does not ask (mode off)', async () => {
    renderForm()
    await confirm()
    const body = await submitted()
    expect(body.accepted_languages_supported).toBe(true)
    expect(body.participants.every((p) => !('accepted_languages' in p))).toBe(true)
  })

  it('sends the answer only for the participant the rule asks', async () => {
    renderForm({
      product: makeServiceProduct(ASKING),
      participantAcceptedLanguages: { 0: ['en', 'es'], 1: ['en'] },
    })
    await confirm()
    const body = await submitted()
    expect(body.accepted_languages_supported).toBe(true)
    expect(body.participants[0]).toMatchObject({ first_name: 'Ada', accepted_languages: ['en', 'es'] })
    // Grace speaks German, a preferred language: not asked, so nothing is sent.
    expect('accepted_languages' in body.participants[1]!).toBe(false)
  })

  it('sends [] for "I only speak my language"', async () => {
    renderForm({
      product: makeServiceProduct(ASKING),
      participantAcceptedLanguages: { 0: [] },
    })
    await confirm()
    const body = await submitted()
    expect(body.participants[0]).toMatchObject({ accepted_languages: [] })
  })

  it('drops an answer value that is no longer an option (never sends it)', async () => {
    renderForm({
      product: makeServiceProduct({ ...ASKING, second_language_options: 'preferred' }),
      participantAcceptedLanguages: { 0: ['en', 'es'] },
    })
    await confirm()
    const body = await submitted()
    expect(body.participants[0]).toMatchObject({ accepted_languages: ['en'] })
  })

  it('an asked participant without an answer blocks Confirm and is asked on the review screen', async () => {
    renderForm({ product: makeServiceProduct(ASKING) })
    expect(screen.getByTestId('second-language-asked-0')).toBeTruthy()
    expect(screen.queryByTestId('second-language-asked-1')).toBeNull()
    expect(screen.getByRole('button', { name: /Confirm booking/i })).toBeDisabled()
    expect(document.getElementById('review-step-gate')!.textContent).toMatch(/Tick at least one option.*Ada/)
    fireEvent.click(screen.getByTestId('second-language-0-de'))
    expect(screen.getByRole('button', { name: /Confirm booking/i })).not.toBeDisabled()
    await confirm()
    const body = await submitted()
    expect(body.participants[0]).toMatchObject({ accepted_languages: ['de'] })
  })

  it('drops an answer when the participant main language changes, and asks again', () => {
    const { rerender } = render(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct(ASKING)}
        selection={SELECTION}
        booker={BOOKER}
        participants={PARTICIPANTS}
        companions={COMPANIONS}
        participantLanguages={{ 0: 'fr', 1: 'de' }}
        participantAcceptedLanguages={{ 0: [] }}
        pickupLocationId={null}
        accommodationRooms={[]}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    // Answered ("only French"): nothing blocks.
    expect(screen.getByRole('button', { name: /Confirm booking/i })).not.toBeDisabled()
    rerender(
      <BookingForm
        widgetToken="para42"
        product={makeServiceProduct(ASKING)}
        selection={SELECTION}
        booker={BOOKER}
        participants={PARTICIPANTS}
        companions={COMPANIONS}
        participantLanguages={{ 0: 'es', 1: 'de' }}
        participantAcceptedLanguages={{ 0: [] }}
        pickupLocationId={null}
        accommodationRooms={[]}
        onBack={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /Confirm booking/i })).toBeDisabled()
    expect(screen.getByTestId('second-language-asked-0')).toBeTruthy()
    expect(screen.getByTestId('second-language-0-only')).not.toBeChecked()
  })

  it('a product open to any or one language is never asked and sends no answer', async () => {
    for (const guide of [[], ['en']]) {
      fetchSpy.mockClear()
      renderForm({
        product: makeServiceProduct({ ...ASKING, second_language_mode: 'always', guide_languages: guide }),
        participantLanguages: guide.length ? { 0: 'en', 1: 'en' } : {},
      })
      expect(screen.queryByTestId('second-language-questions')).toBeNull()
      expect(screen.getByRole('button', { name: /Confirm booking/i })).not.toBeDisabled()
      await confirm()
      const body = await submitted()
      expect(body.participants.every((p) => !('accepted_languages' in p))).toBe(true)
      cleanup()
    }
  })

  it.each([
    ['participant_accepted_languages_missing', /say which other guiding languages/i],
    ['participant_accepted_languages_invalid', /other guiding languages on offer have changed/i],
  ])('maps the typed 422 %s to a friendly message', async (code, message) => {
    fetchSpy.mockImplementation(
      async () =>
        new Response(JSON.stringify({ detail: { error: code, offered: ['de'] } }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    renderForm()
    await confirm()
    expect(await screen.findByText(message)).toBeTruthy()
    expect(screen.queryByText(/Booking rejected|422/)).toBeNull()
  })

  it('an add-on line with a mode set does not ask a participant the main product would not', async () => {
    const addon = makeServiceProduct({
      product_id: 'video',
      second_language_mode: 'always',
      second_language_options: 'all',
    })
    const line = {
      key: 'video',
      lineId: 'o1',
      offerId: 'offer-1',
      parentLineId: 'main',
      product: addon,
      mode: 'days',
      days: ['2026-06-10'],
      slot: null,
      windowId: null,
      quantity: 1,
      unavailableDays: [],
      checking: false,
    } as unknown as ExtraLine
    renderForm({
      product: makeServiceProduct(ASKING),
      participantLanguages: { 0: 'de', 1: 'de' },
      extraLines: [line],
      onExtraLinesChange: vi.fn(),
    })
    expect(screen.queryByTestId('second-language-questions')).toBeNull()
    expect(screen.getByRole('button', { name: /Confirm booking/i })).not.toBeDisabled()
  })
})
