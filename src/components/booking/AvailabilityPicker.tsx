import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAvailability } from '@/api/client'
import type { AvailabilitySlot, Product } from '@/api/types'
import { forceReasonsFor, isDayBookable } from '@/components/booking/bookability'
import { OperatorOverrideBadge } from '@/components/booking/OperatorOverrideBadge'
import { useStaffMode } from '@/lib/staffMode'
import { hasFixedStartTimes, slotKey } from '@/components/booking/slotKey'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { CalendarDayHintContext } from '@/components/ui/calendarDayHints'
import { PartySizeStepper, SeatFitNotice, ShortDayLegend } from '@/components/booking/PartySize'
import { usePartySize } from '@/lib/usePartySize'
import { seatFit, windowRangeLabel } from '@/lib/seatHold'
import { StepBackButton } from '@/components/booking/StepBackButton'
import { dateFromIso, isoDate } from '@/components/booking/dateUtils'
import {
  availabilityWindow,
  useNothingBeforeNotice,
  useStartMonth,
} from '@/components/booking/calendarStart'
import {
  availabilityGate,
  availableDaysForLabel,
  seatsCountLabel,
  seatsLeftLabel,
  slotSeatsShortLabel,
  timesOnLabel,
  tr,
  type ForceReason,
} from '@/lib/strings'
import { browserLocale } from '@/lib/locale'
import { NextAction } from '@/components/booking/NextAction'
import { ContinueAction } from '@/components/booking/ContinueAction'
import { useReportLoaded } from '@/lib/bootSplash'

interface Props {
  product: Product
  /** landr-f987a.4: invite token — a live seat hold counts as available. */
  inviteToken?: string
  /** Absent → no Back affordance (landr-6eita.1: start=dates entry). */
  onBack?: () => void
  /**
   * landr-xtkae.2: in staff mode (force_book power) on a fixed-times product,
   * a full or lead-time-closed time can be picked on the customer's behalf —
   * `forced` is then true and `forcedReasons` names the gate(s) bypassed
   * (mirrors SingleDatePicker). Both are omitted on every normal pick, so the
   * customer path calls onConfirm(slot) with exactly one argument.
   */
  onConfirm: (
    slot: AvailabilitySlot,
    forced?: boolean,
    forcedReasons?: ForceReason[],
  ) => void
  /**
   * landr-e10.9: when false (default), hides the numeric remaining-seat
   * badge on each slot button. Operators opt in per-tenant via
   * operators.expose_seats_to_customer to use seats as an urgency lever.
   */
  exposeSeatsToCustomer?: boolean
  /**
   * landr (breadcrumb): the previously-committed slot, restored when the
   * customer navigates BACK so the prior date + time is pre-selected instead of
   * empty. Undefined on the first visit.
   */
  initialSlot?: AvailabilitySlot
  /**
   * landr-tkgx8.1: called once the initial fetch settles (data or error), so
   * the boot splash can stay up until this step has something to show.
   */
  onLoaded?: () => void
  /**
   * landr-rmcsu.7: seats the group needs (known from the draft). A time with
   * fewer free seats is disabled and marked "Only n left" — distinct from
   * "Full" — and a day whose every time is short is struck through in the
   * calendar. Absent/1 → the old "any seat" rule.
   */
  seatsNeeded?: number
  /** landr-rmcsu.7: show the "How many of you?" stepper (see MultiDayStep). */
  showPartySizeStepper?: boolean
  onPartySizeChange?: (partySize: number) => void
  /** landr-rmcsu.7: widget token + contact email for the group-inquiry exit. */
  operatorToken?: string
  contactEmail?: string | null
}

// Stable empty reference while availability loads (an unstable [] in a memo
// input once looped renders — see MultiDayStep's EMPTY_SLOTS).
const EMPTY_SLOTS: AvailabilitySlot[] = []

