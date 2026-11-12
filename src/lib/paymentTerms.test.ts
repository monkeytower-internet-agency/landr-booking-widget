import { describe, expect, it } from 'vitest'
import { checkoutPaymentTermsNote } from './paymentTerms'

const TERMS = {
  payment_methods: ['bank_transfer'] as const,
  deposit_percent: 30,
  deposit_refundable: false,
  balance_due_days_before_arrival: 30,
}
const TODAY = '2031-01-10'

describe('checkoutPaymentTermsNote', () => {
  it('deposit today (non-refundable), the rest by arrival minus N days', () => {
    expect(checkoutPaymentTermsNote(TERMS, ['2031-03-12', '2031-03-10'], 'en', TODAY)).toMatch(
      /^30% deposit today \(non-refundable\), the rest by .*(Feb 8|8 Feb)/,
    )
  })

  it('German wording', () => {
    expect(checkoutPaymentTermsNote(TERMS, ['2031-03-10'], 'de', TODAY)).toMatch(
      /^Heute 30 % Anzahlung \(nicht erstattbar\), Rest bis /,
    )
  })

  it('refundable deposit with a due date: no "non-refundable"', () => {
    const note = checkoutPaymentTermsNote(
      { ...TERMS, deposit_refundable: true }, ['2031-03-10'], 'en', TODAY,
    )
    expect(note).toMatch(/^30% deposit today, the rest by /)
  })

  it('booked inside the window: due in full now, only the deposit rule remains', () => {
    expect(checkoutPaymentTermsNote(TERMS, ['2031-01-20'], 'en', TODAY)).toBe(
      'The 30% deposit is not refunded if you cancel.',
    )
    expect(
      checkoutPaymentTermsNote({ ...TERMS, deposit_refundable: true }, ['2031-01-20'], 'en', TODAY),
    ).toBeNull()
  })

  it('non-refundable without a due date', () => {
    expect(
      checkoutPaymentTermsNote(
        { ...TERMS, balance_due_days_before_arrival: null }, ['2031-03-10'], 'en', TODAY,
      ),
    ).toBe('30% deposit today (non-refundable).')
  })

  it('nothing by default, without a deposit, on site only, or an older API', () => {
    expect(
      checkoutPaymentTermsNote(
        { payment_methods: ['online'], deposit_percent: 30 }, ['2031-03-10'], 'en', TODAY,
      ),
    ).toBeNull()
    expect(
      checkoutPaymentTermsNote({ ...TERMS, deposit_percent: null }, ['2031-03-10'], 'en', TODAY),
    ).toBeNull()
    expect(
      checkoutPaymentTermsNote({ ...TERMS, payment_methods: ['on_site'] }, ['2031-03-10'], 'en', TODAY),
    ).toBeNull()
    expect(checkoutPaymentTermsNote(undefined, ['2031-03-10'], 'en', TODAY)).toBeNull()
  })
})
