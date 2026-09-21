/**
 * landr-g98ug: "unsaved booking in progress" signal for the staff embed.
 *
 * The dashboard's "+ Add booking" overlay (StaffWidgetModal) embeds this
 * widget in a cross-origin iframe, so it cannot see what the operator has
 * entered. Without a signal, an outside-click / Esc / X closes the overlay
 * and silently throws the half-built booking away. The widget therefore
 * tells its parent whether a booking is in progress:
 *
 *   { type: 'landr:staff-dirty', dirty: boolean }
 *
 * Posted ONLY in staff mode (active session) and only when embedded, to the
 * same allow-listed parent origin as the completion message — never '*'. A
 * normal customer embed never posts it. The parent verifies event.origin.
 */
import { useEffect } from 'react'
import type { Step } from '@/appStepMachine'
import { resolveParentTargetOrigin, useStaffMode } from './staffMode'

export const STAFF_DIRTY_MESSAGE_TYPE = 'landr:staff-dirty'

/**
 * Steps that hold nothing the operator would lose: browsing the catalogue,
 * a sold-out notice, and the finished booking (already saved server-side).
 */
const CLEAN_STEPS: ReadonlySet<Step['name']> = new Set([
  'pick-product',
  'pick-category',
  'product-detail',
  'fully-booked',
  'confirmed',
])

/**
 * True once the operator has made a choice worth warning about: any date
 * picked (live, before Continue) or any step past the product/date pick.
 * Merely opening a product's date picker is not progress on its own.
 */
export function isBookingInProgress(step: Step, liveSelectionCount: number): boolean {
  if (step.name === 'confirmed') return false
  if (liveSelectionCount > 0) return true
  if (CLEAN_STEPS.has(step.name)) return false
  if (step.name === 'pick-selection') return step.selection !== undefined
  return true
}

/**
 * Posts the dirty flag to the embedding dashboard whenever it changes (and
 * once when the staff session becomes active, so a parent that mounted
 * after progress was restored still learns the current state).
 */
export function useStaffDirtySignal(dirty: boolean): void {
  const staff = useStaffMode()
  useEffect(() => {
    if (!staff.active) return
    if (typeof window === 'undefined' || window.parent === window) return
    window.parent.postMessage(
      { type: STAFF_DIRTY_MESSAGE_TYPE, dirty },
      resolveParentTargetOrigin(),
    )
  }, [staff.active, dirty])
}
