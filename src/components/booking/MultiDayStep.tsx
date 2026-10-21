import { useEffect, useMemo, useRef, useState } from 'react'
import { getAvailability } from '@/api/client'
import type { AvailabilitySlot, Product } from '@/api/types'
import type { ForceReason } from '@/lib/strings'
import { useStaffMode } from '@/lib/staffMode'
import { formatDayLabel } from '@/components/booking/dateLabel'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { MultiDayPicker } from '@/components/booking/MultiDayPicker'
import { StepBackButton } from '@/components/booking/StepBackButton'
import { dateFromIso, isoDate } from '@/components/booking/dateUtils'
import { DayChips } from '@/components/booking/DayChips'
import { isDayBookable } from '@/components/booking/bookability'
import { availabilityWindow, startOfToday } from '@/components/booking/calendarStart'
import {
  availableDaysForLabel,
  dayNoLongerAvailableReason,
  daysSelectedLabel,
  seatsShortDaysMessage,
  hostDaysUnavailableMessage,
  multiDayGate,
  sameDaysAsHostForLabel,
  tr,
} from '@/lib/strings'
import { browserLocale } from '@/lib/locale'
import { NextAction } from '@/components/booking/NextAction'
import { ContinueAction } from '@/components/booking/ContinueAction'
import { useReportLoaded } from '@/lib/bootSplash'
import { maxPartySize, seatFit, shortDays, windowRangeLabel } from '@/lib/seatHold'
import { PartySizeStepper, SeatFitNotice } from '@/components/booking/PartySize'

interface Props {
  product: Product
  /** Absent → no Back affordance (landr-6eita.1: start=dates entry). */
  onBack?: () => void
  /**
   * landr-aoak.2: `forcedDays` carries the subset of selectedDays the operator
   * force-booked past zero availability (staff mode only; empty otherwise).
   * landr-t869m.5: `forcedReasons` names WHICH gate(s) were bypassed across
   * that subset (capacity and/or lead time) — empty/undefined when
   * `forcedDays` is empty/undefined.
   */
  onConfirm: (
    selectedDays: string[],
    forcedDays?: string[],
    forcedReasons?: ForceReason[],
  ) => void
  /**
   * Called whenever the user's day selection changes so App.tsx can feed
   * the live selection into PriceSidebar before the user presses Continue
   * (landr-w7pi). Optional — omitting it has no effect on the picker UX.
   */
  onLiveDaysChange?: (isoDays: string[]) => void
  /**
   * landr (breadcrumb): previously-committed ISO days, restored when the
   * customer navigates BACK to this step so they can edit their prior choice
   * instead of starting from scratch. Empty/undefined on the first visit.
   */
  initialSelectedDays?: string[]
  /**
   * landr-otml0.3 — invite-mode diff baseline: the host's ISO days. When
   * present the picker renders the tri-colour diff against them (see
   * MultiDayPicker's originalValue prop). Undefined for every non-invite
   * booking.
   */
  originalDays?: string[]
  /** The host's display name, for the diff summary + reset button copy. */
  originalDaysLabel?: string
  /**
   * landr-tkgx8.1: called once the initial fetch settles (data or error), so
   * the boot splash can stay up until this step has something to show.
   */
  onLoaded?: () => void
  /**
   * landr-f987a.4: the raw `?invite=<token>`; sent to the availability call so
   * days covered by the invitee's live seat hold read as available.
   */
  inviteToken?: string
  /**
   * landr-f987a.4: seats the host's party needs on every day (guiding
   * participants + invited separate_guiding companions) once known (e.g. after
   * Back from the details step). Absent/1 → no party-size check here.
   */
  seatsNeeded?: number
  /**
   * landr-rmcsu.5: show the "How many of you?" stepper above the calendar.
   * Its value (seeded from `seatsNeeded`, else 1; max = the product's
   * max_party_size, else 6) replaces `seatsNeeded` for the seat check and is
   * reported through `onPartySizeChange` so App can persist it in the draft.
   * Pass false/omit when the group size is already known — e.g. the
   * participants step ran BEFORE dates (landr-rmcsu.6); `seatsNeeded` then
   * drives the seat check on its own.
   */
  showPartySizeStepper?: boolean
  onPartySizeChange?: (partySize: number) => void
  /** landr-rmcsu.5: widget token + contact email for the group-inquiry exit. */
  operatorToken?: string
  /**
   * landr-8ht3m.12: the operator's IANA timezone. "Today" (fetch window,
   * first-bookable-day search) is the operator's day, not the browser's.
   * Absent -> browser clock.
   */
  operatorTimezone?: string | null
  contactEmail?: string | null
}

