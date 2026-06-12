/**
 * landr-aoak.2 [S3].6 → RECONCILED in landr-aoak.4: THE single reconciliation
 * point with the API contract.
 *
 * Verified against the MERGED api worker (landr-aoak.1)
 * `app/routers/staff_bookings_submit.py` StaffSubmitBookingIn model. The staff
 * submit is a SEPARATE operator-scoped endpoint
 * (POST /api/staff/operators/{operator_id}/bookings/submit) — NOT an extension
 * of /api/public/bookings — so this adapter shapes the body for that endpoint:
 *   - drops widget_token + preview_token (the signed staff_session is the
 *     credential; the staff route has no such fields),
 *   - carries staff_session + ignore_capacity (force_book) + force_book_reason,
 *   - sends override_gross_total as a STRING decimal (e.g. "199.95") +
 *     override_reason,
 *   - forces booking_channel='agent_dashboard' (the old channel:'staff' guess
 *     was ignored server-side and is removed).
 * The CALLER (BookingForm) routes a staff-shaped body to submitStaffBooking()
 * and a normal body to submitBooking(); reconciling wire field names touches
 * ONLY this file + the StaffSubmitBody type (src/api/types.ts).
 *
 * THE INVARIANT: with no staff session, augmentStaffSubmit returns the body
 * UNCHANGED (referentially identical), so the normal customer submit is 100%
 * byte-identical to today.
 */
import type { StaffSubmitBody, SubmitBookingBody } from '@/api/types'
import type { StaffSession } from '@/lib/staffMode'

export type { StaffSubmitBody }

/**
 * Operator price-override captured on the review step in staff mode.
 * `grossTotal` is the new gross total the operator dictates; `reason` is the
 * mandatory audit reason. Mirrors the existing post-hoc override
 * (staff_bookings_price_override.py: override_gross_total + reason).
 */
export interface PriceOverride {
  grossTotal: number
  reason: string
}

/**
 * Everything the staff path adds on top of a normal SubmitBookingBody. Collected
 * by the UI and handed to augmentStaffSubmit. Kept as one flat carrier so the
 * call-sites stay trivial and reconciliation is local to this module.
 */
export interface StaffSubmitExtras {
  session: StaffSession
  /**
   * True when the operator force-booked at least one blocked / full day or a
   * full fixed-date window. Drives the booking-level `ignore_capacity` flag.
   * DEFAULT MODEL (epic [S2], and ticket instruction when the per-line shape is
   * unknown): a single booking-level force flag. If the api handoff turns out
   * to want per-line force flags instead, that change lives HERE.
   */
  forced: boolean
  /** Optional operator price-override from the review step. */
  priceOverride?: PriceOverride | null
}

/**
 * The StaffSubmitBody wire shape lives in src/api/types.ts (next to
 * SubmitBookingBody) and is re-exported above so existing importers keep
 * working. It is a SEPARATE shape — NOT a superset of SubmitBookingBody — that
 * drops widget_token + preview_token (the staff route uses the signed
 * staff_session as the credential) and adds the operator-only power fields.
 */

/**
 * Format a numeric gross total as the 2-decimal STRING the staff endpoint's
 * Decimal field expects (aoak.1 handoff: override_gross_total: "42.00"). The
 * server re-derives pricing; this value only stamps the effective gross.
 */
function formatOverrideTotal(grossTotal: number): string {
  return grossTotal.toFixed(2)
}

/**
 * Shape a normal submit body into the STAFF submit body when (and only when) a
 * staff session is active. Returns the body UNCHANGED (referentially identical)
 * when inactive — the guard that preserves the byte-identical normal customer
 * path. When active it strips widget_token + preview_token (the staff endpoint
 * rejects/ignores them) and adds the staff_session + power fields.
 *
 * The CALLER decides WHERE to POST this: an active session ⇒ the staff endpoint
 * (see submitStaffBooking in src/api/client.ts), an inactive one ⇒ the public
 * endpoint, exactly as today. This function only shapes the body.
 */
export function augmentStaffSubmit(
  body: SubmitBookingBody,
  extras: StaffSubmitExtras | null | undefined,
): SubmitBookingBody | StaffSubmitBody {
  if (!extras || !extras.session.active || !extras.session.token) return body

  // Start from a copy of the public body, then strip the public-only
  // credentials — the staff endpoint has no widget_token / preview_token field.
  const shaped: Partial<SubmitBookingBody> = { ...body }
  delete shaped.widget_token
  delete shaped.preview_token

  const staffBody: StaffSubmitBody = {
    ...(shaped as Omit<SubmitBookingBody, 'widget_token' | 'preview_token'>),
    staff_session: extras.session.token,
    booking_channel: 'agent_dashboard',
  }

  if (extras.forced) {
    staffBody.ignore_capacity = true
  }

  if (extras.priceOverride) {
    staffBody.override_gross_total = formatOverrideTotal(
      extras.priceOverride.grossTotal,
    )
    staffBody.override_reason = extras.priceOverride.reason
  }

  return staffBody
}

/**
 * Type-guard distinguishing the staff body (carries `staff_session`) from a
 * plain public body. Used by the submit client to pick the endpoint.
 */
export function isStaffSubmitBody(
  body: SubmitBookingBody | StaffSubmitBody,
): body is StaffSubmitBody {
  return (
    typeof (body as StaffSubmitBody).staff_session === 'string' &&
    (body as StaffSubmitBody).staff_session.length > 0
  )
}
