import { useEffect, useRef, useState } from 'react'
import type { AnimationEvent } from 'react'
import { Copy } from 'lucide-react'
import type { BookingSelection } from '@/components/booking/BookingForm'
import type { Product, ServiceRole } from '@/api/types'
import { requestSubscriptionPerkOtp } from '@/api/client'
import { browserLocale } from '@/lib/locale'
import { formatDayLabel } from '@/components/booking/dateLabel'
import { CustomerCommentField } from '@/components/booking/CustomerCommentField'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StepBackButton } from '@/components/booking/StepBackButton'
import {
  bookerToParticipant,
  detailsAreComplete,
  emptyBooker,
  emptyCompanion,
  emptyParticipant,
  isValidPhoneFormat,
  PHONE_HTML_PATTERN,
  type BookerDetails,
  type CompanionDetails,
  type ParticipantDetails,
} from './detailsTypes'
// landr-uwvl: stable per-member identity for the room-assignment maps.
import { withMemberId } from './partyIdentity'
import { GroupInquiryForm } from './GroupInquiryForm'
import { NextAction } from './NextAction'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const MAX_ADDITIONAL = 5 // total cap = 6 participants (matches the legacy form)
// landr-87n9.3: generous cap on non-guiding companions. Total headcount
// (participants + companions) can exceed 6 — companions are uncapped by the
// guiding rule. 12 is a pragmatic upper bound that comfortably covers
// "6 pilots + 6 partners" without an unbounded input.
const MAX_COMPANIONS = 12
// landr-de6ej: mirrors the API's `bookings_customer_comment_length_chk`
// CHECK constraint (and PublicSubmitBookingIn's max_length) — kept in sync
// by hand since the widget has no shared contract constant for this.
interface Props {
  product: Product
  selection: BookingSelection
  /**
   * Operator's active service_roles (landr-mg0a). Fetched once at App
   * mount via getOperatorServiceRoles and threaded down. When the list
   * has >1 entry DetailsStep renders a per-participant dropdown so
   * customers can pick (e.g. 'pilot' vs 'passenger' for tandem flights).
   * With exactly one row the dropdown is hidden and the single code is
   * pre-assigned to every participant.
   *
   * Optional / empty while the fetch is in flight (or in legacy test
   * call-sites). In that case the dropdown is suppressed and
   * BookingForm falls back to the legacy hardcoded 'participant' code
   * at submit time.
   */
  serviceRoles?: ServiceRole[]
  /**
   * landr-4uyu: operator contact email surfaced at the participant max
   * (MAX_ADDITIONAL added). When non-empty the Details step renders a
   * "Need a larger group or a custom booking?" line with a mailto:
   * link to this address. Null / undefined → the copy still shows but the
   * (broken) mailto is omitted. Optional so existing tests need no change.
   */
  contactEmail?: string | null
  /**
   * landr-y1t4: does this operator have any ACTIVE subscription perk? When
   * false the member-perk code field never renders and no OTP is ever
   * requested — for an operator with no membership programme that field is a
   * control which can do nothing, while its copy ("apply your member price")
   * promises a rate the operator does not offer. Martin (Para42) asked what
   * the code was; nobody could have used it.
   *
   * Defaults FALSE so every existing call-site (and every test that predates
   * this prop) keeps the field hidden unless it opts in. UI-ONLY: the server
   * still verifies any member_perk_otp that reaches it, so a hand-crafted
   * payload gains exactly nothing from this gate.
   */
  hasMemberPerks?: boolean
  /**
   * landr-ehye: opaque widget token used to POST the group-inquiry form.
   * When absent (e.g. existing test call-sites) the form still renders but
   * submitGroupInquiry will throw (no API base), which falls back to the
   * mailto: link — safe degrade.
   */
  operatorToken?: string
  /** Re-entry data when the customer hits Back from a downstream step. */
  initialBooker?: BookerDetails
  initialParticipants?: ParticipantDetails[]
  /**
   * landr-87n9.3: re-entry data for the non-guiding companions section
   * when the customer hits Back from a downstream step.
   */
  initialCompanions?: CompanionDetails[]
  /**
   * landr-fn4i / landr-5krc: prior value of the optional member-perk code,
   * carried by App.tsx's top-level state (NOT the Step union — see
   * BookingForm's memberPerkOtp doc) so a Back-then-forward re-entry shows
   * the code the customer already typed instead of a blank field that would
   * silently contradict what's actually still armed for submit.
   */
  initialMemberPerkOtp?: string
  /**
   * landr-de6ej: prior value of the optional "Anything we should know?"
   * comment, carried by App.tsx's persistent bookingDraft (unlike
   * memberPerkOtp — this field DOES round-trip through sessionStorage, so
   * a reload restores it too) so a Back-then-forward re-entry shows what
   * the customer already typed instead of a blank field.
   */
  initialCustomerComment?: string | null
  /**
   * landr-otml0.3 review fix (MINOR 6): companion index (0-based, into
   * companions[] — matches the API's 422 `companion_index`) to highlight on
   * mount. Set by App.tsx after BookingForm's submit was rejected with
   * `companion_contact_required` and the customer was navigated back here.
   * Marks that companion's shared contact-required error as already
   * touched (visible without needing to blur the field first) and focuses
   * their email input. undefined on every normal entry.
   */
  initialFocusCompanionContactIndex?: number
  /**
   * Fires once the mount-time focus/touched marking above has been
   * applied, so the caller (App.tsx) can clear its one-shot state and this
   * doesn't re-apply on an unrelated later remount.
   */
  onCompanionContactFocusApplied?: () => void
  onBack: () => void
  onConfirm: (
    booker: BookerDetails,
    participants: ParticipantDetails[],
    // landr-87n9.3: non-guiding companions captured in the "Others joining"
    // section. Empty array when nobody extra joins.
    companions: CompanionDetails[],
    // landr-de6ej: trimmed comment text, '' when the customer left it blank.
    // App.tsx's afterDetails folds '' to null before it lands in the draft.
    comment: string,
  ) => void
  /**
   * landr-gb2f.1: live participant count + names for the PriceSidebar.
   * Fires on every booker-field change or additional-count change so the
   * sidebar updates without waiting for Continue. count = 1 + additional.length;
   * names = booker first name (trimmed) + additional first names (trimmed,
   * non-empty). Called from event handlers — NOT from effects — to satisfy
   * the react-hooks/set-state-in-effect constraint (App.tsx uses the value
   * to set its own state). Optional so existing tests need no changes.
   *
   * landr-87n9.3: a third arg carries the live companion count so App.tsx
   * can thread it to AccommodationStep (whole-party assignment) while the
   * customer is still on DetailsStep. The guiding price uses only `count`
   * (participants) — companions never change participants_count.
   */
  onLiveParticipantsChange?: (
    count: number,
    names: string[],
    companionCount: number,
  ) => void
  /**
   * landr-fn4i / landr-5krc: fires on every keystroke in the optional
   * member-perk code field, lifting the live value straight into App.tsx's
   * top-level state (mirrors onLiveParticipantsChange's "fire from the event
   * handler, not an effect" pattern). By the time the customer reaches
   * BookingForm's Confirm button — several steps later — the lifted value is
   * already current; there's no separate "commit on Continue" step for this
   * field.
   */
  onMemberPerkOtpChange?: (code: string) => void
}

/**
 * DetailsStep (landr-8c03) — collects FULL participant details right
 * after dates, not just count. Replaces the previous count-only
 * ParticipantsStep (landr-mbge). The booker fills in their own
 * first/last/email/phone (all required) and 0-5 additional participants
 * with first/last (required) + email/phone (optional). The booker is
 * automatically mirrored into participants[0] so the data only gets
 * typed once.
 *
 * Why move details up here: downstream steps (AccommodationStep,
 * PriceSidebar) now have full party context — they can show names next
 * to room assignments / line items instead of just a count. The final
 * BookingForm becomes a review-only confirmation screen
 * (no inputs).
 *
 * Generic copy per landr-genericity-northstar — "participants" not
 * "pilots"/"divers".
 */
