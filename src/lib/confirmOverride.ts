import { OUTSIDE_SCHEDULE_CONFIRM } from '@/lib/strings'

/**
 * Operator override confirm ("Outside your schedule — book anyway?").
 *
 * The staff widget runs in a cross-origin iframe inside the dashboard, and
 * browsers suppress window.confirm there: it returns false without showing
 * anything, so the operator's click was silently swallowed and the day/time
 * could never be selected. Framed, we skip the blocking dialog — the
 * persistent OperatorOverrideBadge on the pick (and the review banner) carry
 * the warning instead. Top-level (a plain tab) keeps the native confirm.
 */
export function confirmOverride(message: string = OUTSIDE_SCHEDULE_CONFIRM): boolean {
  let framed: boolean
  try {
    framed = window.self !== window.top
  } catch {
    framed = true
  }
  return framed || window.confirm(message)
}
