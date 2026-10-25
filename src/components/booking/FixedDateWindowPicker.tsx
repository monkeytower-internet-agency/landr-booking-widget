import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, Check } from 'lucide-react'
import { ProductSkeleton } from '@/components/booking/browse/ProductSkeleton'
import { getFixedDateWindows, getStaffFixedDateWindows } from '@/api/client'
import type { AvailabilitySlot, FixedDateWindow, Product } from '@/api/types'
import { forceReasonsFor } from '@/components/booking/bookability'
import {
  fixedDateWindowGate,
  seatsLeftLabel,
  slotSeatsShortLabel,
  tr,
  upcomingWindowsForLabel,
  type ForceReason,
} from '@/lib/strings'
import { PartySizeStepper, SeatFitNotice } from '@/components/booking/PartySize'
import { usePartySize } from '@/lib/usePartySize'
import { browserLocale } from '@/lib/locale'
import { expandWindowDays } from './expandWindowDays'
import { dateFromIso } from '@/components/booking/dateUtils'
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
import { useReportLoaded } from '@/lib/bootSplash'
import {
  AlternativesSection,
  type AlternativeSelectHandler,
} from '@/components/booking/AlternativesPanel'

interface Props {
  product: Product
  /** Absent → no Back affordance (landr-6eita.1: start=dates entry). */
  onBack?: () => void
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
  /**
   * landr-tkgx8.1: called once the initial fetch settles (data or error), so
   * the boot splash can stay up until this step has something to show.
   */
  onLoaded?: () => void
  /**
   * landr-rmcsu.7: seats the group needs (known from the draft). A window
   * with fewer free seats is disabled and marked "Only n left" — distinct
   * from "Full". Absent/1 → the old "any seat" rule. Staff `canForce` still
   * picks it (capacity force).
   */
  seatsNeeded?: number
  /** landr-rmcsu.7: show the "How many of you?" stepper (see MultiDayStep). */
  showPartySizeStepper?: boolean
  onPartySizeChange?: (partySize: number) => void
  /** landr-rmcsu.7: widget token + contact email for the group-inquiry exit. */
  operatorToken?: string
  contactEmail?: string | null
  /**
   * Tapping a row of the "Also available" panel. A wiring point: the product
   * switch hooks in here; without a handler a tap does nothing.
   */
  onSelectAlternative?: AlternativeSelectHandler
}

function sortWindows(list: FixedDateWindow[]): FixedDateWindow[] {
  return [...list].sort(
    (a, b) =>
      a.start_date.localeCompare(b.start_date) ||
      (a.label ?? '').localeCompare(b.label ?? '') ||
      a.end_date.localeCompare(b.end_date),
  )
}

/**
 * landr-my6fc.11: the name shown on a card. The operator's label when set;
 * otherwise, when several unlabeled windows have identical dates, a
 * "Course n" fallback by list order so the customer can still tell them
 * apart. A lone unlabeled window shows no name.
 */
