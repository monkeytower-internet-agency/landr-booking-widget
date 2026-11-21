/**
 * landr-kq0l4 — documents, waiver and signature are collected on the Details
 * step (Review only shows them). Continue waits for them, the same rule as
 * for every other required item.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { mockOccupancyStay } from '@/api/mocks'
import type { Product } from '@/api/types'
import type { BookingSelection } from './BookingForm'
import { DetailsStep } from './DetailsStep'
import { EMPTY_VERIFICATION, type VerificationInput } from './verification'

const SELECTION: BookingSelection = { kind: 'days', selectedDays: ['2026-12-01'] }
const verified: Product = {
  ...mockOccupancyStay,
  requires_verification: true,
  waiver_text_localized: { en: 'At my own risk.' },
}

const file = (name: string, type: string) => new File([new Uint8Array(10)], name, { type })

function Harness({
  product = verified,
  onConfirm,
  controlled = true,
}: {
  product?: Product
  onConfirm: () => void
  controlled?: boolean
}) {
  const [verification, setVerification] = useState<VerificationInput>(EMPTY_VERIFICATION)
  return (
    <DetailsStep
      product={product}
      selection={SELECTION}
      onBack={vi.fn()}
      onConfirm={onConfirm}
      {...(controlled
        ? {
            verificationProducts: [product],
            verification,
            onVerificationChange: setVerification,
          }
        : {})}
    />
  )
}

function fillContact() {
  const set = (name: string, value: string) =>
    fireEvent.change(document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!, {
      target: { value },
    })
  set('booker_first_name', 'Ada')
  set('booker_last_name', 'Lovelace')
  set('booker_email', 'ada@example.com')
  set('booker_phone', '+34 600000000')
}

describe('DetailsStep verification (landr-kq0l4)', () => {
  it('shows the documents, waiver and signature for a product that asks for verification', () => {
    render(<Harness onConfirm={vi.fn()} />)
    expect(screen.getByTestId('verification-fields')).toBeInTheDocument()
    expect(screen.getByTestId('verification-waiver-text')).toHaveTextContent('At my own risk.')
  })

  it('shows nothing for a product without verification', () => {
    render(<Harness product={{ ...verified, requires_verification: false }} onConfirm={vi.fn()} />)
    expect(screen.queryByTestId('verification-fields')).toBeNull()
  })

  it('Continue waits for both documents, the signature and the accepted waiver', () => {
    const onConfirm = vi.fn()
    render(<Harness onConfirm={onConfirm} />)
    fillContact()
    fireEvent.click(screen.getByTestId('details-step-submit'))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByTestId('details-step-gate')).toHaveTextContent(/Add both documents/)

    fireEvent.change(screen.getByTestId('verification-licence'), {
      target: { files: [file('l.jpg', 'image/jpeg')] },
    })
    fireEvent.change(screen.getByTestId('verification-insurance'), {
      target: { files: [file('i.pdf', 'application/pdf')] },
    })
    fireEvent.change(screen.getByTestId('verification-signature'), {
      target: { value: 'Ada Lovelace' },
    })
    fireEvent.click(screen.getByTestId('details-step-submit'))
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('verification-accept'))
    expect(screen.getByTestId('details-step-gate')).toHaveTextContent(/ready/i)
    fireEvent.click(screen.getByTestId('details-step-submit'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('a caller that wires no verification (older callers, other flows) is unchanged', () => {
    const onConfirm = vi.fn()
    render(<Harness controlled={false} onConfirm={onConfirm} />)
    expect(screen.queryByTestId('verification-fields')).toBeNull()
    fillContact()
    fireEvent.click(screen.getByTestId('details-step-submit'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
