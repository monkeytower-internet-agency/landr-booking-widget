import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SavingLine } from '@/api/types'
import { PriceBreakdown } from './PriceBreakdown'

/**
 * Tests for the shared Subtotal → savings rows → Amount due block
 * (landr-nva1a.4), used by both PriceSidebar and Confirmation.
 */
describe('PriceBreakdown', () => {
  it('renders only the total row when there are no savings', () => {
    render(
      <PriceBreakdown
        amountDue="180.00"
        currency="EUR"
        testIdPrefix="test"
      />,
    )
    expect(screen.queryByTestId('test-subtotal')).not.toBeInTheDocument()
    expect(screen.queryByTestId('test-savings')).not.toBeInTheDocument()
    const total = screen.getByTestId('test-amount-due')
    expect(total).toHaveTextContent('Amount due')
    expect(total).toHaveTextContent('180')
  })

  it('renders only the total row when savings is an empty array', () => {
    render(
      <PriceBreakdown
        amountDue="180.00"
        currency="EUR"
        savings={[]}
        subtotalBeforeSavings="180.00"
        testIdPrefix="test"
      />,
    )
    expect(screen.queryByTestId('test-subtotal')).not.toBeInTheDocument()
    expect(screen.getByTestId('test-amount-due')).toHaveTextContent('180')
  })

  it('renders only the total row when subtotalBeforeSavings is missing (savings present but no base to diff against)', () => {
    const savings: SavingLine[] = [
      { kind: 'multi_day', label: 'Multi-day savings', amount: '15.00' },
    ]
    render(
      <PriceBreakdown amountDue="165.00" currency="EUR" savings={savings} testIdPrefix="test" />,
    )
    expect(screen.queryByTestId('test-subtotal')).not.toBeInTheDocument()
    expect(screen.queryByTestId('test-savings')).not.toBeInTheDocument()
    expect(screen.getByTestId('test-amount-due')).toHaveTextContent('165')
  })

  it('renders Subtotal → one row per saving → Amount due when both are present', () => {
    const savings: SavingLine[] = [
      { kind: 'multi_day', label: 'Multi-day savings', amount: '15.00' },
      { kind: 'voucher', label: 'Voucher SUMMER10', amount: '9.00' },
    ]
    render(
      <PriceBreakdown
        amountDue="156.00"
        currency="EUR"
        savings={savings}
        subtotalBeforeSavings="180.00"
        testIdPrefix="test"
      />,
    )
    const subtotal = screen.getByTestId('test-subtotal')
    expect(subtotal).toHaveTextContent('Subtotal')
    expect(subtotal).toHaveTextContent('180')

    const rows = screen.getAllByTestId('test-saving')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Multi-day savings')
    expect(rows[0]).toHaveTextContent('−€15.00')
    expect(rows[1]).toHaveTextContent('Voucher SUMMER10')
    expect(rows[1]).toHaveTextContent('−€9.00')

    const total = screen.getByTestId('test-amount-due')
    expect(total).toHaveTextContent('Amount due')
    expect(total).toHaveTextContent('156')
  })

  it('uses a custom totalLabel when supplied', () => {
    render(
      <PriceBreakdown
        amountDue="180.00"
        currency="EUR"
        totalLabel="Booking total"
        testIdPrefix="test"
      />,
    )
    expect(screen.getByTestId('test-amount-due')).toHaveTextContent('Booking total')
  })
})
