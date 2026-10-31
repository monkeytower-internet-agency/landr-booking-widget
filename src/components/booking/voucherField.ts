/**
 * Whether the checkout shows the optional voucher-code field.
 *
 * The API says `has_active_vouchers: false` when the operator has no voucher a
 * guest could redeem — then the field is a dead end and stays hidden. Anything
 * else shows it (an absent key means an older API: keep the previous behaviour).
 * A code that arrived via `?voucher=` or was already typed always keeps the
 * field, so a guest holding a code can see the verdict on it.
 */
export function shouldShowVoucherField(
  hasActiveVouchers: boolean | undefined,
  currentCode: string,
): boolean {
  return hasActiveVouchers !== false || currentCode.trim() !== ''
}
