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
import { Calendar } from '@/components/ui/calendar'
import { StepBackButton } from '@/components/booking/StepBackButton'

interface Props {
  product: Product
  onBack: () => void
  onConfirm: (slot: AvailabilitySlot) => void
  /**
   * landr-e10.9: when false (default), hides the numeric remaining-seat
   * badge on each slot button. Operators opt in per-tenant via
   * operators.expose_seats_to_customer to use seats as an urgency lever.
   */
  exposeSeatsToCustomer?: boolean
}

const HORIZON_DAYS = 60

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

export function AvailabilityPicker({
  product,
  onBack,
  onConfirm,
  exposeSeatsToCustomer = false,
}: Props) {
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)

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

  const availableDates = useMemo(() => {
    if (!slots) return new Set<string>()
    return new Set(slots.filter((s) => s.available_seats > 0).map((s) => s.date))
  }, [slots])

  const slotsForSelectedDate = useMemo(() => {
    if (!slots || !selectedDate) return []
    const key = isoDate(selectedDate)
    return slots.filter((s) => s.date === key && s.available_seats > 0)
  }, [slots, selectedDate])

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
        <CardTitle>Pick a date</CardTitle>
        <CardDescription>
          Showing the next {HORIZON_DAYS} days for {product.name}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            setSelectedDate(date)
            setSelectedSlotId(null)
          }}
          disabled={(date) => !availableDates.has(isoDate(date))}
        />
        {selectedDate ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Times on {isoDate(selectedDate)}</p>
            {slotsForSelectedDate.length === 0 ? (
              <p className="text-sm text-muted-foreground">No times available.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slotsForSelectedDate.map((slot) => (
                  <Button
                    key={slot.availability_id}
                    type="button"
                    variant={selectedSlotId === slot.availability_id ? 'default' : 'outline'}
                    onClick={() => setSelectedSlotId(slot.availability_id)}
                  >
                    {slot.start_time?.slice(0, 5) ?? 'Any time'}
                    {exposeSeatsToCustomer ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {slot.available_seats} seats
                      </span>
                    ) : null}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : null}
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            disabled={!selectedSlotId}
            onClick={() => {
              const slot = slotsForSelectedDate.find(
                (s) => s.availability_id === selectedSlotId,
              )
              if (slot) onConfirm(slot)
            }}
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
