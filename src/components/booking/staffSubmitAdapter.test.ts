import { describe, expect, it } from 'vitest'
import type { SubmitBookingBody } from '@/api/types'
import { INACTIVE_STAFF_SESSION, type StaffSession } from '@/lib/staffMode'
import {
  augmentStaffSubmit,
  type StaffSubmitBody,
} from './staffSubmitAdapter'

function baseBody(): SubmitBookingBody {
  return {
    widget_token: 'w-123',
    customer_first_name: 'Ada',
    customer_email: 'ada@example.com',
    cancellation_deadline: '2026-01-01T00:00:00.000Z',
    booking_channel: 'public_website',
    products: [{ product_id: 'p1', quantity: 1, selected_days: ['2026-02-01'] }],
    participants: [{ first_name: 'Ada', service_role_code: 'participant' }],
    is_shared_double: false,
  }
}

const activeSession: StaffSession = {
  active: true,
  token: 'staff.signed.token',
  powers: ['force_book', 'price_override', 'skip_customer_email'],
  operatorId: 'op-uuid-1',
}

describe('augmentStaffSubmit — byte-identical normal path', () => {
  it('returns the body UNCHANGED (referentially) when no extras are given', () => {
    const body = baseBody()
    expect(augmentStaffSubmit(body, null)).toBe(body)
    expect(augmentStaffSubmit(body, undefined)).toBe(body)
  })

  it('returns the body unchanged when the session is inactive', () => {
    const body = baseBody()
    const out = augmentStaffSubmit(body, {
      session: INACTIVE_STAFF_SESSION,
      forced: true,
      priceOverride: { grossTotal: 1, reason: 'x' },
    })
    expect(out).toBe(body)
    expect(out).not.toHaveProperty('staff_session')
    expect(out).not.toHaveProperty('ignore_capacity')
  })

  it('returns the body unchanged when active but the token is missing', () => {
    const body = baseBody()
    const out = augmentStaffSubmit(body, {
      session: { active: true, token: null, powers: ['force_book'], operatorId: 'op-uuid-1' },
      forced: true,
    })
    expect(out).toBe(body)
  })
})

describe('augmentStaffSubmit — staff path (landr-aoak.4 corrected contract)', () => {
  it('adds staff_session + forces booking_channel=agent_dashboard (no force, no override)', () => {
    const out = augmentStaffSubmit(baseBody(), {
      session: activeSession,
      forced: false,
    }) as StaffSubmitBody
    expect(out.staff_session).toBe('staff.signed.token')
    // aoak.1 forces booking_channel='agent_dashboard'; the old 'channel:staff'
    // field was ignored server-side and is gone.
    expect(out.booking_channel).toBe('agent_dashboard')
    expect(out).not.toHaveProperty('channel')
    expect(out.ignore_capacity).toBeUndefined()
    expect(out.override_gross_total).toBeUndefined()
    // does not mutate the original body
    expect(baseBody()).not.toHaveProperty('staff_session')
  })

  it('DROPS widget_token + preview_token (the staff endpoint has no such fields)', () => {
    const body = { ...baseBody(), preview_token: 'preview-xyz' }
    const out = augmentStaffSubmit(body, {
      session: activeSession,
      forced: false,
    }) as StaffSubmitBody
    expect(out).not.toHaveProperty('widget_token')
    expect(out).not.toHaveProperty('preview_token')
  })

  it('sets ignore_capacity when the operator force-booked', () => {
    const out = augmentStaffSubmit(baseBody(), {
      session: activeSession,
      forced: true,
    }) as StaffSubmitBody
    expect(out.ignore_capacity).toBe(true)
  })

  it('threads the price override as a 2-decimal STRING (amount + reason)', () => {
    const out = augmentStaffSubmit(baseBody(), {
      session: activeSession,
      forced: false,
      priceOverride: { grossTotal: 249.5, reason: 'loyalty discount' },
    }) as StaffSubmitBody
    // aoak.1 expects override_gross_total as a string decimal '249.50'.
    expect(out.override_gross_total).toBe('249.50')
    expect(out.override_reason).toBe('loyalty discount')
  })

  it('preserves the customer + products fields (minus widget_token)', () => {
    const out = augmentStaffSubmit(baseBody(), {
      session: activeSession,
      forced: true,
      priceOverride: { grossTotal: 10, reason: 'r' },
    }) as StaffSubmitBody
    expect(out).not.toHaveProperty('widget_token')
    expect(out.customer_email).toBe('ada@example.com')
    expect(out.products).toHaveLength(1)
  })
})
