import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { parsePausedBody, setPaused } from '@/api/pauseStore'
import { PausedGate } from './PausedGate'

afterEach(() => act(() => setPaused(null)))

describe('parsePausedBody', () => {
  it('reads the top-level shape', () => {
    expect(parsePausedBody('{"error":"operator_paused","resume_on":"2027-03-01"}')).toEqual({
      resumeOn: '2027-03-01',
    })
  })
  it('reads the nested detail shape', () => {
    expect(
      parsePausedBody('{"detail":{"error":"operator_paused","resume_on":"2027-03-01"}}'),
    ).toEqual({ resumeOn: '2027-03-01' })
  })
  it('ignores other 409s and junk', () => {
    expect(parsePausedBody('{"detail":"slot taken"}')).toBeNull()
    expect(parsePausedBody('nope')).toBeNull()
  })
})

describe('PausedGate', () => {
  it('renders children until paused, then the back-in-season screen', () => {
    render(
      <PausedGate>
        <div>flow</div>
      </PausedGate>,
    )
    expect(screen.getByText('flow')).toBeTruthy()
    act(() => setPaused({ resumeOn: '2027-03-01' }))
    expect(screen.queryByText('flow')).toBeNull()
    expect(screen.getByTestId('paused-screen').textContent).toMatch(/2027/)
  })
  it('copes with a missing resume date', () => {
    render(
      <PausedGate>
        <div>flow</div>
      </PausedGate>,
    )
    act(() => setPaused({ resumeOn: null }))
    expect(screen.getByTestId('paused-screen')).toBeTruthy()
  })
})