// Stable empty reference for the availability prop while slots are still
// loading. Handing MultiDayPicker a fresh `[]` (i.e. `slots ?? []`) every
// render made its availableSet/forcedDays memos recompute each render and its
// onForcedDaysChange effect re-fire → setForcedDays here → re-render → new
// `[]` … an infinite render loop that blocked the event loop, so the
// availability fetch never resolved to break it (the App.test pickers hung for
// the full 6h CI timeout). A module-level constant keeps the reference stable
// until real slots arrive.
const EMPTY_SLOTS: AvailabilitySlot[] = []

export function MultiDayStep({
  product,
  onBack,
  onConfirm,
  onLiveDaysChange,
  initialSelectedDays,
  originalDays,
  originalDaysLabel,
  onLoaded,
  inviteToken,
  seatsNeeded,
  showPartySizeStepper = false,
  onPartySizeChange,
  operatorToken,
  operatorTimezone,
  contactEmail,
}: Props) {
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useReportLoaded(slots !== null || error !== null, onLoaded)
  const [selectedDays, setSelectedDays] = useState<Date[]>(() =>
    (initialSelectedDays ?? []).map(dateFromIso),
  )
  // landr-aoak.2: force-booked (zero-availability) ISO days inside the current
  // selection. Always [] in the normal customer path.
  const [forcedDays, setForcedDays] = useState<string[]>([])
  // landr-t869m.5: which gate(s) that forced subset bypassed. Always []
  // alongside an empty forcedDays.
  const [forcedReasons, setForcedReasons] = useState<ForceReason[]>([])
  const locale = browserLocale()
  // landr-f987a.1: only a staff session with force_book may keep/pick a day
  // with no availability; a customer (invite) session never can.
  const staff = useStaffMode()
  const canForce = staff.active && staff.powers.includes('force_book')
  // How many host days "Change dates" dropped as no longer bookable.
  const [droppedOnEdit, setDroppedOnEdit] = useState<number | undefined>(undefined)

  const { fromIso, toIso } = useMemo(
    () => availabilityWindow(startOfToday(operatorTimezone)),
    [operatorTimezone],
  )

  // landr-rmcsu.5: group size. With the stepper shown it is local state
  // seeded from the known need (Back / Change dates) and clamped to the
  // product's cap; without it the caller's seatsNeeded is the need.
  const partySizeMax = Math.max(maxPartySize(product.max_party_size), seatsNeeded ?? 1)
  const stepperShown = showPartySizeStepper && partySizeMax > 1
  const [partySize, setPartySize] = useState(() =>
    Math.min(Math.max(1, seatsNeeded ?? 1), partySizeMax),
  )
  const need = stepperShown ? partySize : Math.max(1, seatsNeeded ?? 1)
  const decreaseRef = useRef<HTMLButtonElement>(null)
  const changePartySize = (next: number) => {
    setPartySize(next)
    onPartySizeChange?.(next)
  }
  // Days in the loaded window that fit the whole group (for "12 dates fit 3
  // people" / the none-fit exits). null until availability has loaded.
  const fitCount = useMemo(
    () => (slots === null ? null : seatFit(slots, product.hotel_offering, need).fit.size),
    [slots, product.hotel_offering, need],
  )

  // landr-l38a4: an invite lands on a read-only summary of the host's days
  // (join as-is in one tap); the calendar only opens behind "Change dates".
  // A re-entry whose selection already differs from the host's goes straight
  // to the calendar — the customer has been editing.
  const [editing, setEditing] = useState(() => {
    if (!originalDays) return true
    const initial = [...(initialSelectedDays ?? [])].sort().join(',')
    return initial !== [...originalDays].sort().join(',')
  })

  // Host days that can no longer be booked (sold out / lead time passed).
  // "Continue with these dates" would 422, so the summary blocks it and
  // points at "Change dates". Empty until availability has loaded.
  const bookableSet = useMemo(
    () =>
      slots === null
        ? null
        : new Set(
            slots
              .filter(
                (s) =>
                  s.available_seats > 0 && isDayBookable(s, product.hotel_offering),
              )
              .map((s) => s.date),
          ),
    [slots, product.hotel_offering],
  )
  const unavailableOriginalDays = useMemo(() => {
    if (!originalDays || bookableSet === null) return []
    return originalDays.filter((iso) => !bookableSet.has(iso))
  }, [originalDays, bookableSet])
  // landr-rmcsu.7: host days that are still bookable but cannot take the whole
  // group (seats left, fewer than `need`). The invite summary blocks "Continue
  // with these dates" on them just like on a sold-out day; staff with
  // force_book may push past it (the API re-checks capacity).
  const shortOriginalDays = useMemo(() => {
    if (!originalDays || canForce || slots === null || bookableSet === null) return []
    return shortDays(slots, originalDays, need).filter(
      (d) => d.left > 0 && bookableSet.has(d.date),
    )
  }, [originalDays, canForce, slots, bookableSet, need])
  // Days that fit the whole group — what "Change dates" keeps.
  const fitSet = useMemo(
    () => (slots === null ? null : seatFit(slots, product.hotel_offering, need).fit),
    [slots, product.hotel_offering, need],
  )

  // landr-f987a.1: selected days a customer can no longer book (sold out, lead
  // time passed, or became unavailable after selection / Back nav). Staff with
  // force_book may keep them, so this is [] for them.
  const blockedSelectedDays = useMemo(() => {
    if (canForce || bookableSet === null) return []
    return selectedDays
      .map(isoDate)
      .filter((iso) => !bookableSet.has(iso))
      .sort()
  }, [canForce, bookableSet, selectedDays])

  // landr-f987a.4: selected days that cannot take the whole party (host +
  // invited companions). Staff with force_book may still push past it.
  const shortSelectedDays = useMemo(() => {
    if (canForce || slots === null) return []
    return shortDays(slots, selectedDays.map(isoDate), need)
  }, [canForce, slots, need, selectedDays])

  // "Change dates": drop every host day that is no longer bookable so the
  // calendar opens on a selection the customer can actually submit. When
  // availability has not loaded yet the drop is deferred (dropPending) and
  // runs the moment it does (landr-f987a.7).
  const [dropPending, setDropPending] = useState(false)
  const dropUnbookable = (bookable: Set<string>) => {
    const kept = selectedDays.filter((d) => bookable.has(isoDate(d)))
    const dropped = selectedDays.length - kept.length
    if (dropped > 0) {
      setSelectedDays(kept)
      setDroppedOnEdit(dropped)
    }
  }
  const startEditing = () => {
    if (!canForce) {
      // landr-rmcsu.7: drop host days that no longer take the group too —
      // same droppedOnEdit notice as a sold-out day.
      if (fitSet !== null) dropUnbookable(fitSet)
      else setDropPending(true)
    }
    setEditing(true)
  }
  // Adjust-state-during-render: availability arrived after "Change dates".
  if (dropPending && fitSet !== null) {
    setDropPending(false)
    dropUnbookable(fitSet)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await getAvailability(product.product_id, fromIso, toIso, inviteToken)
        if (!cancelled) setSlots(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [product.product_id, fromIso, toIso, inviteToken])

  // Propagate live day selection up to App.tsx so PriceSidebar can show
  // a live price estimate before the user presses Continue (landr-w7pi).
  useEffect(() => {
    onLiveDaysChange?.(selectedDays.map(isoDate))
  }, [selectedDays, onLiveDaysChange])

  if (error) {
    return (
      <Card>
        <StepBackButton onBack={onBack} />
        <CardHeader>
          <CardTitle>{tr('couldNotLoadAvailability', locale)}</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!editing && originalDays) {
    const host = originalDaysLabel ?? 'the host'
    const blocked = unavailableOriginalDays.length
    return (
      <Card data-testid="invite-dates-summary">
        <StepBackButton onBack={onBack} />
        <CardHeader>
          <CardTitle>{tr('yourDates', locale)}</CardTitle>
          <CardDescription>
            {sameDaysAsHostForLabel(host, product.name, locale)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <DayChips dates={originalDays} />
          {blocked > 0 ? (
            <p
              className="text-sm text-destructive"
              data-testid="invite-dates-unavailable"
            >
              {hostDaysUnavailableMessage(blocked, host, locale)}
            </p>
          ) : null}
          {blocked === 0 && shortOriginalDays.length > 0 ? (
            <p
              className="text-sm text-destructive"
              data-testid="invite-dates-short"
            >
              {seatsShortDaysMessage(
                shortOriginalDays.map((d) => ({
                  label: formatDayLabel(d.date, locale),
                  left: d.left,
                  need: d.need,
                })),
                locale,
              )}
            </p>
          ) : null}
          <div className="flex flex-wrap items-start justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={startEditing}
            >
              {tr('changeDates', locale)}
            </Button>
            <ContinueAction
              ready={slots !== null && blocked === 0 && shortOriginalDays.length === 0}
              reason={
                slots === null
                  ? tr('loadingAvailabilityEllipsis', locale)
                  : blocked > 0 || shortOriginalDays.length > 0
                    ? tr('changeYourDatesToContinue', locale)
                    : tr('readyToContinueWithHostsDates', locale)
              }
              reasonId="multi-day-step-invite-gate"
              onContinue={() => onConfirm([...originalDays].sort())}
              label={tr('continueWithTheseDates', locale)}
              data-testid="multi-day-step-invite-submit"
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>{tr('pickYourDates', locale)}</CardTitle>
        <CardDescription>{availableDaysForLabel(product.name, locale)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {stepperShown ? (
          <PartySizeStepper
            value={partySize}
            max={partySizeMax}
            onChange={changePartySize}
            decreaseRef={decreaseRef}
          />
        ) : null}
        {fitCount !== null ? (
          <SeatFitNotice
            need={need}
            fitCount={fitCount}
            rangeLabel={windowRangeLabel(fromIso, toIso, locale)}
            onFewer={stepperShown ? () => decreaseRef.current?.focus() : undefined}
            operatorToken={operatorToken}
            productSlug={product.slug}
            productName={product.name}
            contactEmail={contactEmail}
          />
        ) : null}
        {/* landr-80ubl.2: one-next-action rule — the picker owns the ring
            until at least one day is picked, then ContinueAction (active by
            default) takes over. */}
        <NextAction active={selectedDays.length === 0} cue={tr('multiDayPickerCue', locale)}>
          <MultiDayPicker
            // initialDroppedCount is read once on mount; a late drop (availability
            // arrived after "Change dates") remounts so the notice shows.
            key={droppedOnEdit ?? 0}
            availability={slots ?? EMPTY_SLOTS}
            value={selectedDays}
            onChange={setSelectedDays}
            onForcedDaysChange={(days, reasons) => {
              setForcedDays(days)
              setForcedReasons(reasons)
            }}
            helpText={undefined}
            isContiguous={product.is_contiguous}
            hotelOffering={product.hotel_offering}
            originalValue={originalDays?.map(dateFromIso)}
            originalValueLabel={originalDaysLabel}
            initialDroppedCount={droppedOnEdit}
            seatsNeeded={need}
            operatorTimezone={operatorTimezone}
          />
          {selectedDays.length > 0 ? (
            // landr-3mo4: selection count surfaced as a tinted chip (committed
            // state), not muted helper text.
            <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-foreground">
              {daysSelectedLabel(selectedDays.length, locale)}
            </p>
          ) : null}
        </NextAction>
        <ContinueAction
          ready={
            selectedDays.length > 0 &&
            blockedSelectedDays.length === 0 &&
            shortSelectedDays.length === 0
          }
          reason={
            blockedSelectedDays.length > 0
              ? dayNoLongerAvailableReason(
                  formatDayLabel(blockedSelectedDays[0], locale),
                  locale,
                )
              : shortSelectedDays.length > 0
                ? seatsShortDaysMessage(
                    shortSelectedDays.map((d) => ({
                      label: formatDayLabel(d.date, locale),
                      left: d.left,
                      need: d.need,
                    })),
                    locale,
                  )
                : multiDayGate(selectedDays.length, locale)
          }
          reasonId="multi-day-step-gate"
          onContinue={() =>
            onConfirm(
              selectedDays.map(isoDate),
              forcedDays,
              forcedDays.length > 0 ? forcedReasons : undefined,
            )
          }
          data-testid="multi-day-step-submit"
        />
      </CardContent>
    </Card>
  )
}
