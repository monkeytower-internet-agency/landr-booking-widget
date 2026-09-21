import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, Check } from 'lucide-react'
import { getFixedDateWindows, getStaffFixedDateWindows } from '@/api/client'
import type { AvailabilitySlot, FixedDateWindow, Product } from '@/api/types'
import { forceReasonsFor } from '@/components/booking/bookability'
import { fixedDateWindowGate, tr, type ForceReason } from '@/lib/strings'
import { expandWindowDays } from './expandWindowDays'
import { formatWindowRangeLabel } from './dateLabel'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StepBackButton } from '@/components/booking/StepBackButton'
import { useVariant } from '@/lib/variant'
import { useStaffMode } from '@/lib/staffMode'
import { OperatorOverrideBadge } from '@/components/booking/OperatorOverrideBadge'
import { cn } from '@/lib/utils'
import { NextAction } from '@/components/booking/NextAction'
import { ContinueAction } from '@/components/booking/ContinueAction'

interface Props {
  product: Product
  onBack: () => void
  /**
   * The widget pipeline downstream of this picker (BookingForm + pickup) only
   * knows AvailabilitySlot. We synthesise a slot from the picked window where
   * `date` = start_date and capacity figures mirror the window. The booking
   * submit path then expands selected_days across the full window range.
   * landr-aoak.2: `forced` is true when the operator (staff mode) selected a
   * blocked window via the override path (false / undefined otherwise).
   * landr-t869m.5: `forcedReasons` names WHICH gate(s) were bypassed
   * (capacity and/or lead time) — empty/undefined whenever `forced` is
   * false/undefined.
   */
  onConfirm: (
    slot: AvailabilitySlot,
    window: FixedDateWindow,
    forced?: boolean,
    forcedReasons?: ForceReason[],
  ) => void
  /** Operator's expose_seats_to_customer flag (landr-e10.9). When false the
   * picker hides exact seat counts and just shows Available / Full. */
  exposeSeats?: boolean
  /**
   * Called when the user selects a window so App.tsx can feed the live
   * expanded days into PriceSidebar before Continue is pressed (landr-w7pi).
   */
  onLiveDaysChange?: (isoDays: string[]) => void
  /**
   * landr (breadcrumb): id of the previously-picked window, restored when the
   * customer navigates BACK so the prior window is pre-selected (the committed
   * BookingSelection carries it as slot.availability_id). Undefined on the
   * first visit.
   */
  initialWindowId?: string
}

function windowToSlot(window: FixedDateWindow): AvailabilitySlot {
  const available = Math.max(0, window.capacity - window.capacity_reserved)
  return {
    availability_id: window.id,
    date: window.start_date,
    start_time: null,
    end_time: null,
    capacity: window.capacity,
    capacity_reserved: window.capacity_reserved,
    available_seats: available,
    status: available > 0 ? 'open' : 'fully_booked',
  }
}

