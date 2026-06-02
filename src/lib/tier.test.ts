/**
 * landr-7jgo: showDateModelDetail() env-gate.
 *
 * The per-product date-model chip is shown in dev + staging and hidden in
 * production / unset, reusing the VITE_DEPLOY_TIER gate. Verified by stubbing
 * the env var (Vite exposes it via import.meta.env; vi.stubEnv overrides it
 * at runtime for the test).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { showDateModelDetail } from './tier'

describe('showDateModelDetail (landr-7jgo)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns true for dev', () => {
    vi.stubEnv('VITE_DEPLOY_TIER', 'dev')
    expect(showDateModelDetail()).toBe(true)
  })

  it('returns true for staging', () => {
    vi.stubEnv('VITE_DEPLOY_TIER', 'staging')
    expect(showDateModelDetail()).toBe(true)
  })

  it('returns false for prod', () => {
    vi.stubEnv('VITE_DEPLOY_TIER', 'prod')
    expect(showDateModelDetail()).toBe(false)
  })

  it('returns false when unset / unrecognised', () => {
    vi.stubEnv('VITE_DEPLOY_TIER', '')
    expect(showDateModelDetail()).toBe(false)
  })
})
