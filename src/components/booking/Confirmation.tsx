import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Mail, MessageCircle, PartyPopper, Users } from 'lucide-react'
import { HttpError, sendBookingInvite } from '@/api/client'
import type {
  BookingSummary,
  BookingSummaryProduct,
  BookingSummaryRoom,
  GroupSummary,
  InviteSummary,
  JoinError,
  PostBookingContent,
  SubmitBookingResponse,
} from '@/api/types'
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
import { browserLocale, resolveCustomerStageLabel } from '@/lib/locale'
import { useStaffMode } from '@/lib/staffMode'
import { formatDayLabel } from './dateLabel'
import { PeriodsTable } from './PeriodsTable'
import { sanitizePostBookingHtml } from './postBookingSanitize'
import { PriceBreakdown } from './PriceBreakdown'
import { formatMoney, splitLineItems } from './priceSidebarHelpers'
import {
  bookedRefLabel,
  bookedTogetherMemberLabel,
  nextStepSendGroupLabel,
  nightsWord,
  participantCountLabel,
  pickBundle,
  plural,
  sendBookingLinkToLabel,
  tr,
} from '@/lib/strings'

interface Props {
  response: SubmitBookingResponse
  onRestart: () => void
  /**
   * landr-otml0.4: true when the booker chose the shared-double
   * accommodation mode (AccommodationStep) for THIS booking. Threaded
   * through the step machine (not derivable from the response) — see
   * appStepMachine.ts's 'confirmed' step doc.
   */
  isSharedDouble?: boolean
}

/**
 * landr-otml0.4: small "Copy" button shared by the reference card and every
 * invite card. Local component state (idle → copied, resetting after 2s)
 * rather than a toast — the widget carries no toast library (unlike the
 * dashboard's CopyLinkButton, which uses one).
 */
/**
 * landr-otml0.4 review fix (MAJOR 4): best-effort chain, never a silent
 * no-op. 1) the modern `navigator.clipboard` API; 2) the legacy
 * `document.execCommand('copy')` path via an offscreen textarea (covers
 * insecure contexts / older WebViews where `navigator.clipboard` is absent
 * but `execCommand` still works); 3) if BOTH fail, the caller falls back to
 * a visible, focused, readonly input so the customer can select-and-copy
 * by hand — the one thing that always works.
 */
function legacyExecCommandCopy(text: string): boolean {
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    // Offscreen but still focusable/selectable — execCommand('copy')
    // requires the node to have an actual selection, which display:none
    // or a detached node would prevent.
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, text.length)
    const ok = document.execCommand ? document.execCommand('copy') : false
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

function CopyButton({
  value,
  label,
  testId,
  size = 'sm',
}: {
  value: string
  label?: string
  testId?: string
  /** landr-8sk6l: 'default' matches the invite card's full-size buttons. */
  size?: 'sm' | 'default'
}) {
  const locale = browserLocale()
  const resolvedLabel = label ?? tr('copyLinkLabel', locale)
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle')
  const manualInputRef = useRef<HTMLInputElement>(null)

  // Focus + select once, when the manual fallback first appears — not on
  // every re-render (an inline ref callback would re-focus on each render).
  useEffect(() => {
    if (status === 'manual') manualInputRef.current?.select()
  }, [status])

  async function handleClick() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('navigator.clipboard unavailable')
      }
      await navigator.clipboard.writeText(value)
      setStatus('copied')
      window.setTimeout(() => setStatus('idle'), 2000)
      return
    } catch {
      // Fall through to the legacy path below.
    }
    if (legacyExecCommandCopy(value)) {
      setStatus('copied')
      window.setTimeout(() => setStatus('idle'), 2000)
    } else {
      // Both copy mechanisms failed — never a silent no-op. Reveal the
      // value in a readonly input the customer can select and copy by
      // hand; this state persists (no auto-reset) until they do.
      setStatus('manual')
    }
  }

  if (status === 'manual') {
    return (
      <div className="flex flex-col gap-1">
        <label
          htmlFor={testId ? `${testId}-manual-input` : undefined}
          className="text-xs text-muted-foreground"
        >
          {tr('couldNotCopyAutomatically', locale)}
        </label>
        <input
          id={testId ? `${testId}-manual-input` : undefined}
          ref={manualInputRef}
          type="text"
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          data-testid={testId ? `${testId}-manual` : 'copy-manual'}
          className="h-8 rounded-md border bg-background px-2 font-mono text-xs"
        />
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={handleClick}
      data-testid={testId}
    >
      {status === 'copied' ? (
        <>
          <Check className="mr-1.5 size-3.5" aria-hidden="true" />
          {tr('copiedLabel', locale)}
        </>
      ) : (
        <>
          <Copy className="mr-1.5 size-3.5" aria-hidden="true" />
          {resolvedLabel}
        </>
      )}
    </Button>
  )
}

