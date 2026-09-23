/**
 * landr-r6e5x.4 — ParticipantLanguageBoard
 *
 * Epic decision D3 (narrowed by landr-9sjw5 — see LanguageStep.tsx): assign
 * every party member handed to this board to exactly one of the operator's
 * offered guide languages, using the same interaction the AccommodationStep
 * uses to put people in hotel rooms — so a customer who has already done the
 * room board recognises this one immediately. The component itself stays
 * generic over WHO it's given (the `guestFlags` prop still badges any
 * non-guiding member) — it's LanguageStep's real caller (App.tsx) that now
 * only ever hands it participants, never companions.
 *
 * Three input modalities, all editing the same ParticipantLanguageMap, and
 * deliberately the SAME three RoomAssignment offers:
 *
 *   1. DRAG-AND-DROP (mouse / touch / keyboard) via @dnd-kit — a name chip is
 *      dragged onto a language column, or back onto the "Unassigned" tray.
 *   2. TAP-TO-PLACE — tap a chip to pick it up, then tap a column. The
 *      phone-friendly path, and the one that does not depend on drag working.
 *   3. Per-chip <select> — the explicit, screen-reader-friendly fallback.
 *
 * Unlike rooms, a language column has NO capacity: the whole party may share
 * one language. A column the customer opened and then emptied can be removed;
 * a column with people in it cannot (removing it would silently unassign
 * them), so its remove control is hidden until it is empty.
 *
 * Presentational only — it never mutates state, it calls back to the parent
 * (CustomFormStep), which owns the map. Pure helpers live in
 * participantLanguages.ts per react-refresh/only-export-components.
 */
