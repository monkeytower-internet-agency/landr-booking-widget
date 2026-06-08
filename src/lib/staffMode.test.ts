import { describe, expect, it } from 'vitest'
import {
  ALL_STAFF_POWERS,
  INACTIVE_STAFF_SESSION,
  isAllowedStaffOrigin,
  isStaffInitMessage,
  parseStaffSession,
  resolveParentTargetOrigin,
  staffInitFromMessage,
  STAFF_ORIGIN_ALLOWLIST,
} from './staffMode'

describe('parseStaffSession', () => {
  it('returns the inactive session when no staff_session param is present', () => {
    expect(parseStaffSession('')).toEqual(INACTIVE_STAFF_SESSION)
    expect(parseStaffSession('?w=tok&product=p1')).toEqual(INACTIVE_STAFF_SESSION)
  })

  it('returns the inactive session for an empty staff_session value', () => {
    expect(parseStaffSession('?staff_session=')).toEqual(INACTIVE_STAFF_SESSION)
    expect(parseStaffSession('?staff_session=%20')).toEqual(INACTIVE_STAFF_SESSION)
  })

  it('activates with the token + all powers when staff_session is present', () => {
    const s = parseStaffSession('?staff_session=signed.token.abc')
    expect(s.active).toBe(true)
    expect(s.token).toBe('signed.token.abc')
    expect(s.powers).toEqual(ALL_STAFF_POWERS)
  })

  it('tolerates a leading-? or bare search string', () => {
    expect(parseStaffSession('staff_session=t').token).toBe('t')
    expect(parseStaffSession('?staff_session=t').token).toBe('t')
  })
})

describe('isStaffInitMessage', () => {
  it('accepts the pinned shape', () => {
    expect(
      isStaffInitMessage({ type: 'landr:staff-init', token: 'abc' }),
    ).toBe(true)
  })

  it('rejects wrong type / missing or empty token / non-objects', () => {
    expect(isStaffInitMessage({ type: 'other', token: 'abc' })).toBe(false)
    expect(isStaffInitMessage({ type: 'landr:staff-init', token: '' })).toBe(false)
    expect(isStaffInitMessage({ type: 'landr:staff-init' })).toBe(false)
    expect(isStaffInitMessage(null)).toBe(false)
    expect(isStaffInitMessage('landr:staff-init')).toBe(false)
  })
})

describe('staffInitFromMessage', () => {
  it('defaults to all powers when the parent omits them', () => {
    const s = staffInitFromMessage({ type: 'landr:staff-init', token: 't' })
    expect(s).toEqual({ active: true, token: 't', powers: ALL_STAFF_POWERS })
  })

  it('keeps only valid power codes when supplied', () => {
    const s = staffInitFromMessage({
      type: 'landr:staff-init',
      token: 't',
      // @ts-expect-error — deliberately includes a bogus code
      powers: ['force_book', 'nope', 'price_override'],
    })
    expect(s.powers).toEqual(['force_book', 'price_override'])
  })
})

describe('isAllowedStaffOrigin', () => {
  it('accepts allow-listed dashboard origins', () => {
    for (const origin of STAFF_ORIGIN_ALLOWLIST) {
      expect(isAllowedStaffOrigin(origin)).toBe(true)
    }
  })

  it('accepts localhost / 127.0.0.1 dev origins on any port', () => {
    expect(isAllowedStaffOrigin('http://localhost:5173')).toBe(true)
    expect(isAllowedStaffOrigin('http://127.0.0.1:8080')).toBe(true)
  })

  it('rejects an empty origin and arbitrary hostile origins', () => {
    expect(isAllowedStaffOrigin('')).toBe(false)
    expect(isAllowedStaffOrigin('https://evil.example.com')).toBe(false)
    expect(isAllowedStaffOrigin('null')).toBe(false)
  })
})

describe('resolveParentTargetOrigin', () => {
  it('never returns the broadcast wildcard', () => {
    expect(resolveParentTargetOrigin()).not.toBe('*')
  })

  it('falls back to a real allow-listed origin', () => {
    expect(STAFF_ORIGIN_ALLOWLIST).toContain(resolveParentTargetOrigin())
  })
})
