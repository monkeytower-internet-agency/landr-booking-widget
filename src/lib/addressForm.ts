// landr-wm0jv: per-operator address form for the German and Turkish widget
// strings. 'informal' (du / sen) is the default and today's voice; 'formal'
// (Sie / siz) is opt-in from the dashboard (operators.address_form, exposed in
// the public widget settings). Module-level, like configureCustomerLocale, so
// every string lookup sees it without prop threading.

export type AddressForm = 'informal' | 'formal'

let current: AddressForm = 'informal'

/** Anything but an explicit 'formal' (absent, null, unknown) is informal. */
export function normalizeAddressForm(value: unknown): AddressForm {
  return value === 'formal' ? 'formal' : 'informal'
}

export function getAddressForm(): AddressForm {
  return current
}

export function setAddressForm(value: unknown): AddressForm {
  current = normalizeAddressForm(value)
  return current
}
