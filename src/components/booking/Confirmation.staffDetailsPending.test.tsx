import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Confirmation } from './Confirmation'
import type { SubmitBookingResponse } from '@/api/types'
import { ALL_STAFF_POWERS, type StaffSession } from '@/lib/staffMode'
import { StaffModeProvider } from '@/lib/staffMode.tsx'

// landr-kcxx5.10: staff Confirmation tells the operator the customer still owes
// custom-form answers (customer_details_pending) and that the link was sent.

const STAFF: StaffSession = {
  active: true,
  token: 'staff.signed.token',
  powers: ALL_STAFF_POWERS,
  operatorId: 'a1b2c3d4-0001-0001-0001-000000000002',
}

function response(overrides: Partial<SubmitBookingResponse> = {}): SubmitBookingResponse {
  return {
    booking_id: '00000000-0000-0000-0000-0000000000bb',
    semantic_state: 'pending',
    ...overrides,
  }
}

function renderStaff(res: SubmitBookingResponse) {
  render(
    <StaffModeProvider value={STAFF}>
      <Confirmation response={res} onRestart={vi.fn()} />
    </StaffModeProvider>,
  )
}

describe('Confirmation — staff customer_details_pending (landr-kcxx5.10)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the note in English when the customer still has to complete details', () => {
    renderStaff(response({ customer_details_pending: true }))
    expect(screen.getByTestId('confirmation-customer-details-pending')).toHaveTextContent(
      'The customer still has to complete their details — we sent them the link.',
    )
  })

  it('shows the note in German on a German locale', () => {
    vi.stubGlobal('navigator', { ...navigator, language: 'de-DE' })
    renderStaff(response({ customer_details_pending: true }))
    expect(screen.getByTestId('confirmation-customer-details-pending')).toHaveTextContent(
      'Der Kunde muss seine Angaben noch vervollständigen — wir haben ihm den Link geschickt.',
    )
  })

  it.each([{ customer_details_pending: false }, {}])('shows no note for %j', (extra) => {
    renderStaff(response(extra))
    expect(screen.queryByTestId('confirmation-customer-details-pending')).toBeNull()
  })

  it('never shows the note outside staff mode', () => {
    render(
      <Confirmation
        response={response({ customer_details_pending: true, approval_outcome: 'auto_approved' })}
        onRestart={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('confirmation-customer-details-pending')).toBeNull()
  })
})
