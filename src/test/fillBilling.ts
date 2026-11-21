/**
 * landr-uuntm.3: shared test helper — fills the REQUIRED billing-address
 * fields (street, postal code, city, country) so flow tests that drive through
 * the Address step keep working now that Continue is gated on them. Looks
 * fields up by `name`, works for the inputs and the country <select>.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { expect } from 'vitest'

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

/**
 * landr-rw8i2: the billing address is its own step right before the read-only
 * Review. Fill the required fields, continue, and wait for the Review. Also
 * fine when the address was already restored (Back -> forward): the same
 * values are typed over it. `timeout` is for the slow flow tests.
 */
export async function passAddressStep(timeout?: number): Promise<void> {
  const opts = timeout === undefined ? undefined : { timeout }
  const next = await screen.findByTestId('address-step-submit', undefined, opts)
  fillBillingFields()
  await waitFor(() => expect(next).toBeEnabled(), opts)
  fireEvent.click(next)
  await waitFor(
    () => expect(screen.getByText(/review your booking/i)).toBeInTheDocument(),
    opts,
  )
}
