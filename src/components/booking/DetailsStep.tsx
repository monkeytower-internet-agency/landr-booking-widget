import { useEffect, useRef, useState } from 'react'
import type { BookingSelection } from '@/components/booking/BookingForm'
import type { Product, ServiceRole } from '@/api/types'
import { browserLocale } from '@/lib/locale'
import { formatDayLabel } from '@/components/booking/dateLabel'
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
  type BookerDetails,
  type CompanionDetails,
  type ParticipantDetails,
} from './detailsTypes'
import { GroupInquiryForm } from './GroupInquiryForm'
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
  onBack: () => void
  onConfirm: (
    booker: BookerDetails,
    participants: ParticipantDetails[],
    // landr-87n9.3: non-guiding companions captured in the "Others joining"
    // section. Empty array when nobody extra joins.
    companions: CompanionDetails[],
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
  operatorToken = '',
  initialBooker,
  initialParticipants,
  initialCompanions,
  onBack,
  onConfirm,
  onLiveParticipantsChange,
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
      return initialParticipants.slice(1)
    }
    return []
  })
  // landr-87n9.3: non-guiding companions ("Others joining the activity").
  // Restored from initialCompanions on Back-restore, else empty.
  const [companions, setCompanions] = useState<CompanionDetails[]>(
    () => initialCompanions ?? [],
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
  const addParticipant = () => {
    setAdditional((current) => {
      if (current.length >= MAX_ADDITIONAL) return current
      const next = [...current, emptyParticipant(defaultRoleCode)]
      notifyLive(booker, next, companions)
      return next
    })
  }

  // landr-4uyu: remove a SPECIFIC additional participant by index (the per-card
  // × control), not just the last one as the stepper did. Splicing the chosen
  // index preserves the entered data of all the OTHER rows (landr-nmed).
  const removeParticipant = (idx: number) => {
    setAdditional((current) => {
      if (idx < 0 || idx >= current.length) return current
      const next = current.slice(0, idx).concat(current.slice(idx + 1))
      notifyLive(booker, next, companions)
      return next
    })
  }

  // landr-4uyu: add a single companion below the last companion card.
  const addCompanion = () => {
    setCompanions((current) => {
      if (current.length >= MAX_COMPANIONS) return current
      const next = [...current, emptyCompanion()]
      notifyLive(booker, additional, next)
      return next
    })
  }

  // landr-4uyu: remove a SPECIFIC companion by index (per-card × control),
  // preserving the other companion rows' data (landr-nmed).
  const removeCompanion = (idx: number) => {
    setCompanions((current) => {
      if (idx < 0 || idx >= current.length) return current
      const next = current.slice(0, idx).concat(current.slice(idx + 1))
      notifyLive(booker, additional, next)
      return next
    })
  }

  const updateCompanion = <K extends keyof CompanionDetails>(
    idx: number,
    key: K,
    value: CompanionDetails[K],
  ) => {
    setCompanions((prev) => {
      const next = prev.slice()
      const row = next[idx]
      if (!row) return prev
      next[idx] = { ...row, [key]: value }
      notifyLive(booker, additional, next)
      return next
    })
  }

  const updateBookerField = (key: keyof BookerDetails, value: string) => {
    setBooker((prev) => {
      const next = { ...prev, [key]: value }
      notifyLive(next, additional, companions)
      return next
    })
  }

  const updateParticipant = (
    idx: number,
    key: keyof ParticipantDetails,
    value: string,
  ) => {
    setAdditional((prev) => {
      const next = prev.slice()
      const row = next[idx]
      if (!row) return prev
      next[idx] = { ...row, [key]: value }
      notifyLive(booker, next, companions)
      return next
    })
  }

  // landr-opi3: per-field "touched" tracking so an EMPTY REQUIRED field turns
  // red only AFTER the customer leaves it (onBlur) — never while they are still
  // typing into it. The required-field set mirrors detailsAreComplete() exactly,
  // so the red borders correspond 1:1 with what blocks the Continue button.
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set())
  const markTouched = (key: string) =>
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))

  // landr-79re: the onBlur path alone is unreliable on mobile (tapping
  // between fields, dismissing the keyboard, or tapping a disabled button
  // often don't fire a blur), so an incomplete form could show NO red
  // borders and the customer was stuck with nothing flagged. markAllTouched
  // arms every required field's touched key in one shot — enumerated to
  // mirror EXACTLY the keys used in the validate(...) calls below and the
  // required set detailsAreComplete() checks — so a Continue tap reveals all
  // the errors at once regardless of platform.
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
    companions.forEach((_, idx) => {
      keys.push(`companion.${idx}.first_name`, `companion.${idx}.last_name`)
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
    const cMatch = /^companion\.(\d+)\.(first_name|last_name)$/.exec(key)
    if (cMatch) {
      const slot = cMatch[2] === 'first_name' ? 'first' : 'last'
      return `companion-${cMatch[1]}-${slot}`
    }
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
        return !booker.phone.trim()
    }
    const pMatch = /^p\.(\d+)\.(first_name|last_name|phone)$/.exec(key)
    if (pMatch) {
      const row = additional[Number(pMatch[1])]
      if (!row) return false
      const field = pMatch[2] as 'first_name' | 'last_name' | 'phone'
      return !row[field].trim()
    }
    const cMatch = /^companion\.(\d+)\.(first_name|last_name)$/.exec(key)
    if (cMatch) {
      const row = companions[Number(cMatch[1])]
      if (!row) return false
      const field = cMatch[2] as 'first_name' | 'last_name'
      return !row[field].trim()
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
  // Bundle the error + the input props (onBlur to arm, aria-invalid to paint
  // red, aria-describedby to wire the message for screen readers).
  const validate = (
    key: string,
    value: string,
    id: string,
    kind: 'required' | 'email' = 'required',
  ) => {
    const error =
      kind === 'email' ? emailError(key, value) : requiredError(key, value)
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
    onConfirm(booker, participantsForValidation, companions)
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
  const bookerPhoneV = validate('booker.phone', booker.phone, 'booker-phone')

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
            booking. They're also automatically participant 1. */}
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
                autoComplete="given-name"
                value={booker.first_name}
                onChange={(e) => updateBookerField('first_name', e.target.value)}
                {...bookerFirstV.inputProps}
              />
            </Field>
            <Field label="Last name" htmlFor="booker-last" error={bookerLastV.error}>
              <Input
                id="booker-last"
                name="booker_last_name"
                autoComplete="family-name"
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
                autoComplete="email"
                value={booker.email}
                onChange={(e) => updateBookerField('email', e.target.value)}
                {...bookerEmailV.inputProps}
              />
            </Field>
            <Field label="Phone" htmlFor="booker-phone" error={bookerPhoneV.error}>
              <Input
                id="booker-phone"
                name="booker_phone"
                type="tel"
                autoComplete="tel"
                value={booker.phone}
                onChange={(e) => updateBookerField('phone', e.target.value)}
                {...bookerPhoneV.inputProps}
              />
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
        </fieldset>

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
            const pPhoneV = validate(`p.${idx}.phone`, row.phone, `p-${idx}-phone`)
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
                  value={row.last_name}
                  onChange={(e) =>
                    updateParticipant(idx, 'last_name', e.target.value)
                  }
                  {...pLastV.inputProps}
                />
              </Field>
              <Field label="Email (optional)" htmlFor={`p-${idx}-email`}>
                <Input
                  id={`p-${idx}-email`}
                  name={`participant_${idx + 2}_email`}
                  type="email"
                  value={row.email}
                  onChange={(e) =>
                    updateParticipant(idx, 'email', e.target.value)
                  }
                />
              </Field>
              {/* landr-nkbi: phone is required for every participant. */}
              <Field label="Phone" htmlFor={`p-${idx}-phone`} error={pPhoneV.error}>
                <Input
                  id={`p-${idx}-phone`}
                  name={`participant_${idx + 2}_phone`}
                  type="tel"
                  value={row.phone}
                  onChange={(e) =>
                    updateParticipant(idx, 'phone', e.target.value)
                  }
                  {...pPhoneV.inputProps}
                />
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
                  value={row.last_name}
                  onChange={(e) =>
                    updateCompanion(idx, 'last_name', e.target.value)
                  }
                  {...cLastV.inputProps}
                />
              </Field>
              <Field label="Email (optional)" htmlFor={`companion-${idx}-email`}>
                <Input
                  id={`companion-${idx}-email`}
                  name={`companion_${idx + 1}_email`}
                  type="email"
                  value={row.email}
                  onChange={(e) =>
                    updateCompanion(idx, 'email', e.target.value)
                  }
                />
              </Field>
              <Field label="Phone (optional)" htmlFor={`companion-${idx}-phone`}>
                <Input
                  id={`companion-${idx}-phone`}
                  name={`companion_${idx + 1}_phone`}
                  type="tel"
                  value={row.phone}
                  onChange={(e) =>
                    updateCompanion(idx, 'phone', e.target.value)
                  }
                />
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

        <div className="flex justify-end pt-2">
          {/* landr-79re: Continue is ALWAYS tappable so mobile customers get
              feedback. handleContinue gates on canContinue internally —
              revealing all required-field errors (markAllTouched) and focusing
              the first invalid field instead of silently doing nothing. There
              is no in-flight/pending state on this step, so no disabled gate is
              needed. */}
          <Button type="button" onClick={handleContinue}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  /** landr-opi3: when set, renders a red validation message below the input. */
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
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
