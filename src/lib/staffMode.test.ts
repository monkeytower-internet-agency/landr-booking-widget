import { describe, expect, it } from 'vitest'
import {
  ALL_STAFF_POWERS,
  INACTIVE_STAFF_SESSION,
  isAllowedStaffOrigin,
  isStaffInitMessage,
  operatorIdFromStaffToken,
  parseStaffSession,
  resolveParentTargetOrigin,
  staffInitFromMessage,
  STAFF_ORIGIN_ALLOWLIST,
} from './staffMode'

/**
 * Build a fake staff session token in aoak.1's `<b64url(payload)>.<sig>` shape
 * carrying the given operator_id. Only the payload half matters for decoding;
 * the signature is opaque to the widget (the server verifies it).
 */
function fakeStaffToken(operatorId: string): string {
  const payload = JSON.stringify({
    channel: 'staff',
    operator_id: operatorId,
    powers: ['force_book', 'price_override', 'skip_customer_email'],
    user_id: 'staff-user-1',
  })
  const b64url = btoa(payload)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${b64url}.deadbeefsig`
}

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

  it('decodes the operator_id from a real-shaped token payload (URL entry path)', () => {
    const token = fakeStaffToken('op-uuid-from-url')
    const s = parseStaffSession(`?staff_session=${encodeURIComponent(token)}`)
    expect(s.active).toBe(true)
    expect(s.operatorId).toBe('op-uuid-from-url')
  })

  it('leaves operatorId null when the token payload is undecodable', () => {
    const s = parseStaffSession('?staff_session=not-a-real-token')
    expect(s.active).toBe(true)
    expect(s.operatorId).toBeNull()
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
  it('defaults to all powers + null operatorId when the parent omits them', () => {
    const s = staffInitFromMessage({ type: 'landr:staff-init', token: 't' })
    expect(s).toEqual({
      active: true,
      token: 't',
      powers: ALL_STAFF_POWERS,
      operatorId: null,
    })
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

  it('prefers the explicit operator_id from the message (aoak.4)', () => {
    const s = staffInitFromMessage({
      type: 'landr:staff-init',
      token: fakeStaffToken('op-in-token'),
      operator_id: 'op-explicit',
    })
    expect(s.operatorId).toBe('op-explicit')
  })

  it('falls back to decoding operator_id from the token when not sent explicitly', () => {
    const s = staffInitFromMessage({
      type: 'landr:staff-init',
      token: fakeStaffToken('op-in-token'),
    })
    expect(s.operatorId).toBe('op-in-token')
  })
})

describe('operatorIdFromStaffToken', () => {
  it('decodes operator_id from the signed payload half', () => {
    expect(operatorIdFromStaffToken(fakeStaffToken('op-9'))).toBe('op-9')
  })

  it('returns null for an empty / malformed / payload-less token', () => {
    expect(operatorIdFromStaffToken('')).toBeNull()
    expect(operatorIdFromStaffToken('not-base64.sig')).toBeNull()
    // valid base64url JSON but no operator_id field
    const noOp = btoa(JSON.stringify({ channel: 'staff' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(operatorIdFromStaffToken(`${noOp}.sig`)).toBeNull()
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
