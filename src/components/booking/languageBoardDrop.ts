/**
 * landr-jr30v — pure drop/tap routing helpers for ParticipantLanguageBoard.
 *
 * jsdom cannot resolve a real dnd-kit pointer/touch drag (no layout to hit-test
 * against — see LanguageStep.test.tsx's header comment), so the board's drag
 * path has never had direct test coverage; only tap-to-place and the <select>
 * fallback, which write the same map, do. landr-jr30v adds real branching
 * (closed flags become drop targets; the first flag tap assigns the whole
 * party) that deserves its own coverage independent of dnd-kit's runtime, so
 * the ROUTING decisions live here as pure functions. Kept out of
 * ParticipantLanguageBoard.tsx so that file keeps exporting only its
 * component (react-refresh/only-export-components), mirroring the
 * accommodationCalc.ts / RoomAssignment.tsx and
 * participantLanguages.ts / ParticipantLanguageBoard.tsx splits.
 */

/** dnd-kit droppable id for the "back to the tray" drop zone. */
export const UNASSIGNED_DROP_ID = '__lang_unassigned__'

export type ChipDropAction =
  | { type: 'assign'; memberIndex: number; code: string }
  | { type: 'unassign'; memberIndex: number }
  | { type: 'none' }

/**
 * What a chip's dnd-kit `onDragEnd` should do, given the raw event shape.
 * Identical whether `overCode` came from an already-open LanguageColumn or a
 * CLOSED flag chip (landr-jr30v's new droppable) — a drag always moves only
 * the dragged participant, never the whole party (that shortcut is tap-only,
 * see `resolveFlagTap`).
 */
export function resolveChipDrop(
  memberIndex: number | undefined,
  overId: string | number | null | undefined,
  overCode: string | undefined,
): ChipDropAction {
  if (memberIndex === undefined) return { type: 'none' }
  if (overId === undefined || overId === null) return { type: 'none' }
  if (overId === UNASSIGNED_DROP_ID) return { type: 'unassign', memberIndex }
  if (overCode) return { type: 'assign', memberIndex, code: overCode }
  return { type: 'none' }
}

export type FlagTapAction =
  | { type: 'place'; memberIndex: number; code: string }
  | { type: 'assignEveryone'; code: string }
  | { type: 'open'; code: string }

/**
 * What tapping a CLOSED language flag chip should do (landr-jr30v, per the
 * approver's Trello comment):
 *
 *   1. A tap-to-place chip already picked up wins outright — it places ONLY
 *      that chip, mirroring the drag rule above.
 *   2. Otherwise, the FIRST flag tap while no column is open yet assigns the
 *      WHOLE party — the common case, a group that shares one language.
 *   3. Any later tap (>= 1 column already open) just opens an empty column,
 *      same as before landr-jr30v. Removing every open column returns the
 *      board to state 2 for the next tap (openLanguagesCount is derived from
 *      the live column set, not tracked separately).
 */
export function resolveFlagTap(
  code: string,
  selectedChip: number | null,
  openLanguagesCount: number,
): FlagTapAction {
  if (selectedChip !== null) return { type: 'place', memberIndex: selectedChip, code }
  if (openLanguagesCount === 0) return { type: 'assignEveryone', code }
  return { type: 'open', code }
}