import { useId, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { chipHue } from './accommodationCalc'
import {
  flagTapAnnouncement,
  flagTapLabel,
  resolveChipDrop,
  resolveFlagTap,
  UNASSIGNED_DROP_ID,
} from './languageBoardDrop'
import {
  languageFlag,
  languageName,
  memberLabel,
  membersOfLanguage,
  unassignedMemberIndices,
  type ParticipantLanguageMap,
} from './participantLanguages'
import { NextAction } from './NextAction'
import { browserLocale } from '@/lib/locale'
import { languageStepGate, tr } from '@/lib/strings'

/**
 * `pointerWithin` alone is wrong here even though the room board uses it:
 * a KEYBOARD drag has no pointer, so the detector returns no collisions and
 * Space-arrow-Space silently drops the chip back where it started — the whole
 * keyboard path, which KeyboardSensor exists to provide, never lands.
 *
 * The dnd-kit composition pattern: try the pointer detector first (it is the
 * one that correctly resolves a chip released inside a column rather than a
 * rect-overlapping neighbour), and fall back to `closestCenter` when it yields
 * nothing — which is exactly the keyboard case.
 */
const pointerThenClosestCenter: CollisionDetection = (args) => {
  const byPointer = pointerWithin(args)
  return byPointer.length > 0 ? byPointer : closestCenter(args)
}

interface Props {
  /** ISO 639-1 codes the operator offers, in the operator's own order. */
  offeredLanguages: string[]
  /** Codes with a visible column right now (already filtered + ordered). */
  openLanguages: string[]
  /**
   * Display names for the WHOLE PARTY, indexed by the unified party-member
   * index: guiding participants first (0..P-1), then companions (P..P+C-1).
   */
  participantNames: string[]
  /** `guestFlags[i] === true` badges member i as a non-guiding companion. */
  guestFlags?: boolean[]
  /** Current party-index → language-code map. */
  assignment: ParticipantLanguageMap
  /** (Re)assign a member, or `null` to send them back to the tray. */
  onAssign: (memberIndex: number, code: string | null) => void
  /** Put the WHOLE party into one language in a single gesture. */
  onAssignEveryone: (code: string) => void
  /** Open a column for `code` (from the "Add language" chip row). */
  onOpenLanguage: (code: string) => void
  /** Remove an EMPTY column. */
  onCloseLanguage: (code: string) => void
  /**
   * landr-80ubl.1: while non-null, the work area (tray, columns, flag row) is
   * the step's active NextAction with this cue. null once everyone is placed.
   */
  nextActionCue?: string | null
}

/** Accent colour per member — same stable hue the room board gives them. */
function chipStyle(hue: number, selected: boolean, isGuest: boolean): CSSProperties {
  if (selected) {
    return {
      backgroundColor: `hsl(${hue}, 65%, 45%)`,
      borderColor: `hsl(${hue}, 65%, 38%)`,
      color: '#ffffff',
    }
  }
  return {
    backgroundColor: `hsla(${hue}, 70%, 55%, ${isGuest ? 0.08 : 0.16})`,
    borderColor: `hsla(${hue}, 65%, 50%, ${isGuest ? 0.4 : 0.6})`,
  }
}

/** Shared chip face classes — reused by the chip and its DragOverlay clone. */
function chipClassName(isGuest: boolean): string {
  return [
    'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium select-none',
    isGuest ? 'border-dashed' : '',
  ].join(' ')
}

function ChipInner({
  label,
  isGuest,
  selected,
}: {
  label: string
  isGuest: boolean
  selected: boolean
}) {
  return (
    <>
      {label}
      {isGuest && !selected ? (
        <span className="rounded-sm bg-black/10 px-1 text-[10px] font-medium uppercase leading-tight tracking-wide">
          {tr('guestBadgeLabel', browserLocale())}
        </span>
      ) : null}
    </>
  )
}

/** A draggable party-member name chip. */
function Chip({
  memberIndex,
  label,
  selected,
  isGuest,
  onTap,
}: {
  memberIndex: number
  label: string
  selected: boolean
  isGuest: boolean
  onTap: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lang-chip-${memberIndex}`,
    data: { memberIndex },
  })
  const hue = chipHue(memberIndex)
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={onTap}
      data-testid={`lang-chip-${memberIndex}`}
      data-guest={isGuest ? 'true' : undefined}
      aria-pressed={selected}
      style={chipStyle(hue, selected, isGuest)}
      className={[
        chipClassName(isGuest),
        'cursor-grab touch-none transition-transform hover:-translate-y-0.5',
        isDragging ? 'opacity-30' : '',
      ].join(' ')}
    >
      <ChipInner label={label} isGuest={isGuest} selected={selected} />
    </button>
  )
}

/** One language column — a droppable, uncapped bucket of name chips. */
function LanguageColumn({
  code,
  memberIndices,
  participantNames,
  guestFlags,
  selectedChip,
  unassignedCount,
  onTapTarget,
  onAssign,
  onAssignEveryone,
  onCloseLanguage,
}: {
  code: string
  memberIndices: number[]
  participantNames: string[]
  guestFlags: boolean[]
  selectedChip: number | null
  /** How many members are still in the tray — gates the "everyone" shortcut. */
  unassignedCount: number
  onTapTarget: () => void
  onAssign: (memberIndex: number, code: string | null) => void
  onAssignEveryone: (code: string) => void
  onCloseLanguage: (code: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `lang-${code}`, data: { code } })
  const empty = memberIndices.length === 0
  return (
    <div
      ref={setNodeRef}
      data-testid={`lang-column-${code}`}
      role="group"
      aria-label={`${languageName(code)} speakers`}
      className={[
        'flex flex-col gap-2 rounded-lg border p-3 transition-colors',
        isOver
          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
          : empty
            ? 'border-dashed border-border bg-surface-raised'
            : 'border-border bg-surface-well shadow-well',
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium" data-testid={`lang-column-title-${code}`}>
          <span aria-hidden className="mr-1">
            {languageFlag(code)}
          </span>
          {languageName(code)}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {memberIndices.length}
          </span>
          {/* Only an EMPTY column can be removed — closing an occupied one
              would silently unassign everyone standing in it. */}
          {empty ? (
            <button
              type="button"
              onClick={() => onCloseLanguage(code)}
              data-testid={`lang-remove-${code}`}
              aria-label={`Remove ${languageName(code)}`}
              className="rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            >
              ✕
            </button>
          ) : null}
        </span>
      </div>
      <div className="flex min-h-[2rem] flex-wrap items-center gap-2">
        {empty ? (
          <span className="text-xs italic text-muted-foreground">
            {tr('dropNamesHere', browserLocale())}
          </span>
        ) : (
          memberIndices.map((idx) => (
            <Chip
              key={idx}
              memberIndex={idx}
              label={memberLabel(participantNames, idx)}
              selected={selectedChip === idx}
              isGuest={guestFlags[idx] ?? false}
              // Tapping an already-placed chip takes them back out — the
              // fastest way to correct a mis-drop, same as the room board.
              onTap={() => onAssign(idx, null)}
            />
          ))
        )}
      </div>
      {selectedChip !== null && !memberIndices.includes(selectedChip) ? (
        <button
          type="button"
          onClick={onTapTarget}
          data-testid={`lang-place-here-${code}`}
          className="self-start rounded-md border border-primary px-2 py-1 text-xs text-primary hover:bg-primary/5"
        >
          {tr('placeHereLabel', browserLocale())}
        </button>
      ) : null}
      {/* One-tap "the whole party speaks this". The common shape is a group
          that shares one language — six people dragged one at a time is six
          gestures for an answer they gave in one breath. Hidden once the tray
          is empty, where it would be a no-op. */}
      {unassignedCount > 0 && selectedChip === null ? (
        <button
          type="button"
          onClick={() => onAssignEveryone(code)}
          data-testid={`lang-everyone-${code}`}
          className="self-start rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          Everyone speaks {languageName(code)}
        </button>
      ) : null}
    </div>
  )
}

/** The unassigned tray — itself a drop zone, so a chip can come back. */
function UnassignedTray({
  unassigned,
  participantNames,
  guestFlags,
  offeredLanguages,
  selectedChip,
  selectId,
  onSelectChip,
  onPlaceSelectedHere,
  onAssign,
}: {
  unassigned: number[]
  participantNames: string[]
  guestFlags: boolean[]
  offeredLanguages: string[]
  selectedChip: number | null
  selectId: string
  onSelectChip: (idx: number) => void
  onPlaceSelectedHere: () => void
  onAssign: (memberIndex: number, code: string | null) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_DROP_ID })
  const locale = browserLocale()
  return (
    <div
      ref={setNodeRef}
      data-testid="lang-unassigned-tray"
      className={[
        'flex flex-col gap-2 rounded-lg border p-3 transition-colors',
        isOver
          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
          : 'border-border bg-surface-well shadow-well',
      ].join(' ')}
    >
      <span className="text-xs font-medium text-muted-foreground">
        {tr('unassignedCountTemplate', locale).replace('{n}', String(unassigned.length))}
      </span>
      <div className="flex min-h-[2rem] flex-wrap items-center gap-2">
        {unassigned.length === 0 ? (
          <span
            className="text-xs italic text-muted-foreground"
            data-testid="lang-everyone-assigned"
          >
            {languageStepGate([], locale)}
          </span>
        ) : (
          unassigned.map((idx) => (
            <div key={idx} className="flex items-center gap-1">
              <Chip
                memberIndex={idx}
                label={memberLabel(participantNames, idx)}
                selected={selectedChip === idx}
                isGuest={guestFlags[idx] ?? false}
                onTap={() => onSelectChip(idx)}
              />
              {/* Inline dropdown — the most direct keyboard / screen-reader
                  path. Lists every OFFERED language, not just the open
                  columns: on arrival no column is open, so listing only those
                  left this control empty and useless exactly when it is most
                  needed. Picking one opens its column as a side effect. */}
              <select
                aria-label={tr('assignToLanguageAriaTemplate', locale).replace(
                  '{name}',
                  memberLabel(participantNames, idx),
                )}
                data-testid={`lang-tray-select-${idx}`}
                id={`${selectId}-${idx}`}
                value=""
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '') return
                  onAssign(idx, v)
                }}
                className="rounded-md border border-border bg-background px-1 py-0.5 text-xs"
              >
                <option value="">{tr('languageDropdownPlaceholder', locale)}</option>
                {offeredLanguages.map((code) => (
                  <option key={code} value={code}>
                    {languageName(code)}
                  </option>
                ))}
              </select>
            </div>
          ))
        )}
      </div>
      {selectedChip !== null ? (
        <button
          type="button"
          onClick={onPlaceSelectedHere}
          data-testid="lang-unassign-here"
          className="self-start rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          Move selected here (unassign)
        </button>
      ) : null}
    </div>
  )
}

/**
 * A CLOSED language flag chip, from the "Add language" row — landr-jr30v
 * makes it a dnd-kit droppable too (`data: { code, closed: true }`), same
 * shape as a LanguageColumn's, so `handleDragEnd` (via `resolveChipDrop`)
 * routes a drop here identically: it assigns ONLY the dragged participant
 * and opens the column as a side effect (LanguageStep.handleAssign). Tapping
 * it (rather than dropping) goes through `resolveFlagTap` instead, which is
 * where the "first tap = whole party" shortcut lives.
 *
 * landr-ajlwl: the button is bimodal (a tap here can assign the whole party,
 * place one picked-up chip, or just open a column) but its VISIBLE text was
 * always just the language name, so a screen-reader user had no way to tell
 * which. `ariaLabel` carries the mode-aware name instead — computed by the
 * caller via `flagTapLabel`, from the same `resolveFlagTap` decision the
 * click itself uses — while the flag + language name stay the visible text.
 */
function FlagDropChip({
  code,
  ariaLabel,
  onTap,
}: {
  code: string
  ariaLabel: string
  onTap: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `lang-add-${code}`,
    data: { code, closed: true },
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onTap}
      aria-label={ariaLabel}
      data-testid={`lang-add-${code}`}
      className={[
        'inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1 text-sm font-medium transition-colors',
        isOver
          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
          : 'border-primary/60 text-primary hover:border-primary hover:bg-primary/5',
      ].join(' ')}
    >
      <span aria-hidden>{languageFlag(code)}</span>
      {languageName(code)}
    </button>
  )
}

export function ParticipantLanguageBoard({
  offeredLanguages,
  openLanguages,
  participantNames,
  guestFlags = [],
  assignment,
  onAssign,
  onAssignEveryone,
  onOpenLanguage,
  onCloseLanguage,
  nextActionCue = null,
}: Props) {
  const selectId = useId()
  const locale = browserLocale()
  // tap-to-place: the currently "picked up" member index (or null).
  const [selectedChip, setSelectedChip] = useState<number | null>(null)
  // the member index currently being DRAGGED — drives the floating clone.
  const [activeChip, setActiveChip] = useState<number | null>(null)
  // landr-ajlwl: text for the visually-hidden live region announcing what a
  // flag TAP just did (a drag gets dnd-kit's own `announcements` above; a tap
  // gets none of that for free). Starts empty so nothing is announced on
  // mount, and is only ever set from the tap handler itself, never an
  // effect, so it can't fire on a render the user didn't cause.
  const [tapAnnouncement, setTapAnnouncement] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  )

  const partyCount = participantNames.length
  const unassigned = unassignedMemberIndices(partyCount, assignment)
  const closedLanguages = offeredLanguages.filter(
    (code) => !openLanguages.includes(code),
  )
  // Name of the picked-up tap-to-place chip, if any — feeds both the flag
  // labels below and the tap announcement (see `flagTapLabel`).
  const pickedUpName =
    selectedChip !== null ? memberLabel(participantNames, selectedChip) : null

  function handleDragStart(event: DragStartEvent) {
    const memberIndex = event.active.data.current?.memberIndex as number | undefined
    setActiveChip(memberIndex ?? null)
    // A drag supersedes any tap-to-place selection so the two "picked up"
    // affordances never fight each other.
    setSelectedChip(null)
  }

  function handleDragCancel() {
    setActiveChip(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setSelectedChip(null)
    setActiveChip(null)
    const memberIndex = event.active.data.current?.memberIndex as number | undefined
    const overCode = (event.over?.data.current as { code?: string } | undefined)?.code
    const action = resolveChipDrop(memberIndex, event.over?.id, overCode)
    if (action.type === 'assign') onAssign(action.memberIndex, action.code)
    else if (action.type === 'unassign') onAssign(action.memberIndex, null)
  }

  function placeSelected(code: string | null) {
    if (selectedChip === null) return
    onAssign(selectedChip, code)
    setSelectedChip(null)
  }

  /**
   * Tap on a CLOSED flag chip — see `resolveFlagTap` for the three-way
   * branch (tap-to-place beats the whole-group shortcut, which beats plain
   * open-a-column).
   */
  function handleFlagTap(code: string) {
    const action = resolveFlagTap(code, selectedChip, openLanguages.length)
    setTapAnnouncement(flagTapAnnouncement(action, pickedUpName))
    if (action.type === 'place') {
      onAssign(action.memberIndex, action.code)
      setSelectedChip(null)
    } else if (action.type === 'assignEveryone') {
      onAssignEveryone(action.code)
    } else {
      onOpenLanguage(action.code)
    }
  }

  const nameOf = (id: string | number | undefined): string | null => {
    if (typeof id !== 'string' || !id.startsWith('lang-chip-')) return null
    return memberLabel(participantNames, Number(id.slice('lang-chip-'.length)))
  }
  const overLabel = (
    over: { id: string | number; data: { current?: unknown } } | null,
  ): string => {
    if (!over) return 'no drop target'
    const data = over.data.current as { code?: string; closed?: boolean } | undefined
    if (data?.code) {
      // A CLOSED flag chip doesn't have a column yet — "Add Spanish" tells a
      // screen-reader user what dropping here will DO, rather than naming a
      // column that does not exist on screen yet.
      return data.closed ? `Add ${languageName(data.code)}` : languageName(data.code)
    }
    if (over.id === UNASSIGNED_DROP_ID) return 'the unassigned tray'
    return 'a drop target'
  }
  const announcements: Announcements = {
    onDragStart({ active }) {
      return `Picked up ${nameOf(active.id) ?? 'person'}.`
    },
    onDragOver({ active, over }) {
      return `${nameOf(active.id) ?? 'Person'} is over ${overLabel(over)}.`
    },
    onDragEnd({ active, over }) {
      const who = nameOf(active.id) ?? 'Person'
      if (!over) return `${who} was dropped.`
      return `Assigned ${who} to ${overLabel(over)}.`
    },
    onDragCancel({ active }) {
      return `Cancelled. ${nameOf(active.id) ?? 'Person'} returned to its place.`
    },
  }

  return (
    <DndContext
      sensors={sensors}
      // See pointerThenClosestCenter: pointer-first so a chip released inside a
      // column resolves to that column, closestCenter fallback so a KEYBOARD
      // drag (which has no pointer, hence no pointerWithin collisions) lands.
      collisionDetection={pointerThenClosestCenter}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col gap-3" data-testid="participant-language-board">
        {/* landr-ajlwl: politely announces what a flag TAP just did. Always
            mounted (not inside the closedLanguages block below) so it survives
            tapping the very last closed flag, which removes that block. */}
        <span
          className="sr-only"
          role="status"
          aria-live="polite"
          data-testid="lang-tap-announcement"
        >
          {tapAnnouncement}
        </span>

        <NextAction
          active={nextActionCue !== null}
          cue={nextActionCue ?? ''}
          className="gap-3"
          data-testid="lang-next-action"
        >
          <UnassignedTray
            unassigned={unassigned}
            participantNames={participantNames}
            guestFlags={guestFlags}
            offeredLanguages={offeredLanguages}
            selectedChip={selectedChip}
            selectId={selectId}
            onSelectChip={(idx) =>
              setSelectedChip((cur) => (cur === idx ? null : idx))
            }
            onPlaceSelectedHere={() => placeSelected(null)}
            onAssign={onAssign}
          />

          {openLanguages.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {openLanguages.map((code) => (
                <LanguageColumn
                  key={code}
                  code={code}
                  memberIndices={membersOfLanguage(assignment, code, partyCount)}
                  participantNames={participantNames}
                  guestFlags={guestFlags}
                  selectedChip={selectedChip}
                  unassignedCount={unassigned.length}
                  onTapTarget={() => placeSelected(code)}
                  onAssign={onAssign}
                  onAssignEveryone={onAssignEveryone}
                  onCloseLanguage={onCloseLanguage}
                />
              ))}
            </div>
          ) : null}

          {/* "Add language" chip row — the operator's offered list minus what is
              already on screen. This is how a column comes into existence; the
              board starts with none open (epic decision D3). landr-jr30v: each
              chip is now ALSO a dnd-kit drop target (FlagDropChip) and its tap
              is routed through handleFlagTap, which assigns the whole party on
              the very first tap. The label reflects which state we're in. */}
          {closedLanguages.length > 0 ? (
            <div
              className="flex flex-wrap items-center gap-2"
              data-testid="lang-add-row"
            >
              <span className="text-xs text-muted-foreground">
                {openLanguages.length === 0 ? tr('languagesColon', locale) : tr('addLanguageColon', locale)}
              </span>
              {closedLanguages.map((code) => (
                <FlagDropChip
                  key={code}
                  code={code}
                  ariaLabel={flagTapLabel(
                    resolveFlagTap(code, selectedChip, openLanguages.length),
                    pickedUpName,
                  )}
                  onTap={() => handleFlagTap(code)}
                />
              ))}
            </div>
          ) : null}
        </NextAction>

        {/* Explicit per-member dropdown — the always-available a11y fallback,
            mirroring the room board's "Assign with dropdowns instead". */}
        <details className="rounded-md border border-border p-2">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            {tr('assignWithDropdownsInstead', locale)}
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {Array.from({ length: partyCount }, (_, idx) => (
              <label
                key={idx}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span>
                  {memberLabel(participantNames, idx)}
                  {guestFlags[idx] ? (
                    <span className="ml-1 text-xs text-muted-foreground">
                      {tr('guestSuffix', locale)}
                    </span>
                  ) : null}
                </span>
                <select
                  data-testid={`lang-assign-select-${idx}`}
                  value={assignment[idx] ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    onAssign(idx, v === '' ? null : v)
                  }}
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                >
                  <option value="">{tr('unassignedOption', locale)}</option>
                  {/* Every OFFERED language, not just the open columns: this
                      path opens the column as a side effect (the parent adds
                      any assigned language to the visible set), so the
                      customer never has to visit the chip row first. */}
                  {offeredLanguages.map((code) => (
                    <option key={code} value={code}>
                      {languageName(code)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </details>
      </div>

      {/* The floating drag clone, portalled to <body>: position:fixed breaks
          under transformed ancestors and StepTransition animates one. */}
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {activeChip !== null ? (
            <div
              data-testid="lang-chip-drag-overlay"
              style={{
                ...chipStyle(chipHue(activeChip), true, guestFlags[activeChip] ?? false),
                transform: 'rotate(6deg) scale(1.06)',
                cursor: 'grabbing',
              }}
              className={[
                chipClassName(guestFlags[activeChip] ?? false),
                'shadow-xl shadow-black/30',
              ].join(' ')}
            >
              <ChipInner
                label={memberLabel(participantNames, activeChip)}
                isGuest={guestFlags[activeChip] ?? false}
                selected
              />
            </div>
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}
