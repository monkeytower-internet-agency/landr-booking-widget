/**
 * landr-aoak.2 [S3].6: THE single reconciliation point with the API contract.
 *
 * The api worker (landr-aoak.1) finalises the EXACT staff-submit wire shape in
 * its handoff. We build contract-first against the epic's [S2] claim
 * (staff_session token + ignore_capacity force flag + override_gross_total /
 * override_reason + channel:'staff'). When the real handoff lands, reconciling
 * field names / nesting touches ONLY this file — every staff branch in the
 * pickers, BookingForm and App routes through `augmentStaffSubmit` / the
 * StaffSubmitExtras carrier, so nothing else needs to change.
 *
 * THE INVARIANT: with no staff session, augmentStaffSubmit returns the body
 * UNCHANGED (referentially identical), so the normal customer submit is 100%
 * byte-identical to today.
 */
import type { SubmitBookingBody } from '@/api/types'
import type { StaffSession } from '@/lib/staffMode'

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
 * Submit-body shape that may carry staff-only fields. These are additive and
 * optional — the API only honors them behind a valid staff session
 * (landr-aoak.1 [S2]); a public widget_token submit that somehow carried them
 * is rejected/ignored server-side. Modeled as a superset of SubmitBookingBody
 * so the augmented body still satisfies the submit client's parameter type.
 */
export type StaffSubmitBody = SubmitBookingBody & {
  /** The server-signed staff session token (epic [S1]). */
  staff_session?: string
  /** Force past full / blocked days + fixed-date windows (epic [S2]). */
  ignore_capacity?: boolean
  /** Operator price-override at create (epic [S2]; matches the post-hoc shape). */
  override_gross_total?: number
  override_reason?: string
  /** Booking channel marker — 'staff' for an operator-on-behalf booking. */
  channel?: string
}

/**
 * Augment a normal submit body with the staff-only fields when (and only when)
 * a staff session is active. Returns the body UNCHANGED when inactive — this is
 * the guard that preserves the byte-identical normal path.
 *
 * RECONCILIATION NOTE: field names here are the contract-first guess from the
 * epic [S2]. When landr-aoak.1's handoff pins the real names, edit this
 * function only.
 */
export function augmentStaffSubmit(
  body: SubmitBookingBody,
  extras: StaffSubmitExtras | null | undefined,
): SubmitBookingBody {
  if (!extras || !extras.session.active || !extras.session.token) return body

  const staffBody: StaffSubmitBody = {
    ...body,
    staff_session: extras.session.token,
    channel: 'staff',
  }

  if (extras.forced) {
    staffBody.ignore_capacity = true
  }

  if (extras.priceOverride) {
    staffBody.override_gross_total = extras.priceOverride.grossTotal
    staffBody.override_reason = extras.priceOverride.reason
  }

  return staffBody
}
