import { useState } from 'react'
import type { BookingSelection } from '@/components/booking/BookingForm'
import type { Product } from '@/api/types'
import { browserLocale } from '@/lib/locale'
import { formatDayLabel, formatDayRange } from '@/components/booking/dateLabel'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const MAX_ADDITIONAL = 5 // total cap = 6 participants (matches Para42's legacy form)

interface Props {
  product: Product
  selection: BookingSelection
  onBack: () => void
  onConfirm: (count: number) => void
}

/**
 * ParticipantsStep (landr-mbge) — collects participant COUNT only (no
 * names). Inserted between pick-selection and the downstream branching
 * (accommodation/pickup/fill-form). The count threads through into:
 *   - AccommodationStep (drives the overbook warning vs room capacity in
 *     landr-qpab),
 *   - the submit payload's participants[] array (we pre-render N empty
 *     slots in BookingForm — names captured later there),
 *   - PriceSidebar per-participant pricing display (landr-qez0).
 *
 * UX defaults to "Just me" (count=1). Selecting "Add more participants"
 * reveals a small stepper for the additional count (1-5 → total 2-6).
 * Generic copy per landr-genericity-northstar — uses 'participants' not
 * 'pilots'/'divers' so the widget works for any vertical.
 */
function describeSelection(
  selection: BookingSelection,
  locale: string,
): string {
  if (selection.kind === 'slot') {
    const { date, start_time } = selection.slot
    const label = formatDayLabel(date, locale)
    return start_time ? `${label} · ${start_time.slice(0, 5)}` : label
  }
  const days = selection.selectedDays
  if (days.length === 0) return ''
  if (days.length === 1) return formatDayLabel(days[0]!, locale)
  return `${formatDayRange(days[0]!, days[days.length - 1]!, locale)} (${days.length} days)`
}

export function ParticipantsStep({
  product,
  selection,
  onBack,
  onConfirm,
}: Props) {
  const locale = browserLocale()
  const [mode, setMode] = useState<'alone' | 'group'>('alone')
  const [additional, setAdditional] = useState<number>(1)

  const totalCount = mode === 'alone' ? 1 : Math.max(2, 1 + additional)

  const clampAdditional = (n: number) => {
    if (Number.isNaN(n)) return 1
    return Math.min(MAX_ADDITIONAL, Math.max(1, Math.floor(n)))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>How many participants?</CardTitle>
        <CardDescription>
          {product.name} · {describeSelection(selection, locale)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Number of participants</legend>

          <label
            className={[
              'flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors',
              mode === 'alone'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/40',
            ].join(' ')}
          >
            <input
              type="radio"
              name="participants_mode"
              value="alone"
              checked={mode === 'alone'}
              onChange={() => setMode('alone')}
              className="h-4 w-4 accent-primary"
            />
            <span>Just me</span>
          </label>

          <label
            className={[
              'flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors',
              mode === 'group'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/40',
            ].join(' ')}
          >
            <input
              type="radio"
              name="participants_mode"
              value="group"
              checked={mode === 'group'}
              onChange={() => setMode('group')}
              className="h-4 w-4 accent-primary"
            />
            <span>Add more participants</span>
          </label>
        </fieldset>

        {mode === 'group' ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="additional-participants" className="text-sm">
              How many additional participants?
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Decrease"
                onClick={() => setAdditional((n) => clampAdditional(n - 1))}
                disabled={additional <= 1}
              >
                −
              </Button>
              <Input
                id="additional-participants"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_ADDITIONAL}
                value={additional}
                onChange={(e) =>
                  setAdditional(clampAdditional(Number(e.target.value)))
                }
                className="w-20 text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Increase"
                onClick={() => setAdditional((n) => clampAdditional(n + 1))}
                disabled={additional >= MAX_ADDITIONAL}
              >
                +
              </Button>
              <span className="text-sm text-muted-foreground">
                ({totalCount} total)
              </span>
            </div>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          You&rsquo;ll add details for each on the next pages.
        </p>

        <div className="flex justify-between pt-2">
          <Button variant="outline" type="button" onClick={onBack}>
            Back
          </Button>
          <Button type="button" onClick={() => onConfirm(totalCount)}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
