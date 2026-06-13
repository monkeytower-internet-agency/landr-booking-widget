/**
 * landr-2mgl: reload-resilient booking progress.
 *
 * The widget is a client SPA embedded in an iframe with NO url/storage
 * persistence of progress. On mobile, a stray pull-to-refresh (or any
 * intentional reload) remounts React and resets `step` + `bookingDraft`
 * (in-memory useState in App.tsx) back to product selection — wiping
 * everything the customer typed.
 *
 * This module persists the funnel position (`step`) and the landr-nmed
 * single-source-of-truth `bookingDraft` to sessionStorage so an
 * (accidental or intentional) reload restores the customer exactly where
 * they were. sessionStorage is same-origin + tab-scoped, which is the
 * right place for the PII the draft carries (names/emails) — that PII must
 * NEVER go in the URL.
 *
 * Storage is wrapped in try/catch on EVERY access: embeds may run inside a
 * sandboxed iframe where `sessionStorage` throws on read OR write (Safari
 * private mode, `sandbox` without allow-same-origin, ITP). A storage
 * failure must never break the widget — it just degrades to the in-memory
 * behaviour (no persistence this session). Same convention as
 * `components/booking/browse/useViewMode.ts`.
 *
 * Why a plain .ts helper (no component export): keeps the
 * react-refresh/only-export-components ESLint gate happy and makes the
 * read/write/clear primitives unit-testable without rendering App.
 */
import type { Step, BookingDraft } from './appStepMachine'

/**
 * sessionStorage key for the persisted booking progress. Versioned so a shape
 * change can bump the suffix and ignore stale blobs instead of crashing on a
 * mismatched structure.
 *
 * landr-71kz.3: bumped v1 → v2. The BookingDraft gained a `customFormAnswers`
 * slot and the Step union gained a `custom-form` variant. A v1 blob written by
 * an older tab has neither, so on mismatch we DISCARD it (do NOT migrate): the
 * new key is simply not found, `readStoredProgress` returns null, and the
 * customer starts clean. Old v1 entries are orphaned in sessionStorage but
 * sessionStorage is tab-scoped and short-lived, so they evaporate with the tab.
 */
export const BOOKING_PROGRESS_STORAGE_KEY = 'landr-widget-progress.v2'

/**
 * The persisted snapshot: the current funnel `step` and the persistent
 * `bookingDraft`. Both are plain JSON-serialisable structures (the Step
 * union and BookingDraft carry only data — products, ISO date strings,
 * names, ids — no functions, Dates, or class instances), so
 * JSON.stringify / JSON.parse round-trips them faithfully.
 */
export interface BookingProgress {
  step: Step
  bookingDraft: BookingDraft
}

/**
 * Steps that should NOT be restored from a reload. `confirmed` carries a
 * one-shot submit response (the booking already happened) — re-showing it
 * after a reload would be confusing and the response may reference a
 * server-side record the customer can no longer act on. We also never want
 * to "restore" the trivial entry steps; persisting them is harmless but a
 * restore to `pick-product` is indistinguishable from a fresh mount, so we
 * skip writing those to keep storage quiet and avoid a category/product
 * re-fetch race fighting the restore.
 */
function isRestorableStep(step: Step): boolean {
  return (
    step.name !== 'pick-product' &&
    step.name !== 'pick-category' &&
    step.name !== 'confirmed'
  )
}

/**
 * Read + parse the persisted progress. Returns null when nothing is
 * stored, the blob is unparseable/legacy, the stored step is not a
 * restorable one, OR storage is unavailable/throws (sandboxed embed).
 */
export function readStoredProgress(): BookingProgress | null {
  try {
    const raw = window.sessionStorage.getItem(BOOKING_PROGRESS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BookingProgress>
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.step ||
      typeof parsed.step !== 'object' ||
      typeof (parsed.step as Step).name !== 'string'
    ) {
      return null
    }
    const step = parsed.step as Step
    if (!isRestorableStep(step)) return null
    return {
      step,
      // Draft is optional in the blob; default to empty so a partial
      // write never restores `undefined` into App's draft state.
      bookingDraft: (parsed.bookingDraft as BookingDraft) ?? {},
    }
  } catch {
    // Unparseable JSON, blocked storage, or a shape we don't recognise —
    // fall back to a fresh start. Never throw.
    return null
  }
}

/**
 * Persist the current progress, swallowing any storage error (sandboxed
 * embed) and skipping non-restorable steps (entry steps + the post-booking
 * confirmation) so a reload at those points starts clean.
 */
export function writeStoredProgress(progress: BookingProgress): void {
  try {
    if (!isRestorableStep(progress.step)) {
      // Don't persist entry/terminal steps — and proactively clear any
      // earlier snapshot so a reload here doesn't resurrect stale progress.
      clearStoredProgress()
      return
    }
    window.sessionStorage.setItem(
      BOOKING_PROGRESS_STORAGE_KEY,
      JSON.stringify(progress),
    )
  } catch {
    // ignore — sandboxed/blocked storage. Progress still holds in-memory
    // for this session; only the cross-reload restore is lost.
  }
}

/**
 * Drop the persisted progress. Called on a completed booking and on a full
 * restart (the same points App's `setBookingDraft({})` fires) so the next
 * reload doesn't resurrect a finished/abandoned funnel. Swallows errors.
 */
export function clearStoredProgress(): void {
  try {
    window.sessionStorage.removeItem(BOOKING_PROGRESS_STORAGE_KEY)
  } catch {
    // ignore — blocked storage. Nothing was persisted, nothing to clear.
  }
}
