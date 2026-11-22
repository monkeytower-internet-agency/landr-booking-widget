import { useEffect, useMemo, useRef, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { countryOptions } from '@/lib/countries'
import { guessCountry } from '@/lib/guessCountry'
import { browserLocale } from '@/lib/locale'
import { tr } from '@/lib/strings'
import { Field } from './FormField'
import {
  BILLING_REQUIRED_FIELDS,
  invoiceToLines,
  type BillingDetails,
  type BookerDetails,
} from './detailsTypes'

export interface BillingAddressBlockProps {
  /** The booker: `booker.billing` is the edited address, the name feeds the "Invoice to:" preview. */
  booker: Pick<BookerDetails, 'first_name' | 'last_name' | 'billing'>
  onChange: (next: BillingDetails) => void
  /** Street, postal code, city, country are required (public widget; false in staff mode). */
  required: boolean
  /** `booker.billing.*` keys the customer has blurred or a failed Confirm armed. */
  touched: ReadonlySet<string>
  onTouch: (key: string) => void
  /** The operator's ISO country, last link of the country guess chain. */
  operatorCountry?: string | null
}

/**
 * The billing address block (landr-uuntm.3), shown on the Address step
 * (landr-rw8i2: it used to sit on the Review). The booker IS the invoice
 * recipient, so it edits `booker.billing`; AddressStep owns the touched set
 * and the Continue gate. Optional: line 2, invoice name, and, behind "Invoice
 * to a company?", company + tax id.
 */
export function BillingAddressBlock({
  booker,
  onChange,
  required,
  touched,
  onTouch,
  operatorCountry,
}: BillingAddressBlockProps) {
  const locale = browserLocale()
  const billing = booker.billing
  const countries = useMemo(() => countryOptions(locale), [locale])
  // landr-uuntm.3: "Invoice to a company?" opens when company/tax id are
  // already filled (Back-restore) so stored data is never hidden.
  const [invoiceToCompany, setInvoiceToCompany] = useState<boolean>(
    () => !!(billing.company.trim() || billing.tax_id.trim()),
  )
  // landr-uuntm.3: set the moment the customer picks a country themselves —
  // the async guess must never overwrite a deliberate choice.
  const countryTouchedRef = useRef(false)
  // The guess lands asynchronously; keep the latest billing + onChange so the
  // mount-only effect below applies it on top of whatever was typed meanwhile.
  const latest = useRef({ billing, onChange })
  useEffect(() => {
    latest.current = { billing, onChange }
  })

  const updateField = (key: keyof BillingDetails, value: string) => {
    if (key === 'country') countryTouchedRef.current = true
    onChange({ ...billing, [key]: value })
  }

  const toggleInvoiceToCompany = (on: boolean) => {
    setInvoiceToCompany(on)
    // Hidden values must never ride along on submit.
    if (!on) onChange({ ...billing, company: '', tax_id: '' })
  }

  // landr-uuntm.3: pre-fill the country once, only while it is still empty and
  // the customer has not touched it. The guess is async (edge /geo call,
  // <=1.5 s) so both conditions are re-checked when it lands; onChange runs in
  // the promise callback, not the effect body.
  useEffect(() => {
    if (billing.country) return
    let cancelled = false
    void guessCountry(operatorCountry).then((code) => {
      if (cancelled || !code || countryTouchedRef.current) return
      const cur = latest.current
      if (cur.billing.country) return
      cur.onChange({ ...cur.billing, country: code })
    })
    return () => {
      cancelled = true
    }
    // Mount-only on purpose: a one-shot guess, never re-run on edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: one-shot country guess, never re-run on edits
  }, [])

  // landr-jiagg.2 + landr-jiagg.5: "Invoice to:" — first two lines of the
  // address block (company, then the booker as contact person).
  const invoiceTo = invoiceToLines(booker, invoiceToCompany)

  // landr-uuntm.3: required-field validation (same touched/blur UX as the
  // details step). In staff mode the address is optional, so nothing flags.
  const validate = (key: string, field: keyof BillingDetails, id: string) => {
    const error =
      required && touched.has(key) && !billing[field].trim()
        ? tr('required', locale)
        : undefined
    return {
      error,
      inputProps: required
        ? {
            onBlur: () => onTouch(key),
            'aria-invalid': error ? true : undefined,
            'aria-describedby': error ? `${id}-error` : undefined,
          }
        : {},
    }
  }
  const [line1, postal, city, country] = BILLING_REQUIRED_FIELDS
  const vLine1 = validate(line1.key, line1.field, line1.id)
  const vPostal = validate(postal.key, postal.field, postal.id)
  const vCity = validate(city.key, city.field, city.id)
  const vCountry = validate(country.key, country.field, country.id)

  return (
    <div
      role="group"
      aria-labelledby="booker-billing-title"
      className="flex flex-col gap-3"
      data-testid="booker-billing-group"
    >
      <div className="flex flex-col gap-0.5">
        <span id="booker-billing-title" className="text-sm font-medium">
          {tr('billingAddressTitle', locale)}
        </span>
        <p className="text-xs text-muted-foreground">
          {tr('billingAddressHelper', locale)}
        </p>
      </div>
      {/* landr-jiagg.2: who the invoice goes to, live, once the booker
          has a name — so the payer is obvious right at the address even
          when they are not taking part. Company invoices read company,
          then the booker as contact person (landr-jiagg.5 block rule).
          The live region stays mounted so updates are announced. */}
      <div aria-live="polite" data-testid="invoice-to-region">
        {invoiceTo.length > 0 ? (
          <div
            className="rounded-md border bg-surface-well px-3 py-2 text-sm shadow-well"
            data-testid="invoice-to"
          >
            <span className="text-xs text-muted-foreground">
              {tr('invoiceToLabel', locale)}
            </span>
            {invoiceTo.map((line, i) => (
              <span
                key={i}
                className={`block ${i === 0 ? 'font-medium' : ''}`}
                data-testid={`invoice-to-line-${i}`}
              >
                {line}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {/* landr-jsu3n.2: optional bill-to name — also in the invite flow.
          Always visible (not behind the company toggle): a private
          guest can have the invoice made out to someone else too. */}
      <Field
        label={tr('billingInvoiceNameLabel', locale)}
        htmlFor="booker-billing-name"
      >
        <Input
          id="booker-billing-name"
          name="booker_billing_name"
          autoComplete="off"
          data-testid="booker-billing-name"
          value={billing.name}
          onChange={(e) => updateField('name', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {tr('billingInvoiceNameHint', locale)}
        </p>
      </Field>
      <div className="grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-6">
          <Field
            label={tr('billingStreetLabel', locale)}
            htmlFor="booker-billing-line1"
            error={vLine1.error}
          >
            <Input
              id="booker-billing-line1"
              name="booker_billing_address_line1"
              autoComplete="section-booker billing address-line1"
              value={billing.address_line1}
              onChange={(e) => updateField('address_line1', e.target.value)}
              {...vLine1.inputProps}
            />
          </Field>
        </div>
        <div className="sm:col-span-6">
          <Field
            label={tr('billingAddressLine2Label', locale)}
            htmlFor="booker-billing-line2"
          >
            <Input
              id="booker-billing-line2"
              name="booker_billing_address_line2"
              autoComplete="section-booker billing address-line2"
              value={billing.address_line2}
              onChange={(e) => updateField('address_line2', e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field
            label={tr('billingPostalCodeLabel', locale)}
            htmlFor="booker-billing-postal"
            error={vPostal.error}
          >
            <Input
              id="booker-billing-postal"
              name="booker_billing_postal_code"
              autoComplete="section-booker billing postal-code"
              value={billing.postal_code}
              onChange={(e) => updateField('postal_code', e.target.value)}
              {...vPostal.inputProps}
            />
          </Field>
        </div>
        <div className="sm:col-span-4">
          <Field
            label={tr('billingCityLabel', locale)}
            htmlFor="booker-billing-city"
            error={vCity.error}
          >
            <Input
              id="booker-billing-city"
              name="booker_billing_city"
              autoComplete="section-booker billing address-level2"
              value={billing.city}
              onChange={(e) => updateField('city', e.target.value)}
              {...vCity.inputProps}
            />
          </Field>
        </div>
        <div className="sm:col-span-6">
          <Field
            label={tr('billingCountryLabel', locale)}
            htmlFor="booker-billing-country"
            error={vCountry.error}
          >
            <select
              id="booker-billing-country"
              name="booker_billing_country"
              autoComplete="section-booker billing country"
              value={billing.country}
              onChange={(e) => updateField('country', e.target.value)}
              data-testid="booker-billing-country"
              className="border-input bg-surface-page shadow-well ring-offset-background focus-visible:ring-ring aria-invalid:border-destructive flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              {...vCountry.inputProps}
            >
              <option value="">{tr('billingCountryPlaceholder', locale)}</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="booker-billing-company-toggle"
          checked={invoiceToCompany}
          onCheckedChange={(v) => toggleInvoiceToCompany(v === true)}
          data-testid="booker-billing-company-toggle"
        />
        <Label htmlFor="booker-billing-company-toggle" className="text-sm font-normal">
          {tr('billingInvoiceToCompanyLabel', locale)}
        </Label>
      </div>
      {invoiceToCompany ? (
        <div className="grid gap-3 sm:grid-cols-2" data-testid="booker-billing-company-fields">
          <Field label={tr('billingCompanyLabel', locale)} htmlFor="booker-billing-company">
            <Input
              id="booker-billing-company"
              name="booker_billing_company"
              autoComplete="section-booker organization"
              value={billing.company}
              onChange={(e) => updateField('company', e.target.value)}
            />
          </Field>
          <Field label={tr('billingTaxIdLabel', locale)} htmlFor="booker-billing-vat-id">
            <Input
              id="booker-billing-vat-id"
              name="vat_id"
              value={billing.tax_id}
              onChange={(e) => updateField('tax_id', e.target.value)}
            />
          </Field>
        </div>
      ) : null}
    </div>
  )
}