/**
 * Short selection summary for the card description. After landr-2wyi the
 * persistent PriceSidebar carries the full day-by-day breakdown (chips
 * for each picked date + explicit hotel span), so we no longer repeat
 * the date list here — that duplication was actively misleading for
 * multi-day flows, where a "Mon 25 May → Wed 27 May (2 days)" header
 * conflated a non-contiguous selection (25 + 27 skipping 26) with a
 * contiguous range.
 *
 * Slot bookings still surface date + time inline because the sidebar's
 * chip layout only covers multi-day selections and slot bookings carry
 * a specific clock-time the customer needs to see in the step header.
 * Single multi-day picks also stay so the header doesn't go blank for
 * the most common one-day case.
 */
function describeSelection(
  selection: BookingSelection,
  locale: string,
): string {
  if (selection.kind === 'slot') {
    const { date, start_time } = selection.slot
    const label = formatDayLabel(date, locale)
    return start_time ? `${label} · ${start_time.slice(0, 5)}` : label
  }
  const days = selection.selectedDays
  if (days.length === 0) return ''
  if (days.length === 1) return formatDayLabel(days[0]!, locale)
  // Multi-day: defer to the sidebar's DayChips (landr-2wyi).
  return `${days.length} days selected`
}

export function DetailsStep({
  product,
  selection,
  serviceRoles = [],
  contactEmail,
  hasMemberPerks = false,
  operatorToken = '',
  initialBooker,
  initialParticipants,
  initialCompanions,
  initialMemberPerkOtp,
  initialCustomerComment,
  initialFocusCompanionContactIndex,
  onCompanionContactFocusApplied,
  onBack,
  onConfirm,
  onLiveParticipantsChange,
  onMemberPerkOtpChange,
}: Props) {
  const locale = browserLocale()
  // landr-mg0a: defaultRoleCode is the first row served by
  // public_get_operator_service_roles (ordered by sort_order). When
  // serviceRoles is still empty (fetch in flight) defaults are ''; the
  // showRoleDropdown gate below also evaluates to false so the UI just
  // omits the dropdown rather than render a broken empty <select>.
  const defaultRoleCode = serviceRoles[0]?.code ?? ''
  const showRoleDropdown = serviceRoles.length > 1
  const [booker, setBooker] = useState<BookerDetails>(
    () => initialBooker ?? emptyBooker(),
  )
  // The booker becomes participants[0] on submit (via bookerToParticipant)
  // — but we need an independent state slot for THEIR role code since the
  // booker type itself carries no role. Seeded from initialParticipants[0]
  // when restoring after Back, else the operator's default.
  const [bookerRoleCode, setBookerRoleCode] = useState<string>(
    () =>
      initialParticipants?.[0]?.service_role_code ?? defaultRoleCode,
  )
  // Additional participants only (booker is participants[0], synced
  // automatically). When the customer comes back to this step we
  // restore the additional slots from initialParticipants[1..].
  const [additional, setAdditional] = useState<ParticipantDetails[]>(() => {
    if (initialParticipants && initialParticipants.length > 1) {
      // landr-uwvl: every row this step emits must carry a stable id — it is
      // what the draft's room-assignment / age / breakfast maps are keyed by.
      // Rows restored from the draft already have one; this backfills the only
      // remaining source of id-less rows (a caller that hand-built the array),
      // and does it ONCE in the state initialiser so a re-render can never
      // re-mint and detach someone from their room.
      return initialParticipants.slice(1).map(withMemberId)
    }
    return []
  })
  // landr-87n9.3: non-guiding companions ("Others joining the activity").
  // Restored from initialCompanions on Back-restore, else empty.
  const [companions, setCompanions] = useState<CompanionDetails[]>(() =>
    (initialCompanions ?? []).map(withMemberId),
  )

  // landr-fn4i / landr-5krc: optional member-perk code. Seeded from
  // initialMemberPerkOtp on Back-restore (mirrors the booker/companions
  // pattern above) so the field never shows blank while App.tsx's lifted
  // copy still holds a previously-typed value.
  const [memberPerkOtp, setMemberPerkOtpState] = useState<string>(
    () => initialMemberPerkOtp ?? '',
  )
  // landr-de6ej: optional free-text comment, seeded from initialCustomerComment
  // on Back-restore / reload — same seeding pattern as memberPerkOtp above,
  // but this one round-trips through bookingDraft + sessionStorage.
  const [comment, setComment] = useState<string>(
    () => initialCustomerComment ?? '',
  )
  // The OTP-request endpoint is fired on email BLUR, not on every keystroke
  // (matches the backend contract + keeps us well under its per-token/per-
  // email rate limits). otpRequested drives whether the always-on optional
  // code field is shown at all — seeded true when re-entering with an
  // already-valid-looking email (Back-restore), since a request for that
  // email would already have fired on the forward pass.
  //
  // landr-y1t4: this seed is deliberately NOT gated on hasMemberPerks. It
  // tracks one thing only — "has a request fired for this email" — and the
  // render below ANDs it with hasMemberPerks, so the operator gate has exactly
  // one home. Duplicating the condition here would let the two drift.
  const [otpRequested, setOtpRequested] = useState<boolean>(() =>
    Boolean(initialBooker?.email?.trim() && initialBooker.email.includes('@')),
  )
  // Dedupes repeated blurs of an UNCHANGED email against re-firing the
  // network call (a customer tabbing back and forth across the form blurs
  // the same field many times). Seeded from initialBooker so a Back-restore
  // remount doesn't re-request for an email that already got one on the way
  // forward — only an actual EDIT to the email (a genuine new blur target)
  // fires a fresh request.
  //
  // landr-31fq: ONLY seed the dedup ref (treat "already requested" as true)
  // when initialMemberPerkOtp is ALSO populated. A same-render Back-restore
  // and a real sessionStorage reload-restore produce an identical
  // initialBooker.email, but memberPerkOtp (App.tsx's bare in-memory
  // useState — deliberately NOT part of the persisted bookingDraft/Step
  // union, see its own doc) survives the former and never the latter. So
  // "email restored but no code restored" is the reload signal: the
  // request state was NOT actually carried over, and without this reset
  // the dedup ref would permanently block any further request for that
  // email in this render tree — even a customer who reloaded mid-flow and
  // waited out the server's 5-min TTL could never get a fresh code. Leaving
  // the ref unseeded here does not touch otpRequested (the field still
  // shows immediately on restore, unchanged) — it only lets the NEXT blur
  // of that email actually fire instead of silently no-op'ing.
  const otpSentForEmailRef = useRef<string | null>(
    initialBooker?.email?.trim() && initialMemberPerkOtp?.trim()
      ? initialBooker.email.trim()
      : null,
  )

  // If the service-roles fetch resolves AFTER DetailsStep first mounted,
  // backfill empty role codes with the new default on the first render
  // where defaultRoleCode becomes non-empty. Already-picked roles (from a
  // Back-restore) are left untouched because we only fill empty strings.
  //
  // This uses the React-recommended "store previous prop" pattern
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes):
  // store the last-seen defaultRoleCode in state; when it changes from ''
  // to a real value, apply the backfill during the same render pass so
  // there is no stale-paint window or eslint-disable needed. The state
  // setter guard (prev || defaultRoleCode / only-empty-codes check) ensures
  // user-picked or Back-restored codes are never clobbered.
  const [prevDefaultRoleCode, setPrevDefaultRoleCode] = useState(defaultRoleCode)
  if (defaultRoleCode !== prevDefaultRoleCode) {
    setPrevDefaultRoleCode(defaultRoleCode)
    if (defaultRoleCode) {
      if (!bookerRoleCode) setBookerRoleCode(defaultRoleCode)
      if (additional.some((p) => !p.service_role_code)) {
        setAdditional((prev) =>
          prev.map((p) =>
            p.service_role_code ? p : { ...p, service_role_code: defaultRoleCode },
          ),
        )
      }
    }
  }

  // Mirror the booker into participants[0] while the customer hasn't
  // overridden individual fields. We track the previous booker values
  // per-field; once the participant field diverges from the previous
  // booker value, that field is "owned" by the user and stops syncing
  // (mirrors the prevBooker pattern from landr-iu3s/landr-qs8d).
  //
  // Implementation note: participants[0] data lives implicitly — we
  // derive it from the booker on submit (bookerToParticipant). The
  // additional[] state covers participants 1..N. This avoids needing
  // to track a "participant 0 has diverged" flag because the participant
  // 0 row is rendered as a read-only summary in the UI.
  //
  // The "additional" array is the only mutable participant state. To
  // change participant 0's name distinct from the booker, the customer
  // would edit the booker — that's the explicit landr-8c03 product
  // decision (booker == primary participant; no separate override).
  const prevBooker = useRef(emptyBooker())
  useEffect(() => {
    prevBooker.current = booker
  }, [booker])

  const totalCount = 1 + additional.length

  // landr-gb2f.1: fire the live-update callback with the latest derived
  // count + names. Called from event handlers (not effects) so App.tsx can
  // set its own liveParticipant* state without triggering the
  // react-hooks/set-state-in-effect rule.
  const notifyLive = (
    nextBooker: BookerDetails,
    nextAdditional: ParticipantDetails[],
    nextCompanions: CompanionDetails[],
  ) => {
    if (!onLiveParticipantsChange) return
    const count = 1 + nextAdditional.length
    const names = [
      nextBooker.first_name.trim(),
      ...nextAdditional.map((p) => p.first_name.trim()),
    ].filter((n) => n.length > 0)
    onLiveParticipantsChange(count, names, nextCompanions.length)
  }

  // landr-4uyu: add a single additional participant below the last card.
  // Replaces the top stepper's grow path. Appends one empty row (capped at
  // MAX_ADDITIONAL) and notifies the live sidebar. Existing rows' data is
  // untouched (preserves landr-nmed entered data for other rows).
  //
  // landr-ykzuq: notifyLive() calls the PARENT's onLiveParticipantsChange,
  // which sets App.tsx's state. Each of these handlers used to call it from
  // INSIDE the setX() updater function — React can invoke that updater
  // eagerly (its state-update bail-out check) while DetailsStep is still
  // rendering, which then trips "Cannot update a component (BookingFlowApp)
  // while rendering a different component (DetailsStep)". Fixed by deriving
  // `next` from the current closure value (accurate here — these are plain
  // event handlers, not concurrent/batched updates), calling setX with the
  // plain value, and only THEN calling notifyLive — after DetailsStep's own
  // render has finished, from the event handler, same as before.
  const addParticipant = () => {
    if (additional.length >= MAX_ADDITIONAL) return
    const next = [...additional, emptyParticipant(defaultRoleCode)]
    setAdditional(next)
    notifyLive(booker, next, companions)
  }

  // landr-4uyu: remove a SPECIFIC additional participant by index (the per-card
  // × control), not just the last one as the stepper did. Splicing the chosen
  // index preserves the entered data of all the OTHER rows (landr-nmed).
  const removeParticipant = (idx: number) => {
    if (idx < 0 || idx >= additional.length) return
    const next = additional.slice(0, idx).concat(additional.slice(idx + 1))
    setAdditional(next)
    notifyLive(booker, next, companions)
  }

  // landr-4uyu: add a single companion below the last companion card.
  const addCompanion = () => {
    if (companions.length >= MAX_COMPANIONS) return
    const next = [...companions, emptyCompanion()]
    setCompanions(next)
    notifyLive(booker, additional, next)
  }

  // landr-4uyu: remove a SPECIFIC companion by index (per-card × control),
  // preserving the other companion rows' data (landr-nmed).
  const removeCompanion = (idx: number) => {
    if (idx < 0 || idx >= companions.length) return
    const next = companions.slice(0, idx).concat(companions.slice(idx + 1))
    setCompanions(next)
    notifyLive(booker, additional, next)
  }

  const updateCompanion = <K extends keyof CompanionDetails>(
    idx: number,
    key: K,
    value: CompanionDetails[K],
  ) => {
    const row = companions[idx]
    if (!row) return
    const next = companions.slice()
    next[idx] = { ...row, [key]: value }
    setCompanions(next)
    notifyLive(booker, additional, next)
  }

  const updateBookerField = (key: keyof BookerDetails, value: string) => {
    const next = { ...booker, [key]: value }
    setBooker(next)
    notifyLive(next, additional, companions)
  }

  // landr-fn4i / landr-5krc: called from the booker email input's onBlur.
  // Fires POST .../subscription-perk/otp for a non-empty, '@'-shaped email —
  // the same loose check the rest of this file already uses for "does this
  // look like an email" (isFieldInvalid's booker.email case), not full RFC
  // validation. Reveals the optional code field regardless of whether the
  // network call itself succeeds (the endpoint is fire-and-forget by design
  // — see requestSubscriptionPerkOtp's doc — so there is nothing useful to
  // gate the UI on). Dedupes against otpSentForEmailRef so repeated blurs of
  // an unchanged email (tabbing back and forth) don't re-request and burn
  // into the server's per-email rate limit.
  const requestMemberPerkOtpIfNeeded = () => {
    // landr-y1t4: hard gate, first line. An operator with no ACTIVE
    // subscription perk has no member price to apply, so we neither reveal the
    // field nor spend one of their per-email issuance budgets asking for a code
    // the server would refuse to send anyway. Returning BEFORE
    // otpSentForEmailRef is written is deliberate: nothing is recorded as
    // "already requested", so if hasMemberPerks were to arrive late a later
    // blur still fires a real request. (In practice it cannot: settings are
    // fetched on App mount and Details is several steps downstream.)
    if (!hasMemberPerks) return
    const email = booker.email.trim()
    if (!email || !email.includes('@')) return
    setOtpRequested(true)
    if (otpSentForEmailRef.current === email) return
    otpSentForEmailRef.current = email
    // No operatorToken (legacy/test call-sites that omit it) → nothing to
    // hit; the field still shows so the customer isn't blocked either way.
    if (!operatorToken) return
    void requestSubscriptionPerkOtp(operatorToken, email).catch(() => {
      // Deliberately swallowed. The endpoint always answers 202 {ok:true}
      // for a valid widget_token regardless of member/non-member/malformed/
      // rate-limited — a network/host failure here is equally uninformative
      // and must never surface to the customer (landr-fn4i: never branch UI
      // on this call, and never turn a non-member's blur into an error toast).
    })
  }

  // landr-fn4i / landr-5krc: the optional code field's onChange. Strips
  // non-digits and caps at 6 so a paste (e.g. from the email client) can't
  // leave stray whitespace or punctuation in the value that eventually rides
  // as member_perk_otp on submit.
  const updateMemberPerkOtp = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6)
    setMemberPerkOtpState(digits)
    onMemberPerkOtpChange?.(digits)
  }

  const updateParticipant = (
    idx: number,
    key: keyof ParticipantDetails,
    value: string,
  ) => {
    const row = additional[idx]
    if (!row) return
    const next = additional.slice()
    next[idx] = { ...row, [key]: value }
    setAdditional(next)
    notifyLive(booker, next, companions)
  }

  // landr-opi3: per-field "touched" tracking so an EMPTY REQUIRED field turns
  // red only AFTER the customer leaves it (onBlur) — never while they are still
  // typing into it. The required-field set mirrors detailsAreComplete() exactly,
  // so the red borders correspond 1:1 with what blocks the Continue button.
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set())
  const markTouched = (key: string) =>
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))

  // landr-otml0.3 review fix (MINOR 6): the API's companion_contact_required
  // 422 sent the customer back here — surface it as if the field had
  // already been blurred (red, with the message) and put focus on it,
  // rather than making them tap Continue again to discover why. Runs once
  // per mount; StepTransition keys this component on step.name so a
  // navigation back here from BookingForm is always a fresh mount, and a
  // later unrelated remount would only re-fire if App.tsx hadn't cleared
  // its one-shot state via onCompanionContactFocusApplied below.
  useEffect(() => {
    if (initialFocusCompanionContactIndex === undefined) return
    const idx = initialFocusCompanionContactIndex
    let cancelled = false
    // IIFE-in-effect pattern (see AccommodationStep.tsx for the same idiom)
    // keeps react-hooks/set-state-in-effect happy — no synchronous setState
    // in the effect body.
    void (async () => {
      if (cancelled) return
      markTouched(`companion.${idx}.contact`)
      if (typeof document !== 'undefined') {
        const el = document.getElementById(`companion-${idx}-email`)
        el?.focus()
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
      }
      onCompanionContactFocusApplied?.()
    })()
    return () => {
      cancelled = true
    }
    // Deliberately mount-only — initialFocusCompanionContactIndex is a
    // one-shot value for THIS mount; re-running on every render would
    // re-focus the field on unrelated re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // landr-bx5y: browser autofill can hand a phone field a value with the
  // '+CC' already stripped (a Safari/Chrome autofill quirk, not something
  // our onChange sees separately from a normal edit) — the customer would
  // otherwise not find out until they blur the field or tap Continue. The
  // CSS in index.css fires a (visually inert) animation while a tel input
  // is in the browser's autofilled state; treat that as an implicit touch
  // so the "add your country code" validation appears immediately.
  const handlePhoneAutofill =
    (key: string) => (e: AnimationEvent<HTMLInputElement>) => {
      if (e.animationName === 'onAutoFillStart') markTouched(key)
    }

  // landr-bx5y follow-up: the :-webkit-autofill/onAnimationStart trick above
  // turned out to only fire reliably on the booker phone field — the one
  // present when the page first loads. Participant/companion rows are
  // mounted later (revealed by "+ Add participant"/"+ Add companion"), and
  // in the field a real browser's autofill engine doesn't consistently
  // apply the :-webkit-autofill state to those, even though it still hands
  // them a (possibly mangled) value. So this is the actual primary signal:
  // a real keystroke changes a field's length by one character at a time —
  // only autofill or a paste can jump a field from empty straight to a
  // multi-character value in a single onChange. That distinction doesn't
  // depend on any browser-specific pseudo-class or on when the field was
  // mounted, so it covers every row equally.
  const looksLikeBulkFill = (prevValue: string, nextValue: string): boolean =>
    prevValue.trim() === '' && nextValue.trim().length >= 4

  // landr-79re: the onBlur path alone is unreliable on mobile (tapping
  // between fields, dismissing the keyboard, or tapping a disabled button
  // often don't fire a blur), so an incomplete form could show NO red
  // borders and the customer was stuck with nothing flagged. markAllTouched
  // arms every required field's touched key in one shot — enumerated to
  // mirror EXACTLY the keys used in the validate(...) calls below and the
  // required set detailsAreComplete() checks — so a Continue tap reveals all
  // the errors at once regardless of platform.
  //
  // landr-1url: companion.<idx>.phone is included even though companion
  // phone is OPTIONAL (not required) — a filled-but-malformed companion
  // phone can also fail detailsAreComplete(), so it needs to be armable too.
  const requiredFieldKeys = (): string[] => {
    const keys = [
      'booker.first_name',
      'booker.last_name',
      'booker.email',
      'booker.phone',
    ]
    additional.forEach((_, idx) => {
      keys.push(`p.${idx}.first_name`, `p.${idx}.last_name`, `p.${idx}.phone`)
    })
    companions.forEach((row, idx) => {
      keys.push(
        `companion.${idx}.first_name`,
        `companion.${idx}.last_name`,
        `companion.${idx}.phone`,
      )
      // landr-otml0.3 D11: the combined email-or-phone requirement only
      // applies once the companion is flipped to 'separate_guiding'.
      if (row.companion_kind === 'separate_guiding') {
        keys.push(`companion.${idx}.contact`)
      }
    })
    return keys
  }
  const markAllTouched = () =>
    setTouched((prev) => {
      const next = new Set(prev)
      for (const key of requiredFieldKeys()) next.add(key)
      return next
    })

  // landr-79re: maps a required-field key to the DOM id of its <Input> so a
  // failed Continue tap can focus + scroll the FIRST invalid field into view
  // on mobile. Mirrors the (key, id) pairs passed to validate(...) below.
  const fieldIdForKey = (key: string): string | undefined => {
    switch (key) {
      case 'booker.first_name':
        return 'booker-first'
      case 'booker.last_name':
        return 'booker-last'
      case 'booker.email':
        return 'booker-email'
      case 'booker.phone':
        return 'booker-phone'
    }
    const pMatch = /^p\.(\d+)\.(first_name|last_name|phone)$/.exec(key)
    if (pMatch) {
      const slot =
        pMatch[2] === 'first_name'
          ? 'first'
          : pMatch[2] === 'last_name'
            ? 'last'
            : 'phone'
      return `p-${pMatch[1]}-${slot}`
    }
    const cMatch = /^companion\.(\d+)\.(first_name|last_name|phone)$/.exec(key)
    if (cMatch) {
      const slot =
        cMatch[2] === 'first_name'
          ? 'first'
          : cMatch[2] === 'last_name'
            ? 'last'
            : 'phone'
      return `companion-${cMatch[1]}-${slot}`
    }
    // landr-otml0.3 D11: focus the email field first — either channel
    // satisfies the requirement, and email is the more common one to add.
    const cContactMatch = /^companion\.(\d+)\.contact$/.exec(key)
    if (cContactMatch) return `companion-${cContactMatch[1]}-email`
    return undefined
  }

  // landr-79re: returns true when a required field is still blank (or, for the
  // booker email, malformed) — used to pick the FIRST invalid field to focus.
  const isFieldInvalid = (key: string): boolean => {
    switch (key) {
      case 'booker.first_name':
        return !booker.first_name.trim()
      case 'booker.last_name':
        return !booker.last_name.trim()
      case 'booker.email':
        return !booker.email.trim() || !booker.email.includes('@')
      case 'booker.phone':
        // landr-1url: required AND must look internationally-formatted.
        return !booker.phone.trim() || !isValidPhoneFormat(booker.phone)
    }
    const pMatch = /^p\.(\d+)\.(first_name|last_name|phone)$/.exec(key)
    if (pMatch) {
      const row = additional[Number(pMatch[1])]
      if (!row) return false
      const field = pMatch[2] as 'first_name' | 'last_name' | 'phone'
      if (field === 'phone') {
        // landr-1url: required AND must look internationally-formatted.
        return !row.phone.trim() || !isValidPhoneFormat(row.phone)
      }
      return !row[field].trim()
    }
    const cMatch = /^companion\.(\d+)\.(first_name|last_name|phone)$/.exec(key)
    if (cMatch) {
      const row = companions[Number(cMatch[1])]
      if (!row) return false
      const field = cMatch[2] as 'first_name' | 'last_name' | 'phone'
      if (field === 'phone') {
        // landr-1url: companion phone is OPTIONAL — empty is fine, but a
        // filled value must look internationally-formatted.
        return row.phone.trim() !== '' && !isValidPhoneFormat(row.phone)
      }
      return !row[field].trim()
    }
    // landr-otml0.3 D11: a 'separate_guiding' companion needs email OR
    // phone (either satisfies it) so their invite link has somewhere to go.
    const cContactMatch = /^companion\.(\d+)\.contact$/.exec(key)
    if (cContactMatch) {
      const row = companions[Number(cContactMatch[1])]
      if (!row || row.companion_kind !== 'separate_guiding') return false
      return !row.email.trim() && !row.phone.trim()
    }
    return false
  }

  // landr-79re: focus + scroll the first invalid required field into view
  // after a failed Continue tap. SSR/test-safe: guards document and the
  // optional scrollIntoView (jsdom does not implement it).
  const focusFirstInvalid = () => {
    if (typeof document === 'undefined') return
    const firstKey = requiredFieldKeys().find((key) => isFieldInvalid(key))
    if (!firstKey) return
    const id = fieldIdForKey(firstKey)
    if (!id) return
    const el = document.getElementById(id)
    if (!el) return
    el.focus()
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }

  // A required text field is invalid once touched and still blank.
  const requiredError = (key: string, value: string): string | undefined =>
    touched.has(key) && !value.trim() ? 'Required' : undefined
  // The booker email additionally needs an '@' (mirrors detailsAreComplete).
  const emailError = (key: string, value: string): string | undefined => {
    if (!touched.has(key)) return undefined
    if (!value.trim()) return 'Required'
    if (!value.includes('@')) return 'Enter a valid email address'
    return undefined
  }
  // landr-1url: a phone additionally needs to look internationally-formatted
  // (leading '+' + country code). `required` distinguishes booker/participant
  // phone (required) from companion phone (optional — blank is fine, but a
  // filled value is still held to the format check).
  const phoneError = (
    key: string,
    value: string,
    required: boolean,
  ): string | undefined => {
    if (!touched.has(key)) return undefined
    if (!value.trim()) return required ? 'Required' : undefined
    if (!isValidPhoneFormat(value)) {
      return 'Add your country code, e.g. +34 600 123 456'
    }
    return undefined
  }
  // Bundle the error + the input props (onBlur to arm, aria-invalid to paint
  // red, aria-describedby to wire the message for screen readers).
  const validate = (
    key: string,
    value: string,
    id: string,
    kind: 'required' | 'email' | 'phone' | 'phone-optional' = 'required',
  ) => {
    const error =
      kind === 'email'
        ? emailError(key, value)
        : kind === 'phone'
          ? phoneError(key, value, true)
          : kind === 'phone-optional'
            ? phoneError(key, value, false)
            : requiredError(key, value)
    return {
      error,
      inputProps: {
        onBlur: () => markTouched(key),
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? `${id}-error` : undefined,
      },
    }
  }

  const participantsForValidation: ParticipantDetails[] = [
    bookerToParticipant(booker, bookerRoleCode),
    ...additional,
  ]
  const canContinue = detailsAreComplete(
    booker,
    participantsForValidation,
    companions,
  )
  // landr-80ubl.3: the one-next-action rule's pending required control for
  // this screen is "your contact details" — the other sections (additional
  // participants, companions) are opt-in via their own "+ Add" affordances,
  // so they don't compete for the single highlight.
  const bookerComplete =
    booker.first_name.trim() !== '' &&
    booker.last_name.trim() !== '' &&
    booker.email.trim() !== '' &&
    booker.email.includes('@') &&
    booker.phone.trim() !== '' &&
    isValidPhoneFormat(booker.phone)

  const handleContinue = () => {
    // landr-79re: the Continue button is ALWAYS tappable now (no
    // disabled={!canContinue}) so mobile customers get feedback. On a tap
    // while incomplete we reveal every required-field error (markAllTouched
    // arms the same set detailsAreComplete checks) and take the customer to
    // the first invalid field, but do NOT advance. We only call onConfirm
    // when the form is actually complete (unchanged behavior for the valid
    // case).
    if (!canContinue) {
      markAllTouched()
      focusFirstInvalid()
      return
    }
    onConfirm(booker, participantsForValidation, companions, comment.trim())
  }

  // landr-4uyu: at-max flags drive the "+ Add" button visibility and the
  // "Maximum …" warnings for each section.
  const participantsAtMax = additional.length >= MAX_ADDITIONAL
  const companionsAtMax = companions.length >= MAX_COMPANIONS

  // landr-amg6: at the participant max we no longer render the inquiry form
  // inline. Instead a "Request more" button opens an overlay modal that holds
  // the form. Closing/cancelling discards the in-progress inquiry (the form
  // remounts fresh each time the dialog opens, keyed below).
  const [inquiryOpen, setInquiryOpen] = useState(false)

  // landr-4uyu: normalize the operator contact email. A blank/whitespace value
  // is treated as absent so we never render an empty `mailto:`. When present we
  // build a mailto with a sensible prefilled subject; when absent the contact
  // copy still shows (graceful degrade) but the link is omitted.
  const trimmedContactEmail = contactEmail?.trim() || ''
  const contactMailto = trimmedContactEmail
    ? `mailto:${trimmedContactEmail}?subject=${encodeURIComponent(
        `Larger group or custom booking — ${product.name}`,
      )}`
    : ''

  // landr-opi3: booker required-field validations (all four required).
  const bookerFirstV = validate('booker.first_name', booker.first_name, 'booker-first')
  const bookerLastV = validate('booker.last_name', booker.last_name, 'booker-last')
  const bookerEmailV = validate('booker.email', booker.email, 'booker-email', 'email')
  const bookerPhoneV = validate(
    'booker.phone',
    booker.phone,
    'booker-phone',
    'phone',
  )

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>Participants</CardTitle>
        <CardDescription>
          {product.name} · {describeSelection(selection, locale)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Booker section — required fields for the person making the
            booking. They're also automatically participant 1.

            landr-jruv follow-up: confirmed live on bw-dev — the browser
            fills the booker phone with the full +CC number but reformats
            every OTHER phone field (added participants, companions) to a
            bare national number (a German +49… autofills as 0…). Every
            row's fields now carry a `section-<row>` autocomplete prefix
            (WHATWG autofill spec —
            https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill-detail-tokens),
            the standards mechanism for telling the browser that repeated
            field groups on one page (here: one per person) are independent
            identities rather than one profile's alternate phone numbers —
            our best working theory for why only the first phone field kept
            its country code. Not independently re-confirmed against a real
            browser after this change (none available in this environment);
            the bulk-fill touch-detection above is the fallback that catches
            a mangled value either way, regardless of whether this helps. */}
        <NextAction active={!bookerComplete} cue="enter your name, email and phone">
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium">Your contact details</legend>
          <p className="text-xs text-muted-foreground">
            You&rsquo;ll be listed as participant 1. Add more people below if
            others are joining.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" htmlFor="booker-first" error={bookerFirstV.error}>
              <Input
                id="booker-first"
                name="booker_first_name"
                autoComplete="section-booker given-name"
                value={booker.first_name}
                onChange={(e) => updateBookerField('first_name', e.target.value)}
                {...bookerFirstV.inputProps}
              />
            </Field>
            <Field label="Last name" htmlFor="booker-last" error={bookerLastV.error}>
              <Input
                id="booker-last"
                name="booker_last_name"
                autoComplete="section-booker family-name"
                value={booker.last_name}
                onChange={(e) => updateBookerField('last_name', e.target.value)}
                {...bookerLastV.inputProps}
              />
            </Field>
            <Field label="Email" htmlFor="booker-email" error={bookerEmailV.error}>
              <Input
                id="booker-email"
                name="booker_email"
                type="email"
                autoComplete="section-booker email"
                value={booker.email}
                onChange={(e) => updateBookerField('email', e.target.value)}
                {...bookerEmailV.inputProps}
                onBlur={() => {
                  bookerEmailV.inputProps.onBlur()
                  // landr-fn4i / landr-5krc: fire the subscription-perk OTP
                  // request on the same blur that arms the "Required" error
                  // check above — one blur, two independent concerns.
                  requestMemberPerkOtpIfNeeded()
                }}
              />
            </Field>
            <Field label="Phone" htmlFor="booker-phone" error={bookerPhoneV.error}>
              <Input
                id="booker-phone"
                name="booker_phone"
                type="tel"
                autoComplete="section-booker tel"
                placeholder="+34 600 123 456"
                pattern={PHONE_HTML_PATTERN}
                value={booker.phone}
                onChange={(e) => {
                  if (looksLikeBulkFill(booker.phone, e.target.value)) {
                    markTouched('booker.phone')
                  }
                  updateBookerField('phone', e.target.value)
                }}
                onAnimationStart={handlePhoneAutofill('booker.phone')}
                {...bookerPhoneV.inputProps}
              />
              {/* landr-1url: nudge toward international format (no new dep). */}
              <p className="text-xs text-muted-foreground">
                Include your country code
              </p>
            </Field>
            {/* landr-mg0a: per-participant role dropdown, hidden when the
                operator only has the single default role. */}
            {showRoleDropdown ? (
              <Field label="Role" htmlFor="booker-role">
                <RoleSelect
                  id="booker-role"
                  name="booker_role"
                  value={bookerRoleCode}
                  serviceRoles={serviceRoles}
                  onChange={setBookerRoleCode}
                  testId="booker-role-select"
                />
              </Field>
            ) : null}
          </div>

          {/* landr-fn4i / landr-5krc: OPTIONAL member-perk code field.
              landr-y1t4: shown ONLY for operators that actually run a
              membership programme (hasMemberPerks — an ACTIVE
              subscription_perks row exists), and then only once the OTP
              request has fired for the current
              email (member or not — the response carries no signal either
              way, so this can't and doesn't try to say "code sent" vs "not a
              member"). Never required, never validated red — a non-member
              leaving it blank must feel exactly as unremarkable as a member
              filling it in. The price only changes on submit (the code is
              spent server-side during pricing), so there is deliberately no
              client-side preview here. */}
          {hasMemberPerks && otpRequested ? (
            <div
              className="rounded-lg border border-dashed bg-surface-raised p-3"
              data-testid="member-perk-otp-section"
            >
              <Label htmlFor="member-perk-otp" className="text-xs">
                Member? Enter the 6-digit code we emailed you to apply your
                member price.
              </Label>
              <Input
                id="member-perk-otp"
                name="member_perk_otp"
                data-testid="member-perk-otp-input"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                autoComplete="one-time-code"
                className="mt-1 max-w-[10rem]"
                value={memberPerkOtp}
                onChange={(e) => updateMemberPerkOtp(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Not a member, or don&rsquo;t have a code? Leave this blank —
                it won&rsquo;t affect your booking.
              </p>
            </div>
          ) : null}
        </fieldset>
        </NextAction>

        {/* Additional participants — same stepper pattern as the legacy
            ParticipantsStep (landr-mbge) but now growing/shrinking a
            list of full participant rows instead of a single counter. */}
        <fieldset className="flex flex-col gap-3 border-t pt-4">
          <legend className="text-sm font-medium">
            Other participants ({totalCount} total)
          </legend>
          <p className="text-xs text-muted-foreground">
            Add anyone else taking part. You can add up to {MAX_ADDITIONAL} more.
          </p>

          {additional.map((row, idx) => {
            // landr-opi3: first + last + phone are required for every added
            // participant (landr-nkbi); email stays optional.
            const pFirstV = validate(`p.${idx}.first_name`, row.first_name, `p-${idx}-first`)
            const pLastV = validate(`p.${idx}.last_name`, row.last_name, `p-${idx}-last`)
            const pPhoneV = validate(
              `p.${idx}.phone`,
              row.phone,
              `p-${idx}-phone`,
              'phone',
            )
            return (
            // landr-3mo4: each added participant is a raised sub-card (one
            // level lighter than the step card) so the nested form group
            // reads as its own block.
            <div
              key={`participant-${idx}`}
              className="grid gap-3 rounded-lg border bg-surface-raised p-3 shadow-elev-1 sm:grid-cols-2"
              data-testid={`participant-row-${idx + 2}`}
            >
              {/* landr-4uyu: per-card header row carries a remove (×) control so
                  a specific participant row can be removed (replacing the old
                  top-stepper −). Removal preserves the OTHER rows' data. */}
              <div className="sm:col-span-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Participant {idx + 2}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="tap-44 rounded bg-primary/10 text-foreground shadow-elev-1 hover:bg-primary/20"
                  aria-label={`Remove participant ${idx + 2}`}
                  data-testid={`remove-participant-${idx + 2}`}
                  onClick={() => removeParticipant(idx)}
                >
                  ×
                </Button>
              </div>
              <Field label="First name" htmlFor={`p-${idx}-first`} error={pFirstV.error}>
                <Input
                  id={`p-${idx}-first`}
                  name={`participant_${idx + 2}_first_name`}
                  autoComplete={`section-participant-${idx + 2} given-name`}
                  value={row.first_name}
                  onChange={(e) =>
                    updateParticipant(idx, 'first_name', e.target.value)
                  }
                  {...pFirstV.inputProps}
                />
              </Field>
              <Field label="Last name" htmlFor={`p-${idx}-last`} error={pLastV.error}>
                <Input
                  id={`p-${idx}-last`}
                  name={`participant_${idx + 2}_last_name`}
                  autoComplete={`section-participant-${idx + 2} family-name`}
                  value={row.last_name}
                  onChange={(e) =>
                    updateParticipant(idx, 'last_name', e.target.value)
                  }
                  {...pLastV.inputProps}
                />
              </Field>
              <Field
                label="Email (optional)"
                htmlFor={`p-${idx}-email`}
                action={
                  <CopyFromBookerButton
                    bookerValue={booker.email}
                    targetValue={row.email}
                    onCopy={(value) => updateParticipant(idx, 'email', value)}
                    field="email"
                    testId={`copy-booker-email-p-${idx}`}
                  />
                }
              >
                <Input
                  id={`p-${idx}-email`}
                  name={`participant_${idx + 2}_email`}
                  type="email"
                  autoComplete={`section-participant-${idx + 2} email`}
                  value={row.email}
                  onChange={(e) =>
                    updateParticipant(idx, 'email', e.target.value)
                  }
                />
              </Field>
              {/* landr-nkbi: phone is required for every participant. */}
              <Field
                label="Phone"
                htmlFor={`p-${idx}-phone`}
                error={pPhoneV.error}
                action={
                  <CopyFromBookerButton
                    bookerValue={booker.phone}
                    targetValue={row.phone}
                    onCopy={(value) => updateParticipant(idx, 'phone', value)}
                    field="phone"
                    testId={`copy-booker-phone-p-${idx}`}
                  />
                }
              >
                <Input
                  id={`p-${idx}-phone`}
                  name={`participant_${idx + 2}_phone`}
                  type="tel"
                  autoComplete={`section-participant-${idx + 2} tel`}
                  placeholder="+34 600 123 456"
                  pattern={PHONE_HTML_PATTERN}
                  value={row.phone}
                  onChange={(e) => {
                    if (looksLikeBulkFill(row.phone, e.target.value)) {
                      markTouched(`p.${idx}.phone`)
                    }
                    updateParticipant(idx, 'phone', e.target.value)
                  }}
                  onAnimationStart={handlePhoneAutofill(`p.${idx}.phone`)}
                  {...pPhoneV.inputProps}
                />
                {/* landr-1url: nudge toward international format (no new dep). */}
                <p className="text-xs text-muted-foreground">
                  Include your country code
                </p>
              </Field>
              {showRoleDropdown ? (
                <Field label="Role" htmlFor={`p-${idx}-role`}>
                  <RoleSelect
                    id={`p-${idx}-role`}
                    name={`participant_${idx + 2}_role`}
                    value={row.service_role_code || defaultRoleCode}
                    serviceRoles={serviceRoles}
                    onChange={(value) =>
                      updateParticipant(idx, 'service_role_code', value)
                    }
                    testId={`participant-role-select-${idx + 2}`}
                  />
                </Field>
              ) : null}
            </div>
            )
          })}

          {/* landr-4uyu: the "Add" affordance lives BELOW the last card and is
              rendered AFTER the card map in the DOM, so tabbing out of the last
              participant's phone lands here (natural tab order) — the customer
              never scrolls back up. At max it is replaced by a warning + the
              participant-only contact-us line. The aria-label "Add participant"
              is preserved from the old stepper button so existing tests/AT keep
              working. */}
          {participantsAtMax ? (
            // landr-amg6: at the max we replace the "+ Add participant" button
            // (which is gone anyway) with a "Request more" button. The inline
            // group-inquiry form (landr-ehye) is moved into an overlay modal
            // opened by this button — the participants section stays uncluttered
            // and the customer can't accidentally Send a half-filled form.
            <div
              className="flex flex-col gap-2 rounded-lg border border-dashed bg-surface-raised p-3"
              data-testid="participants-max-notice"
            >
              <p className="text-sm font-medium text-muted-foreground">
                Maximum of {MAX_ADDITIONAL} additional participants reached
              </p>
              <p className="text-xs text-muted-foreground">
                Need a larger group or a custom booking?
              </p>
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setInquiryOpen(true)}
                  data-testid="group-inquiry-open"
                >
                  Request more
                </Button>
                {/* Secondary escape hatch — reachable without opening the modal.
                    When the operator has no contact_email, contactMailto is
                    empty and the link is omitted (graceful degrade, as before). */}
                {contactMailto ? (
                  <a
                    href={contactMailto}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    data-testid="participants-contact-mailto"
                  >
                    Or email us
                  </a>
                ) : null}
              </div>

              {/* The overlay modal (radix Dialog primitive) holds the inquiry
                  form. Closing/Cancel discards the in-progress inquiry. The form
                  is keyed on `inquiryOpen` so each open starts fresh (no stale
                  draft, no leftover success/error state). */}
              <Dialog open={inquiryOpen} onOpenChange={setInquiryOpen}>
                <DialogContent
                  className="sm:max-w-lg"
                  data-testid="group-inquiry-modal"
                >
                  <DialogHeader>
                    <DialogTitle>Request a larger group</DialogTitle>
                    <DialogDescription>
                      Need a larger group or a custom booking? Send us
                      the details and we&rsquo;ll be in touch.
                    </DialogDescription>
                  </DialogHeader>
                  {inquiryOpen ? (
                    <GroupInquiryForm
                      key={inquiryOpen ? 'open' : 'closed'}
                      operatorToken={operatorToken}
                      productSlug={product.slug}
                      defaultName={`${booker.first_name} ${booker.last_name}`.trim()}
                      defaultEmail={booker.email}
                      defaultPhone={booker.phone}
                      contactMailto={contactMailto}
                      contactEmail={trimmedContactEmail}
                      onCancel={() => setInquiryOpen(false)}
                    />
                  ) : null}
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="tap-44 w-full justify-center rounded bg-primary/10 text-foreground shadow-elev-1 hover:bg-primary/20"
              aria-label="Add participant"
              data-testid="add-participant"
              onClick={addParticipant}
            >
              + Add participant
            </Button>
          )}
        </fieldset>

        {/* landr-87n9.3: non-guiding companions. Generic copy per
            landr-genericity-northstar. Companions occupy hotel beds (whole-party
            room assignment) but are NOT counted toward this booking's guiding
            participants, price, or the 6-participant cap — regardless of whether
            they do the activity (landr-doam.1: companion_kind).
            landr-rxjo: first and last name are both required for companions. */}
        <fieldset
          className="flex flex-col gap-3 border-t pt-4"
          data-testid="companions-section"
        >
          <legend className="text-sm font-medium">
            Others sharing your room
          </legend>
          <p className="text-xs text-muted-foreground">
            Anyone else sharing your accommodation — partners, friends, family
            members, or fellow activity participants who book and pay for their
            own guiding separately. They&rsquo;re added to the hotel headcount
            and room assignment, but not to this booking&rsquo;s activity or price.
          </p>
          {companions.map((row, idx) => {
            // landr-rxjo: both first and last name are required for companions.
            const cFirstV = validate(
              `companion.${idx}.first_name`,
              row.first_name,
              `companion-${idx}-first`,
            )
            const cLastV = validate(
              `companion.${idx}.last_name`,
              row.last_name,
              `companion-${idx}-last`,
            )
            // landr-1url: companion phone stays optional (landr-nkbi) but a
            // filled value is still nudged toward the international format.
            const cPhoneV = validate(
              `companion.${idx}.phone`,
              row.phone,
              `companion-${idx}-phone`,
              'phone-optional',
            )
            // landr-otml0.3 D11: a 'separate_guiding' companion needs email
            // OR phone — rendered as one shared error under the pair rather
            // than duplicated on both fields.
            const contactKey = `companion.${idx}.contact`
            const contactRequired = row.companion_kind === 'separate_guiding'
            const contactError =
              contactRequired &&
              touched.has(contactKey) &&
              !row.email.trim() &&
              !row.phone.trim()
            return (
            // landr-3mo4: companion rows are raised sub-cards, matching the
            // participant rows.
            <div
              key={`companion-${idx}`}
              className="grid gap-3 rounded-lg border bg-surface-raised p-3 shadow-elev-1 sm:grid-cols-2"
              data-testid={`companion-row-${idx}`}
            >
              {/* landr-4uyu: per-card header row with a remove (×) control so a
                  specific guest can be removed; the other rows' data persists. */}
              <div className="sm:col-span-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Guest {idx + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="tap-44 rounded bg-primary/10 text-foreground shadow-elev-1 hover:bg-primary/20"
                  aria-label={`Remove companion ${idx + 1}`}
                  data-testid={`remove-companion-${idx}`}
                  onClick={() => removeCompanion(idx)}
                >
                  ×
                </Button>
              </div>
              {/* landr-doam.1: companion kind selector — "not joining the
                  activity" (guest) vs "joining with their own separate guiding
                  booking" (separate_guiding). Default guest. The kind is
                  purely informational for the operator / rooming list; it
                  never affects this booking's price or participant count. */}
              <fieldset className="sm:col-span-2 flex flex-col gap-1">
                <legend className="text-xs text-muted-foreground">
                  How are they joining?
                </legend>
                <div className="flex flex-col gap-1">
                  {(
                    [
                      {
                        value: 'guest',
                        label: 'Not doing the activity (partner / child / friend)',
                      },
                      {
                        value: 'separate_guiding',
                        label:
                          'Joining the activity — booking their own guiding separately',
                      },
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.value}
                      className="flex cursor-pointer items-center gap-2 text-xs"
                      data-testid={`companion-kind-${idx}-${opt.value}`}
                    >
                      <input
                        type="radio"
                        name={`companion_${idx + 1}_kind`}
                        value={opt.value}
                        checked={row.companion_kind === opt.value}
                        onChange={() =>
                          updateCompanion(idx, 'companion_kind', opt.value)
                        }
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field label="First name" htmlFor={`companion-${idx}-first`} error={cFirstV.error}>
                <Input
                  id={`companion-${idx}-first`}
                  name={`companion_${idx + 1}_first_name`}
                  autoComplete={`section-companion-${idx + 1} given-name`}
                  value={row.first_name}
                  onChange={(e) =>
                    updateCompanion(idx, 'first_name', e.target.value)
                  }
                  {...cFirstV.inputProps}
                />
              </Field>
              <Field label="Last name" htmlFor={`companion-${idx}-last`} error={cLastV.error}>
                <Input
                  id={`companion-${idx}-last`}
                  name={`companion_${idx + 1}_last_name`}
                  autoComplete={`section-companion-${idx + 1} family-name`}
                  value={row.last_name}
                  onChange={(e) =>
                    updateCompanion(idx, 'last_name', e.target.value)
                  }
                  {...cLastV.inputProps}
                />
              </Field>
              {/* landr-otml0.3 D11: a 'separate_guiding' companion gets their
                  own invite link — this pair is where it goes, so at least
                  one channel is required. Helper copy sits above the pair
                  (per spec); the shared error renders once, below both. */}
              {contactRequired ? (
                <p className="sm:col-span-2 text-xs text-muted-foreground">
                  We&rsquo;ll use this to send them their own booking link.
                </p>
              ) : null}
              <Field
                label={contactRequired ? 'Email' : 'Email (optional)'}
                htmlFor={`companion-${idx}-email`}
                action={
                  <CopyFromBookerButton
                    bookerValue={booker.email}
                    targetValue={row.email}
                    onCopy={(value) => updateCompanion(idx, 'email', value)}
                    field="email"
                    testId={`copy-booker-email-companion-${idx}`}
                  />
                }
              >
                <Input
                  id={`companion-${idx}-email`}
                  name={`companion_${idx + 1}_email`}
                  type="email"
                  autoComplete={`section-companion-${idx + 1} email`}
                  value={row.email}
                  onChange={(e) =>
                    updateCompanion(idx, 'email', e.target.value)
                  }
                  onBlur={() => {
                    if (contactRequired) markTouched(contactKey)
                  }}
                  aria-invalid={contactError ? true : undefined}
                  aria-describedby={
                    contactError ? `companion-${idx}-contact-error` : undefined
                  }
                />
              </Field>
              <Field
                label={contactRequired ? 'Phone' : 'Phone (optional)'}
                htmlFor={`companion-${idx}-phone`}
                error={cPhoneV.error}
                action={
                  <CopyFromBookerButton
                    bookerValue={booker.phone}
                    targetValue={row.phone}
                    onCopy={(value) => updateCompanion(idx, 'phone', value)}
                    field="phone"
                    testId={`copy-booker-phone-companion-${idx}`}
                  />
                }
              >
                <Input
                  id={`companion-${idx}-phone`}
                  name={`companion_${idx + 1}_phone`}
                  type="tel"
                  autoComplete={`section-companion-${idx + 1} tel`}
                  placeholder="+34 600 123 456"
                  pattern={PHONE_HTML_PATTERN}
                  value={row.phone}
                  onChange={(e) => {
                    if (looksLikeBulkFill(row.phone, e.target.value)) {
                      markTouched(`companion.${idx}.phone`)
                    }
                    updateCompanion(idx, 'phone', e.target.value)
                  }}
                  onAnimationStart={handlePhoneAutofill(`companion.${idx}.phone`)}
                  onBlur={() => {
                    cPhoneV.inputProps.onBlur()
                    if (contactRequired) markTouched(contactKey)
                  }}
                  aria-invalid={cPhoneV.inputProps['aria-invalid'] ?? (contactError ? true : undefined)}
                  aria-describedby={
                    cPhoneV.inputProps['aria-describedby'] ??
                    (contactError ? `companion-${idx}-contact-error` : undefined)
                  }
                />
                {contactError ? (
                  <p
                    id={`companion-${idx}-contact-error`}
                    className="text-xs text-destructive"
                    data-testid={`companion-${idx}-contact-error`}
                  >
                    We need an email or phone number to send{' '}
                    {row.first_name.trim() || 'them'} their booking link
                  </p>
                ) : null}
                {/* landr-1url: nudge toward international format (no new dep). */}
                <p className="text-xs text-muted-foreground">
                  Include your country code
                </p>
              </Field>
            </div>
            )
          })}

          {/* landr-4uyu: "+ Add guest" lives below the last companion card and
              after the card map in the DOM, so it's the natural next tab stop
              after the last companion's phone. At max it is replaced by the
              warning only — companions have NO contact-us line. The aria-label
              "Add companion" is preserved from the old stepper button so the
              existing tests/AT keep working. */}
          {companionsAtMax ? (
            <div
              className="rounded-lg border border-dashed bg-surface-raised p-3"
              data-testid="companions-max-notice"
            >
              <p className="text-sm font-medium text-muted-foreground">
                Maximum of {MAX_COMPANIONS} guests reached
              </p>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="tap-44 w-full justify-center rounded bg-primary/10 text-foreground shadow-elev-1 hover:bg-primary/20"
              aria-label="Add companion"
              data-testid="add-companion"
              onClick={addCompanion}
            >
              + Add guest
            </Button>
          )}
        </fieldset>

        {/* landr-de6ej / landr-n6ii3: OPTIONAL free-text comment, last field
            before Continue — see CustomerCommentField's doc for why it's
            never required/validated red. This is the ONE step where the
            value is still local (committed to the draft on Continue below,
            same as booker/participants/companions); every step after this
            one reads/writes bookingDraft.customerComment directly. */}
        <CustomerCommentField value={comment} onChange={setComment} collapsible />

        {/* landr-79re: Continue is ALWAYS tappable so mobile customers get
            feedback — handleContinue gates on canContinue internally,
            revealing all required-field errors (markAllTouched) and
            focusing the first invalid field instead of silently doing
            nothing. ContinueAction's own Button always disables when not
            ready, which would break that contract, so this step wires the
            same accent/reason presentation by hand instead of using the
            primitive directly. */}
        <NextAction active={canContinue} cue="continue" className="mt-2">
          <div className="flex items-center justify-end gap-3">
            <p
              id="details-step-gate"
              role="status"
              data-testid="details-step-gate"
              className="min-w-0 flex-1 text-xs text-muted-foreground"
            >
              {canContinue ? 'Ready to continue.' : 'Fill in every required field to continue.'}
            </p>
            <Button
              type="button"
              variant={canContinue ? 'default' : 'secondary'}
              onClick={handleContinue}
              data-testid="details-step-submit"
            >
              Continue
            </Button>
          </div>
        </NextAction>
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  htmlFor,
  error,
  action,
  children,
}: {
  label: string
  htmlFor?: string
  /** landr-opi3: when set, renders a red validation message below the input. */
  error?: string
  /**
   * landr-0utgk: optional control rendered right-aligned next to the label
   * (currently only the "copy from main participant" icon). Kept generic
   * rather than a dedicated prop so Field doesn't need to know what the
   * action does.
   */
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-xs">
          {label}
        </Label>
        {action}
      </div>
      {children}
      {error ? (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          className="text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * landr-0utgk: "copy from the main participant" icon for a secondary
 * contact field (Trello: "so when someone brings his kids, the contact
 * stays the same"). Renders inside a Field's `action` slot. Deliberately
 * self-gating on visibility — every call site would otherwise repeat the
 * same "hidden when it'd be a no-op" check, so it lives here once: hidden
 * when the booker has nothing to copy yet, or when the target already
 * holds that value (an icon that does nothing on click is worse than no
 * icon). Writes through the caller's onCopy (updateParticipant /
 * updateCompanion), so persistence/validation see it exactly like a typed
 * edit.
 *
 * The accessible name is "Use your <field>", not "main participant" — the
 * booker's own section is titled "Your contact details" and there is no
 * visible "Participant 1"/"main participant" anywhere in this form, so a
 * screen-reader user would have had nothing to map that phrase onto.
 *
 * The glyph stays small (a label-row affordance, not a primary control) but
 * the hit box is 24px (WCAG 2.5.8) so a thumb can land on it. The repo's
 * tap-44 helper is deliberately NOT used here: at 44px it either doubles
 * every label row's height or, pulled back with a negative margin, overhangs
 * the input below and steals taps meant for the field itself.
 */
function CopyFromBookerButton({
  bookerValue,
  targetValue,
  onCopy,
  field,
  testId,
}: {
  bookerValue: string
  targetValue: string
  onCopy: (value: string) => void
  field: 'email' | 'phone'
  testId: string
}) {
  const source = bookerValue.trim()
  if (!source || source === targetValue.trim()) return null
  return (
    <button
      type="button"
      className="flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      aria-label={`Use your ${field}`}
      title={`Use your ${field}`}
      data-testid={testId}
      onClick={() => onCopy(source)}
    >
      <Copy className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}

/**
 * landr-mg0a: per-participant service_role picker. Native <select> kept
 * minimal — the dropdown is only ever rendered when the operator has
 * >1 active role (single-role operators get the auto-default flow with
 * no UI surface). Styling mirrors the project's <Input> component so
 * the row blends visually with the surrounding text fields.
 */
function RoleSelect({
  id,
  name,
  value,
  serviceRoles,
  onChange,
  testId,
}: {
  id: string
  name: string
  value: string
  serviceRoles: ServiceRole[]
  onChange: (next: string) => void
  testId?: string
}) {
  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testId}
      className="border-input bg-surface-page shadow-well ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {serviceRoles.map((role) => (
        <option key={role.id} value={role.code}>
          {role.label}
        </option>
      ))}
    </select>
  )
}
