/**
 * landr-aoak.2 [S3].1: StaffModeProvider postMessage-init wiring. A staff
 * session can arrive from the embedding dashboard via a `landr:staff-init`
 * message, but ONLY from an allow-listed origin. This file exercises the
 * provider's message listener + the useStaffMode hook.
 */
import { render, screen, act } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { StaffModeProvider } from './staffMode.tsx'
import { useStaffMode } from './staffMode'

function Probe() {
  const staff = useStaffMode()
  return (
    <div>
      <span data-testid="active">{String(staff.active)}</span>
      <span data-testid="token">{staff.token ?? ''}</span>
    </div>
  )
}

function postInit(origin: string, data: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { origin, data }))
  })
}

describe('StaffModeProvider — postMessage init', () => {
  afterEach(() => {
    // Reset the URL so a prior test's ?staff_session= can't leak.
    window.history.replaceState({}, '', '/')
  })

  it('starts inactive with no URL session', () => {
    render(
      <StaffModeProvider>
        <Probe />
      </StaffModeProvider>,
    )
    expect(screen.getByTestId('active')).toHaveTextContent('false')
  })

  it('activates from an allow-listed origin staff-init message', () => {
    render(
      <StaffModeProvider>
        <Probe />
      </StaffModeProvider>,
    )
    postInit('https://dashboard.dev.landr.de', {
      type: 'landr:staff-init',
      token: 'minted.token.123',
    })
    expect(screen.getByTestId('active')).toHaveTextContent('true')
    expect(screen.getByTestId('token')).toHaveTextContent('minted.token.123')
  })

  it('IGNORES a staff-init message from a non-allow-listed origin', () => {
    render(
      <StaffModeProvider>
        <Probe />
      </StaffModeProvider>,
    )
    postInit('https://evil.example.com', {
      type: 'landr:staff-init',
      token: 'attacker.token',
    })
    expect(screen.getByTestId('active')).toHaveTextContent('false')
    expect(screen.getByTestId('token')).toHaveTextContent('')
  })

  it('ignores a malformed message even from an allowed origin', () => {
    render(
      <StaffModeProvider>
        <Probe />
      </StaffModeProvider>,
    )
    postInit('https://dashboard.dev.landr.de', { type: 'wrong', token: 'x' })
    expect(screen.getByTestId('active')).toHaveTextContent('false')
  })
})
