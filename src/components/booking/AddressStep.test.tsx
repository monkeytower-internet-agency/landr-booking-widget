/**
 * The billing address (and the "Invoice to a company?" block) is collected on
 * its own ADDRESS step right before the read-only Review (landr-rw8i2); it
 * used to sit on the Review itself. Carries the landr-uuntm.3 / landr-jsu3n.2 /
 * landr-jiagg.2 coverage, now gating the step's Continue instead of Confirm.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { StaffModeProvider } from '@/lib/staffMode.tsx'
import { fillBillingFields } from '@/test/fillBilling'
import { AddressStep } from './AddressStep'
import { emptyBilling, type BillingDetails, type BookerDetails } from './detailsTypes'

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

function renderAddress(props: Partial<React.ComponentProps<typeof AddressStep>> = {}) {
  const onConfirm = vi.fn()
  const onBillingChange = vi.fn()
  const view = render(
    <AddressStep
      booker={booker()}
      onBillingChange={onBillingChange}
      customerComment=""
      onCustomerCommentChange={vi.fn()}
      onBack={vi.fn()}
      onConfirm={onConfirm}
      {...props}
    />,
  )
  return { onConfirm, onBillingChange, ...view }
}

const next = () => screen.getByTestId('address-step-submit')

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
  noGuess()
})
afterEach(() => {
  tzSpy?.mockRestore()
  vi.unstubAllGlobals()
})

describe('AddressStep — billing address', () => {
  it('renders the group with its helper line, labels and autocomplete tokens', () => {
    renderAddress()
    const group = screen.getByRole('group', { name: 'Billing address' })
    expect(group).toHaveTextContent('We need this for your invoice.')
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

  it('keeps Continue disabled with a helper line until all four required fields are filled', () => {
    const { onConfirm } = renderAddress()
    expect(next()).toBeDisabled()
    expect(document.getElementById('address-step-gate')).toHaveTextContent(
      'Fill in street, postal code, city and country to continue.',
    )
    fireEvent.click(next())
    expect(onConfirm).not.toHaveBeenCalled()
    const steps = [
      ['booker_billing_address_line1', 'Calle Mayor 1'],
      ['booker_billing_postal_code', '28013'],
      ['booker_billing_city', 'Madrid'],
    ] as const
    for (const [name, value] of steps) {
      fireEvent.change(byName(name), { target: { value } })
      expect(next()).toBeDisabled()
    }
    fireEvent.change(byName('booker_billing_country'), { target: { value: 'ES' } })
    expect(next()).toBeEnabled()
    expect(document.getElementById('address-step-gate')).toHaveTextContent('Ready to continue.')
    fireEvent.click(next())
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not count the optional fields toward the gate', () => {
    renderAddress()
    fireEvent.change(byName('booker_billing_address_line2'), { target: { value: '3B' } })
    fireEvent.change(screen.getByLabelText('Invoice name (optional)'), {
      target: { value: 'Grace Hopper' },
    })
    expect(next()).toBeDisabled()
  })

  it('treats a whitespace-only required field as still empty', () => {
    renderAddress()
    fillBillingFields({ booker_billing_city: '   ' })
    expect(next()).toBeDisabled()
  })

  it('flags a single required field on blur and clears it once filled', () => {
    renderAddress()
    const city = byName('booker_billing_city')
    fireEvent.blur(city)
    expect(city).toHaveAttribute('aria-invalid', 'true')
    expect(document.getElementById('booker-billing-city-error')).toHaveTextContent('Required')
    fireEvent.change(city, { target: { value: 'Madrid' } })
    expect(city).not.toHaveAttribute('aria-invalid')
    // line 2 / company / tax id are optional and never flagged.
    const line2 = byName('booker_billing_address_line2')
    fireEvent.blur(line2)
    expect(line2).not.toHaveAttribute('aria-invalid')
  })

  it('"Invoice to a company?" reveals company + tax id; unchecking clears them', () => {
    const { onBillingChange } = renderAddress()
    fillBillingFields()
    const toggle = screen.getByRole('checkbox', { name: 'Invoice to a company?' })
    expect(toggle).not.toBeChecked()
    expect(screen.queryByLabelText('Tax ID (NIF / VAT)')).not.toBeInTheDocument()
    fireEvent.click(toggle)
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Para42 SL' } })
    fireEvent.change(screen.getByLabelText('Tax ID (NIF / VAT)'), {
      target: { value: 'B12345678' },
    })
    // Company is optional: the step stays ready with it filled...
    expect(next()).toBeEnabled()
    expect(onBillingChange.mock.calls.at(-1)![0]).toMatchObject({
      company: 'Para42 SL',
      tax_id: 'B12345678',
    })
    // ...and switching it off wipes the hidden values.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Invoice to a company?' }))
    expect(screen.queryByLabelText('Company')).not.toBeInTheDocument()
    expect(onBillingChange.mock.calls.at(-1)![0]).toMatchObject({ company: '', tax_id: '' })
  })

  it('restores the address (and an open company section) from the booker', () => {
    renderAddress({
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
    // Complete already: nothing blocks Continue.
    expect(next()).toBeEnabled()
  })

  it('reports every edit through onBillingChange so Back / a reload keep it', () => {
    const { onBillingChange } = renderAddress()
    fillBillingFields()
    const last = onBillingChange.mock.calls.at(-1)![0] as BillingDetails
    expect(last).toMatchObject({
      address_line1: 'Calle Mayor 1',
      postal_code: '28013',
      city: 'Madrid',
      country: 'ES',
    })
  })

  it('keeps the entered address when the step is re-mounted from the booker it reported', () => {
    function Harness() {
      const [b, setB] = useState(booker())
      const [shown, setShown] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setShown((s) => !s)}>
            toggle
          </button>
          {shown ? (
            <AddressStep
              booker={b}
              onBillingChange={(billing) => setB((cur) => ({ ...cur, billing }))}
              customerComment=""
              onCustomerCommentChange={vi.fn()}
              onConfirm={vi.fn()}
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

  it('tolerates a booker persisted before billing existed', () => {
    const legacy = {
      first_name: 'Ada',
      last_name: 'L',
      email: 'ada@example.com',
      phone: '+34600000000',
    } as unknown as BookerDetails
    renderAddress({ booker: legacy })
    expect(byName('booker_billing_city')).toHaveValue('')
    expect(next()).toBeDisabled()
  })

  it('puts the note for us last, directly above Continue', () => {
    renderAddress({ customerComment: 'Please add a baby seat.' })
    const note = screen.getByTestId('customer-comment-reveal')
    const box = next().closest('[data-next-action]')
    expect(note.nextElementSibling).toBe(box)
    // Everything that collects billing data sits above the note.
    expect(
      screen
        .getByTestId('booker-billing-group')
        .compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('shows the Back affordance and the product line', () => {
    const onBack = vi.fn()
    renderAddress({ onBack, description: 'Guided day' })
    expect(screen.getByText('Guided day')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('step-back-button'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  // landr-jsu3n.2: optional "Invoice name" + the company toggle.
  it('the "Invoice to:" cue shows the invoice name and company', () => {
    renderAddress()
    fillBillingFields()
    fireEvent.change(screen.getByLabelText('Invoice name (optional)'), {
      target: { value: 'Grace Hopper' },
    })
    expect(screen.getByTestId('invoice-to-line-0')).toHaveTextContent('Grace Hopper')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Invoice to a company?' }))
    fireEvent.change(byName('booker_billing_company'), { target: { value: 'Acme SL' } })
    expect(screen.getByTestId('invoice-to-line-0')).toHaveTextContent('Acme SL')
    expect(screen.getByTestId('invoice-to-line-1')).toHaveTextContent('Grace Hopper')
  })

  it('keeps the Invoice name when the company toggle is switched off', () => {
    const { onBillingChange } = renderAddress()
    fillBillingFields()
    fireEvent.change(screen.getByLabelText('Invoice name (optional)'), {
      target: { value: 'Grace Hopper' },
    })
    const toggle = screen.getByRole('checkbox', { name: 'Invoice to a company?' })
    fireEvent.click(toggle)
    fireEvent.change(byName('booker_billing_company'), { target: { value: 'Acme SL' } })
    fireEvent.click(toggle)
    expect(onBillingChange.mock.calls.at(-1)![0]).toMatchObject({
      name: 'Grace Hopper',
      company: '',
    })
  })

  describe('"Invoice to:" cue', () => {
    it('is live: appears with the booker name', () => {
      renderAddress({ booker: { ...booker(), first_name: '', last_name: '' } })
      expect(screen.getByTestId('invoice-to-region')).toHaveAttribute('aria-live', 'polite')
      expect(screen.queryByTestId('invoice-to')).not.toBeInTheDocument()
    })

    it('reads company, then the booker as contact person, when invoicing a company', () => {
      renderAddress({ booker: { ...booker(), first_name: 'Olaf', last_name: 'Klein' } })
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
      renderAddress()
      await waitFor(() => expect(byName('booker_billing_country')).toHaveValue('AT'))
    })

    it('falls back to the browser locale region, then the operator country', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
      vi.stubGlobal('navigator', { languages: ['de-CH', 'de'], language: 'de-CH' })
      const { unmount } = renderAddress({ operatorCountry: 'ES' })
      await waitFor(() => expect(byName('booker_billing_country')).toHaveValue('CH'))
      unmount()
      vi.stubGlobal('navigator', { languages: ['en'], language: 'en' })
      renderAddress({ operatorCountry: 'es' })
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
      renderAddress()
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
      renderAddress()
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
      renderAddress({ booker: booker({ ...emptyBilling(), country: 'IT' }) })
      await new Promise((r) => setTimeout(r, 0))
      expect(byName('booker_billing_country')).toHaveValue('IT')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('names countries in German on a German locale', () => {
      vi.stubGlobal('navigator', { languages: ['de'], language: 'de' })
      renderAddress()
      const opt = byName<HTMLSelectElement>('booker_billing_country').querySelector(
        'option[value="DE"]',
      )
      expect(opt).toHaveTextContent('Deutschland')
    })
  })
})

describe('AddressStep — staff mode (landr-uuntm.3)', () => {
  const STAFF = { active: true, token: 't.o.k', powers: [], operatorId: 'op-1' } as const

  it('reads as optional: blur on empty fields flags nothing and Continue stays enabled', () => {
    const onConfirm = vi.fn()
    render(
      <StaffModeProvider value={STAFF}>
        <AddressStep
          booker={booker()}
          onBillingChange={vi.fn()}
          customerComment=""
          onCustomerCommentChange={vi.fn()}
          onConfirm={onConfirm}
        />
      </StaffModeProvider>,
    )
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
    expect(next()).toBeEnabled()
    fireEvent.click(next())
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
