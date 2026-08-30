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
import type {
  CompanionDetails,
  ParticipantDetails,
} from './components/booking/detailsTypes'
import {
  BOOKER_MEMBER_ID,
  newMemberId,
  type PartyMemberId,
} from './components/booking/partyIdentity'

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
 *
 * landr-uwvl deliberately did NOT bump v2 → v3. The party maps gained stable
 * `PartyMemberId` keys and the party rows gained an `id`, but the new shape is
 * a strict SUPERSET of the old one and `normalizePartyIdentity` below migrates
 * an old blob explicitly, so there is nothing to crash on — while the v1 → v2
 * convention (bump + DISCARD) would have thrown away a customer's half-filled
 * booking on the deploy. Old-code-reads-new-blob cannot happen: sessionStorage
 * is tab-scoped and a tab runs one bundle at a time, so the only cross-version
 * read is new-reads-old, which is exactly what the normalizer covers.
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

/** True when every party row in the blob already carries an id — i.e. it was
 *  written by a post-landr-uwvl bundle and needs no migration. A blob with no
 *  party at all has nothing keyed by index either, so it counts as done. */
function alreadyIdentified(progress: BookingProgress): boolean {
  const rows: { id?: PartyMemberId }[] = []
  const collect = (container: Partial<Step> & Partial<BookingDraft>) => {
    if (Array.isArray(container.participants)) rows.push(...container.participants)
    if (Array.isArray(container.companions)) rows.push(...container.companions)
  }
  collect(progress.step as Partial<Step> & Partial<BookingDraft>)
  collect(progress.bookingDraft)
  // No party at all → nothing to migrate (and nothing keyed by index either).
  if (rows.length === 0) return true
  return rows.every((row) => typeof row?.id === 'string' && row.id.length > 0)
}

/** Re-key one index-keyed map onto the supplied ids. Entries whose index has
 *  no id (a longer map than roster, i.e. a stale ghost) are dropped — the same
 *  thing `autoAssignParticipants` does with an out-of-party key. */
function rekeyByPosition(
  map: Record<string, unknown> | undefined,
  ids: PartyMemberId[],
): Record<string, unknown> | undefined {
  if (!map || typeof map !== 'object') return map
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(map)) {
    const index = Number(key)
    if (!Number.isInteger(index)) continue
    const id = ids[index]
    if (id === undefined) continue
    out[id] = value
  }
  return out
}

/**
 * landr-uwvl BACKFILL: migrate a blob written before party members had stable
 * ids.
 *
 * Pre-landr-uwvl the three party maps (`roomAssignment` / `occupantAgeMap` /
 * `breakfastMap`) were keyed by the party-member INDEX in the unified space
 * `[participants 0..P-1] ++ [companions P..P+C-1]`. Post-landr-uwvl they are
 * keyed by `ParticipantDetails.id` / `CompanionDetails.id`.
 *
 * The migration mints an id per party POSITION and rewrites every map key from
 * that position to that id. Index → the id minted AT THE SAME INDEX is the
 * identity permutation, so NOBODY'S ROOM CHANGES — which is the whole point: a
 * migration that reshuffles real people's rooms is the bug being fixed.
 *
 * The ids are minted ONCE and applied to BOTH `progress.step` and
 * `progress.bookingDraft`. They carry the same roster (the draft is written
 * from the step and vice-versa), and App.tsx resolves the draft's maps against
 * the STEP's roster — so minting independently per container would leave the
 * two disagreeing and silently unassign the whole party.
 *
 * A blob that already carries ids is returned untouched.
 */
export function normalizePartyIdentity(progress: BookingProgress): BookingProgress {
  if (alreadyIdentified(progress)) return progress

  const stepAny = progress.step as Partial<Step> & Partial<BookingDraft>
  const draft = progress.bookingDraft

  const participantCount = Math.max(
    Array.isArray(stepAny.participants) ? stepAny.participants.length : 0,
    Array.isArray(draft.participants) ? draft.participants.length : 0,
  )
  const companionCount = Math.max(
    Array.isArray(stepAny.companions) ? stepAny.companions.length : 0,
    Array.isArray(draft.companions) ? draft.companions.length : 0,
  )

  // participants[0] is always the booker — pin them to the same sentinel
  // `bookerToParticipant` stamps, so a restored booker keeps their identity
  // across the remount that re-derives participants[0] from the booker fields.
  const participantIds: PartyMemberId[] = Array.from(
    { length: participantCount },
    (_, i) => (i === 0 ? BOOKER_MEMBER_ID : newMemberId()),
  )
  const companionIds: PartyMemberId[] = Array.from({ length: companionCount }, () =>
    newMemberId(),
  )
  // The unified party index space the old maps were keyed by.
  const partyIds = [...participantIds, ...companionIds]

  const stampParticipants = (
    rows: ParticipantDetails[] | undefined,
  ): ParticipantDetails[] | undefined =>
    rows?.map((row, i) => (row.id ? row : { ...row, id: participantIds[i] }))
  const stampCompanions = (
    rows: CompanionDetails[] | undefined,
  ): CompanionDetails[] | undefined =>
    rows?.map((row, i) => (row.id ? row : { ...row, id: companionIds[i] }))

  const rekeyContainer = <T extends Partial<Step> & Partial<BookingDraft>>(
    container: T,
  ): T => ({
    ...container,
    ...(container.participants
      ? { participants: stampParticipants(container.participants) }
      : {}),
    ...(container.companions
      ? { companions: stampCompanions(container.companions) }
      : {}),
    ...('roomAssignment' in container
      ? {
          roomAssignment: rekeyByPosition(
            container.roomAssignment as Record<string, unknown> | undefined,
            partyIds,
          ),
        }
      : {}),
    ...('occupantAgeMap' in container
      ? {
          occupantAgeMap: rekeyByPosition(
            container.occupantAgeMap as Record<string, unknown> | undefined,
            partyIds,
          ),
        }
      : {}),
    ...('breakfastMap' in container
      ? {
          breakfastMap: rekeyByPosition(
            container.breakfastMap as Record<string, unknown> | undefined,
            partyIds,
          ),
        }
      : {}),
  })

  return {
    step: rekeyContainer(stepAny) as Step,
    bookingDraft: rekeyContainer(draft) as BookingDraft,
  }
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
    // landr-uwvl: migrate a pre-identity blob before it reaches App state —
    // see normalizePartyIdentity. A no-op for blobs written by this bundle.
    return normalizePartyIdentity({
      step,
      // Draft is optional in the blob; default to empty so a partial
      // write never restores `undefined` into App's draft state.
      bookingDraft: (parsed.bookingDraft as BookingDraft) ?? {},
    })
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
