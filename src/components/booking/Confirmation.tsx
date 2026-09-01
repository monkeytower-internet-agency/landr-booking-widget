import type { SubmitBookingResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  buildGoogleCalendarUrl,
  buildOutlookUrl,
} from '@/lib/calendarLinks'
import { useStaffMode } from '@/lib/staffMode'

interface Props {
  response: SubmitBookingResponse
  onRestart: () => void
}

/**
 * landr-y31z: derive the email status notice to render on the confirmation
 * screen, based on the confirmation_email_status field added by landr-2js5.
 *
 * 'sent' | 'captured' → success copy (email is on its way / captured in dev).
 * 'failed'            → amber alert: booking saved, email failed; contact operator.
 * 'pending' | absent  → neutral copy (awaiting operator action, or old API).
 */
type EmailStatusKind = 'success' | 'failed' | 'neutral'

function resolveEmailStatusKind(
  status: SubmitBookingResponse['confirmation_email_status'],
): EmailStatusKind {
  if (status === 'sent' || status === 'captured') return 'success'
  if (status === 'failed') return 'failed'
  return 'neutral'
}

/**
 * landr-5oox.6 (OD-7): whether the customer sees "confirmed" or
 * "awaiting confirmation" copy. `auto_approved` is the only outcome that
 * reads as confirmed — every manual outcome (`requires_general_approval`,
 * `requires_hotel_approval`, `staff_authorized`, anything else, or the
 * field being absent on an older API deploy) reads as awaiting confirmation.
 * This never surfaces the raw `approval_outcome`/`semantic_state` string to
 * the customer, and never mentions buses/seats/capacity/approval policy
 * (product-owner decision OD-7 — customers never see bus/seat logic).
 */
type ApprovalKind = 'auto' | 'manual'

function resolveApprovalKind(
  outcome: SubmitBookingResponse['approval_outcome'],
): ApprovalKind {
  return outcome === 'auto_approved' ? 'auto' : 'manual'
}

