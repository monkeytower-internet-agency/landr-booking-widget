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
  emptyParticipant,
  type BookerDetails,
  type ParticipantDetails,
} from './detailsTypes'

const MAX_ADDITIONAL = 5 // total cap = 6 participants (matches the legacy form)

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
  /** Re-entry data when the customer hits Back from a downstream step. */
  initialBooker?: BookerDetails
  initialParticipants?: ParticipantDetails[]
  onBack: () => void
  onConfirm: (
    booker: BookerDetails,
    participants: ParticipantDetails[],
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
  initialBooker,
  initialParticipants,
  onBack,
  onConfirm,
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

  // If the service-roles fetch resolves AFTER DetailsStep first
  // mounted, swap empty role codes for the new default. Already-picked
  // roles (from a Back-restore) stay untouched.
  useEffect(() => {
    if (!defaultRoleCode) return
    setBookerRoleCode((prev) => prev || defaultRoleCode)
    setAdditional((prev) =>
      prev.map((p) =>
        p.service_role_code ? p : { ...p, service_role_code: defaultRoleCode },
      ),
    )
  }, [defaultRoleCode])

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

  const setAdditionalCount = (next: number) => {
    const clamped = Math.min(MAX_ADDITIONAL, Math.max(0, Math.floor(next)))
    setAdditional((current) => {
      if (clamped === current.length) return current
      if (clamped > current.length) {
        const grown = current.slice()
        for (let i = current.length; i < clamped; i += 1) {
          grown.push(emptyParticipant(defaultRoleCode))
        }
        return grown
      }
      return current.slice(0, clamped)
    })
  }

  const updateBookerField = (key: keyof BookerDetails, value: string) => {
    setBooker((prev) => ({ ...prev, [key]: value }))
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
      return next
    })
  }

  const participantsForValidation: ParticipantDetails[] = [
    bookerToParticipant(booker, bookerRoleCode),
    ...additional,
  ]
  const canContinue = detailsAreComplete(booker, participantsForValidation)

  const handleContinue = () => {
    if (!canContinue) return
    onConfirm(booker, participantsForValidation)
  }

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>Your details</CardTitle>
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
            <Field label="First name" htmlFor="booker-first">
              <Input
                id="booker-first"
                name="booker_first_name"
                autoComplete="given-name"
                value={booker.first_name}
                onChange={(e) => updateBookerField('first_name', e.target.value)}
              />
            </Field>
            <Field label="Last name" htmlFor="booker-last">
              <Input
                id="booker-last"
                name="booker_last_name"
                autoComplete="family-name"
                value={booker.last_name}
                onChange={(e) => updateBookerField('last_name', e.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="booker-email">
              <Input
                id="booker-email"
                name="booker_email"
                type="email"
                autoComplete="email"
                value={booker.email}
                onChange={(e) => updateBookerField('email', e.target.value)}
              />
            </Field>
            <Field label="Phone" htmlFor="booker-phone">
              <Input
                id="booker-phone"
                name="booker_phone"
                type="tel"
                autoComplete="tel"
                value={booker.phone}
                onChange={(e) => updateBookerField('phone', e.target.value)}
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
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Remove participant"
              onClick={() => setAdditionalCount(additional.length - 1)}
              disabled={additional.length <= 0}
            >
              −
            </Button>
            <span className="text-sm tabular-nums w-8 text-center">
              {additional.length}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Add participant"
              onClick={() => setAdditionalCount(additional.length + 1)}
              disabled={additional.length >= MAX_ADDITIONAL}
            >
              +
            </Button>
            <span className="text-sm text-muted-foreground">
              additional (max {MAX_ADDITIONAL})
            </span>
          </div>

          {additional.map((row, idx) => (
            <div
              key={`participant-${idx}`}
              className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
              data-testid={`participant-row-${idx + 2}`}
            >
              <div className="sm:col-span-2 text-xs font-medium text-muted-foreground">
                Participant {idx + 2}
              </div>
              <Field label="First name" htmlFor={`p-${idx}-first`}>
                <Input
                  id={`p-${idx}-first`}
                  name={`participant_${idx + 2}_first_name`}
                  value={row.first_name}
                  onChange={(e) =>
                    updateParticipant(idx, 'first_name', e.target.value)
                  }
                />
              </Field>
              <Field label="Last name" htmlFor={`p-${idx}-last`}>
                <Input
                  id={`p-${idx}-last`}
                  name={`participant_${idx + 2}_last_name`}
                  value={row.last_name}
                  onChange={(e) =>
                    updateParticipant(idx, 'last_name', e.target.value)
                  }
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
              <Field label="Phone (optional)" htmlFor={`p-${idx}-phone`}>
                <Input
                  id={`p-${idx}-phone`}
                  name={`participant_${idx + 2}_phone`}
                  type="tel"
                  value={row.phone}
                  onChange={(e) =>
                    updateParticipant(idx, 'phone', e.target.value)
                  }
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
          ))}
        </fieldset>

        <div className="flex justify-end pt-2">
          <Button type="button" onClick={handleContinue} disabled={!canContinue}>
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
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
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
      className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {serviceRoles.map((role) => (
        <option key={role.id} value={role.code}>
          {role.label}
        </option>
      ))}
    </select>
  )
}
