import { useEffect, useMemo, useState } from 'react'
import { getAvailability } from '@/api/client'
import type { AvailabilitySlot, Product } from '@/api/types'
import type { ForceReason } from '@/lib/strings'
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
import { availabilityWindow } from '@/components/booking/calendarStart'

interface Props {
  product: Product
  onBack: () => void
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
}: Props) {
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedDays, setSelectedDays] = useState<Date[]>(() =>
    (initialSelectedDays ?? []).map(dateFromIso),
  )
  // landr-aoak.2: force-booked (zero-availability) ISO days inside the current
  // selection. Always [] in the normal customer path.
  const [forcedDays, setForcedDays] = useState<string[]>([])
  // landr-t869m.5: which gate(s) that forced subset bypassed. Always []
  // alongside an empty forcedDays.
  const [forcedReasons, setForcedReasons] = useState<ForceReason[]>([])

  const { fromIso, toIso } = useMemo(() => availabilityWindow(), [])

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
  const unavailableOriginalDays = useMemo(() => {
    if (!originalDays || slots === null) return []
    const bookable = new Set(
      slots
        .filter(
          (s) => s.available_seats > 0 && isDayBookable(s, product.hotel_offering),
        )
        .map((s) => s.date),
    )
    return originalDays.filter((iso) => !bookable.has(iso))
  }, [originalDays, slots, product.hotel_offering])

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
          <CardTitle>Could not load availability.</CardTitle>
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
          <CardTitle>Your dates</CardTitle>
          <CardDescription>
            The same days as {host} for {product.name}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <DayChips dates={originalDays} />
          {blocked > 0 ? (
            <p
              className="text-sm text-destructive"
              data-testid="invite-dates-unavailable"
            >
              {blocked === 1
                ? `1 of ${host}'s days is no longer available — change your dates to continue.`
                : `${blocked} of ${host}'s days are no longer available — change your dates to continue.`}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              Change dates
            </Button>
            <Button
              type="button"
              disabled={slots === null || blocked > 0}
              onClick={() => onConfirm([...originalDays].sort())}
            >
              Continue with these dates
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>Pick your dates</CardTitle>
        <CardDescription>Available days for {product.name}.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <MultiDayPicker
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
        />
        {selectedDays.length > 0 ? (
          // landr-3mo4: selection count surfaced as a tinted chip (committed
          // state), not muted helper text.
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-foreground">
            {selectedDays.length === 1
              ? `1 day selected`
              : `${selectedDays.length} days selected`}
          </p>
        ) : null}
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            disabled={selectedDays.length === 0}
            onClick={() =>
              onConfirm(
                selectedDays.map(isoDate),
                forcedDays,
                forcedDays.length > 0 ? forcedReasons : undefined,
              )
            }
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