function windowDisplayName(
  list: FixedDateWindow[],
  window: FixedDateWindow,
  locale: string,
): string | null {
  const label = window.label?.trim()
  if (label) return label
  const twins = list.filter(
    (w) =>
      !w.label?.trim() &&
      w.start_date === window.start_date &&
      w.end_date === window.end_date,
  )
  if (twins.length < 2) return null
  return tr('courseFallbackName', locale).replace(
    '{n}',
    String(twins.findIndex((w) => w.id === window.id) + 1),
  )
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
  onLoaded,
  seatsNeeded,
  showPartySizeStepper = false,
  onPartySizeChange,
  operatorToken,
  contactEmail,
  onSelectAlternative,
}: Props) {
  const { tokens } = useVariant()
  const party = usePartySize(
    product.max_party_size,
    seatsNeeded,
    showPartySizeStepper,
    onPartySizeChange,
  )
  const need = party.need
  const staff = useStaffMode()
  const locale = browserLocale()
  // landr-aoak.2: force-book a FULL window only when staff mode is active AND
  // the session carries the force_book power. Otherwise normal behaviour.
  const canForce = staff.active && staff.powers.includes('force_book')
  const [windows, setWindows] = useState<FixedDateWindow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useReportLoaded(windows !== null || error !== null, onLoaded)
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
        // landr-my6fc.5: windows may overlap (distinct start dates) — list them
        // in a stable chronological order so chained courses read naturally.
        if (!cancelled) setWindows(sortWindows(data))
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
  // The month whose courses the "Also available" panel lists: the picked
  // window's start month, else the earliest window's (there is no calendar).
  const alternativesMonth = useMemo(() => {
    const iso =
      selectedWindow?.start_date ??
      (windows ?? []).map((w) => w.start_date).sort()[0]
    return iso ? dateFromIso(iso) : new Date()
  }, [selectedWindow, windows])

  // landr (breadcrumb): once the windows load, surface a restored selection in
  // the live sidebar so the price preview reflects the prior pick immediately.
  useEffect(() => {
    if (selectedWindow) onLiveDaysChange?.(expandWindowDays(selectedWindow))
    // Fire only when the resolved window changes (i.e. the restore resolves).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire when the resolved window changes; onLiveDaysChange is a parent callback with unstable identity
  }, [selectedWindow])

  // landr-t869m.5: which gate(s) the picked window bypasses, if any — empty
  // when the window is normally bookable. Non-empty drives the forced
  // submit flag identically regardless of WHICH gate(s) it names; the
  // review-step banner is what actually reads the reasons (see
  // forceBookReasonMessage in @/lib/strings).
  const selectedForceReasons = useMemo(() => {
    if (!selectedWindow) return []
    // landr-rmcsu.7: "has room" = room for the WHOLE group.
    const hasRoom =
      selectedWindow.capacity - selectedWindow.capacity_reserved >= need
    return forceReasonsFor(hasRoom, selectedWindow, product.hotel_offering)
  }, [selectedWindow, product.hotel_offering, need])

  // landr-rmcsu.7: windows with room for the group (not full, not too late) —
  // for "n course dates fit 4 people" / the none-fit exits.
  const fitCount = useMemo(
    () =>
      (windows ?? []).filter(
        (w) =>
          w.capacity - w.capacity_reserved >= need &&
          forceReasonsFor(true, w, product.hotel_offering).length === 0,
      ).length,
    [windows, need, product.hotel_offering],
  )
  // A restored / previously picked window that stopped fitting (stepper
  // raised): it must not stay committable for a customer. Staff may force it.
  const selectedUnfit =
    !canForce && selectedWindow !== null && selectedForceReasons.length > 0

  if (error) {
    return (
      <Card>
        <StepBackButton onBack={onBack} />
        <CardHeader>
          <CardTitle>{tr('couldNotLoadCourseWindows', locale)}</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>{tr('pickACourseWindow', locale)}</CardTitle>
        <CardDescription>
          {upcomingWindowsForLabel(product.name, locale)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* landr-80ubl.2: one-next-action rule — the window list owns the
            ring until one is picked, then ContinueAction (active by
            default) takes over. */}
        {party.stepperShown ? (
          <PartySizeStepper
            value={party.value}
            max={party.max}
            onChange={party.change}
            decreaseRef={party.decreaseRef}
          />
        ) : null}
        {windows !== null && windows.length > 0 ? (
          <SeatFitNotice
            need={need}
            fitCount={fitCount}
            unit="windows"
            rangeLabel=""
            onFewer={
              party.stepperShown ? () => party.decreaseRef.current?.focus() : undefined
            }
            operatorToken={operatorToken}
            productSlug={product.slug}
            productName={product.name}
            contactEmail={contactEmail}
          />
        ) : null}
        <NextAction active={!selectedWindow} cue={tr('fixedDateWindowCue', locale)}>
        {windows === null ? (
          <ProductSkeleton view="list" count={3} label={tr('loadingWindows', locale)} />
        ) : windows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tr('noUpcomingWindows', locale)}
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {windows.map((window) => {
              const displayName = windowDisplayName(windows, window, locale)
              const available = Math.max(
                0,
                window.capacity - window.capacity_reserved,
              )
              const isFull = available === 0
              // landr-rmcsu.7: seats left, but fewer than the group needs.
              const isShort = !isFull && available < need
              // landr-t869m.5: which gate(s) does this window fail, if any?
              // Reuses the SAME forceReasonsFor()/isDayBookable() rule the
              // day pickers gate on — see bookability.ts's doc for the
              // optional/mandatory split and the fail-open contract. Never
              // silently dropped: unlike a fully sold-out window it stays in
              // the list, just shown as unavailable with its own reason so
              // the customer can see the trip exists.
              const windowReasons = forceReasonsFor(
                !isFull && !isShort,
                window,
                product.hotel_offering,
              )
              const leadTimeBlocked =
                windowReasons.includes('lead_time') ||
                windowReasons.includes('accommodation_lead_time')
              const blocked = windowReasons.length > 0
              const isSelected = selectedId === window.id && !selectedUnfit
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
                      <span className="flex flex-col">
                        {displayName ? (
                          <span
                            className="font-semibold"
                            data-testid={`fixed-date-window-name-${window.id}`}
                          >
                            {displayName}
                          </span>
                        ) : null}
                        <span className="font-medium tabular-nums">
                          {formatWindowRangeLabel(window.start_date, window.end_date, locale)}
                        </span>
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
                            ? tr('fullBadge', locale)
                            : leadTimeBlocked
                              ? tr('tooLateToBook', locale)
                              : isShort
                                ? slotSeatsShortLabel(available, need, exposeSeats, locale)
                                : exposeSeats
                                  ? seatsLeftLabel(available, locale)
                                  : tr('availableBadge', locale)}
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

        <AlternativesSection
          productId={product.product_id}
          party={need}
          selectedDays={selectedWindow ? expandWindowDays(selectedWindow) : []}
          month={alternativesMonth}
          onSelectAlternative={onSelectAlternative}
        />

        <ContinueAction
          ready={!!selectedWindow && !selectedUnfit}
          reason={fixedDateWindowGate(!!selectedWindow && !selectedUnfit, locale)}
          reasonId="fixed-date-window-picker-gate"
          onContinue={() => {
            if (selectedWindow && !selectedUnfit) {
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

