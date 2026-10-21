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
  // landr-fcoh2: a weekend surcharge is itemised, and the rows add up:
  // 150 + 20 − 10 = 160.
  it('renders Subtotal (before surcharges) → + surcharge → − saving → Amount due', () => {
    render(
      <PriceBreakdown
        subtotalBeforeSavings="170.00"
        savings={[{ kind: 'discount', label: 'Time-slot discount', amount: '10.00' }]}
        surcharges={[{ kind: 'surcharge', label: 'Weekend surcharge', amount: '20.00' }]}
        subtotalBeforeSurcharges="150.00"
        amountDue="160.00"
        currency="EUR"
        testIdPrefix="test"
      />,
    )
    expect(screen.getByTestId('test-subtotal')).toHaveTextContent('150')
    const surcharge = screen.getByTestId('test-surcharge')
    expect(surcharge).toHaveTextContent('+ Weekend surcharge')
    expect(surcharge).toHaveTextContent('20')
    expect(screen.getByTestId('test-saving')).toHaveTextContent('Time-slot discount')
    expect(screen.getByTestId('test-amount-due')).toHaveTextContent('160')
    // Visual order: subtotal, surcharge, saving, total.
    const order = ['test-subtotal', 'test-surcharge', 'test-saving', 'test-amount-due'].map(
      (id) => screen.getByTestId(id),
    )
    for (let k = 1; k < order.length; k++) {
      expect(
        order[k - 1].compareDocumentPosition(order[k]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    }
  })

  it('shows a surcharge with no savings (Subtotal → + surcharge → Amount due)', () => {
    render(
      <PriceBreakdown
        subtotalBeforeSavings="170.00"
        savings={[]}
        surcharges={[{ kind: 'surcharge', label: 'Weekend surcharge', amount: '20.00' }]}
        subtotalBeforeSurcharges="150.00"
        amountDue="170.00"
        currency="EUR"
        testIdPrefix="test"
      />,
    )
    expect(screen.getByTestId('test-subtotal')).toHaveTextContent('150')
    expect(screen.getByTestId('test-surcharge')).toHaveTextContent('Weekend surcharge')
    expect(screen.queryByTestId('test-savings')).not.toBeInTheDocument()
    expect(screen.getByTestId('test-amount-due')).toHaveTextContent('170')
  })
})
