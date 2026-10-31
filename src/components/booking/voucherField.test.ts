import { describe, expect, it } from 'vitest'
import { shouldShowVoucherField } from './voucherField'

describe('shouldShowVoucherField', () => {
  it('hides the field when the operator has no active voucher', () => {
    expect(shouldShowVoucherField(false, '')).toBe(false)
  })
  it('shows it when the operator has one', () => {
    expect(shouldShowVoucherField(true, '')).toBe(true)
  })
  it('shows it for an older API that sends no flag', () => {
    expect(shouldShowVoucherField(undefined, '')).toBe(true)
  })
  it('keeps it when a code came in via ?voucher= even without vouchers', () => {
    expect(shouldShowVoucherField(false, 'GIFT10')).toBe(true)
  })
})
