import { useRef, useState, type RefObject } from 'react'
import { maxPartySize } from '@/lib/seatHold'

/**
 * landr-rmcsu.7: the dates-step group-size state, shared by every picker that
 * shows the "How many of you?" stepper (MultiDayStep and SingleDatePicker
 * carry the same logic inline from landr-rmcsu.5; AvailabilityPicker and
 * FixedDateWindowPicker use this).
 *
 * With the stepper shown the value is local state seeded from the known need
 * (Back / Change dates) and clamped to the product's cap; without it the
 * caller's `seatsNeeded` is the need.
 */
export interface PartySizeState {
  /** Seats the whole group needs — what every seat check compares against. */
  need: number
  value: number
  max: number
  stepperShown: boolean
  decreaseRef: RefObject<HTMLButtonElement | null>
  change: (next: number) => void
}

export function usePartySize(
  maxPartySizeField: number | null | undefined,
  seatsNeeded: number | undefined,
  showPartySizeStepper: boolean,
  onPartySizeChange?: (partySize: number) => void,
): PartySizeState {
  const max = Math.max(maxPartySize(maxPartySizeField), seatsNeeded ?? 1)
  const stepperShown = showPartySizeStepper && max > 1
  const [value, setValue] = useState(() => Math.min(Math.max(1, seatsNeeded ?? 1), max))
  const decreaseRef = useRef<HTMLButtonElement>(null)
  return {
    need: stepperShown ? value : Math.max(1, seatsNeeded ?? 1),
    value,
    max,
    stepperShown,
    decreaseRef,
    change: (next) => {
      setValue(next)
      onPartySizeChange?.(next)
    },
  }
}
