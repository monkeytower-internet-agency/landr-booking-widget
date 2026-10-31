import { useEffect, useMemo, useState } from 'react'
import { getAvailability } from '@/api/client'
import type { AvailabilitySlot, Product } from '@/api/types'
import { Calendar } from '@/components/ui/calendar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StepBackButton } from '@/components/booking/StepBackButton'
import { NextAction } from '@/components/booking/NextAction'
import { ContinueAction } from '@/components/booking/ContinueAction'
import { dateFromIso, isoDate } from '@/components/booking/dateUtils'
import { formatDayLabel } from '@/components/booking/dateLabel'
import {
  availabilityWindow,
  startOfToday,
  useStartMonth,
} from '@/components/booking/calendarStart'
import {
  freeStayNights,
  initialStayRange,
  stayRangeAfterClick,
  stayRangeViolations,
  type StayRange,
} from '@/components/booking/stayRange'
import { nightsBetween } from '@/components/booking/accommodationCalc'
import { useReportLoaded } from '@/lib/bootSplash'
import { browserLocale } from '@/lib/locale'
import {
  fmt,
  stayMinNightsLabel,
  staySpanLabel,
  stayViolationMessage,
  tr,
} from '@/lib/strings'

interface Props {
  product: Product
  /** Absent → no Back affordance. */
  onBack?: () => void
  /** Commits the stay's NIGHT LIST (check-in inclusive, check-out exclusive). */
  onConfirm: (nights: string[]) => void
  /** Live night list for the price sidebar ([] while the range is incomplete or invalid). */
  onLiveDaysChange?: (nights: string[]) => void
  /** Previously committed night list (Back navigation). */
  initialSelectedDays?: string[]
  onLoaded?: () => void
  /** The operator's IANA timezone: "today" is the operator's day. */
  operatorTimezone?: string | null
  /** Availability source; defaults to the public API (tests inject a stub). */
  loadAvailability?: typeof getAvailability
}

const EMPTY_SLOTS: AvailabilitySlot[] = []

/**
 * Check-in / check-out picker for a standalone stay (product_kind 'stay').
 *
 * The availability endpoint returns one row per NIGHT for a stay. A night is
 * free when it is not closed (past or blocked by the owner), its lead time
 * still holds and at least one unit is left. A check-in must fall on a free
 * night; a check-out only needs the night BEFORE it to be free, so a guest can
 * leave on the morning another one arrives. The range is judged with the same
 * rules as the API (checkStayRange) before Continue turns on.
 */
export function StayRangePicker({
  product,
  onBack,
  onConfirm,
  onLiveDaysChange,
  initialSelectedDays,
  onLoaded,
  operatorTimezone,
  loadAvailability = getAvailability,
}: Props) {
  const locale = browserLocale()
  const stay = product.stay ?? null
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useReportLoaded(slots !== null || error !== null, onLoaded)
  const [range, setRange] = useState<StayRange>(() => initialStayRange(initialSelectedDays))

  const { fromIso, toIso, today } = useMemo(() => {
    const from = startOfToday(operatorTimezone)
    return { ...availabilityWindow(from), today: from }
  }, [operatorTimezone])
  const todayIso = isoDate(today)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await loadAvailability(product.product_id, fromIso, toIso)
        if (!cancelled) setSlots(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [product.product_id, fromIso, toIso, loadAvailability])

  const nights = useMemo(() => freeStayNights(slots ?? EMPTY_SLOTS), [slots])
  const [month, setMonth] = useStartMonth(
    range.checkIn ? [range.checkIn] : [],
    nights.free,
    undefined,
    operatorTimezone,
  )

  const violations = useMemo(
    () =>
      range.checkIn && range.checkOut && slots !== null
        ? stayRangeViolations(range, stay, nights, todayIso)
        : [],
    [range, stay, nights, slots, todayIso],
  )
  const complete = range.checkIn !== null && range.checkOut !== null
  const valid = complete && slots !== null && violations.length === 0

  const select = (day: Date | undefined) => {
    if (!day) return
    const next = stayRangeAfterClick(range, isoDate(day))
    setRange(next)
    const ok =
      next.checkIn !== null &&
      next.checkOut !== null &&
      stayRangeViolations(next, stay, nights, todayIso).length === 0
    onLiveDaysChange?.(ok ? nightsBetween(next.checkIn!, next.checkOut!) : [])
  }

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

  const prevIso = (iso: string) => {
    const d = dateFromIso(iso)
    d.setDate(d.getDate() - 1)
    return isoDate(d)
  }

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>{tr('stayPickerTitle', locale)}</CardTitle>
        {stay && stay.check_in_time && stay.check_out_time ? (
          <CardDescription data-testid="stay-picker-times">
            {fmt(tr('stayTimesTemplate', locale), {
              checkIn: stay.check_in_time,
              checkOut: stay.check_out_time,
            })}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {stay && (stay.min_nights ?? 1) > 1 ? (
          <p className="text-xs text-muted-foreground" data-testid="stay-picker-min-nights">
            {stayMinNightsLabel(stay.min_nights ?? 1, locale)}
          </p>
        ) : null}
        <NextAction active={!complete} cue={tr('stayPickerCue', locale)}>
          <Calendar
            today={startOfToday(operatorTimezone)}
            mode="range"
            selected={{
              from: range.checkIn ? dateFromIso(range.checkIn) : undefined,
              to: range.checkOut ? dateFromIso(range.checkOut) : undefined,
            }}
            onSelect={(_range, trigger) => select(trigger)}
            disabled={(date) => {
              const iso = isoDate(date)
              if (iso < todayIso) return true
              // Selectable as a check-in (a free night) or as a check-out
              // (the night before it is free).
              return !nights.free.has(iso) && !nights.free.has(prevIso(iso))
            }}
            month={month}
            onMonthChange={setMonth}
          />
          {complete ? (
            <p
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-foreground"
              data-testid="stay-picker-selected"
            >
              {staySpanLabel(
                formatDayLabel(range.checkIn!, locale),
                formatDayLabel(range.checkOut!, locale),
                nightsBetween(range.checkIn!, range.checkOut!).length,
                locale,
              )}
            </p>
          ) : null}
          {violations.length > 0 ? (
            <ul className="space-y-1 text-sm text-destructive" data-testid="stay-picker-errors">
              {violations.map((v, idx) => (
                <li key={`${v.code}-${idx}`}>
                  {stayViolationMessage(
                    v.code,
                    v.date ? formatDayLabel(v.date, locale) : undefined,
                    locale,
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </NextAction>
        <ContinueAction
          ready={valid}
          reason={
            valid
              ? tr('readyToContinue', locale)
              : range.checkIn && !range.checkOut
                ? tr('stayGateCheckOut', locale)
                : tr('stayGateEmpty', locale)
          }
          reasonId="stay-picker-gate"
          onContinue={() => {
            if (valid) onConfirm(nightsBetween(range.checkIn!, range.checkOut!))
          }}
          data-testid="stay-picker-submit"
        />
      </CardContent>
    </Card>
  )
}
