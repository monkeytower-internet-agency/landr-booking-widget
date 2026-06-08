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
      session: { active: true, token: null, powers: ['force_book'] },
      forced: true,
    })
    expect(out).toBe(body)
  })
})

describe('augmentStaffSubmit — staff path', () => {
  it('adds staff_session + channel when active (no force, no override)', () => {
    const out = augmentStaffSubmit(baseBody(), {
      session: activeSession,
      forced: false,
    }) as StaffSubmitBody
    expect(out.staff_session).toBe('staff.signed.token')
    expect(out.channel).toBe('staff')
    expect(out.ignore_capacity).toBeUndefined()
    expect(out.override_gross_total).toBeUndefined()
    // does not mutate the original body
    expect(baseBody()).not.toHaveProperty('staff_session')
  })

  it('sets ignore_capacity when the operator force-booked', () => {
    const out = augmentStaffSubmit(baseBody(), {
      session: activeSession,
      forced: true,
    }) as StaffSubmitBody
    expect(out.ignore_capacity).toBe(true)
  })

  it('threads the price override (amount + reason)', () => {
    const out = augmentStaffSubmit(baseBody(), {
      session: activeSession,
      forced: false,
      priceOverride: { grossTotal: 249.5, reason: 'loyalty discount' },
    }) as StaffSubmitBody
    expect(out.override_gross_total).toBe(249.5)
    expect(out.override_reason).toBe('loyalty discount')
  })

  it('preserves all original submit fields', () => {
    const out = augmentStaffSubmit(baseBody(), {
      session: activeSession,
      forced: true,
      priceOverride: { grossTotal: 10, reason: 'r' },
    }) as StaffSubmitBody
    expect(out.widget_token).toBe('w-123')
    expect(out.customer_email).toBe('ada@example.com')
    expect(out.products).toHaveLength(1)
  })
})
