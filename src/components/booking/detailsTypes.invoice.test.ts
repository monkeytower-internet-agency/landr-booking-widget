import { describe, expect, it } from 'vitest'
import { billingToPayload, emptyBilling, invoiceToLines, withBilling, emptyBooker } from './detailsTypes'

// landr-jsu3n.2: the optional bill-to "Invoice name".
const booker = (billing: Partial<ReturnType<typeof emptyBilling>> = {}) => ({
  first_name: 'Olaf',
  last_name: 'Klein',
  billing: { ...emptyBilling(), ...billing },
})

describe('invoiceToLines — Invoice name (landr-jsu3n.2)', () => {
  it('shows the booker when no Invoice name is set', () => {
    expect(invoiceToLines(booker(), false)).toEqual(['Olaf Klein'])
  })

  it('shows the Invoice name instead of the booker', () => {
    expect(invoiceToLines(booker({ name: ' Grace Hopper ' }), false)).toEqual(['Grace Hopper'])
  })

  it('company first, then the Invoice name as contact person', () => {
    expect(invoiceToLines(booker({ name: 'Grace Hopper', company: 'Acme SL' }), true)).toEqual([
      'Acme SL',
      'Grace Hopper',
    ])
  })

  it('shows the Invoice name even before the booker has typed a name', () => {
    const b = { ...booker({ name: 'Grace Hopper' }), first_name: '', last_name: '' }
    expect(invoiceToLines(b, false)).toEqual(['Grace Hopper'])
  })
})

describe('billing wire / restore (landr-jsu3n.2)', () => {
  it('billingToPayload trims and blank-folds name', () => {
    expect(billingToPayload({ ...emptyBilling(), name: '  Grace  ' }).name).toBe('Grace')
    expect(billingToPayload({ ...emptyBilling(), name: '   ' }).name).toBeNull()
  })

  it('withBilling fills name for a booker persisted by an older bundle', () => {
    const old = { ...emptyBooker(), billing: { address_line1: 'x' } } as unknown as ReturnType<
      typeof emptyBooker
    >
    expect(withBilling(old).billing.name).toBe('')
  })
})
