/**
 * landr-r6e5x.4 — ParticipantLanguageBoard
 *
 * Epic decision D3: assign EVERY party member (guiding participants and
 * non-guiding companions alike) to exactly one of the operator's offered
 * guide languages, using the same interaction the AccommodationStep uses to
 * put people in hotel rooms — so a customer who has already done the room
 * board recognises this one immediately.
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
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { chipHue } from './accommodationCalc'
import {
  languageFlag,
  languageName,
  memberLabel,
  membersOfLanguage,
  unassignedMemberIndices,
  type ParticipantLanguageMap,
} from './participantLanguages'

const UNASSIGNED_DROP_ID = '__lang_unassigned__'

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
  /** Open a column for `code` (from the "Add language" chip row). */
  onOpenLanguage: (code: string) => void
  /** Remove an EMPTY column. */
  onCloseLanguage: (code: string) => void
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
          guest
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
  onTapTarget,
  onAssign,
  onCloseLanguage,
}: {
  code: string
  memberIndices: number[]
  participantNames: string[]
  guestFlags: boolean[]
  selectedChip: number | null
  onTapTarget: () => void
  onAssign: (memberIndex: number, code: string | null) => void
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
            Drop names here
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
          Place here
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
  openLanguages,
  selectedChip,
  selectId,
  onSelectChip,
  onPlaceSelectedHere,
  onAssign,
}: {
  unassigned: number[]
  participantNames: string[]
  guestFlags: boolean[]
  openLanguages: string[]
  selectedChip: number | null
  selectId: string
  onSelectChip: (idx: number) => void
  onPlaceSelectedHere: () => void
  onAssign: (memberIndex: number, code: string | null) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_DROP_ID })
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
        Unassigned ({unassigned.length})
      </span>
      <div className="flex min-h-[2rem] flex-wrap items-center gap-2">
        {unassigned.length === 0 ? (
          <span
            className="text-xs italic text-muted-foreground"
            data-testid="lang-everyone-assigned"
          >
            Everyone has a language.
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
                  path. Lists every OPEN column; opening a new one is the
                  "Add language" chip row above. */}
              <select
                aria-label={`Assign ${memberLabel(participantNames, idx)} to a language`}
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
                <option value="">→ language…</option>
                {openLanguages.map((code) => (
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

export function ParticipantLanguageBoard({
  offeredLanguages,
  openLanguages,
  participantNames,
  guestFlags = [],
  assignment,
  onAssign,
  onOpenLanguage,
  onCloseLanguage,
}: Props) {
  const selectId = useId()
  // tap-to-place: the currently "picked up" member index (or null).
  const [selectedChip, setSelectedChip] = useState<number | null>(null)
  // the member index currently being DRAGGED — drives the floating clone.
  const [activeChip, setActiveChip] = useState<number | null>(null)

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
    if (memberIndex === undefined) return
    const overId = event.over?.id
    if (overId === undefined || overId === null) return
    if (overId === UNASSIGNED_DROP_ID) {
      onAssign(memberIndex, null)
      return
    }
    const code = (event.over?.data.current as { code?: string } | undefined)?.code
    if (code) onAssign(memberIndex, code)
  }

  function placeSelected(code: string | null) {
    if (selectedChip === null) return
    onAssign(selectedChip, code)
    setSelectedChip(null)
  }

  const nameOf = (id: string | number | undefined): string | null => {
    if (typeof id !== 'string' || !id.startsWith('lang-chip-')) return null
    return memberLabel(participantNames, Number(id.slice('lang-chip-'.length)))
  }
  const overLabel = (
    over: { id: string | number; data: { current?: unknown } } | null,
  ): string => {
    if (!over) return 'no drop target'
    const code = (over.data.current as { code?: string } | undefined)?.code
    if (code) return languageName(code)
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
      // pointerWithin ranks the droppable the POINTER is inside, so a chip
      // released inside a column resolves to that column rather than to a
      // rect-overlapping neighbour.
      collisionDetection={pointerWithin}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col gap-3" data-testid="participant-language-board">
        <p className="text-xs text-muted-foreground">
          Open a language below, then drag each person into it — or tap a name
          and then tap a language. Everyone needs exactly one.
        </p>

        <UnassignedTray
          unassigned={unassigned}
          participantNames={participantNames}
          guestFlags={guestFlags}
          openLanguages={openLanguages}
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
                onTapTarget={() => placeSelected(code)}
                onAssign={onAssign}
                onCloseLanguage={onCloseLanguage}
              />
            ))}
          </div>
        ) : null}

        {/* "Add language" chip row — the operator's offered list minus what is
            already on screen. This is how a column comes into existence; the
            board starts with none open (epic decision D3). */}
        {closedLanguages.length > 0 ? (
          <div
            className="flex flex-wrap items-center gap-2"
            data-testid="lang-add-row"
          >
            <span className="text-xs text-muted-foreground">Add language:</span>
            {closedLanguages.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onOpenLanguage(code)}
                data-testid={`lang-add-${code}`}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-sm hover:border-primary hover:bg-primary/5"
              >
                <span aria-hidden>{languageFlag(code)}</span>
                {languageName(code)}
              </button>
            ))}
          </div>
        ) : null}

        {/* Explicit per-member dropdown — the always-available a11y fallback,
            mirroring the room board's "Assign with dropdowns instead". */}
        <details className="rounded-md border border-border p-2">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Assign with dropdowns instead
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
                      (guest)
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
                  <option value="">Unassigned</option>
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
