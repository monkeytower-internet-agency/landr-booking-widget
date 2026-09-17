import { PartyPopper } from 'lucide-react'
import type {
  BookingSummary,
  BookingSummaryProduct,
  BookingSummaryRoom,
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
import { DayChips } from './DayChips'
import { sanitizePostBookingHtml } from './postBookingSanitize'
import { PriceBreakdown } from './PriceBreakdown'
import { formatMoney, splitLineItems } from './priceSidebarHelpers'

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
  return (
    <div
      data-testid="confirmation-summary"
      className="space-y-3 rounded-lg border bg-surface-card p-4"
    >
      <h3 className="text-sm font-semibold">Your booking</h3>
      <div className="space-y-2 text-sm">
        {summary.products.map((product) => (
          <div key={product.product_id}>
            <span className="block">
              {product.label}
              {product.qty > 1 ? ` × ${product.qty}` : ''}
            </span>
            {product.selected_days && product.selected_days.length > 0 ? (
              <DayChips dates={product.selected_days} locale={locale} />
            ) : null}
          </div>
        ))}
        {summary.dates.label ? (
          <p
            className="text-muted-foreground"
            data-testid="confirmation-dates"
          >
            📅 {summary.dates.label}
          </p>
        ) : null}
        <p data-testid="confirmation-participants">
          {summary.participant_count}{' '}
          {summary.participant_count === 1 ? 'participant' : 'participants'}
          {hasParticipantNames
            ? ` — ${summary.participants.map((p) => p.name).join(', ')}`
            : ''}
        </p>
        {summary.pickup_location ? (
          <p data-testid="confirmation-pickup">
            Pickup: {summary.pickup_location}
          </p>
        ) : null}
        {summary.hotel ? (
          <div
            data-testid="confirmation-hotel"
            className="rounded-md border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/40"
          >
            {summary.hotel.stay_window ? (
              <p className="mb-1 text-xs text-muted-foreground">
                {formatDayLabel(summary.hotel.stay_window.check_in, locale)} →{' '}
                {formatDayLabel(summary.hotel.stay_window.check_out, locale)},{' '}
                {summary.hotel.stay_window.nights}{' '}
                {summary.hotel.stay_window.nights === 1 ? 'night' : 'nights'}
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
  const amountLabel = formatMoney(amount, currency)
  const dayNoun = days === 1 ? 'day' : 'days'
  const message = consecutive
    ? `${days} ${dayNoun} in a row — you saved ${amountLabel}!`
    : `You saved ${amountLabel} by booking ${days} ${dayNoun}!`
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
  const { operator, hotel } = splitLineItems(summary.line_items)
  return (
    <div
      data-testid="confirmation-price-breakdown"
      className="space-y-3 rounded-lg border bg-surface-card p-4"
    >
      <h3 className="text-sm font-semibold">Price breakdown</h3>
      {operator.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {operator.map((li) => (
            <li
              key={`op-${li.product_id}`}
              className="flex items-baseline justify-between gap-2"
            >
              <span>{li.label}</span>
              <span className="tabular-nums">
                {formatMoney(li.line_total, summary.currency)}
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
        totalLabel="Amount due"
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
                  {formatMoney(li.line_total, summary.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-baseline justify-between border-t border-amber-200 pt-2 font-medium dark:border-amber-900">
            <span>At hotel · pay at check-in</span>
            <span className="tabular-nums">
              {formatMoney(summary.hotel_total, summary.currency)}
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
            ? 'Booking created'
            : approvalKind === 'auto'
              ? 'Booking confirmed'
              : 'Booking received'}
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
        <CardDescription className="text-xs">
          Reference{' '}
          <span className="font-mono">
            {summary?.booking_reference ?? response.booking_id}
          </span>
        </CardDescription>
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
            Status: {resolveCustomerStageLabel(response.stage, browserLocale())}
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
            Make another booking
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