/**
 * landr-otml0.4 (D5, D11): "Send <name> their booking link" per
 * `separate_guiding` companion. Channels follow what was captured at
 * DetailsStep (D11) — phone → WhatsApp, email → one-click Email send,
 * always → Copy link. No inline phone/email inputs on this screen (contact
 * is mandatory and already captured upstream).
 */
/**
 * landr-otml0.4 review fix (MAJOR 3): classify a failed invite-email send by
 * HTTP status so the customer gets an accurate next step instead of one
 * generic "try again" for every failure. Mirrors the send endpoint's own
 * documented failure modes (public_booking_groups.py): 404 = opaque miss
 * (bad/expired share_secret or booking — the endpoint returns the SAME 404
 * for an unknown booking, so this reads as "link no longer works" rather
 * than naming the secret), 422 = the endpoint's own email-shape validator
 * rejected the address, 429 = the per-booking/per-IP rate limit tripped.
 * Anything else (network failure, 5xx, a non-HttpError throw) is the
 * generic retry-able case.
 */
function classifyInviteSendError(err: unknown): {
  message: string
  canRetry: boolean
} {
  const locale = browserLocale()
  if (err instanceof HttpError) {
    if (err.status === 404) {
      return {
        message: tr('linkCannotBeEmailed', locale),
        canRetry: false,
      }
    }
    if (err.status === 422) {
      return { message: tr('emailAddressRejected', locale), canRetry: false }
    }
    if (err.status === 429) {
      return {
        message: tr('tooManyEmailsRetry', locale),
        canRetry: true,
      }
    }
  }
  return {
    message: tr('couldNotSendEmailGeneric', locale),
    canRetry: true,
  }
}

function InviteCard({
  invite,
  bookingId,
  shareSecret,
}: {
  invite: InviteSummary
  bookingId: string
  shareSecret?: string
}) {
  const [emailState, setEmailState] = useState<
    'idle' | 'sending' | 'sent' | 'failed'
  >('idle')
  const [emailError, setEmailError] = useState<{
    message: string
    canRetry: boolean
  } | null>(null)
  // No prior failure yet → the button reads "Email", not "Retry email", and
  // stays enabled (canRetry defaults true so a fresh card is never
  // pre-disabled by this flag).
  const canRetryEmail = emailError?.canRetry ?? true

  async function handleSendEmail() {
    if (!invite.email || !shareSecret) return
    setEmailState('sending')
    setEmailError(null)
    try {
      await sendBookingInvite(bookingId, invite.companion_id, shareSecret, invite.email)
      setEmailState('sent')
    } catch (err) {
      setEmailState('failed')
      setEmailError(classifyInviteSendError(err))
    }
  }

  const emailErrorMessage = emailError?.message ?? ''
  const locale = browserLocale()

  if (invite.linked_booking_reference) {
    // Already joined — no more actions to offer, just confirm it happened.
    return (
      <div
        data-testid="invite-card"
        className="flex items-center justify-between gap-2 rounded-lg border bg-surface-card p-3 text-sm"
      >
        <span>{invite.name}</span>
        <span
          data-testid="invite-linked"
          className="font-medium text-emerald-700 dark:text-emerald-400"
        >
          {bookedRefLabel(invite.linked_booking_reference, locale)}
        </span>
      </div>
    )
  }

  return (
    <div
      data-testid="invite-card"
      className="space-y-2 rounded-lg border bg-surface-card p-3"
    >
      <p className="text-sm font-semibold">{sendBookingLinkToLabel(invite.name, locale)}</p>
      <div className="flex flex-wrap gap-2">
        {invite.whatsapp_url ? (
          <Button asChild type="button">
            <a
              href={invite.whatsapp_url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="invite-whatsapp"
            >
              <MessageCircle className="mr-1.5 size-4" aria-hidden="true" />
              WhatsApp
            </a>
          </Button>
        ) : null}
        {invite.email ? (
          <Button
            type="button"
            onClick={handleSendEmail}
            disabled={
              !shareSecret ||
              emailState === 'sending' ||
              emailState === 'sent' ||
              !canRetryEmail
            }
            // landr-otml0.4 review fix (MAJOR 2): no share_secret → a
            // native title explains why, instead of a silent no-op. Same
            // native-title pattern the dashboard's CopyLinkButton uses for
            // dependency-free tooltips (no Tooltip provider in this tree).
            title={!shareSecret ? tr('emailUnavailableNotice', locale) : undefined}
            data-testid="invite-email"
          >
            <Mail className="mr-1.5 size-4" aria-hidden="true" />
            {emailState === 'sending'
              ? tr('sendingEllipsis', locale)
              : emailState === 'sent'
                ? tr('inviteEmailSentLabel', locale)
                : emailState === 'failed'
                  ? canRetryEmail
                    ? tr('retryEmailLabel', locale)
                    : tr('emailLabelShort', locale)
                  : tr('emailLabelShort', locale)}
          </Button>
        ) : null}
        <CopyButton value={invite.invite_url} testId="invite-copy" size="default" />
      </div>
      {!shareSecret ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid="invite-email-unavailable"
        >
          {tr('emailUnavailableNotice', locale)}
        </p>
      ) : null}
      {emailState === 'failed' ? (
        <p
          className="text-xs text-amber-700 dark:text-amber-400"
          role="status"
          data-testid="invite-email-error"
        >
          {emailErrorMessage}
        </p>
      ) : null}
    </div>
  )
}

