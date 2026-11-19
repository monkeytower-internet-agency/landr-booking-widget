/**
 * The billing address (and the "Invoice to a company?" block) is
 * collected on the REVIEW step, directly above Confirm, not on the details
 * step. Moved from DetailsStep.test.tsx (landr-uuntm.3 / landr-jsu3n.2 /
 * landr-jiagg.2 coverage), plus the submit gate that came with it.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import { StaffModeProvider } from '@/lib/staffMode.tsx'
import { fillBillingFields } from '@/test/fillBilling'
import { submitBooking, submitStaffBooking } from '@/api/client'
import { BookingForm, type BookingSelection } from './BookingForm'
import { emptyBilling, type BillingDetails, type BookerDetails } from './detailsTypes'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return { ...actual, submitBooking: vi.fn(), submitStaffBooking: vi.fn() }
})

function makeProduct(): Product {
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

const SELECTION: BookingSelection = { kind: 'days', selectedDays: ['2026-05-23'] }

function booker(billing: BillingDetails = emptyBilling()): BookerDetails {
  return {
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    phone: '+34 600 000 000',
    billing,
    joins: true,
  }
}

function byName<T extends HTMLElement = HTMLInputElement>(name: string): T {
  const el = document.querySelector<T>(`[name="${name}"]`)
  if (!el) throw new Error(`No input named ${name}`)
  return el
}

// The edge answers "unknown" and the browser has no region, so nothing
// pre-fills the country unless a test says so.
function noGuess() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ country: null }) })),
  )
  vi.stubGlobal('navigator', { languages: ['en'], language: 'en' })
}

function renderReview(props: Partial<React.ComponentProps<typeof BookingForm>> = {}) {
  const onConfirmed = vi.fn()
  const view = render(
    <BookingForm
      widgetToken="op-x"
      product={makeProduct()}
      selection={SELECTION}
      booker={booker()}
      participants={[
        {
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
          phone: '+34 600 000 000',
          service_role_code: '',
        },
      ]}
      pickupLocationId={null}
      onBack={vi.fn()}
      onConfirmed={onConfirmed}
      {...props}
    />,
  )
  return { onConfirmed, ...view }
}

async function clickConfirm() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('review-confirm-btn'))
  })
}

let tzSpy: ReturnType<typeof vi.spyOn> | undefined
beforeEach(() => {
  // No zone -> the timezone link of the country guess knows nothing; the
  // runner's own TZ must not pre-fill the country behind a test's back.
  const real = Intl.DateTimeFormat.prototype.resolvedOptions
  tzSpy = vi
    .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
    .mockImplementation(function (this: Intl.DateTimeFormat) {
      return { ...real.call(this), timeZone: 'UTC' }
    })
  vi.mocked(submitBooking).mockReset()
  vi.mocked(submitBooking).mockResolvedValue({ booking_id: 'b-1', semantic_state: 'pending' })
  noGuess()
})
afterEach(() => {
  tzSpy?.mockRestore()
  vi.unstubAllGlobals()
})

describe('BookingForm review — billing address', () => {
  it('renders the group above Confirm with its helper line, labels and autocomplete tokens', () => {
    renderReview()
    const group = screen.getByRole('group', { name: 'Billing address' })
    expect(group).toHaveTextContent('We need this for your invoice.')
    expect(
      group.compareDocumentPosition(screen.getByTestId('review-confirm-btn')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByLabelText('Street and number')).toHaveAttribute(
      'autocomplete',
      expect.stringContaining('address-line1'),
    )
    expect(screen.getByLabelText('Address line 2 (optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Postal code')).toHaveAttribute(
      'autocomplete',
      expect.stringContaining('postal-code'),
    )
    expect(screen.getByLabelText('City')).toHaveAttribute(
      'autocomplete',
      expect.stringContaining('address-level2'),
    )
    expect(screen.getByLabelText('Country')).toHaveAttribute(
      'autocomplete',
      expect.stringContaining('country'),
    )
  })

  it('blocks Buchen, flags the four required fields and focuses the first one', async () => {
    renderReview()
    expect(document.getElementById('review-step-gate')).toHaveTextContent(
      'Enter your billing address to confirm.',
    )
    await clickConfirm()
    expect(submitBooking).not.toHaveBeenCalled()
    for (const name of [
      'booker_billing_address_line1',
      'booker_billing_postal_code',
      'booker_billing_city',
      'booker_billing_country',
    ]) {
      expect(byName(name)).toHaveAttribute('aria-invalid', 'true')
    }
    // line 2 / company / tax id are optional and never flagged.
    expect(byName('booker_billing_address_line2')).not.toHaveAttribute('aria-invalid')
    expect(document.getElementById('booker-billing-line1-error')).toHaveTextContent('Required')
    expect(byName('booker_billing_address_line1')).toHaveFocus()
  })

  it('focuses the first MISSING field, skipping the ones already filled', async () => {
    renderReview({ booker: booker({ ...emptyBilling(), address_line1: 'Calle Mayor 1' }) })
    await clickConfirm()
    expect(submitBooking).not.toHaveBeenCalled()
    expect(byName('booker_billing_postal_code')).toHaveFocus()
  })

  it('flags a single required field on blur and clears it once filled', () => {
    renderReview()
    const city = byName('booker_billing_city')
    fireEvent.blur(city)
    expect(city).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(city, { target: { value: 'Madrid' } })
    expect(city).not.toHaveAttribute('aria-invalid')
  })

  it('submits customer_billing once the address is complete (company hidden by default)', async () => {
    renderReview()
    fillBillingFields()
    fireEvent.change(byName('booker_billing_address_line2'), { target: { value: '3B' } })
    expect(screen.queryByLabelText('Tax ID (NIF / VAT)')).not.toBeInTheDocument()
    await clickConfirm()
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    expect(vi.mocked(submitBooking).mock.calls[0]![0].customer_billing).toEqual({
      address_line1: 'Calle Mayor 1',
      address_line2: '3B',
      postal_code: '28013',
      city: 'Madrid',
      region: null,
      country: 'ES',
      company: null,
      tax_id: null,
      name: null,
    })
  })

  it('"Invoice to a company?" reveals company + tax id; unchecking clears them', async () => {
    renderReview()
    fillBillingFields()
    const toggle = screen.getByRole('checkbox', { name: 'Invoice to a company?' })
    expect(toggle).not.toBeChecked()
    fireEvent.click(toggle)
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Para42 SL' } })
    fireEvent.change(screen.getByLabelText('Tax ID (NIF / VAT)'), {
      target: { value: 'B12345678' },
    })
    // Company is optional, so Buchen works with it filled...
    await clickConfirm()
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    expect(vi.mocked(submitBooking).mock.calls[0]![0].customer_billing).toMatchObject({
      company: 'Para42 SL',
      tax_id: 'B12345678',
    })
    // ...and switching it off wipes the hidden values.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Invoice to a company?' }))
    expect(screen.queryByLabelText('Company')).not.toBeInTheDocument()
    await clickConfirm()
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(2))
    expect(vi.mocked(submitBooking).mock.calls[1]![0].customer_billing).toMatchObject({
      company: null,
      tax_id: null,
    })
  })

  it('restores the address (and an open company section) from the booker', () => {
    renderReview({
      booker: booker({
        address_line1: 'Hauptstr. 5',
        address_line2: '',
        postal_code: '10115',
        city: 'Berlin',
        region: '',
        country: 'DE',
        company: 'Acme GmbH',
        tax_id: 'DE1',
        name: '',
      }),
    })
    expect(byName('booker_billing_address_line1')).toHaveValue('Hauptstr. 5')
    expect(byName('booker_billing_country')).toHaveValue('DE')
    expect(screen.getByRole('checkbox', { name: 'Invoice to a company?' })).toBeChecked()
    expect(screen.getByLabelText('Company')).toHaveValue('Acme GmbH')
    // Complete already: nothing blocks Buchen.
    expect(document.getElementById('review-step-gate')).toHaveTextContent('Ready to confirm.')
  })

  it('reports every edit through onBillingChange so Back / a reload keep it', () => {
    const onBillingChange = vi.fn()
    renderReview({ onBillingChange })
    fillBillingFields()
    const last = onBillingChange.mock.calls.at(-1)![0] as BillingDetails
    expect(last).toMatchObject({
      address_line1: 'Calle Mayor 1',
      postal_code: '28013',
      city: 'Madrid',
      country: 'ES',
    })
  })

  it('keeps the entered address when the review step is re-mounted from the booker it reported', () => {
    function Harness() {
      const [b, setB] = useState(booker())
      const [shown, setShown] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setShown((s) => !s)}>
            toggle
          </button>
          {shown ? (
            <BookingForm
              widgetToken="op-x"
              product={makeProduct()}
              selection={SELECTION}
              booker={b}
              onBillingChange={(billing) => setB((cur) => ({ ...cur, billing }))}
              participants={[]}
              pickupLocationId={null}
              onBack={vi.fn()}
              onConfirmed={vi.fn()}
            />
          ) : null}
        </>
      )
    }
    render(<Harness />)
    fillBillingFields({ booker_billing_city: 'Sevilla' })
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }))
    expect(screen.queryByRole('group', { name: 'Billing address' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }))
    expect(byName('booker_billing_city')).toHaveValue('Sevilla')
    expect(byName('booker_billing_address_line1')).toHaveValue('Calle Mayor 1')
  })

  it('tolerates a booker persisted before billing existed', async () => {
    const legacy = {
      first_name: 'Ada',
      last_name: 'L',
      email: 'ada@example.com',
      phone: '+34600000000',
    } as unknown as BookerDetails
    renderReview({ booker: legacy })
    expect(byName('booker_billing_city')).toHaveValue('')
    await clickConfirm()
    expect(submitBooking).not.toHaveBeenCalled()
  })

  // landr-jsu3n.2: optional "Invoice name" + the company toggle, also for an
  // invitee joining through an invite link (the invite token rides the submit).
  describe.each([
    ['direct booking', undefined],
    ['invite link', 'invite-token'],
  ])('Invoice name and company toggle — %s', (_label, inviteToken) => {
    it('submits the Invoice name and company; the "Invoice to:" cue shows them', async () => {
      renderReview({ inviteToken })
      fillBillingFields()
      fireEvent.change(screen.getByLabelText('Invoice name (optional)'), {
        target: { value: 'Grace Hopper' },
      })
      expect(screen.getByTestId('invoice-to-line-0')).toHaveTextContent('Grace Hopper')
      fireEvent.click(screen.getByRole('checkbox', { name: 'Invoice to a company?' }))
      fireEvent.change(byName('booker_billing_company'), { target: { value: 'Acme SL' } })
      expect(screen.getByTestId('invoice-to-line-0')).toHaveTextContent('Acme SL')
      expect(screen.getByTestId('invoice-to-line-1')).toHaveTextContent('Grace Hopper')
      await clickConfirm()
      await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
      const body = vi.mocked(submitBooking).mock.calls[0]![0]
      expect(body.customer_billing).toMatchObject({ name: 'Grace Hopper', company: 'Acme SL' })
      expect(body.invite_token).toBe(inviteToken)
    })
  })

  it('keeps the Invoice name when the company toggle is switched off', async () => {
    renderReview()
    fillBillingFields()
    fireEvent.change(screen.getByLabelText('Invoice name (optional)'), {
      target: { value: 'Grace Hopper' },
    })
    const toggle = screen.getByRole('checkbox', { name: 'Invoice to a company?' })
    fireEvent.click(toggle)
    fireEvent.change(byName('booker_billing_company'), { target: { value: 'Acme SL' } })
    fireEvent.click(toggle)
    await clickConfirm()
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    expect(vi.mocked(submitBooking).mock.calls[0]![0].customer_billing).toMatchObject({
      name: 'Grace Hopper',
      company: null,
    })
  })

  describe('"Invoice to:" cue', () => {
    it('is live: appears with the booker name and follows the company', () => {
      renderReview({ booker: { ...booker(), first_name: '', last_name: '' } })
      expect(screen.getByTestId('invoice-to-region')).toHaveAttribute('aria-live', 'polite')
      expect(screen.queryByTestId('invoice-to')).not.toBeInTheDocument()
    })

    it('reads company, then the booker as contact person, when invoicing a company', () => {
      renderReview({ booker: { ...booker(), first_name: 'Olaf', last_name: 'Klein' } })
      expect(screen.getByTestId('invoice-to')).toHaveTextContent('Invoice to:')
      expect(screen.getByTestId('invoice-to-line-0')).toHaveTextContent('Olaf Klein')
      fireEvent.click(screen.getByRole('checkbox', { name: 'Invoice to a company?' }))
      // Toggle on but company still blank: the person alone.
      expect(screen.queryByTestId('invoice-to-line-1')).not.toBeInTheDocument()
      fireEvent.change(byName('booker_billing_company'), {
        target: { value: 'monkeytower internet agency' },
      })
      expect(screen.getByTestId('invoice-to-line-0')).toHaveTextContent(
        'monkeytower internet agency',
      )
      expect(screen.getByTestId('invoice-to-line-1')).toHaveTextContent('Olaf Klein')
      fireEvent.click(screen.getByRole('checkbox', { name: 'Invoice to a company?' }))
      expect(screen.getByTestId('invoice-to-line-0')).toHaveTextContent('Olaf Klein')
      expect(screen.queryByTestId('invoice-to-line-1')).not.toBeInTheDocument()
    })
  })

  describe('country pre-fill (landr-uuntm.3)', () => {
    it('pre-fills the country from the edge guess while the field is still empty', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, json: async () => ({ country: 'AT' }) })),
      )
      renderReview()
      await waitFor(() => expect(byName('booker_billing_country')).toHaveValue('AT'))
    })

    it('falls back to the browser locale region, then the operator country', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
      vi.stubGlobal('navigator', { languages: ['de-CH', 'de'], language: 'de-CH' })
      const { unmount } = renderReview({ operatorCountry: 'ES' })
      await waitFor(() => expect(byName('booker_billing_country')).toHaveValue('CH'))
      unmount()
      vi.stubGlobal('navigator', { languages: ['en'], language: 'en' })
      renderReview({ operatorCountry: 'es' })
      await waitFor(() => expect(byName('booker_billing_country')).toHaveValue('ES'))
    })

    it('never overrides a country the customer picked while the guess was in flight', async () => {
      let release!: () => void
      vi.stubGlobal(
        'fetch',
        vi.fn(
          () =>
            new Promise((resolve) => {
              release = () => resolve({ ok: true, json: async () => ({ country: 'AT' }) })
            }),
        ),
      )
      renderReview()
      fireEvent.change(byName('booker_billing_country'), { target: { value: 'FR' } })
      release()
      await new Promise((r) => setTimeout(r, 0))
      expect(byName('booker_billing_country')).toHaveValue('FR')
    })

    it('keeps the country empty when picked then cleared before the guess landed', async () => {
      let release!: () => void
      vi.stubGlobal(
        'fetch',
        vi.fn(
          () =>
            new Promise((resolve) => {
              release = () => resolve({ ok: true, json: async () => ({ country: 'AT' }) })
            }),
        ),
      )
      renderReview()
      const country = byName('booker_billing_country')
      fireEvent.change(country, { target: { value: 'FR' } })
      fireEvent.change(country, { target: { value: '' } })
      release()
      await new Promise((r) => setTimeout(r, 0))
      expect(byName('booker_billing_country')).toHaveValue('')
    })

    it('does not run (or override) the guess when the country is already restored', async () => {
      const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ country: 'AT' }) }))
      vi.stubGlobal('fetch', fetchMock)
      renderReview({ booker: booker({ ...emptyBilling(), country: 'IT' }) })
      await new Promise((r) => setTimeout(r, 0))
      expect(byName('booker_billing_country')).toHaveValue('IT')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('names countries in German on a German locale', () => {
      vi.stubGlobal('navigator', { languages: ['de'], language: 'de' })
      renderReview()
      const opt = byName<HTMLSelectElement>('booker_billing_country').querySelector(
        'option[value="DE"]',
      )
      expect(opt).toHaveTextContent('Deutschland')
    })
  })
})

describe('BookingForm review — billing address in staff mode (landr-uuntm.3)', () => {
  const STAFF = { active: true, token: 't.o.k', powers: [], operatorId: 'op-1' } as const
  function renderStaff() {
    return render(
      <StaffModeProvider value={STAFF}>
        <BookingForm
          widgetToken="op-x"
          product={makeProduct()}
          selection={SELECTION}
          booker={booker()}
          participants={[]}
          pickupLocationId={null}
          onBack={vi.fn()}
          onConfirmed={vi.fn()}
        />
      </StaffModeProvider>,
    )
  }

  it('shows the group but reads as optional: blur on empty fields flags nothing', () => {
    vi.mocked(submitStaffBooking).mockReset()
    renderStaff()
    expect(screen.getByRole('group', { name: 'Billing address' })).toBeInTheDocument()
    for (const name of [
      'booker_billing_address_line1',
      'booker_billing_postal_code',
      'booker_billing_city',
      'booker_billing_country',
    ]) {
      const el = byName(name)
      fireEvent.blur(el)
      expect(el).not.toHaveAttribute('aria-invalid')
    }
    expect(document.querySelector('[id^="booker-billing-"][id$="-error"]')).toBeNull()
    expect(document.getElementById('review-step-gate')).toHaveTextContent('Ready to confirm.')
  })

  it('Confirm works without an address, and carries one when the operator enters it', async () => {
    vi.mocked(submitStaffBooking).mockReset()
    vi.mocked(submitStaffBooking).mockResolvedValue({
      booking_id: 'b-1',
      semantic_state: 'pending',
    } as never)
    renderStaff()
    await clickConfirm()
    await waitFor(() => expect(submitStaffBooking).toHaveBeenCalledTimes(1))
    expect(vi.mocked(submitStaffBooking).mock.calls[0]![1]).not.toHaveProperty(
      'customer_billing',
    )
    fillBillingFields()
    await clickConfirm()
    await waitFor(() => expect(submitStaffBooking).toHaveBeenCalledTimes(2))
    expect(vi.mocked(submitStaffBooking).mock.calls[1]![1].customer_billing).toMatchObject({
      address_line1: 'Calle Mayor 1',
      country: 'ES',
    })
  })
})
