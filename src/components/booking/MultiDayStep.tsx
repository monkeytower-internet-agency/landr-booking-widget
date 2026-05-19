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
import { tr } from '@/lib/strings'

interface Props {
  product: Product
  onBack: () => void
  onConfirm: (selectedDays: string[]) => void
}

const HORIZON_DAYS = 60

const isoDate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function MultiDayStep({ product, onBack, onConfirm }: Props) {
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedDays, setSelectedDays] = useState<Date[]>([])

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

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Could not load availability.</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pick your dates</CardTitle>
        <CardDescription>
          Showing the next {HORIZON_DAYS} days for {product.name}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <MultiDayPicker
          availability={slots ?? []}
          value={selectedDays}
          onChange={setSelectedDays}
          helpText={tr('multiDayPickerHelp')}
          defaultMonth={new Date()}
        />
        {selectedDays.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {selectedDays.length === 1
              ? `1 day selected`
              : `${selectedDays.length} days selected`}
          </p>
        ) : null}
        <div className="flex justify-between pt-2">
          <Button variant="outline" type="button" onClick={onBack}>
            Back
          </Button>
          <Button
            type="button"
            disabled={selectedDays.length === 0}
            onClick={() => onConfirm(selectedDays.map(isoDate))}
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
