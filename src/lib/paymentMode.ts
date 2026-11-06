/**
 * Whether guests pay the operator directly instead of online.
 *
 * Derived from the operator's accepted payment methods in the public
 * config, never from a plan or tier name. A missing or empty list (an older
 * API, or no config yet) is "unknown" and returns false, so nothing changes
 * for operators the widget has no information about.
 */
export type PaymentMethod = 'online' | 'bank_transfer' | 'on_site'

export function paysDirectly(methods: readonly PaymentMethod[] | null | undefined): boolean {
  return Array.isArray(methods) && methods.length > 0 && !methods.includes('online')
}
