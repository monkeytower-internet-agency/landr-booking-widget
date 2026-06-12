import { useEffect, useMemo, useState } from 'react'
import { getAvailability } from '@/api/client'
import type { AvailabilitySlot, Product } from '@/api/types'
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

interface Props {
  product: Product
  onBack: () => void
  /**
   * landr-aoak.2: `forcedDays` carries the subset of selectedDays the operator
   * force-booked past zero availability (staff mode only; empty otherwise).
   */
  onConfirm: (selectedDays: string[], forcedDays?: string[]) => void
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
}

const HORIZON_DAYS = 60

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
}: Props) {
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedDays, setSelectedDays] = useState<Date[]>(() =>
    (initialSelectedDays ?? []).map(dateFromIso),
  )
  // landr-aoak.2: force-booked (zero-availability) ISO days inside the current
  // selection. Always [] in the normal customer path.
  const [forcedDays, setForcedDays] = useState<string[]>([])

  const { fromIso, toIso } = useMemo(() => {
    const from = new Date()
    const to = new Date()
    to.setDate(to.getDate() + HORIZON_DAYS)
    return { fromIso: isoDate(from), toIso: isoDate(to) }
  }, [])

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

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>Pick your dates</CardTitle>
        <CardDescription>
          Showing the next {HORIZON_DAYS} days for {product.name}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <MultiDayPicker
          availability={slots ?? EMPTY_SLOTS}
          value={selectedDays}
          onChange={setSelectedDays}
          onForcedDaysChange={setForcedDays}
          helpText={undefined}
          defaultMonth={new Date()}
          isContiguous={product.is_contiguous}
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
            onClick={() => onConfirm(selectedDays.map(isoDate), forcedDays)}
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