export function Confirmation({ response, onRestart }: Props) {
  /**
   * landr-acew: build Google Calendar and Outlook deep-link URLs from
   * the calendar_event block returned by the API alongside ical_url.
   * Both are present together when the booking carries at least one
   * dated product; when absent we fall back to the ICS-only path so
   * older API deploys keep working without change.
   */
  // landr-9ut4: only build deep-links when the API supplied a calendar_event
  // carrying BOTH ISO dates. Guarding on the dates here (rather than trusting
  // the payload shape) means a field-name skew or partial payload degrades to
  // the ICS-only path instead of throwing inside buildGoogleCalendarUrl during
  // render — a throw here unmounts the whole widget (no error boundary) and
  // blanks the confirmation screen, which is exactly the bug this guards.
  const calendarEvent =
    response.calendar_event?.start_date && response.calendar_event?.end_date
      ? response.calendar_event
      : null
  const googleUrl = calendarEvent ? buildGoogleCalendarUrl(calendarEvent) : null
  const outlookUrl = calendarEvent ? buildOutlookUrl(calendarEvent) : null

  // landr-y31z: email status
  const emailStatusKind = resolveEmailStatusKind(response.confirmation_email_status)

  // landr-5oox.6: confirmed vs awaiting-confirmation copy, driven by
  // approval_outcome rather than the raw semantic_state.
  const approvalKind = resolveApprovalKind(response.approval_outcome)

  // landr-aoak.2 [S3].4: operator-on-behalf framing. The customer-facing
  // "you will receive an email" copy makes no sense for a staff booking, so we
  // swap to operator-framed copy. Inactive ⇒ original customer copy verbatim.
  const staff = useStaffMode()

  return (
    <Card>
      <CardHeader>
        <CardTitle data-testid="confirmation-title">
          {staff.active
            ? 'Booking created'
            : approvalKind === 'auto'
              ? 'Booking confirmed'
              : 'Booking received'}
        </CardTitle>
        <CardDescription>
          Reference <span className="font-mono">{response.booking_id}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {emailStatusKind === 'failed' ? (
          /*
           * landr-y31z: amber notice when the confirmation email could not
           * be sent. Booking IS saved (reference is shown in the CardDescription
           * above). Ask the customer to contact the operator directly.
           * role="status" makes screen readers announce this without requiring
           * focus, matching the urgency of the message without being assertive.
           *
           * landr-5oox.27 (OD-7 follow-up of landr-5oox.6): this panel used to
           * say "your booking is confirmed" unconditionally, which was wrong
           * for a manual outcome — the booking is only requested, not
           * confirmed, until the operator approves it. Branch on the same
           * approvalKind used for the title/body above: auto_approved keeps
           * the "confirmed" copy, every manual outcome (or an absent
           * approval_outcome, e.g. an older API deploy) gets "we received
           * your booking request" instead. Recovery guidance (contact the
           * operator) is unchanged either way.
           */
          <div
            role="status"
            className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <p className="font-medium">
              {approvalKind === 'auto'
                ? 'Your booking is confirmed — but we could not send the confirmation email.'
                : 'We received your booking request, but we could not send the confirmation email.'}
            </p>
            <p className="mt-1">
              {/*
               * Operator name/contact: SubmitBookingResponse does not carry
               * operator fields in the current API contract (operator metadata
               * lives in OperatorSettings, fetched separately). A future API
               * iteration may surface operator_name here; for now we use the
               * safe generic fallback. See landr-y31z spec note.
               */}
              Please contact the operator directly to confirm your booking details.
            </p>
          </div>
        ) : staff.active ? (
          // landr-aoak.2 [S3].4: operator-framed copy — the operator booked on
          // behalf, so "you will receive an email" / "operator confirms" copy is
          // dropped. The reference + state are what the operator needs.
          <p className="text-sm">
            Booking created on behalf of the customer. It is currently{' '}
            <span className="font-medium">{response.semantic_state}</span>.
          </p>
        ) : approvalKind === 'auto' ? (
          // landr-5oox.6 (OD-7): auto-approved bookings are confirmed
          // outright — no "awaiting" language, no raw semantic_state.
          <p className="text-sm">
            Your booking is confirmed — the details are in your inbox.
            {response.payment_link_sent ? ' A payment link is on its way.' : null}
          </p>
        ) : (
          // landr-5oox.6 (OD-7): every manual outcome (general approval,
          // hotel approval, or an unrecognised/absent approval_outcome)
          // reads as "awaiting confirmation" — today's request copy,
          // tidied to drop the raw semantic_state + "confirms capacity"
          // line (customers never see bus/seat/approval-policy logic).
          <p className="text-sm">
            {emailStatusKind === 'success'
              ? 'A confirmation email has been sent with your booking details.'
              : 'You will receive a confirmation email shortly with the next steps.'}{' '}
            Your booking is awaiting confirmation from the operator.
          </p>
        )}
        {/*
          landr-3vr5 + landr-acew: "Add to calendar" group.

          When calendar_event is present (landr-acew API) we show all
          three options: Google · Outlook · Download .ics. When only
          ical_url is available (older API deploys, or bookings without
          dated products) we fall back to the single Download .ics
          anchor so the feature degrades gracefully.

          Each option is a plain anchor so the browser's native
          right-click / long-press save behaviour works everywhere.
          Google and Outlook open the provider's compose form in a new
          tab; the .ics link downloads the file.
         */}
        {response.ical_url ? (
          <div className="flex flex-wrap gap-2">
            {googleUrl ? (
              <Button asChild type="button" variant="outline">
                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Add to Google Calendar"
                >
                  Google Calendar
                </a>
              </Button>
            ) : null}
            {outlookUrl ? (
              <Button asChild type="button" variant="outline">
                <a
                  href={outlookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Add to Outlook Calendar"
                >
                  Outlook
                </a>
              </Button>
            ) : null}
            <Button asChild type="button" variant="outline">
              <a
                href={response.ical_url}
                download={`landr-booking-${response.booking_id}.ics`}
              >
                Download .ics
              </a>
            </Button>
          </div>
        ) : null}
        <div>
          <Button type="button" variant="outline" onClick={onRestart}>
            Make another booking
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
