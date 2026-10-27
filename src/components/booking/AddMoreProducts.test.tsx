import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Location, Product } from '@/api/types'
import {
  getAvailability,
  getProductFlow,
  listPickupLocationsForOperator,
  listProducts,
  submitBooking,
} from '@/api/client'
import { BookingForm, type BookingSelection, type InlineAnswers } from './BookingForm'
import type { ExtraLine } from './crossSell'
import type { BookerDetails } from './detailsTypes'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    submitBooking: vi.fn(),
    getAvailability: vi.fn(),
    listProducts: vi.fn(),
    getFixedDateWindows: vi.fn(),
    getProductFlow: vi.fn(),
    listPickupLocationsForOperator: vi.fn(),
  }
})

function product(id: string, over: Partial<Product> = {}): Product {
  return {
    product_id: id,
    slug: id,
    name: id === 'main' ? 'Lift pass' : 'Camping',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'days_range',
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
    ...over,
  }
}

const MAIN = product('main')
const CAMPING = product('camping', { product_kind: 'stay', service_time_shape: null })
const SELECTION: BookingSelection = { kind: 'days', selectedDays: ['2026-11-02', '2026-11-03'] }
const BOOKER: BookerDetails = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone: '',
  billing: {
    address_line1: 'Calle Mayor 1',
    address_line2: '',
    postal_code: '28013',
    city: 'Madrid',
    region: '',
    country: 'ES',
    company: '',
    tax_id: '',
    name: '',
  },
}

function Harness({
  main = MAIN,
  participantLanguages,
  allowed,
  off,
}: {
  main?: Product
  participantLanguages?: Record<number, string>
  allowed?: string[]
  off?: boolean
}) {
  const [lines, setLines] = useState<ExtraLine[]>([])
  return (
    <BookingForm
      widgetToken="tok"
      product={main}
      participantLanguages={participantLanguages}
      selection={SELECTION}
      booker={BOOKER}
      participants={[{ ...BOOKER, service_role_code: '' }]}
      pickupLocationId={null}
      extraLines={lines}
      onExtraLinesChange={off ? undefined : setLines}
      crossSellProductIds={allowed}
      onBack={vi.fn()}
      onConfirmed={vi.fn()}
    />
  )
}

/** Holds lines + inline answers above BookingForm, like App, and can unmount it (Back). */
function RoundTripHarness() {
  const [lines, setLines] = useState<ExtraLine[]>([])
  const [inline, setInline] = useState<InlineAnswers | undefined>(undefined)
  const [onReview, setOnReview] = useState(true)
  if (!onReview) {
    return (
      <button type="button" onClick={() => setOnReview(true)}>
        Return to review
      </button>
    )
  }
  return (
    <BookingForm
      widgetToken="tok"
      product={MAIN}
      selection={SELECTION}
      booker={BOOKER}
      participants={[{ ...BOOKER, service_role_code: '' }]}
      pickupLocationId={null}
      extraLines={lines}
      onExtraLinesChange={setLines}
      inlineAnswers={inline}
      onInlineAnswersChange={setInline}
      onBack={() => setOnReview(false)}
      onConfirmed={vi.fn()}
    />
  )
}

