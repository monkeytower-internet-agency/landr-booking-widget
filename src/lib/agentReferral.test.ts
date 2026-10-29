import { beforeEach, describe, expect, it } from 'vitest'
import {
  AGENT_ATTRIBUTION_WINDOW_MS,
  readStoredAgentToken,
  resolveAgentToken,
  writeStoredAgentToken,
} from './agentReferral'

const DAY = 24 * 60 * 60 * 1000

describe('agent referral storage', () => {
  beforeEach(() => window.localStorage.clear())

  it('returns the stored token for the same widget inside the window', () => {
    writeStoredAgentToken('w1', 'tok-a', 1_000)
    expect(readStoredAgentToken('w1', 1_000 + DAY)).toBe('tok-a')
  })

  it('expires after the attribution window', () => {
    writeStoredAgentToken('w1', 'tok-a', 1_000)
    expect(readStoredAgentToken('w1', 1_000 + AGENT_ATTRIBUTION_WINDOW_MS + 1)).toBeNull()
  })

  it('never crosses to another widget token', () => {
    writeStoredAgentToken('w1', 'tok-a', 1_000)
    expect(readStoredAgentToken('w2', 2_000)).toBeNull()
    expect(readStoredAgentToken(null, 2_000)).toBeNull()
  })

  it('ignores a corrupt blob', () => {
    window.localStorage.setItem('landr-widget-agent-ref.v1', '{nope')
    expect(readStoredAgentToken('w1')).toBeNull()
  })

  it('a fresh ?a= wins over the stored token (last click wins)', () => {
    writeStoredAgentToken('w1', 'old', 1_000)
    expect(resolveAgentToken('w1', 'new', 2_000)).toBe('new')
    expect(resolveAgentToken('w1', null, 2_000)).toBe('old')
  })
})
