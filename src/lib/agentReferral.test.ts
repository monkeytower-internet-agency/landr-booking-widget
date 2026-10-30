import { beforeEach, describe, expect, it } from 'vitest'
import {
  AGENT_ATTRIBUTION_WINDOW_MS,
  readStoredAgentToken,
  sanitizeAgentToken,
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

  it('drops a malformed ?a= before storing or sending it', () => {
    expect(sanitizeAgentToken('x'.repeat(65))).toBeNull()
    expect(sanitizeAgentToken('has space')).toBeNull()
    expect(sanitizeAgentToken('<script>')).toBeNull()
    expect(sanitizeAgentToken('  ')).toBeNull()
    expect(sanitizeAgentToken(' good_Token-1 ')).toBe('good_Token-1')
    writeStoredAgentToken('w1', 'bad token', 1_000)
    expect(window.localStorage.getItem('landr-widget-agent-ref.v1')).toBeNull()
    // a bad ?a= falls back to a good stored token
    writeStoredAgentToken('w1', 'good', 1_000)
    expect(resolveAgentToken('w1', 'x'.repeat(100), 2_000)).toBe('good')
  })

  it('clears a bad value stored by an earlier build', () => {
    window.localStorage.setItem(
      'landr-widget-agent-ref.v1',
      JSON.stringify({ w: 'w1', a: 'x'.repeat(100), at: 1_000 }),
    )
    expect(readStoredAgentToken('w1', 2_000)).toBeNull()
    expect(window.localStorage.getItem('landr-widget-agent-ref.v1')).toBeNull()
  })
})
