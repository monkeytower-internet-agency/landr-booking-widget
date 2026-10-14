/**
 * landr-rmcsu.5: group-size controls for the date pickers (MultiDayStep,
 * SingleDatePicker).
 *
 *  - PartySizeStepper — "How many of you?" −/+ with a numeric readout. Its
 *    value filters the calendar (days with fewer free seats than the group
 *    are marked + disabled) and pre-creates that many participant rows on the
 *    details step.
 *  - SeatFitNotice — "12 dates fit 3 people", or, when nothing in the loaded
 *    window fits, the never-stranded exits: "Fewer people" (focuses the
 *    stepper) and "Ask for a group booking" (the existing GroupInquiryForm).
 *  - ShortDayLegend — the legend entry for the struck-through amber days.
 */
import { useId, useState, type Ref } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { browserLocale } from '@/lib/locale'
import {
  seatFitCountLabel,
  seatFitNoneMessage,
  seatFitNoneWindowsMessage,
  seatFitWindowsCountLabel,
  tr,
} from '@/lib/strings'
import { GroupInquiryForm } from './GroupInquiryForm'

interface PartySizeStepperProps {
  value: number
  max: number
  onChange: (next: number) => void
  /** The − button, so "Fewer people" can move focus onto the stepper. */
  decreaseRef?: Ref<HTMLButtonElement>
}

export function PartySizeStepper({ value, max, onChange, decreaseRef }: PartySizeStepperProps) {
  const locale = browserLocale()
  const labelId = useId()
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex items-center justify-between gap-3 rounded-lg bg-surface-well px-3 py-2"
      data-testid="party-size-stepper"
    >
      <span id={labelId} className="text-sm font-medium">
        {tr('partySizeLabel', locale)}
      </span>
      <div className="flex items-center gap-2">
        <Button
          ref={decreaseRef}
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={tr('partySizeDecreaseAria', locale)}
          // aria-disabled (not disabled) keeps the button focusable at 1 so
          // "Fewer people" can always land focus here.
          aria-disabled={value <= 1 || undefined}
          className="aria-disabled:opacity-50"
          onClick={() => {
            if (value > 1) onChange(value - 1)
          }}
          data-testid="party-size-decrease"
        >
          <Minus aria-hidden="true" />
        </Button>
        <output
          aria-labelledby={labelId}
          aria-live="polite"
          className="min-w-6 text-center text-base font-semibold tabular-nums"
          data-testid="party-size-value"
        >
          {value}
        </output>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={tr('partySizeIncreaseAria', locale)}
          disabled={value >= max}
          onClick={() => {
            if (value < max) onChange(value + 1)
          }}
          data-testid="party-size-increase"
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

interface SeatFitNoticeProps {
  need: number
  /** Bookable days in the loaded window with room for `need`. */
  fitCount: number
  /** "October 2026 – October 2027" — the loaded window, for the none-fit copy. */
  rangeLabel: string
  /** landr-rmcsu.7: 'windows' = fixed course windows ("3 course dates fit 4 people"). */
  unit?: 'days' | 'windows'
  /** Absent → no "Fewer people" button (the stepper is hidden). */
  onFewer?: () => void
  operatorToken?: string
  productSlug: string | null
  productName: string
  contactEmail?: string | null
}

export function SeatFitNotice({
  need,
  fitCount,
  rangeLabel,
  unit = 'days',
  onFewer,
  operatorToken = '',
  productSlug,
  productName,
  contactEmail,
}: SeatFitNoticeProps) {
  const locale = browserLocale()
  const [inquiryOpen, setInquiryOpen] = useState(false)
  if (need <= 1) return null
  if (fitCount > 0) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="seat-fit-count">
        {unit === 'windows'
          ? seatFitWindowsCountLabel(fitCount, need, locale)
          : seatFitCountLabel(fitCount, need, locale)}
      </p>
    )
  }
  const email = contactEmail?.trim() || ''
  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent(`${tr('requestLargerGroupLink', locale)} — ${productName}`)}`
    : ''
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg border border-dashed bg-surface-raised p-3"
      data-testid="seat-fit-none"
    >
      <p className="text-sm font-medium">
        {unit === 'windows'
          ? seatFitNoneWindowsMessage(need, locale)
          : seatFitNoneMessage(need, rangeLabel, locale)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {onFewer ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onFewer}
            data-testid="seat-fit-fewer"
          >
            {tr('seatFitFewerButton', locale)}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setInquiryOpen(true)}
          data-testid="seat-fit-inquiry"
        >
          {tr('seatFitInquiryButton', locale)}
        </Button>
      </div>
      <Dialog open={inquiryOpen} onOpenChange={setInquiryOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="seat-fit-inquiry-modal">
          <DialogHeader>
            <DialogTitle>{tr('requestLargerGroupLink', locale)}</DialogTitle>
            <DialogDescription>
              {tr('needLargerGroupDialogDescription', locale)}
            </DialogDescription>
          </DialogHeader>
          {inquiryOpen ? (
            <GroupInquiryForm
              operatorToken={operatorToken}
              productSlug={productSlug}
              contactMailto={mailto}
              contactEmail={email}
              defaultPartySize={need}
              onCancel={() => setInquiryOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ShortDayLegend() {
  const locale = browserLocale()
  return (
    <p
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      data-testid="short-day-legend"
    >
      <span
        aria-hidden="true"
        className="inline-flex size-5 items-center justify-center rounded text-amber-700 line-through decoration-2 decoration-amber-600 dark:text-amber-400 dark:decoration-amber-400"
      >
        11
      </span>
      {tr('shortDayLegend', locale)}
    </p>
  )
}
