import { useId, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  occupantsOfUnit,
  roomUnitKey,
  type RoomAssignmentMap,
  type RoomUnit,
} from './accommodationCalc'

/**
 * RoomAssignment (landr-gb2f.2) — assigns participant NAME chips to per-unit
 * room slots. Three input modalities, all editing the same RoomAssignmentMap:
 *
 *   1. DRAG-AND-DROP (mouse / touch / keyboard) via @dnd-kit — a chip is
 *      dragged onto a room-unit drop zone (or back onto the "Unassigned"
 *      tray). KeyboardSensor makes it operable with Space/Enter + arrows.
 *   2. TAP-TO-PLACE fallback — tap a chip to "select" it, then tap a target
 *      unit (or the unassigned tray) to drop it there. Works on touch and
 *      avoids relying on drag for a11y-conscious users.
 *   3. Per-chip <select> dropdown — the most explicit, screen-reader-friendly
 *      path: each chip carries a native select listing every unit + Unassigned.
 *
 * The component is presentational: it never mutates state itself, it calls
 * `onAssign(participantIndex, target)` where target is a RoomUnit or null
 * (unassign). The parent (AccommodationStep) owns the map + auto-assign.
 *
 * Per landr-znl / react-refresh: this file exports ONLY the component as a
 * named export; pure helpers live in accommodationCalc.ts.
 */

const UNASSIGNED_DROP_ID = '__unassigned__'

interface Props {
  /** All assignable room units (expanded from the picked rooms). */
  units: RoomUnit[]
  /** Display names for participants, indexed by participant index. */
  participantNames: string[]
  /** Current assignment map (participantIndex → unit). */
  assignment: RoomAssignmentMap
  /**
   * Called when a participant is (re)assigned. `target` is the destination
   * unit, or null to move the participant back to the unassigned tray.
   */
  onAssign: (participantIndex: number, target: RoomUnit | null) => void
}

function participantLabel(names: string[], index: number): string {
  const name = (names[index] ?? '').trim()
  return name.length > 0 ? name : `Guest ${index + 1}`
}