export function AvailabilityPicker({
  product,
  onBack,
  onConfirm,
  exposeSeatsToCustomer = false,
  initialSlot,
  onLoaded,
  inviteToken,
  seatsNeeded,
  showPartySizeStepper = false,
  onPartySizeChange,
  operatorToken,
  contactEmail,
}: Props) {
  const staff = useStaffMode()
  const party = usePartySize(
    product.max_party_size,
    seatsNeeded,
    showPartySizeStepper,
    onPartySizeChange,
  )
  const need = party.need
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useReportLoaded(slots !== null || error !== null, onLoaded)
  // landr (breadcrumb): seed date + slot from the restored selection.
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() =>
    initialSlot ? dateFromIso(initialSlot.date) : undefined,
  )
  // landr-k9pji.1: keyed by slotKey(), not availability_id — a synthesised
  // on-request day has availability_id === null.
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(
    initialSlot ? slotKey(initialSlot) : null,
  )
  const locale = browserLocale()

  const { fromIso, toIso } = useMemo(() => availabilityWindow(), [])

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

  // landr-xtkae.2: staff force-book (same rule as SingleDatePicker: staff mode
  // AND the force_book power). Offered only on fixed-times products, which were
  // routed here from SingleDatePicker — every other product keeps exactly the
  // behaviour it had in this picker before.
  const fixedTimes = hasFixedStartTimes(product)
  const canForce = fixedTimes && staff.active && staff.powers.includes('force_book')
  // landr-rmcsu.7: "pickable" = room for the WHOLE group (need 1 → any seat).
  const slotIsPickable = (s: AvailabilitySlot): boolean =>
    s.available_seats >= need && isDayBookable(s, product.hotel_offering)
  // Has seats, but fewer than the group — shown "Only n left", not "Full".
  const slotIsShort = (s: AvailabilitySlot): boolean =>
    need > 1 &&
    s.available_seats > 0 &&
    s.available_seats < need &&
    isDayBookable(s, product.hotel_offering)

  // Days with a time that takes the group, and days where every time is short.
  const { fit: fitDates, short: shortSeats } = useMemo(
    () => seatFit(slots ?? EMPTY_SLOTS, product.hotel_offering, need),
    [slots, product.hotel_offering, need],
  )
  const availableDates = useMemo(() => {
    if (!slots) return new Set<string>()
    // Staff can open any day that has times, even a full / closed one.
    return canForce ? new Set(slots.map((s) => s.date)) : fitDates
  }, [slots, canForce, fitDates])
  const shortDates = useMemo(
    () => Array.from(shortSeats.keys()).sort().map(dateFromIso),
    [shortSeats],
  )
  const dayHint = useCallback(
    (date: Date) => {
      const left = shortSeats.get(isoDate(date))
      return left === undefined || !exposeSeatsToCustomer
        ? undefined
        : seatsLeftLabel(left, locale)
    },
    [shortSeats, locale, exposeSeatsToCustomer],
  )

  // landr-l38a4: open on the restored pick, else the first bookable day.
  const [month, setMonth] = useStartMonth(
    selectedDate ? [isoDate(selectedDate)] : [],
    availableDates,
  )
  const nothingBefore = useNothingBeforeNotice(availableDates)

  // landr-xtkae.2: on a fixed-daily-times product the day's times are a menu
  // the operator published, so a FULL (or lead-time-closed) time stays visible
  // but disabled — hiding it would make "the 11:00 flight" vanish with no
  // explanation. Past slots never arrive (the API omits started slots).
  const slotsForSelectedDate = useMemo(() => {
    if (!slots || !selectedDate) return []
    const key = isoDate(selectedDate)
    return slots.filter(
      (s) =>
        s.date === key &&
        (fixedTimes ||
          (s.available_seats > 0 && isDayBookable(s, product.hotel_offering))),
    )
  }, [slots, selectedDate, product.hotel_offering, fixedTimes])

  // The slot Continue would commit — ONE lookup shared by `ready`, the gate
  // line and onContinue, so the button is never enabled while it would do
  // nothing (e.g. a restored time that has filled up meanwhile). Staff can
  // commit an unpickable time (force-book).
  const selectedSlot = useMemo(
    () =>
      slotsForSelectedDate.find(
        (s) => slotKey(s) === selectedSlotId && (canForce || slotIsPickable(s)),
      ),
    // slotIsPickable closes over product.hotel_offering only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slotsForSelectedDate, selectedSlotId, canForce, product.hotel_offering, need],
  )
  const selectedForceReasons: ForceReason[] =
    selectedSlot && canForce && !slotIsPickable(selectedSlot)
      ? forceReasonsFor(selectedSlot.available_seats >= need, selectedSlot, product.hotel_offering)
      : []

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

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>{tr('pickADate', locale)}</CardTitle>
        <CardDescription>{availableDaysForLabel(product.name, locale)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {party.stepperShown ? (
          <PartySizeStepper
            value={party.value}
            max={party.max}
            onChange={party.change}
            decreaseRef={party.decreaseRef}
          />
        ) : null}
        {slots !== null ? (
          <SeatFitNotice
            need={need}
            fitCount={fitDates.size}
            rangeLabel={windowRangeLabel(fromIso, toIso, locale)}
            onFewer={
              party.stepperShown ? () => party.decreaseRef.current?.focus() : undefined
            }
            operatorToken={operatorToken}
            productSlug={product.slug}
            productName={product.name}
            contactEmail={contactEmail}
          />
        ) : null}
        {/* landr-80ubl.2: one-next-action rule — three stages in sequence
            (date, then time, then Continue). Each NextAction is active only
            for its own stage; ContinueAction (active by default) takes over
            once a time is picked. */}
        <NextAction active={!selectedDate} cue={tr('availabilityDateCue', locale)}>
          {slots === null ? (
            <p
              role="status"
              className="text-muted-foreground animate-pulse text-center text-sm"
              data-testid="availability-loading"
            >
              {tr('loadingAvailabilityEllipsis', locale)}
            </p>
          ) : null}
          <CalendarDayHintContext.Provider value={dayHint}>
            <Calendar
              className={slots === null ? 'pointer-events-none opacity-40' : undefined}
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date)
                setSelectedSlotId(null)
              }}
              disabled={(date) => !availableDates.has(isoDate(date))}
              month={month}
              onMonthChange={setMonth}
              modifiers={{ short: shortDates }}
            />
          </CalendarDayHintContext.Provider>
          {shortSeats.size > 0 ? <ShortDayLegend /> : null}
          {nothingBefore ? (
            <p
              className="text-xs text-muted-foreground"
              data-testid="calendar-nothing-before"
            >
              {nothingBefore}
            </p>
          ) : null}
        </NextAction>
        {selectedDate ? (
          <NextAction active={!selectedSlotId} cue={tr('availabilityTimeCue', locale)}>
            <p className="text-sm font-medium">{timesOnLabel(isoDate(selectedDate), locale)}</p>
            {slotsForSelectedDate.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tr('noTimesAvailable', locale)}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slotsForSelectedDate.map((slot) => (
                  <Button
                    key={slotKey(slot)}
                    type="button"
                    // A pick that stopped fitting (stepper raised) no longer reads as chosen.
                    variant={
                      selectedSlot && slotKey(selectedSlot) === slotKey(slot)
                        ? 'default'
                        : 'outline'
                    }
                    // Staff keep full / closed times selectable (force-book).
                    disabled={!canForce && !slotIsPickable(slot)}
                    data-testid={fixedTimes ? 'start-time-option' : undefined}
                    onClick={() => {
                      if (
                        canForce &&
                        !slotIsPickable(slot) &&
                        !window.confirm(
                          'Force-book this full / blocked time on behalf of the customer?',
                        )
                      ) {
                        return
                      }
                      setSelectedSlotId(slotKey(slot))
                    }}
                  >
                    {slot.start_time?.slice(0, 5) ?? tr('anyTime', locale)}
                    {!slotIsPickable(slot) ? (
                      <span
                        className="ml-2 text-xs text-muted-foreground"
                        data-testid={slotIsShort(slot) ? 'slot-seats-short' : undefined}
                      >
                        {slotIsShort(slot)
                          ? slotSeatsShortLabel(
                              slot.available_seats,
                              need,
                              exposeSeatsToCustomer,
                              locale,
                            )
                          : slot.available_seats > 0
                            ? tr('tooLateToBook', locale)
                            : tr('fullBadge', locale)}
                      </span>
                    ) : exposeSeatsToCustomer ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {seatsCountLabel(slot.available_seats, locale)}
                      </span>
                    ) : null}
                  </Button>
                ))}
              </div>
            )}
          </NextAction>
        ) : null}
        {selectedForceReasons.length > 0 ? <OperatorOverrideBadge /> : null}
        <ContinueAction
          ready={!!selectedSlot}
          reason={availabilityGate(!!selectedDate, !!selectedSlot, locale)}
          reasonId="availability-picker-gate"
          onContinue={() => {
            if (!selectedSlot) return
            // Pass the force markers ONLY for a force-booked time, so the
            // normal path calls onConfirm(slot) with exactly one argument.
            if (selectedForceReasons.length > 0) {
              onConfirm(selectedSlot, true, selectedForceReasons)
            } else {
              onConfirm(selectedSlot)
            }
          }}
          data-testid="availability-picker-submit"
        />
      </CardContent>
    </Card>
  )
}