export function FixedDateWindowPicker({
  product,
  onBack,
  onConfirm,
  exposeSeats = true,
  onLiveDaysChange,
  initialWindowId,
}: Props) {
  const { tokens } = useVariant()
  const staff = useStaffMode()
  // landr-aoak.2: force-book a FULL window only when staff mode is active AND
  // the session carries the force_book power. Otherwise normal behaviour.
  const canForce = staff.active && staff.powers.includes('force_book')
  const [windows, setWindows] = useState<FixedDateWindow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // landr (breadcrumb): seed from the restored window id on back-nav re-entry.
  const [selectedId, setSelectedId] = useState<string | null>(
    initialWindowId ?? null,
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // landr-r2o8: in staff mode with the force_book power AND a resolved
        // operatorId, fetch via the staff-session-gated endpoint so a FULL /
        // overbooked window is actually returned (the public RPC hides it
        // unconditionally — see getStaffFixedDateWindows). Any other case
        // (no session, missing power, undecodable operatorId/token) falls
        // back to the normal public call — byte-identical to today.
        const data =
          canForce && staff.operatorId && staff.token
            ? await getStaffFixedDateWindows(
                staff.operatorId,
                product.product_id,
                staff.token,
              )
            : await getFixedDateWindows(product.product_id)
        if (!cancelled) setWindows(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [product.product_id, canForce, staff.operatorId, staff.token])

  const selectedWindow = useMemo(
    () => windows?.find((w) => w.id === selectedId) ?? null,
    [windows, selectedId],
  )

  // landr (breadcrumb): once the windows load, surface a restored selection in
  // the live sidebar so the price preview reflects the prior pick immediately.
  useEffect(() => {
    if (selectedWindow) onLiveDaysChange?.(expandWindowDays(selectedWindow))
    // Fire only when the resolved window changes (i.e. the restore resolves).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWindow])

  // landr-t869m.5: which gate(s) the picked window bypasses, if any — empty
  // when the window is normally bookable. Non-empty drives the forced
  // submit flag identically regardless of WHICH gate(s) it names; the
  // review-step banner is what actually reads the reasons (see
  // forceBookReasonMessage in @/lib/strings).
  const selectedForceReasons = useMemo(() => {
    if (!selectedWindow) return []
    const available =
      selectedWindow.capacity - selectedWindow.capacity_reserved > 0
    return forceReasonsFor(available, selectedWindow, product.hotel_offering)
  }, [selectedWindow, product.hotel_offering])

  if (error) {
    return (
      <Card>
        <StepBackButton onBack={onBack} />
        <CardHeader>
          <CardTitle>Could not load course windows.</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>Pick a course window</CardTitle>
        <CardDescription>
          Upcoming {product.name} windows. Pick one to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* landr-80ubl.2: one-next-action rule — the window list owns the
            ring until one is picked, then ContinueAction (active by
            default) takes over. */}
        <NextAction active={!selectedWindow} cue={tr('fixedDateWindowCue')}>
        {windows === null ? (
          <p className="text-sm text-muted-foreground">Loading windows…</p>
        ) : windows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No upcoming windows for this course. Please check back later.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {windows.map((window) => {
              const available = Math.max(
                0,
                window.capacity - window.capacity_reserved,
              )
              const isFull = available === 0
              // landr-t869m.5: which gate(s) does this window fail, if any?
              // Reuses the SAME forceReasonsFor()/isDayBookable() rule the
              // day pickers gate on — see bookability.ts's doc for the
              // optional/mandatory split and the fail-open contract. Never
              // silently dropped: unlike a fully sold-out window it stays in
              // the list, just shown as unavailable with its own reason so
              // the customer can see the trip exists.
              const windowReasons = forceReasonsFor(
                !isFull,
                window,
                product.hotel_offering,
              )
              const leadTimeBlocked =
                windowReasons.includes('lead_time') ||
                windowReasons.includes('accommodation_lead_time')
              const blocked = windowReasons.length > 0
              const isSelected = selectedId === window.id
              return (
                <li key={window.id}>
                  {/* landr-3mo4: window rows are now proper OPTION-CARDS —
                      a leading calendar-range icon in a tinted tile, the date
                      range as the label, a borderless seat-state chip, and a
                      brand-tinted selected state with a check. The card is a
                      raised surface that lifts off the step card; selection
                      adds the shared brand well + ring. ≥44px tap target. */}
                  <button
                    type="button"
                    // landr-aoak.2/t869m.5: a blocked window (full OR
                    // lead-time) stays clickable in staff mode (operator
                    // override — the staff submit's own 422 + force_book
                    // handles it). Normal customers keep disabled={blocked}.
                    disabled={blocked && !canForce}
                    onClick={() => {
                      // Confirm the operator-override intent for a blocked
                      // window. NB: `window` here is the FixedDateWindow loop
                      // variable, so reach the browser dialog via globalThis.confirm.
                      if (blocked && canForce) {
                        if (
                          !globalThis.confirm(
                            'Force-book this full / blocked course window on behalf of the customer?',
                          )
                        ) {
                          return
                        }
                      }
                      setSelectedId(window.id)
                      onLiveDaysChange?.(expandWindowDays(window))
                    }}
                    aria-pressed={isSelected}
                    className={cn(
                      'tap-44 flex w-full items-center gap-3 border p-3 text-left transition-[background-color,border-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-60',
                      tokens.optionCardRadius,
                      tokens.focusRing,
                      isSelected
                        ? tokens.optionSelected
                        : cn(
                            'border-border bg-surface-raised hover:border-primary/40',
                            !blocked && tokens.optionCardShadow,
                          ),
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-lg',
                        isSelected
                          ? 'bg-primary/15 text-foreground'
                          : 'bg-surface-well text-muted-foreground',
                      )}
                      aria-hidden
                    >
                      {isSelected ? (
                        <Check className="size-4" />
                      ) : (
                        <CalendarRange className="size-4" />
                      )}
                    </span>
                    <span className="flex flex-1 items-center justify-between gap-3">
                      <span className="font-medium tabular-nums">
                        {formatWindowRangeLabel(window.start_date, window.end_date)}
                      </span>
                      {blocked && canForce ? (
                        // landr-aoak.2/t869m.5: a blocked window in staff mode
                        // shows the operator-override badge instead of a dead
                        // "Full"/"Too late" chip.
                        <OperatorOverrideBadge />
                      ) : (
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            blocked
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
                          )}
                        >
                          {isFull
                            ? 'Full'
                            : leadTimeBlocked
                              ? 'Too late to book'
                              : exposeSeats
                                ? `${available} seat${available === 1 ? '' : 's'} left`
                                : 'Available'}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        </NextAction>

        <ContinueAction
          ready={!!selectedWindow}
          reason={fixedDateWindowGate(!!selectedWindow)}
          reasonId="fixed-date-window-picker-gate"
          onContinue={() => {
            if (selectedWindow) {
              onConfirm(
                windowToSlot(selectedWindow),
                selectedWindow,
                selectedForceReasons.length > 0,
                selectedForceReasons.length > 0 ? selectedForceReasons : undefined,
              )
            }
          }}
          data-testid="fixed-date-window-picker-submit"
        />
      </CardContent>
    </Card>
  )
}