/** A draggable participant name chip. */
function Chip({
  participantIndex,
  label,
  selected,
  onTap,
}: {
  participantIndex: number
  label: string
  selected: boolean
  onTap: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip-${participantIndex}`,
    data: { participantIndex },
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={onTap}
      data-testid={`participant-chip-${participantIndex}`}
      aria-pressed={selected}
      className={[
        'inline-flex cursor-grab items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors touch-none select-none',
        isDragging ? 'opacity-40' : '',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-muted/40 hover:bg-muted',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

/** A droppable room-unit slot. */
function UnitDropZone({
  unit,
  occupantIndices,
  participantNames,
  selectedChip,
  onTapTarget,
  onAssign,
}: {
  unit: RoomUnit
  occupantIndices: number[]
  participantNames: string[]
  selectedChip: number | null
  onTapTarget: () => void
  onAssign: (participantIndex: number, target: RoomUnit | null) => void
}) {
  const key = roomUnitKey(unit.roomProductId, unit.unitIndex)
  const { setNodeRef, isOver } = useDroppable({ id: `unit-${key}`, data: { unit } })
  const full = occupantIndices.length >= unit.capacity
  return (
    <div
      ref={setNodeRef}
      data-testid={`room-unit-${key}`}
      role="group"
      aria-label={`${unit.roomName} — unit ${unit.unitIndex + 1}`}
      className={[
        'flex flex-col gap-2 rounded-md border p-3 transition-colors',
        isOver
          ? 'border-primary bg-primary/10'
          : full
            ? 'border-border bg-muted/30'
            : 'border-dashed border-border',
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">
          {unit.roomName} #{unit.unitIndex + 1}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {occupantIndices.length}/{unit.capacity}
        </span>
      </div>
      <div className="flex min-h-[2rem] flex-wrap items-center gap-2">
        {occupantIndices.length === 0 ? (
          <span className="text-xs italic text-muted-foreground">Empty</span>
        ) : (
          occupantIndices.map((pIdx) => (
            <Chip
              key={pIdx}
              participantIndex={pIdx}
              label={participantLabel(participantNames, pIdx)}
              selected={selectedChip === pIdx}
              onTap={() =>
                // Tapping an already-assigned chip removes it from this unit
                // (back to unassigned) — the fastest way to free a slot.
                onAssign(pIdx, null)
              }
            />
          ))
        )}
      </div>
      {/* Tap-to-place target affordance — visible only while a chip is
          selected and this unit has room. Keeps the non-drag flow obvious. */}
      {selectedChip !== null && !full ? (
        <button
          type="button"
          onClick={onTapTarget}
          data-testid={`assign-here-${key}`}
          className="self-start rounded-md border border-primary px-2 py-1 text-xs text-primary hover:bg-primary/5"
        >
          Place here
        </button>
      ) : null}
    </div>
  )
}

export function RoomAssignment({
  units,
  participantNames,
  assignment,
  onAssign,
}: Props) {
  const selectId = useId()
  // tap-to-place: the currently "picked up" participant index (or null).
  const [selectedChip, setSelectedChip] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  )

  const participantCount = participantNames.length
  const assignedSet = new Set(Object.keys(assignment).map(Number))
  const unassignedIndices: number[] = []
  for (let i = 0; i < participantCount; i += 1) {
    if (!assignedSet.has(i)) unassignedIndices.push(i)
  }

  const unitByKey = new Map(
    units.map((u) => [roomUnitKey(u.roomProductId, u.unitIndex), u]),
  )

  function handleDragEnd(event: DragEndEvent) {
    setSelectedChip(null)
    const participantIndex = event.active.data.current?.participantIndex as
      | number
      | undefined
    if (participantIndex === undefined) return
    const overId = event.over?.id
    if (overId === undefined || overId === null) return
    if (overId === UNASSIGNED_DROP_ID) {
      onAssign(participantIndex, null)
      return
    }
    const targetUnit = (event.over?.data.current?.unit as RoomUnit | undefined) ?? null
    if (targetUnit) onAssign(participantIndex, targetUnit)
  }

  /** Tap-to-place resolver: drop the selected chip onto a target unit. */
  function placeSelected(target: RoomUnit | null) {
    if (selectedChip === null) return
    onAssign(selectedChip, target)
    setSelectedChip(null)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-3" data-testid="room-assignment">
        <p className="text-sm font-medium">Who stays where?</p>
        <p className="text-xs text-muted-foreground">
          Drag a name onto a room, or tap a name then tap a room. You can also
          use the dropdown on each name.
        </p>

        <UnassignedTray
          unassignedIndices={unassignedIndices}
          participantNames={participantNames}
          units={units}
          assignment={assignment}
          selectedChip={selectedChip}
          selectId={selectId}
          onSelectChip={(idx) =>
            setSelectedChip((cur) => (cur === idx ? null : idx))
          }
          onPlaceSelectedHere={() => placeSelected(null)}
          onAssign={onAssign}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {units.map((unit) => {
            const key = roomUnitKey(unit.roomProductId, unit.unitIndex)
            const occupants = occupantsOfUnit(assignment, unit)
            return (
              <div key={key} className="flex flex-col gap-1">
                <UnitDropZone
                  unit={unit}
                  occupantIndices={occupants}
                  participantNames={participantNames}
                  selectedChip={selectedChip}
                  onTapTarget={() => placeSelected(unit)}
                  onAssign={onAssign}
                />
              </div>
            )
          })}
        </div>

        {/* Explicit per-participant dropdown — the always-available a11y
            fallback. Lists every participant with a native <select> of all
            units + Unassigned. */}
        <details className="rounded-md border border-border p-2">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Assign with dropdowns instead
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {Array.from({ length: participantCount }, (_, pIdx) => {
              const entry = assignment[pIdx]
              const currentKey = entry
                ? roomUnitKey(entry.roomProductId, entry.unitIndex)
                : ''
              return (
                <label
                  key={pIdx}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span>{participantLabel(participantNames, pIdx)}</span>
                  <select
                    data-testid={`assign-select-${pIdx}`}
                    value={currentKey}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '') {
                        onAssign(pIdx, null)
                        return
                      }
                      const u = unitByKey.get(v) ?? null
                      onAssign(pIdx, u)
                    }}
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {units.map((u) => {
                      const k = roomUnitKey(u.roomProductId, u.unitIndex)
                      return (
                        <option key={k} value={k}>
                          {u.roomName} #{u.unitIndex + 1}
                        </option>
                      )
                    })}
                  </select>
                </label>
              )
            })}
          </div>
        </details>
      </div>
    </DndContext>
  )
}

/** The unassigned-participants tray — itself a drop zone (drag back to here). */
function UnassignedTray({
  unassignedIndices,
  participantNames,
  selectedChip,
  selectId,
  onSelectChip,
  onPlaceSelectedHere,
  units,
  assignment,
  onAssign,
}: {
  unassignedIndices: number[]
  participantNames: string[]
  selectedChip: number | null
  selectId: string
  onSelectChip: (idx: number) => void
  onPlaceSelectedHere: () => void
  units: RoomUnit[]
  assignment: RoomAssignmentMap
  onAssign: (participantIndex: number, target: RoomUnit | null) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_DROP_ID })
  const unitByKey = new Map(
    units.map((u) => [roomUnitKey(u.roomProductId, u.unitIndex), u]),
  )
  return (
    <div
      ref={setNodeRef}
      data-testid="unassigned-tray"
      className={[
        'flex flex-col gap-2 rounded-md border p-3 transition-colors',
        isOver ? 'border-primary bg-primary/10' : 'border-border bg-muted/20',
      ].join(' ')}
    >
      <span className="text-xs font-medium text-muted-foreground">
        Unassigned ({unassignedIndices.length})
      </span>
      <div className="flex min-h-[2rem] flex-wrap items-center gap-2">
        {unassignedIndices.length === 0 ? (
          <span className="text-xs italic text-muted-foreground">
            Everyone has a room.
          </span>
        ) : (
          unassignedIndices.map((pIdx) => (
            <div key={pIdx} className="flex items-center gap-1">
              <Chip
                participantIndex={pIdx}
                label={participantLabel(participantNames, pIdx)}
                selected={selectedChip === pIdx}
                onTap={() => onSelectChip(pIdx)}
              />
              {/* inline dropdown next to each unassigned chip for the most
                  direct keyboard/SR path */}
              <select
                aria-label={`Assign ${participantLabel(participantNames, pIdx)} to a room`}
                data-testid={`tray-select-${pIdx}`}
                id={`${selectId}-${pIdx}`}
                value=""
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '') return
                  const u = unitByKey.get(v) ?? null
                  if (u) onAssign(pIdx, u)
                }}
                className="rounded-md border border-border bg-background px-1 py-0.5 text-xs"
              >
                <option value="">→ room…</option>
                {units.map((u) => {
                  const k = roomUnitKey(u.roomProductId, u.unitIndex)
                  const occ = occupantsOfUnit(assignment, u).length
                  const full = occ >= u.capacity
                  return (
                    <option key={k} value={k} disabled={full}>
                      {u.roomName} #{u.unitIndex + 1}
                      {full ? ' (full)' : ''}
                    </option>
                  )
                })}
              </select>
            </div>
          ))
        )}
      </div>
      {selectedChip !== null ? (
        <button
          type="button"
          onClick={onPlaceSelectedHere}
          data-testid="unassign-here"
          className="self-start rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          Move selected here (unassign)
        </button>
      ) : null}
    </div>
  )
}
