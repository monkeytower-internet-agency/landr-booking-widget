/**
 * landr-g98ug: the widget tells the dashboard's Add-booking overlay whether a
 * booking is in progress, so an outside-click can warn instead of silently
 * discarding the operator's input.
 */
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Step } from '@/appStepMachine'
import type { Product } from '@/api/types'
import { StaffModeProvider } from './staffMode.tsx'
import { INACTIVE_STAFF_SESSION, type StaffSession } from './staffMode'
import { isBookingInProgress, useStaffDirtySignal } from './staffDirty'

const product = { id: 'p1' } as unknown as Product
const ACTIVE: StaffSession = {
  active: true,
  token: 't',
  powers: [],
  operatorId: 'op1',
}

describe('isBookingInProgress', () => {
  it('is clean while browsing the catalogue', () => {
    expect(isBookingInProgress({ name: 'pick-product' }, 0)).toBe(false)
    expect(isBookingInProgress({ name: 'product-detail', product }, 0)).toBe(false)
    expect(isBookingInProgress({ name: 'fully-booked', product }, 0)).toBe(false)
  })

  it('is clean on the date picker until a date is chosen', () => {
    const step: Step = { name: 'pick-selection', product }
    expect(isBookingInProgress(step, 0)).toBe(false)
    expect(isBookingInProgress(step, 1)).toBe(true)
  })

  it('is dirty when returning to the date picker with a selection', () => {
    const step = {
      name: 'pick-selection',
      product,
      selection: { kind: 'single', date: '2026-10-01' },
    } as unknown as Step
    expect(isBookingInProgress(step, 0)).toBe(true)
  })

  it('is dirty on any later step', () => {
    expect(isBookingInProgress({ name: 'details' } as unknown as Step, 0)).toBe(true)
    expect(isBookingInProgress({ name: 'fill-form' } as unknown as Step, 0)).toBe(true)
  })

  it('is clean once the booking is confirmed (already saved)', () => {
    expect(isBookingInProgress({ name: 'confirmed' } as unknown as Step, 3)).toBe(false)
  })
})

function Probe({ dirty }: { dirty: boolean }) {
  useStaffDirtySignal(dirty)
  return null
}

describe('useStaffDirtySignal', () => {
  const postMessage = vi.fn()

  beforeEach(() => {
    postMessage.mockReset()
    Object.defineProperty(window, 'parent', {
      value: { postMessage },
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'parent', { value: window, configurable: true })
  })

  it('posts the flag to the allow-listed parent origin in staff mode', () => {
    const { rerender } = render(
      <StaffModeProvider value={ACTIVE}>
        <Probe dirty={false} />
      </StaffModeProvider>,
    )
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: 'landr:staff-dirty', dirty: false },
      'https://dashboard.dev.landr.de',
    )
    rerender(
      <StaffModeProvider value={ACTIVE}>
        <Probe dirty={true} />
      </StaffModeProvider>,
    )
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: 'landr:staff-dirty', dirty: true },
      'https://dashboard.dev.landr.de',
    )
    const [, targetOrigin] = postMessage.mock.calls[0]!
    expect(targetOrigin).not.toBe('*')
  })

  it('never posts from a normal customer embed', () => {
    render(
      <StaffModeProvider value={INACTIVE_STAFF_SESSION}>
        <Probe dirty={true} />
      </StaffModeProvider>,
    )
    expect(postMessage).not.toHaveBeenCalled()
  })
})
