import { describe, expect, it } from 'vitest'
import { explainFetchError, HttpError } from './client'

// landr-brge follow-up: the bare "Failed to fetch" gave operators nothing
// to act on (real confusion 2026-06-05 on bw.landr.de, root cause CORS).
describe('explainFetchError', () => {
  it('explains 404 as a bad/outdated widget link', () => {
    const msg = explainFetchError(new HttpError(404, 'Not Found', ''))
    expect(msg).toMatch(/did not recognise this booking link/)
    expect(msg).toMatch(/404/)
  })

  it('explains other HTTP errors with the status', () => {
    expect(explainFetchError(new HttpError(500, 'Internal Server Error', ''))).toMatch(/error \(500/)
  })

  it('explains native fetch TypeError as network or CORS', () => {
    const msg = explainFetchError(new TypeError('Failed to fetch'))
    expect(msg).toMatch(/Could not reach/)
    expect(msg).toMatch(/CORS/)
  })

  it('falls back to the message for unknown errors', () => {
    expect(explainFetchError(new Error('boom'))).toBe('boom')
  })
})
