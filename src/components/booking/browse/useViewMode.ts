/**
 * landr-d8rg.6: catalogue view-mode (grid | list) state with a localStorage
 * preference + a responsive default.
 *
 * Defaults: grid on ≥md viewports, list on <md (denser, thumb-left rows read
 * better on a phone). A persisted user choice in localStorage always wins over
 * the responsive default.
 *
 * Storage is wrapped in try/catch on EVERY access: embeds may run inside a
 * sandboxed iframe where `localStorage` throws on read OR write (Safari
 * private mode, `sandbox` without allow-same-origin). A storage failure must
 * never break the catalogue — it just falls back to the responsive default
 * and the toggle still works for the session.
 *
 * Pure-helper + hook file (no component export) so the
 * react-refresh/only-export-components ESLint gate stays happy — same
 * convention as useBookingEstimate.ts.
 */
import { useState } from 'react'

export type ViewMode = 'grid' | 'list'

/** localStorage key for the persisted catalogue view preference. */
export const VIEW_MODE_STORAGE_KEY = 'landr-widget-view'

/** Tailwind `md` breakpoint (px). Grid is the default at/above this width. */
const MD_BREAKPOINT_PX = 768

function isViewMode(value: unknown): value is ViewMode {
  return value === 'grid' || value === 'list'
}

/**
 * Read the persisted view preference once. Returns null when nothing is stored
 * OR when storage is unavailable/throws (sandboxed embed) — the caller then
 * resolves the responsive default.
 */
export function readStoredViewMode(): ViewMode | null {
  try {
    const raw = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)
    return isViewMode(raw) ? raw : null
  } catch {
    return null
  }
}

/** Persist the view preference, swallowing any storage error (sandboxed embed). */
export function writeStoredViewMode(mode: ViewMode): void {
  try {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
  } catch {
    // ignore — sandboxed/blocked storage. The choice still holds in-memory.
  }
}

/**
 * The responsive default when the user has no stored preference: grid on
 * ≥md, list below. `matchMedia` is feature-detected (absent in jsdom and old
 * embeds) and guarded — any failure falls back to grid, the safest default
 * (the desktop layout degrades gracefully on narrow viewports).
 */
export function defaultViewMode(): ViewMode {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia(`(min-width: ${MD_BREAKPOINT_PX}px)`).matches
        ? 'grid'
        : 'list'
    }
  } catch {
    // ignore — fall through to the grid default.
  }
  return 'grid'
}

/** Resolve the initial view mode: stored preference first, else responsive default. */
export function resolveInitialViewMode(): ViewMode {
  return readStoredViewMode() ?? defaultViewMode()
}

/**
 * View-mode state hook. Reads the stored preference (or responsive default)
 * once on mount, and persists every change. Returns the current mode and a
 * setter that writes through to localStorage.
 */
export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(resolveInitialViewMode)

  const set = (next: ViewMode) => {
    setMode(next)
    writeStoredViewMode(next)
  }

  return [mode, set]
}
