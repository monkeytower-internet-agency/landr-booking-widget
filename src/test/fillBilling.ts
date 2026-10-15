/**
 * landr-uuntm.3: shared test helper — fills the REQUIRED billing-address
 * fields of the details step's booker block (street, postal code, city,
 * country) so flow tests that drive through the step keep working now that
 * Continue is gated on them. Looks fields up by `name`, works for the inputs
 * and the country <select>.
 */
import { fireEvent } from '@testing-library/react'

export const TEST_BILLING_FIELDS = {
  booker_billing_address_line1: 'Calle Mayor 1',
  booker_billing_postal_code: '28013',
  booker_billing_city: 'Madrid',
  booker_billing_country: 'ES',
} as const

export function fillBillingFields(
  overrides: Partial<Record<keyof typeof TEST_BILLING_FIELDS, string>> = {},
): void {
  const values = { ...TEST_BILLING_FIELDS, ...overrides }
  for (const [name, value] of Object.entries(values)) {
    const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[name="${name}"]`,
    )
    if (!el) throw new Error(`No billing field named ${name}`)
    fireEvent.change(el, { target: { value } })
  }
}
