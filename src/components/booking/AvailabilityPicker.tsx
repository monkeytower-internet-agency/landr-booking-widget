import { useEffect, useMemo, useState } from 'react'
import { getAvailability } from '@/api/client'
import type { AvailabilitySlot, Product } from '@/api/types'
import { isDayBookable } from '@/components/booking/bookability'
import { slotKey } from '@/components/booking/slotKey'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { StepBackButton } from '@/components/booking/StepBackButton'
import { dateFromIso, isoDate } from '@/components/booking/dateUtils'
import {
  availabilityWindow,
  useNothingBeforeNotice,
  useStartMonth,
} from '@/components/booking/calendarStart'
import { availabilityGate, availableDaysForLabel, tr } from '@/lib/strings'
import { browserLocale } from '@/lib/locale'
import { NextAction } from '@/components/booking/NextAction'
import { ContinueAction } from '@/components/booking/ContinueAction'

interface Props {
  product: Product
  /** Absent → no Back affordance (landr-6eita.1: start=dates entry). */
  onBack?: () => void
  onConfirm: (slot: AvailabilitySlot) => void
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
}

export function AvailabilityPicker({
  product,
  onBack,
  onConfirm,
  exposeSeatsToCustomer = false,
  initialSlot,
}: Props) {
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
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
        const data = await getAvailability(product.product_id, fromIso, toIso)
        if (!cancelled) setSlots(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [product.product_id, fromIso, toIso])

  const availableDates = useMemo(() => {
    if (!slots) return new Set<string>()
    return new Set(
      slots
        .filter(
          (s) => s.available_seats > 0 && isDayBookable(s, product.hotel_offering),
        )
        .map((s) => s.date),
    )
  }, [slots, product.hotel_offering])

  // landr-l38a4: open on the restored pick, else the first bookable day.
  const [month, setMonth] = useStartMonth(
    selectedDate ? [isoDate(selectedDate)] : [],
    availableDates,
  )
  const nothingBefore = useNothingBeforeNotice(availableDates)

  const slotsForSelectedDate = useMemo(() => {
    if (!slots || !selectedDate) return []
    const key = isoDate(selectedDate)
    return slots.filter(
      (s) =>
        s.date === key &&
        s.available_seats > 0 &&
        isDayBookable(s, product.hotel_offering),
    )
  }, [slots, selectedDate, product.hotel_offering])

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
        {/* landr-80ubl.2: one-next-action rule — three stages in sequence
            (date, then time, then Continue). Each NextAction is active only
            for its own stage; ContinueAction (active by default) takes over
            once a time is picked. */}
        <NextAction active={!selectedDate} cue={tr('availabilityDateCue', locale)}>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date)
              setSelectedSlotId(null)
            }}
            disabled={(date) => !availableDates.has(isoDate(date))}
            month={month}
            onMonthChange={setMonth}
          />
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
            <p className="text-sm font-medium">Times on {isoDate(selectedDate)}</p>
            {slotsForSelectedDate.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tr('noTimesAvailable', locale)}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slotsForSelectedDate.map((slot) => (
                  <Button
                    key={slotKey(slot)}
                    type="button"
                    variant={selectedSlotId === slotKey(slot) ? 'default' : 'outline'}
                    onClick={() => setSelectedSlotId(slotKey(slot))}
                  >
                    {slot.start_time?.slice(0, 5) ?? tr('anyTime', locale)}
                    {exposeSeatsToCustomer ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {slot.available_seats} seats
                      </span>
                    ) : null}
                  </Button>
                ))}
              </div>
            )}
          </NextAction>
        ) : null}
        <ContinueAction
          ready={!!selectedSlotId}
          reason={availabilityGate(!!selectedDate, !!selectedSlotId, locale)}
          reasonId="availability-picker-gate"
          onContinue={() => {
            const slot = slotsForSelectedDate.find(
              (s) => slotKey(s) === selectedSlotId,
            )
            if (slot) onConfirm(slot)
          }}
          data-testid="availability-picker-submit"
        />
      </CardContent>
    </Card>
  )
}