/**
 * landr-otml0.4 (D9/D5): "Booked together with" — the other live members of
 * this booking's group, once it has >= 2 (GroupSummary is null otherwise —
 * see its doc). Self is excluded; the booker already knows they're on the
 * list.
 */
function GroupBlock({ group }: { group: GroupSummary }) {
  const others = group.members.filter((m) => !m.is_self)
  if (others.length === 0) return null
  const locale = browserLocale()
  return (
    <div
      data-testid="confirmation-group"
      className="space-y-2 rounded-lg border bg-surface-card p-4"
    >
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <Users className="size-4" aria-hidden="true" />
        {tr('groupBookedTogetherWith', locale)}
      </h3>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {others.map((member) => (
          <li key={member.reference}>
            {bookedTogetherMemberLabel(member.display_name, member.reference, member.is_host, locale)}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * landr-otml0.4 (D4): shown only when the booker chose shared-double and the
 * submit neither joined a group nor reported a join_error — i.e. they never
 * entered a reference at all. Links to the customer page's join form when
 * the API supplied one (landr-otml0.2, A2); omitted otherwise rather than
 * guessing a URL.
 */
function SharedDoubleHint({ customerPageUrl }: { customerPageUrl?: string | null }) {
  const locale = browserLocale()
  return (
    <p
      data-testid="confirmation-shared-double-hint"
      className="text-sm text-muted-foreground"
    >
      {tr('sharedDoubleHintQuestion', locale)}{' '}
      {customerPageUrl && isHttpUrl(customerPageUrl) ? (
        <a
          href={`${customerPageUrl}#join`}
          className="text-primary underline"
        >
          {tr('addReferenceLinkLabel', locale)}
        </a>
      ) : (
        `${tr('addReferenceLinkLabel', locale)}.`
      )}
    </p>
  )
}

function joinErrorMessage(error: JoinError['error'], locale?: string): string {
  if (error === 'unknown_reference') return tr('joinErrorUnknownReference', locale)
  if (error === 'same_booking') return tr('joinErrorSameBooking', locale)
  return tr('joinErrorJoinFailed', locale)
}

/**
 * landr-otml0.4: soft notice for a join_ref the server could not honour.
 * The booking itself always succeeds either way (see JoinError's doc) — this
 * is informational, not an error state for the page as a whole.
 */
function JoinErrorNotice({ joinError }: { joinError: JoinError }) {
  const locale = browserLocale()
  return (
    <div
      role="status"
      data-testid="confirmation-join-error"
      className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
    >
      {joinErrorMessage(joinError.error, locale)} {tr('joinErrorFollowup', locale)}
    </div>
  )
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

/**
 * landr-otml0.4 review fix (MAJOR 1): the 8-hex booking reference, derived
 * client-side EXACTLY as the API does
 * (`booking_id.replace("-", "")[:8].upper()` — see build_booking_summary /
 * public_lookup_booking_by_reference) when `summary` is absent. The raw
 * `booking_id` UUID must never be shown or fed to Copy/share on this
 * screen — it used to be a bearer credential in this API (cancel and the
 * .ics download accepted it alone until landr-5aih0.7 / landr-5aih0.4
 * moved both to signed tokens) and still identifies the booking, unlike the
 * reference, which is deliberately cheap/safe to hand to a stranger
 * (D2's masked-lookup design). This function is the one place that
 * boundary is enforced, so no caller can accidentally reach for
 * `response.booking_id` directly for display — the .ics download filename
 * below uses the reference too.
 */
function deriveBookingReference(bookingId: string): string {
  return bookingId.replace(/-/g, '').slice(0, 8).toUpperCase()
}

/** http(s)-only guard for the post-booking link (landr-nva1a.4) — the API
 * already only stores http(s) URLs, but this is the client-side backstop
 * before we ever emit an <a href> built from operator-authored input. */
function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Rich-text prose classes for the after-booking HTML block. Byte-identical
 * scale to ProductDetailStep's PROSE_CLASSES so operator copy reads the
 * same everywhere it appears — this block renders raw (sanitized) HTML
 * from the dashboard's tiptap editor rather than Markdown, so it's a
 * sibling constant, not a shared import (different source pipelines).
 */
const POST_BOOKING_PROSE_CLASSES =
  'text-sm text-foreground [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-medium [&_p]:mb-2 [&_p]:leading-relaxed last:[&_p]:mb-0 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_a]:text-primary [&_a]:underline'

/**
 * "Your booking" card (landr-nva1a.4, step 3) — what was booked, sourced
 * from `response.summary` (the same builder that feeds the confirmation
 * email, so this never drifts from what the customer's inbox says).
 */
function BookingDetailsCard({ summary }: { summary: BookingSummary }) {
  const locale = browserLocale()
  const hasParticipantNames = summary.participants.length > 0
  // landr-78i5e.8 review fix (MAJOR): `periods` is optional/best-effort —
  // an older API deploy, or any periods_for_booking lookup failure,
  // yields it absent/[]. The widget and API promote independently
  // (Cloudflare Pages vs Cloud Run), so deploy skew alone can trigger
  // this. Losing the hotel check-in/check-out date to that is not
  // acceptable degradation, so the stay-window line below is the
  // fallback, not deleted outright.
  const hasPeriods = Boolean(summary.periods && summary.periods.length > 0)
  // landr-5aih0.2: the meeting-point block (address + Google Maps/Waze deep
  // links), derived server-side once (app/services/meeting_point.py) and
  // carried on summary.meeting_point. The API always sends an object (the
  // all-"" block when the booking has no pickup location) rather than null,
  // but the type stays nullable for older-API rolling-deploy safety — either
  // way, an empty/unusable block (no address, no map links) falls back to
  // the plain pickup_location text above, unchanged.
  const meetingPoint = summary.meeting_point
  const meetingPointMapsUrl =
    meetingPoint?.google_maps_url && isHttpUrl(meetingPoint.google_maps_url)
      ? meetingPoint.google_maps_url
      : null
  const meetingPointWazeUrl =
    meetingPoint?.waze_url && isHttpUrl(meetingPoint.waze_url)
      ? meetingPoint.waze_url
      : null
  const meetingPointAddress = meetingPoint?.address || null
  const hasMeetingPointDetail = Boolean(
    meetingPointAddress || meetingPointMapsUrl || meetingPointWazeUrl,
  )
  return (
    <div
      data-testid="confirmation-summary"
      className="space-y-3 rounded-lg border bg-surface-card p-4"
    >
      <h3 className="text-sm font-semibold">{tr('yourBookingTitle', locale)}</h3>
      <div className="space-y-2 text-sm">
        {summary.products.map((product) => (
          <div key={product.product_id}>
            <span className="block">
              {product.label}
              {product.qty > 1 ? ` × ${product.qty}` : ''}
            </span>
          </div>
        ))}
        {/*
          landr-78i5e.8: the arrival/activity/departure schedule replaces
          the old per-product DayChips above, and the hotel stay-window
          line below (check_in/check_out now show as the arrival/departure
          rows) — same derivation as the confirmation email, never
          re-derived here. When absent/empty (older API deploy, or a
          periods_for_booking lookup failure), the stay-window line in the
          hotel block below is the fallback — see hasPeriods.
        */}
        {hasPeriods && summary.periods ? (
          <PeriodsTable periods={summary.periods} locale={locale} />
        ) : null}
        {summary.dates.label ? (
          <p
            className="text-muted-foreground"
            data-testid="confirmation-dates"
          >
            📅 {summary.dates.label}
          </p>
        ) : null}
        <p data-testid="confirmation-participants">
          {participantCountLabel(summary.participant_count, locale)}
          {hasParticipantNames
            ? ` — ${summary.participants.map((p) => p.name).join(', ')}`
            : ''}
        </p>
        {summary.pickup_location ? (
          <p data-testid="confirmation-pickup">
            {tr('pickupPrefix', locale)} {summary.pickup_location}
          </p>
        ) : null}
        {hasMeetingPointDetail ? (
          <div data-testid="confirmation-meeting-point" className="space-y-1.5">
            {meetingPointAddress ? (
              <p className="text-muted-foreground">{meetingPointAddress}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {meetingPointMapsUrl ? (
                <Button asChild type="button" variant="outline" size="sm">
                  <a
                    href={meetingPointMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={tr('meetingPointOpenInGoogleMapsAria', locale)}
                  >
                    Google Maps
                  </a>
                </Button>
              ) : null}
              {meetingPointWazeUrl ? (
                <Button asChild type="button" variant="outline" size="sm">
                  <a
                    href={meetingPointWazeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={tr('meetingPointOpenInWazeAria', locale)}
                  >
                    Waze
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        {summary.hotel ? (
          <div
            data-testid="confirmation-hotel"
            className="rounded-md border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/40"
          >
            {!hasPeriods && summary.hotel.stay_window ? (
              <p className="mb-1 text-xs text-muted-foreground">
                {formatDayLabel(summary.hotel.stay_window.check_in, locale)} →{' '}
                {formatDayLabel(summary.hotel.stay_window.check_out, locale)},{' '}
                {summary.hotel.stay_window.nights}{' '}
                {nightsWord(summary.hotel.stay_window.nights, locale)}
              </p>
            ) : null}
            <ul className="space-y-1">
              {(summary.hotel.rooms ?? []).map(
                (room: BookingSummaryRoom, idx: number) => (
                  <li key={`${room.label}-${idx}`}>
                    {room.label} × {room.qty}
                    {room.addons && room.addons.length > 0 ? (
                      <span className="text-muted-foreground">
                        {' '}
                        (
                        {room.addons
                          .map((addon) => `${addon.label} × ${addon.qty}`)
                          .join(', ')}
                        )
                      </span>
                    ) : null}
                  </li>
                ),
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Savings congrats card (landr-nva1a.4, step 4) — shown only when the API
 * returned a multi_day_savings block. Copy per the epic decision:
 * consecutive runs get "N days in a row"; non-consecutive total-days
 * tiers get "by booking N days" instead.
 */
function SavingsCongratsCard({
  days,
  amount,
  consecutive,
  currency,
}: {
  days: number
  amount: string
  consecutive: boolean
  currency: string
}) {
  const locale = browserLocale()
  const amountLabel = formatMoney(amount, currency, locale)
  const t = pickBundle(locale)
  const dayNoun = plural(days, t.daySingular, t.dayPlural)
  const template = consecutive ? t.savingsConsecutiveTemplate : t.savingsNonConsecutiveTemplate
  const message = template
    .replace('{days}', String(days))
    .replace('{dayWord}', dayNoun)
    .replace('{amount}', amountLabel)
  return (
    <div
      data-testid="confirmation-savings-congrats"
      className="celebrate-pop flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
    >
      <span aria-hidden="true" className="text-lg leading-none">
        🎉
      </span>
      <span>{message}</span>
    </div>
  )
}

/**
 * Price breakdown (landr-nva1a.4, step 5) — operator-paid line items →
 * the shared PriceBreakdown (Subtotal → savings rows → Amount due) →
 * hotel lines kept as a visually separate "pay at check-in" block, same
 * convention as PriceSidebar.
 */
function ConfirmationPriceBreakdown({ summary }: { summary: BookingSummary }) {
  const locale = browserLocale()
  const { operator, hotel } = splitLineItems(summary.line_items)
  return (
    <div
      data-testid="confirmation-price-breakdown"
      className="space-y-3 rounded-lg border bg-surface-card p-4"
    >
      <h3 className="text-sm font-semibold">{tr('priceBreakdownTitle', locale)}</h3>
      {operator.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {operator.map((li) => (
            <li
              key={`op-${li.product_id}`}
              className="flex items-baseline justify-between gap-2"
            >
              <span>{li.label}</span>
              <span className="tabular-nums">
                {formatMoney(li.line_total, summary.currency, locale)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <PriceBreakdown
        subtotalBeforeSavings={summary.subtotal_before_savings}
        savings={summary.savings}
        amountDue={summary.amount_due}
        currency={summary.currency}
        totalLabel={tr('amountDueLabel', locale)}
        totalClassName="border-t pt-2 text-base"
        testIdPrefix="confirmation"
      />
      {hotel.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          <ul className="space-y-1">
            {hotel.map((li) => (
              <li
                key={`hot-${li.product_id}`}
                className="flex items-baseline justify-between gap-2"
              >
                <span>{li.label}</span>
                <span className="tabular-nums">
                  {formatMoney(li.line_total, summary.currency, locale)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-baseline justify-between border-t border-amber-200 pt-2 font-medium dark:border-amber-900">
            <span>{tr('atHotelPayAtCheckin', locale)}</span>
            <span className="tabular-nums">
              {formatMoney(summary.hotel_total, summary.currency, locale)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * After-booking content (landr-nva1a.4, step 7 / landr-nva1a.2). Renders
 * once per product that carries content, skipping products with neither
 * `html` nor a valid link — an operator who cleared both fields produces
 * no visible card rather than an empty shell.
 *
 * landr-nva1a.4 review round: `PostBookingContent` carries no `label` of
 * its own (the real API shape is `{product_id, html, link}` — see the
 * type's doc comment) — the heading is looked up from `products` by
 * `product_id` and OMITTED (not a fallback string) when the id isn't
 * found there, or when the booking only has one product (a heading
 * naming the only thing on the page is noise).
 */
function PostBookingSection({
  items,
  products,
}: {
  items: PostBookingContent[]
  products: BookingSummaryProduct[]
}) {
  const showHeadings = products.length > 1
  return (
    <div data-testid="confirmation-post-booking" className="space-y-3">
      {items.map((item) => {
        const link = item.link && isHttpUrl(item.link.url) ? item.link : null
        const heading = showHeadings
          ? products.find((p) => p.product_id === item.product_id)?.label
          : null
        return (
          <div
            key={item.product_id}
            data-testid="confirmation-post-booking-item"
            className="rounded-lg border bg-surface-card p-4"
          >
            {heading ? (
              <h4 className="mb-2 text-sm font-semibold">{heading}</h4>
            ) : null}
            {item.html ? (
              <div
                className={POST_BOOKING_PROSE_CLASSES}
                data-testid="confirmation-post-booking-html"
                // landr-nva1a.4: defence in depth — the dashboard/API already
                // sanitize on save (landr-nva1a.2); sanitizePostBookingHtml
                // sanitizes again client-side, scoped to the tiptap output
                // set, before this ever reaches dangerouslySetInnerHTML.
                dangerouslySetInnerHTML={{ __html: sanitizePostBookingHtml(item.html) }}
              />
            ) : null}
            {link ? (
              <Button asChild type="button" variant="outline" className="mt-3">
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.label}
                </a>
              </Button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function Confirmation({ response, onRestart, isSharedDouble }: Props) {
  const locale = browserLocale()
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

  // landr-nva1a.4: `summary` is absent on an older API deploy — every
  // section below built from it (steps 3/4/5/7) is skipped wholesale in
  // that case, rendering exactly today's content (graceful degrade).
  const summary = response.summary ?? null
  const showCongrats =
    summary !== null && !staff.active && !summary.price_overridden &&
    summary.multi_day_savings !== null
  const postBookingItems = (summary?.post_booking ?? []).filter(
    (item) => Boolean(item.html) || (item.link && isHttpUrl(item.link.url)),
  )

  // landr-otml0.4 review fix (MAJOR 1): never fall back to the raw
  // booking_id UUID here — derive the reference client-side the same way
  // the API does when summary is absent (older deploy). See
  // deriveBookingReference's doc for why the UUID is unsafe to promote.
  const referenceValue =
    summary?.booking_reference ?? deriveBookingReference(response.booking_id)

  // landr-otml0.4 (D5): per-companion "send their booking link" cards, only
  // for separate_guiding companions the API minted an invite for.
  const invites = response.invites ?? []

  // landr-otml0.4 (D4): the shared-double "add reference later" hint shows
  // ONLY when the booker chose shared-double and neither joined a group nor
  // hit a join_error — i.e. they never entered a reference at all. Once
  // `group` or `join_error` is present, this booking already tried (and
  // either succeeded or has its own notice), so the hint would be redundant.
  const showSharedDoubleHint =
    Boolean(isSharedDouble) && !response.group && !response.join_error

  return (
    <Card>
      <CardHeader>
        {/*
          landr-nva1a.4: warm/playful celebratory accent (brand voice —
          Duolingo-flavoured). Purely decorative (aria-hidden, no text
          content of its own) so it never changes the title element's
          accessible name/text — e2e (booking-submit.spec.ts) and the
          landr-5oox.6 unit tests match the title by its exact copy.
          CSS-only pop-in (index.css `.celebrate-pop`), honours
          prefers-reduced-motion.
        */}
        <div
          aria-hidden="true"
          className="celebrate-pop mb-1 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <PartyPopper className="size-5" />
        </div>
        <CardTitle data-testid="confirmation-title">
          {staff.active
            ? tr('bookingCreated', locale)
            : approvalKind === 'auto'
              ? tr('bookingConfirmed', locale)
              : tr('bookingReceived', locale)}
        </CardTitle>
        {/*
          landr-nva1a.4 review round: `summary.booking_reference` (same
          value the confirmation email shows — build_booking_summary is
          the shared builder) is preferred over the raw `booking_id`
          UUID, falling back to it when summary is absent (older API
          deploy). "smaller" per spec — text-xs, down from CardDescription's
          default text-sm, since the reference is a secondary detail now
          that the header carries the celebratory weight.
        */}
        <CardDescription className="text-xs">{tr('referenceLabel', locale)}</CardDescription>
        {/*
          landr-otml0.4 (D5): reference prominence — large + monospace, with
          a copy button and the one-line invite hint. Previously this was a
          single small line inside CardDescription; the reference is now the
          thing customers are expected to hand to a fellow traveller, so it
          gets its own row.
        */}
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <span
            className="font-mono text-lg font-semibold"
            data-testid="confirmation-reference-value"
          >
            {referenceValue}
          </span>
          <CopyButton
            value={referenceValue}
            label={tr('copyLabel', locale)}
            testId="confirmation-reference-copy"
          />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr('shareReferenceHint', locale)}
        </p>
        {/*
          landr-821d6.7: the operator's own customer-facing wording for the
          booking's current stage (falls back to the staff label when the
          operator hasn't set one). Customer-facing only — staff.active
          already shows the raw semantic_state below, which is enough
          context for the operator. Optional: absent on an older API.
        */}
        {!staff.active && response.stage ? (
          <p
            className="mt-1 text-sm text-muted-foreground"
            data-testid="confirmation-stage-label"
          >
            {tr('statusLabel', locale)} {resolveCustomerStageLabel(response.stage, browserLocale())}
          </p>
        ) : null}
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
                ? tr('bookingConfirmedEmailFailed', locale)
                : tr('confirmationEmailFailed', locale)}
            </p>
            <p className="mt-1">
              {/*
               * Operator name/contact: SubmitBookingResponse does not carry
               * operator fields in the current API contract (operator metadata
               * lives in OperatorSettings, fetched separately). A future API
               * iteration may surface operator_name here; for now we use the
               * safe generic fallback. See landr-y31z spec note.
               */}
              {tr('contactOperatorToConfirm', locale)}
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
            {tr('bookingConfirmedInboxNote', locale)}
            {response.payment_link_sent ? ` ${tr('paymentLinkOnItsWay', locale)}` : null}
          </p>
        ) : (
          // landr-5oox.6 (OD-7): every manual outcome (general approval,
          // hotel approval, or an unrecognised/absent approval_outcome)
          // reads as "awaiting confirmation" — today's request copy,
          // tidied to drop the raw semantic_state + "confirms capacity"
          // line (customers never see bus/seat/approval-policy logic).
          <p className="text-sm">
            {emailStatusKind === 'success'
              ? tr('confirmationEmailSent', locale)
              : tr('confirmationEmailPending', locale)}{' '}
            {tr('awaitingOperatorConfirmation', locale)}
          </p>
        )}

        {/* landr-otml0.4 (D5, D11): one "send their booking link" card per
            separate_guiding companion the API minted an invite for.
            landr-8sk6l: the booking isn't complete for the group until each of
            them books, so this is the screen's call to action — lifted to
            sit straight under the status line, in a brand-tinted panel with
            solid buttons, instead of trailing the price breakdown. */}
        {invites.length > 0 ? (
          <section
            data-testid="confirmation-invites"
            aria-labelledby="confirmation-invites-heading"
            className="space-y-3 rounded-xl border-2 border-primary/40 bg-primary/5 p-4"
          >
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h3
                  id="confirmation-invites-heading"
                  className="text-base font-semibold"
                >
                  {nextStepSendGroupLabel(invites.length, locale)}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {tr('eachCompletesOwnBooking', locale)}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {invites.map((invite) => (
                <InviteCard
                  key={invite.companion_id}
                  invite={invite}
                  bookingId={response.booking_id}
                  shareSecret={response.share_secret}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* landr-nva1a.4 step 3: "Your booking" — graceful degrade when
            summary is absent (older API deploy). */}
        {summary ? <BookingDetailsCard summary={summary} /> : null}

        {/* landr-nva1a.4 step 4: savings congrats — skipped for staff
            bookings, a price override, or no multi-day saving at all. */}
        {showCongrats && summary?.multi_day_savings ? (
          <SavingsCongratsCard
            days={summary.multi_day_savings.days}
            amount={summary.multi_day_savings.amount}
            consecutive={summary.multi_day_savings.consecutive}
            currency={summary.currency}
          />
        ) : null}

        {/* landr-nva1a.4 step 5: price breakdown. */}
        {summary ? <ConfirmationPriceBreakdown summary={summary} /> : null}

        {/* landr-otml0.4 (D9): "Booked together with" — other live members
            of this booking's group, when it has any. */}
        {response.group ? <GroupBlock group={response.group} /> : null}

        {/* landr-otml0.4: soft notice for a join_ref the server could not
            honour — the booking itself still succeeded regardless. */}
        {response.join_error ? (
          <JoinErrorNotice joinError={response.join_error} />
        ) : null}

        {/* landr-otml0.4 (D4): shared-double "add a reference later" hint —
            only when the booker never entered/confirmed one at all. */}
        {showSharedDoubleHint ? (
          <SharedDoubleHint customerPageUrl={response.customer_page_url} />
        ) : null}

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

          landr-5aih0.4: ical_url is token-scoped
          (/api/public/bookings/{token}/calendar.ics); the suggested
          filename carries the booking reference, never the UUID (same
          name the API's Content-Disposition uses).
         */}
        {response.ical_url ? (
          <div className="flex flex-wrap gap-2">
            {googleUrl ? (
              <Button asChild type="button" variant="outline">
                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={tr('addToGoogleCalendarAria', locale)}
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
                  aria-label={tr('addToOutlookCalendarAria', locale)}
                >
                  Outlook
                </a>
              </Button>
            ) : null}
            <Button asChild type="button" variant="outline">
              <a
                href={response.ical_url}
                download={`landr-booking-${referenceValue}.ics`}
              >
                {tr('downloadIcsButton', locale)}
              </a>
            </Button>
          </div>
        ) : null}

        {/* landr-nva1a.4 step 7: per-product after-booking content
            (landr-nva1a.2). */}
        {postBookingItems.length > 0 ? (
          <PostBookingSection
            items={postBookingItems}
            products={summary?.products ?? []}
          />
        ) : null}

        {/* landr-nva1a.4 step 8: "Make another booking" demoted to a small
            link-style affordance at the very bottom — it used to be an
            outline button competing with the calendar/CTA group above it. */}
        <div>
          <Button type="button" variant="link" size="sm" onClick={onRestart}>
            {tr('makeAnotherBookingLink', locale)}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
