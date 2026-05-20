/**
 * Generic value debouncer for the PriceSidebar (landr-qez0). When the
 * customer flips between options quickly (e.g. toggles add-ons, changes
 * rooms, scrolls through days) we don't want to fire an estimate RPC
 * per keystroke — the engine touches multiple tables and the request
 * round-trips at minimum 100ms over the LAN.
 *
 * Standard useEffect + setTimeout pattern: emit `value` immediately,
 * then on every subsequent change schedule a `setDebouncedValue(value)`
 * after `delayMs`. A new change cancels the pending timeout so only the
 * last value before the quiet period lands.
 *
 * Kept in a sibling .ts file so the react-refresh/only-export-components
 * ESLint rule stays happy (the PriceSidebar.tsx file only exports the
 * React component as default — adding hook exports there would trigger
 * the rule and block the widget deploy pipeline; see landr-znl + the
 * accommodationCalc.ts / dateLabel.ts precedents).
 */
import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])
  return debounced
}