describe('Add more to this booking (review step)', () => {
  beforeEach(() => {
    vi.mocked(submitBooking).mockReset()
    vi.mocked(getAvailability).mockReset()
    vi.mocked(listProducts).mockReset()
    vi.mocked(listProducts).mockResolvedValue([MAIN, CAMPING])
    vi.mocked(getProductFlow).mockReset()
    vi.mocked(getProductFlow).mockResolvedValue({ modules: null })
    vi.mocked(listPickupLocationsForOperator).mockReset()
    vi.mocked(listPickupLocationsForOperator).mockResolvedValue([])
  })

  const flowWith = (key: string, fields: unknown[] = []) => ({
    modules: [
      {
        kind: 'custom_form',
        position: 1,
        form: { key, version: 1, name: 'Medical', name_localized: null, fields },
      },
    ],
  })
  const addAndSettle = async (id: string) => {
    const add = await screen.findByTestId(`add-more-candidate-${id}`)
    await act(async () => {
      fireEvent.click(add)
    })
    const line = await screen.findByTestId(`add-more-line-${id}`)
    await waitFor(() => expect(line).not.toHaveTextContent(/Checking availability/))
    return line
  }
  const confirm = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
  }

  it('asks for verification inline when the added product requires it', async () => {
    const verified = product('verified', { name: 'Test event', requires_verification: true })
    vi.mocked(listProducts).mockResolvedValue([MAIN, CAMPING, verified])
    vi.mocked(getAvailability).mockResolvedValue([])
    render(<Harness />)
    await addAndSettle('verified')
    expect(screen.getByRole('button', { name: /Confirm booking/i })).toBeDisabled()
  })

  it('leaves out a product that shares no guide language with the booking', async () => {
    const mainEn = product('main', { guide_languages: ['en'] })
    const guided = product('guided', { name: 'Guided tour', guide_languages: ['de'] })
    vi.mocked(listProducts).mockResolvedValue([mainEn, CAMPING, guided])
    vi.mocked(getAvailability).mockResolvedValue([])
    render(<Harness main={mainEn} participantLanguages={{ 0: 'en' }} />)
    await screen.findByTestId('add-more-candidate-camping')
    expect(screen.queryByTestId('add-more-candidate-guided')).toBeNull()
  })

  it('renders the guide-language board inline and submits the picked language', async () => {
    const guided = product('guided', { name: 'Guided tour', guide_languages: ['de', 'en'] })
    vi.mocked(listProducts).mockResolvedValue([MAIN, guided])
    vi.mocked(getAvailability).mockResolvedValue([])
    vi.mocked(submitBooking).mockResolvedValue({ booking_id: 'b-3', semantic_state: 'pending' })
    render(<Harness />)
    const line = await addAndSettle('guided')

    const module = within(line).getByTestId('add-more-module-language')
    expect(screen.getByRole('button', { name: /Confirm booking/i })).toBeDisabled()
    fireEvent.click(within(module).getByTestId('lang-add-de'))
    await waitFor(() => expect(within(module).getByTestId('language-step-submit')).toBeEnabled())
    fireEvent.click(within(module).getByTestId('language-step-submit'))

    // Saved: the board collapses to a one-line summary.
    await waitFor(() => expect(within(line).queryByTestId('language-step-submit')).toBeNull())
    expect(within(line).getByTestId('add-more-module-language')).toHaveTextContent(/saved/i)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Confirm booking/i })).toBeEnabled(),
    )
    await confirm()
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    const body = vi.mocked(submitBooking).mock.calls[0]![0]
    expect(body.products.map((p) => p.product_id)).toEqual(['main', 'guided'])
    expect(body.participants[0]).toMatchObject({ language: 'de' })
  })

  it('keeps the inline language answer across Back and return to review', async () => {
    const guided = product('guided', { name: 'Guided tour', guide_languages: ['de', 'en'] })
    vi.mocked(listProducts).mockResolvedValue([MAIN, guided])
    vi.mocked(getAvailability).mockResolvedValue([])
    render(<RoundTripHarness />)
    const line = await addAndSettle('guided')
    const module = within(line).getByTestId('add-more-module-language')
    fireEvent.click(within(module).getByTestId('lang-add-de'))
    await waitFor(() => expect(within(module).getByTestId('language-step-submit')).toBeEnabled())
    fireEvent.click(within(module).getByTestId('language-step-submit'))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Confirm booking/i })).toBeEnabled(),
    )

    fireEvent.click(screen.getByRole('button', { name: /Back/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Return to review/i }))

    const back = await screen.findByTestId('add-more-line-guided')
    await waitFor(() => expect(back).not.toHaveTextContent(/Checking availability/))
    expect(within(back).getByTestId('add-more-module-language')).toHaveTextContent(/saved/i)
    expect(screen.getByRole('button', { name: /Confirm booking/i })).toBeEnabled()
  })

  it('needs no board when one language is shared: the whole party gets it', async () => {
    const guided = product('guided', { name: 'Guided tour', guide_languages: ['fr'] })
    vi.mocked(listProducts).mockResolvedValue([MAIN, guided])
    vi.mocked(getAvailability).mockResolvedValue([])
    vi.mocked(submitBooking).mockResolvedValue({ booking_id: 'b-4', semantic_state: 'pending' })
    render(<Harness />)
    const line = await addAndSettle('guided')
    expect(within(line).queryByTestId('add-more-module-language')).toBeNull()
    await confirm()
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    expect(vi.mocked(submitBooking).mock.calls[0]![0].participants[0]).toMatchObject({
      language: 'fr',
    })
  })

  it('renders the added product\'s custom form inline and submits its answers', async () => {
    const formed = product('formed', { name: 'Course' })
    vi.mocked(listProducts).mockResolvedValue([MAIN, formed])
    vi.mocked(getAvailability).mockResolvedValue([])
    vi.mocked(getProductFlow).mockResolvedValue(
      flowWith('medical', [
        {
          key: 'allergies',
          field_type: 'text',
          label: 'Allergies',
          label_localized: null,
          help_text: null,
          help_text_localized: null,
          required: true,
          position: 0,
          options: null,
          validation: null,
          visibility_rule: null,
          scope: 'booking',
        },
      ]) as never,
    )
    vi.mocked(submitBooking).mockResolvedValue({ booking_id: 'b-5', semantic_state: 'pending' })
    render(<Harness />)
    const line = await addAndSettle('formed')

    const module = within(line).getByTestId('add-more-module-form:medical')
    expect(screen.getByRole('button', { name: /Confirm booking/i })).toBeDisabled()
    fireEvent.change(within(module).getByRole('textbox'), { target: { value: 'Peanuts' } })
    await waitFor(() => expect(within(module).getByTestId('cf-submit')).toBeEnabled())
    fireEvent.click(within(module).getByTestId('cf-submit'))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Confirm booking/i })).toBeEnabled(),
    )
    await confirm()
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    expect(vi.mocked(submitBooking).mock.calls[0]![0].form_responses).toEqual([
      { form_key: 'medical', answers: { allergies: 'Peanuts' } },
    ])
  })

  it('drops the inline form answers when the product is removed', async () => {
    const formed = product('formed', { name: 'Course' })
    vi.mocked(listProducts).mockResolvedValue([MAIN, formed])
    vi.mocked(getAvailability).mockResolvedValue([])
    vi.mocked(getProductFlow).mockResolvedValue(flowWith('medical') as never)
    vi.mocked(submitBooking).mockResolvedValue({ booking_id: 'b-6', semantic_state: 'pending' })
    render(<Harness />)
    const line = await addAndSettle('formed')
    const module = within(line).getByTestId('add-more-module-form:medical')
    await waitFor(() => expect(within(module).getByTestId('cf-submit')).toBeEnabled())
    fireEvent.click(within(module).getByTestId('cf-submit'))
    await waitFor(() => expect(within(line).queryByTestId('cf-submit')).toBeNull())
    fireEvent.click(within(line).getAllByRole('button', { name: 'Remove' })[0]!)
    await waitFor(() => expect(screen.queryByTestId('add-more-line-formed')).toBeNull())
    await confirm()
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    expect(vi.mocked(submitBooking).mock.calls[0]![0].form_responses).toBeUndefined()
  })

  it('renders the pickup picker inline and submits the picked point', async () => {
    const shuttle = product('shuttle', { name: 'Shuttle tour', needs_pickup: true })
    vi.mocked(listProducts).mockResolvedValue([MAIN, shuttle])
    vi.mocked(getAvailability).mockResolvedValue([])
    vi.mocked(listPickupLocationsForOperator).mockResolvedValue([
      { location_id: 'loc-1', name: 'Harbour', name_localized: null },
      { location_id: 'loc-2', name: 'Station', name_localized: null },
    ] as unknown as Location[])
    vi.mocked(submitBooking).mockResolvedValue({ booking_id: 'b-7', semantic_state: 'pending' })
    render(<Harness />)
    const line = await addAndSettle('shuttle')

    const module = within(line).getByTestId('add-more-module-pickup')
    expect(screen.getByRole('button', { name: /Confirm booking/i })).toBeDisabled()
    fireEvent.click(await within(module).findByLabelText('Station'))
    await waitFor(() => expect(within(module).getByTestId('pickup-step-submit')).toBeEnabled())
    fireEvent.click(within(module).getByTestId('pickup-step-submit'))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Confirm booking/i })).toBeEnabled(),
    )
    await confirm()
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    expect(vi.mocked(submitBooking).mock.calls[0]![0].participants[0]).toMatchObject({
      pickup_location_id: 'loc-2',
    })
  })

  it('adds a product with the main dates and submits both lines in one booking', async () => {
    vi.mocked(getAvailability).mockResolvedValue([])
    vi.mocked(submitBooking).mockResolvedValue({ booking_id: 'b-1', semantic_state: 'pending' })
    render(<Harness />)

    const add = await screen.findByTestId('add-more-candidate-camping')
    expect(screen.queryByTestId('add-more-candidate-main')).toBeNull()
    await act(async () => {
      fireEvent.click(add)
    })
    const line = await screen.findByTestId('add-more-line-camping')
    await waitFor(() => expect(line).not.toHaveTextContent(/Checking availability/))
    expect(getAvailability).toHaveBeenCalledWith('camping', '2026-11-02', '2026-11-03', undefined)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    const body = vi.mocked(submitBooking).mock.calls[0]![0]
    expect(body.products).toEqual([
      expect.objectContaining({ product_id: 'main', quantity: 1, selected_days: ['2026-11-02', '2026-11-03'] }),
      { product_id: 'camping', quantity: 1, selected_days: ['2026-11-02', '2026-11-03'] },
    ])
  })

  it('shows an unavailable inherited date inline and blocks Confirm until it is removed', async () => {
    vi.mocked(getAvailability).mockResolvedValue([
      {
        availability_id: 'n1',
        date: '2026-11-03',
        start_time: null,
        end_time: null,
        capacity: 1,
        capacity_reserved: 1,
        available_seats: 0,
        status: 'open',
      },
    ])
    vi.mocked(submitBooking).mockResolvedValue({ booking_id: 'b-2', semantic_state: 'pending' })
    render(<Harness />)
    const add = await screen.findByTestId('add-more-candidate-camping')
    await act(async () => {
      fireEvent.click(add)
    })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/Not available on/)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    expect(submitBooking).not.toHaveBeenCalled()

    // Remove the taken night: the line re-checks and the booking goes through
    // with the remaining night only (never silently dropped).
    const removeBtns = screen.getAllByRole('button', { name: /^Remove / })
    await act(async () => {
      fireEvent.click(removeBtns[removeBtns.length - 1]!)
    })
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }))
    })
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    expect(vi.mocked(submitBooking).mock.calls[0]![0].products[1]).toEqual({
      product_id: 'camping',
      quantity: 1,
      selected_days: ['2026-11-02'],
    })
  })

  it('offers only the curated products when the operator lists some', async () => {
    const other = product('other', { name: 'Other' })
    vi.mocked(listProducts).mockResolvedValue([MAIN, CAMPING, other])
    vi.mocked(getAvailability).mockResolvedValue([])
    render(<Harness allowed={['other']} />)
    expect(await screen.findByTestId('add-more-candidate-other')).toBeInTheDocument()
    expect(screen.queryByTestId('add-more-candidate-camping')).toBeNull()
  })

  it('offers every eligible product when the curated list is empty', async () => {
    vi.mocked(getAvailability).mockResolvedValue([])
    render(<Harness allowed={[]} />)
    expect(await screen.findByTestId('add-more-candidate-camping')).toBeInTheDocument()
  })

  it('hides the section entirely when the operator turned cross-sell off', async () => {
    render(<Harness off />)
    await screen.findByRole('button', { name: /Confirm booking/i })
    expect(screen.queryByTestId('add-more-candidate-camping')).toBeNull()
    expect(listProducts).not.toHaveBeenCalled()
  })
})
