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
import {
  chipHue,
  occupantsByRoomProduct,
  occupantsOfUnit,
  resolveBreakfastDropTarget,
  resolveNameDropUnit,
  roomBreakfastMode,
  roomBreakfastQty,
  roomUnitKey,
  unitBreakfastLabel,
  type BreakfastMap,
  type OccupantAgeMap,
  type OccupantAgeBand,
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
  /**
   * Display names for the WHOLE PARTY (landr-87n9.3), indexed by the
   * unified party-member index: guiding participants first (0..P-1), then
   * companions (P..P+C-1). The component is agnostic about the split — it
   * just renders one chip per name + uses `guestFlags` to badge companions.
   */
  participantNames: string[]
  /**
   * landr-87n9.3: parallel boolean array — `guestFlags[i] === true` marks
   * member i as a non-guiding companion so its chip renders a muted style
   * + a "guest" badge. Defaults to all-false (every chip is a participant)
   * so legacy call-sites need no change.
   */
  guestFlags?: boolean[]
  /** Current assignment map (memberIndex → unit). */
  assignment: RoomAssignmentMap
  /**
   * Called when a party member is (re)assigned. `target` is the destination
   * unit, or null to move the member back to the unassigned tray.
   */
  onAssign: (memberIndex: number, target: RoomUnit | null) => void
  /**
   * landr-doam.1: per-occupant age band + age map (memberIndex → entry).
   * Only assigned occupants ever appear. Missing key = adult (default).
   * The component renders an inline Adult/Child toggle + child-age input
   * next to each occupant chip in a room unit. Unassigned chips (in the
   * tray) never show the control.
   */
  ageMap?: OccupantAgeMap
  /**
   * landr-doam.1: called when the user changes an occupant's age band or
   * child age. The parent owns the map and passes it back down.
   */
  onAgeBandChange?: (
    memberIndex: number,
    band: OccupantAgeBand,
    age: number | null,
  ) => void
  /**
   * landr-z59y: raw per-room add-on selection map (roomProductId →
   * { addon_product_id → qty }). The summed qty per room product is the FIXED
   * number of breakfast chips for that product. Drives the breakfast UI mode
   * (none / all / partial), the "(N breakfasts)" room label, and how many
   * draggable breakfast chips to render. Absent / empty → no breakfast UI.
   */
  perRoomAddons?: Record<string, Record<string, number>>
  /**
   * landr-z59y: which occupants currently HOLD a breakfast chip
   * (memberIndex → true). Drives the per-occupant breakfast indicator + which
   * occupant a draggable chip sits on. The parent (AccommodationStep) owns the
   * map, keeps it clamped to exactly `qty` holders per room product, and passes
   * it back down. Absent → no occupant holds a chip.
   */
  breakfastMap?: BreakfastMap
  /**
   * landr-z59y: move a breakfast chip ONTO `memberIndex` (the occupant the
   * customer dropped the chip on). The parent re-clamps so the source occupant
   * (same room product) gives up its chip — the count stays fixed. Only fired
   * for 'partial'-mode products; 'all'-mode breakfast is automatic.
   */
  onBreakfastAssign?: (memberIndex: number) => void
}

function participantLabel(names: string[], index: number): string {
  const name = (names[index] ?? '').trim()
  return name.length > 0 ? name : `Guest ${index + 1}`
}

/** Plain label for a room unit in the <select> / <option> fallbacks. */
function unitOptionLabel(unit: RoomUnit): string {
  return `${unit.roomName} #${unit.unitIndex + 1}`
}

/**
 * landr-rc4l: per-chip accent colour. Each party member gets a stable hue
 * from chipHue(index) so the chips are "a bit colourful" and visually
 * distinct rather than a wall of identical grey pills.
 *
 *   - resting:  a translucent tint of the member's hue (so it reads fine on
 *               both the light card and a dark-mode card — the alpha lets
 *               whatever's behind it show through) + a saturated border.
 *   - selected / lifted: a SOLID saturated fill of the hue with white text.
 *               Used both for the tap-to-place "picked up" state and for the
 *               floating DragOverlay clone, so the active card stands out
 *               and stays readable over any page content while dragging.
 *   - guest:    same hue, fainter tint, paired with the dashed border below.
 */
function chipStyle(
  hue: number,
  selected: boolean,
  isGuest: boolean,
): CSSProperties {
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

/** Shared layout classes for the chip face — reused by the draggable chip
 *  and the DragOverlay clone so the floating card matches exactly. */
function chipClassName(isGuest: boolean): string {
  return [
    'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium select-none',
    isGuest ? 'border-dashed' : '',
  ].join(' ')
}

/** Inner content of a chip: the label + the optional muted "guest" badge. */
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

/** A draggable party-member name chip. Companions render a muted "guest" badge. */
function Chip({
  participantIndex,
  label,
  selected,
  isGuest = false,
  onTap,
}: {
  participantIndex: number
  label: string
  selected: boolean
  isGuest?: boolean
  onTap: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip-${participantIndex}`,
    data: { participantIndex },
  })
  const hue = chipHue(participantIndex)
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={onTap}
      data-testid={`participant-chip-${participantIndex}`}
      data-guest={isGuest ? 'true' : undefined}
      data-hue={hue}
      aria-pressed={selected}
      style={chipStyle(hue, selected, isGuest)}
      className={[
        chipClassName(isGuest),
        // While this chip is the drag source it fades to a faint ghost in
        // place — the tilted DragOverlay clone is what follows the cursor
        // (landr-rc4l), so the customer always sees the card being moved.
        'cursor-grab touch-none transition-transform hover:-translate-y-0.5',
        isDragging ? 'opacity-30' : '',
      ].join(' ')}
    >
      <ChipInner label={label} isGuest={isGuest} selected={selected} />
    </button>
  )
}

/**
 * landr-doam.1: inline Adult/Child control shown next to each assigned
 * occupant chip inside a room unit. Selecting 'child' reveals a small
 * required age input (0-17). Only renders for assigned occupants — the
 * unassigned tray never shows this control.
 */
function OccupantAgeControl({
  memberIndex,
  ageMap = {},
  onAgeBandChange,
}: {
  memberIndex: number
  ageMap: OccupantAgeMap
  onAgeBandChange: (
    memberIndex: number,
    band: OccupantAgeBand,
    age: number | null,
  ) => void
}) {
  const entry = ageMap[memberIndex]
  const band = entry?.band ?? 'adult'
  const age = entry?.age ?? null
  const isChild = band === 'child'
  return (
    <span className="flex items-center gap-1">
      <select
        data-testid={`age-band-select-${memberIndex}`}
        aria-label="Age band"
        value={band}
        onChange={(e) => {
          const next = e.target.value as OccupantAgeBand
          onAgeBandChange(memberIndex, next, next === 'adult' ? null : age)
        }}
        className="rounded border border-border bg-surface-page px-1 py-0.5 text-xs"
      >
        <option value="adult">Adult</option>
        <option value="child">Child</option>
      </select>
      {isChild ? (
        <input
          type="number"
          min={0}
          max={17}
          data-testid={`child-age-input-${memberIndex}`}
          aria-label="Child age"
          placeholder="Age"
          value={age === null ? '' : String(age)}
          onChange={(e) => {
            const raw = e.target.value
            const parsed = raw === '' ? null : Math.min(17, Math.max(0, parseInt(raw, 10)))
            onAgeBandChange(memberIndex, 'child', isNaN(parsed as number) ? null : parsed)
          }}
          className={[
            'w-14 rounded border px-1 py-0.5 text-xs',
            age === null ? 'border-destructive' : 'border-border',
            'bg-background',
          ].join(' ')}
          required
        />
      ) : null}
    </span>
  )
}

/**
 * landr-z59y: a draggable "Breakfast" chip held by occupant `memberIndex`.
 * Dragging it onto another occupant (of the same room product) reassigns the
 * breakfast. `static` (all-mode) renders the same face but non-draggable —
 * everyone gets breakfast so there is nothing to move. `ownerLabel` is the
 * holder's display name — woven into the accessible name so AT users hear
 * "Ada's breakfast — drag to another guest to move it" rather than a bare
 * "Breakfast" (the visual 🥐 is aria-hidden).
 */
function BreakfastChip({
  memberIndex,
  ownerLabel,
  isStatic = false,
}: {
  memberIndex: number
  ownerLabel: string
  isStatic?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `breakfast-${memberIndex}`,
    data: { breakfastFrom: memberIndex },
    disabled: isStatic,
  })
  const face = (
    <>
      <span aria-hidden>🥐</span>
      <span>Breakfast</span>
    </>
  )
  if (isStatic) {
    return (
      <span
        data-testid={`breakfast-chip-${memberIndex}`}
        data-breakfast-static="true"
        aria-label={`${ownerLabel} has breakfast`}
        className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary select-none"
      >
        {face}
      </span>
    )
  }
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      data-testid={`breakfast-chip-${memberIndex}`}
      aria-label={`${ownerLabel}'s breakfast — drag onto another guest to move it`}
      className={[
        'inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary select-none',
        'cursor-grab touch-none transition-transform hover:-translate-y-0.5',
        isDragging ? 'opacity-30' : '',
      ].join(' ')}
    >
      {face}
    </button>
  )
}

/**
 * landr-z59y: one assigned occupant inside a room unit. The row is itself a
 * droppable target for breakfast chips (so a chip dragged here reassigns the
 * breakfast to this occupant). It renders the draggable NAME chip, the optional
 * Adult/Child control, and — when this occupant holds breakfast — the breakfast
 * chip (draggable in 'partial' mode, static in 'all' mode).
 */
function OccupantRow({
  memberIndex,
  label,
  selected,
  isGuest,
  onUnassign,
  ageMap,
  onAgeBandChange,
  breakfastMode,
  hasBreakfast,
  onBreakfastAssign,
  breakfastDragActive,
}: {
  memberIndex: number
  label: string
  selected: boolean
  isGuest: boolean
  onUnassign: () => void
  ageMap: OccupantAgeMap
  onAgeBandChange?: (
    memberIndex: number,
    band: OccupantAgeBand,
    age: number | null,
  ) => void
  breakfastMode: ReturnType<typeof roomBreakfastMode>
  hasBreakfast: boolean
  onBreakfastAssign?: (memberIndex: number) => void
  /**
   * landr-z59y: true only while a BREAKFAST CHIP is the active drag. The
   * occupant breakfast-drop target is enabled ONLY then, so a NAME-chip drag
   * (room assignment) can never resolve to this nested droppable and silently
   * no-op (it would carry breakfastTarget, not .unit). See handleDragEnd.
   */
  breakfastDragActive: boolean
}) {
  // Only 'partial' mode allows reassigning breakfast, and only while a
  // breakfast chip is actually being dragged is this occupant a live target.
  const droppable = breakfastMode === 'partial' && breakfastDragActive
  const { setNodeRef, isOver } = useDroppable({
    id: `occupant-${memberIndex}`,
    data: { breakfastTarget: memberIndex },
    disabled: !droppable,
  })
  return (
    <div
      ref={setNodeRef}
      data-testid={`occupant-row-${memberIndex}`}
      className={[
        'flex flex-wrap items-center gap-2 rounded-md transition-colors',
        droppable && isOver ? 'ring-1 ring-primary/50 bg-primary/5' : '',
      ].join(' ')}
    >
      <Chip
        participantIndex={memberIndex}
        label={label}
        selected={selected}
        isGuest={isGuest}
        // Tapping an already-assigned chip removes it from this unit
        // (back to unassigned) — the fastest way to free a slot.
        onTap={onUnassign}
      />
      {/* landr-doam.1: Adult/Child control — only for assigned occupants. */}
      {onAgeBandChange ? (
        <OccupantAgeControl
          memberIndex={memberIndex}
          ageMap={ageMap}
          onAgeBandChange={onAgeBandChange}
        />
      ) : null}
      {/* landr-z59y: breakfast chip. Held occupants show it; in 'partial' mode
          it is draggable (move it to another occupant to reassign), in 'all'
          mode it is a static indicator (everyone eats). */}
      {hasBreakfast && breakfastMode !== 'none' ? (
        <BreakfastChip
          memberIndex={memberIndex}
          ownerLabel={label}
          isStatic={breakfastMode === 'all'}
        />
      ) : null}
      {/* Tap-to-place fallback for breakfast (a11y / no-drag): in partial mode,
          a one-tap "give breakfast here" when this occupant doesn't hold one.
          Gated on the MODE (not the live-drag flag) so it's always available. */}
      {breakfastMode === 'partial' && !hasBreakfast && onBreakfastAssign ? (
        <button
          type="button"
          data-testid={`give-breakfast-${memberIndex}`}
          aria-label={`Give breakfast to ${label}`}
          onClick={() => onBreakfastAssign(memberIndex)}
          className="rounded-md border border-primary/40 px-2 py-0.5 text-xs text-primary hover:bg-primary/5"
        >
          + breakfast
        </button>
      ) : null}
    </div>
  )
}

/** A droppable room-unit slot. */
function UnitDropZone({
  unit,
  occupantIndices,
  participantNames,
  guestFlags,
  selectedChip,
  onTapTarget,
  onAssign,
  ageMap = {},
  onAgeBandChange,
  breakfastMode = 'none',
  productHasBreakfast = false,
  breakfastMap = {},
  onBreakfastAssign,
  breakfastDragActive = false,
}: {
  unit: RoomUnit
  occupantIndices: number[]
  participantNames: string[]
  guestFlags: boolean[]
  selectedChip: number | null
  onTapTarget: () => void
  onAssign: (participantIndex: number, target: RoomUnit | null) => void
  ageMap: OccupantAgeMap
  onAgeBandChange?: (
    memberIndex: number,
    band: OccupantAgeBand,
    age: number | null,
  ) => void
  /** landr-z59y: breakfast UI mode for THIS unit's room product. */
  breakfastMode?: ReturnType<typeof roomBreakfastMode>
  /** landr-z59y: does the unit's room product have a breakfast add-on at all? */
  productHasBreakfast?: boolean
  /** landr-z59y: which occupants currently hold a breakfast chip. */
  breakfastMap?: BreakfastMap
  /** landr-z59y: drop a breakfast chip onto an occupant (partial mode). */
  onBreakfastAssign?: (memberIndex: number) => void
  /** landr-z59y: true while a breakfast chip is the active drag. */
  breakfastDragActive?: boolean
}) {
  const key = roomUnitKey(unit.roomProductId, unit.unitIndex)
  const { setNodeRef, isOver } = useDroppable({ id: `unit-${key}`, data: { unit } })
  const full = occupantIndices.length >= unit.capacity
  // landr-z59y: breakfast is a fixed set of chips owned by occupants. The label
  // reflects THIS unit's actual chip holders (so two units of one product label
  // independently and never over-report), not the product-total qty.
  const bfLabel = unitBreakfastLabel(occupantIndices, breakfastMap, productHasBreakfast)
  return (
    <div
      ref={setNodeRef}
      data-testid={`room-unit-${key}`}
      role="group"
      aria-label={`${unit.roomName} — unit ${unit.unitIndex + 1}`}
      className={[
        // landr-3mo4: occupied/full units read as a settled well; an empty
        // unit keeps its dashed "drop here" affordance; an active drop-over
        // lights up brand-tinted.
        'flex flex-col gap-2 rounded-lg border p-3 transition-colors',
        isOver
          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
          : full
            ? 'border-border bg-surface-well shadow-well'
            : 'border-dashed border-border bg-surface-raised',
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium" data-testid={`room-unit-title-${key}`}>
          {unit.roomName} #{unit.unitIndex + 1}
          {bfLabel ? (
            <span
              className="ml-1 text-xs font-medium text-primary"
              data-testid={`room-unit-breakfast-${key}`}
            >
              {bfLabel}
            </span>
          ) : null}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {occupantIndices.length}/{unit.capacity}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {occupantIndices.length === 0 ? (
          <span className="text-xs italic text-muted-foreground">Empty</span>
        ) : (
          occupantIndices.map((pIdx) => (
            <OccupantRow
              key={pIdx}
              memberIndex={pIdx}
              label={participantLabel(participantNames, pIdx)}
              selected={selectedChip === pIdx}
              isGuest={guestFlags[pIdx] ?? false}
              onUnassign={() => onAssign(pIdx, null)}
              ageMap={ageMap}
              onAgeBandChange={onAgeBandChange}
              breakfastMode={breakfastMode}
              hasBreakfast={breakfastMap[pIdx] === true}
              onBreakfastAssign={onBreakfastAssign}
              breakfastDragActive={breakfastDragActive}
            />
          ))
        )}
      </div>
      {/* Tap-to-place target affordance — visible while a chip is selected.
          A full unit still accepts a placement: it ROTATES the selected member
          in at the front and bumps the last occupant out (matching the drag
          behaviour), so the copy switches to "Swap in here". Keeps the non-drag
          flow at parity with drag-and-drop. */}
      {selectedChip !== null && !occupantIndices.includes(selectedChip) ? (
        <button
          type="button"
          onClick={onTapTarget}
          data-testid={`assign-here-${key}`}
          className="self-start rounded-md border border-primary px-2 py-1 text-xs text-primary hover:bg-primary/5"
        >
          {full ? 'Swap in here' : 'Place here'}
        </button>
      ) : null}
    </div>
  )
}

export function RoomAssignment({
  units,
  participantNames,
  guestFlags = [],
  assignment,
  onAssign,
  ageMap = {},
  onAgeBandChange,
  perRoomAddons = {},
  breakfastMap = {},
  onBreakfastAssign,
}: Props) {
  const selectId = useId()
  // tap-to-place: the currently "picked up" participant index (or null).
  const [selectedChip, setSelectedChip] = useState<number | null>(null)
  // landr-rc4l: the participant index currently being DRAGGED (or null).
  // Drives the tilted DragOverlay clone so the customer sees the card move
  // instead of dragging "blindly" while the source chip fades in place.
  const [activeChip, setActiveChip] = useState<number | null>(null)
  // landr-z59y: the member-index whose BREAKFAST chip is being dragged (or null).
  const [activeBreakfast, setActiveBreakfast] = useState<number | null>(null)

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

  // landr-z59y: per-room-product breakfast facts — chip qty, the product's
  // occupant count, and the resulting UI mode. Drives the unit title label +
  // whether breakfast chips are draggable.
  const occupantsByProduct = occupantsByRoomProduct(assignment)
  const breakfastByProduct = new Map<
    string,
    { qty: number; occCount: number; mode: ReturnType<typeof roomBreakfastMode> }
  >()
  for (const u of units) {
    if (breakfastByProduct.has(u.roomProductId)) continue
    const qty = roomBreakfastQty(u.roomProductId, perRoomAddons)
    const occCount = occupantsByProduct.get(u.roomProductId)?.length ?? 0
    breakfastByProduct.set(u.roomProductId, {
      qty,
      occCount,
      mode: roomBreakfastMode(qty, occCount),
    })
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current
    const breakfastFrom = data?.breakfastFrom as number | undefined
    if (breakfastFrom !== undefined) {
      setActiveBreakfast(breakfastFrom)
      setSelectedChip(null)
      return
    }
    const participantIndex = data?.participantIndex as number | undefined
    setActiveChip(participantIndex ?? null)
    // Starting a drag supersedes any tap-to-place selection so the two
    // "picked up" affordances don't fight each other.
    setSelectedChip(null)
  }

  function handleDragCancel() {
    setActiveChip(null)
    setActiveBreakfast(null)
  }

  /** landr-z59y: the RoomUnit an occupant is currently assigned to (or null). */
  function unitOfOccupant(memberIndex: number): RoomUnit | null {
    const entry = assignment[memberIndex]
    if (!entry) return null
    return unitByKey.get(roomUnitKey(entry.roomProductId, entry.unitIndex)) ?? null
  }

  function handleDragEnd(event: DragEndEvent) {
    setSelectedChip(null)
    setActiveChip(null)
    setActiveBreakfast(null)
    const data = event.active.data.current
    const overData = event.over?.data.current

    const over = overData as
      | { unit?: RoomUnit; breakfastTarget?: number }
      | undefined

    // landr-z59y: a breakfast chip dropped onto an occupant reassigns the
    // breakfast to that occupant (the parent re-clamps the source's chip away).
    // resolveBreakfastDropTarget defensively maps a near-miss onto a unit to a
    // sensible occupant so the move doesn't silently fail.
    const breakfastFrom = data?.breakfastFrom as number | undefined
    if (breakfastFrom !== undefined) {
      const target = resolveBreakfastDropTarget(
        over,
        breakfastFrom,
        breakfastMap,
        (unit) => occupantsOfUnit(assignment, unit),
      )
      if (target !== null) onBreakfastAssign?.(target)
      return
    }

    const participantIndex = data?.participantIndex as number | undefined
    if (participantIndex === undefined) return
    const overId = event.over?.id
    if (overId === undefined || overId === null) return
    if (overId === UNASSIGNED_DROP_ID) {
      onAssign(participantIndex, null)
      return
    }
    // resolveNameDropUnit defensively falls through a near-miss onto a nested
    // occupant droppable (which carries breakfastTarget, NOT .unit) to that
    // occupant's unit — without this the assignment would silently no-op
    // (the original regression).
    const targetUnit = resolveNameDropUnit(over, unitOfOccupant)
    if (targetUnit) onAssign(participantIndex, targetUnit)
  }

  /** Tap-to-place resolver: drop the selected chip onto a target unit. */
  function placeSelected(target: RoomUnit | null) {
    if (selectedChip === null) return
    onAssign(selectedChip, target)
    setSelectedChip(null)
  }

  // landr-z59y: screen-reader announcements for keyboard/AT drag — both the
  // name-chip room assignment and the breakfast-chip reassignment. Restores the
  // a11y parity lost when the OccupantBreakfastControl checkbox was removed.
  const nameOf = (id: string | number | undefined): string | null => {
    if (typeof id !== 'string') return null
    if (id.startsWith('chip-')) {
      return participantLabel(participantNames, Number(id.slice('chip-'.length)))
    }
    if (id.startsWith('breakfast-')) {
      return participantLabel(participantNames, Number(id.slice('breakfast-'.length)))
    }
    return null
  }
  const overLabel = (over: { id: string | number; data: { current?: unknown } } | null): string => {
    if (!over) return 'no drop target'
    const d = over.data.current as
      | { unit?: RoomUnit; breakfastTarget?: number }
      | undefined
    if (d?.unit) return `${d.unit.roomName} #${d.unit.unitIndex + 1}`
    if (d?.breakfastTarget !== undefined)
      return participantLabel(participantNames, d.breakfastTarget)
    if (over.id === UNASSIGNED_DROP_ID) return 'the unassigned tray'
    return 'a drop target'
  }
  const isBreakfast = (id: string | number): boolean =>
    typeof id === 'string' && id.startsWith('breakfast-')
  const announcements: Announcements = {
    onDragStart({ active }) {
      const who = nameOf(active.id) ?? 'item'
      return isBreakfast(active.id)
        ? `Picked up ${who}'s breakfast.`
        : `Picked up ${who}.`
    },
    onDragOver({ active, over }) {
      const who = nameOf(active.id) ?? 'item'
      return isBreakfast(active.id)
        ? `${who}'s breakfast is over ${overLabel(over)}.`
        : `${who} is over ${overLabel(over)}.`
    },
    onDragEnd({ active, over }) {
      const who = nameOf(active.id) ?? 'item'
      if (!over) return isBreakfast(active.id)
        ? `${who}'s breakfast was dropped.`
        : `${who} was dropped.`
      return isBreakfast(active.id)
        ? `Moved ${who}'s breakfast to ${overLabel(over)}.`
        : `Assigned ${who} to ${overLabel(over)}.`
    },
    onDragCancel({ active }) {
      const who = nameOf(active.id) ?? 'item'
      return `Cancelled. ${who} returned to its place.`
    },
  }

  return (
    <DndContext
      sensors={sensors}
      // landr-z59y: pointerWithin ranks the droppable the POINTER is inside over
      // the nested-rect intersection ratio, so a name chip released inside a
      // room card resolves to the room — not a small nested occupant droppable.
      // Combined with gating the occupant droppables on an active breakfast drag
      // (OccupantRow.breakfastDragActive), this prevents the silent no-op.
      collisionDetection={pointerWithin}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col gap-3" data-testid="room-assignment">
        <p className="text-sm font-medium">Who stays where?</p>
        <p className="text-xs text-muted-foreground">
          Drag a name onto a room, or tap a name then tap a room. You can also
          use the dropdown on each name. When a room has fewer breakfasts than
          guests, drag the Breakfast chip onto whoever gets it.
        </p>

        <UnassignedTray
          unassignedIndices={unassignedIndices}
          participantNames={participantNames}
          guestFlags={guestFlags}
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
            const bf = breakfastByProduct.get(unit.roomProductId)
            return (
              <div key={key} className="flex flex-col gap-1">
                <UnitDropZone
                  unit={unit}
                  occupantIndices={occupants}
                  participantNames={participantNames}
                  guestFlags={guestFlags}
                  selectedChip={selectedChip}
                  onTapTarget={() => placeSelected(unit)}
                  onAssign={onAssign}
                  ageMap={ageMap}
                  onAgeBandChange={onAgeBandChange}
                  breakfastMode={bf?.mode ?? 'none'}
                  productHasBreakfast={(bf?.qty ?? 0) > 0}
                  breakfastMap={breakfastMap}
                  onBreakfastAssign={onBreakfastAssign}
                  breakfastDragActive={activeBreakfast !== null}
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
                  <span>
                    {participantLabel(participantNames, pIdx)}
                    {guestFlags[pIdx] ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (guest)
                      </span>
                    ) : null}
                  </span>
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
                          {unitOptionLabel(u)}
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

      {/* landr-rc4l: the floating drag clone. Rendered OUTSIDE the normal
          flow and tilted ~6° with a lift + shadow — the "Trello card" look —
          so the customer can see exactly which name they're moving instead
          of dragging an invisible chip. Solid saturated fill (selected
          style) keeps it readable over any page content. */}
      {/* Portal to <body>: position:fixed breaks under transformed
          ancestors (StepTransition animates one); the portal makes the
          overlay viewport-anchored no matter what wraps this step. */}
      {createPortal(
        <DragOverlay dropAnimation={null}>
        {activeChip !== null ? (
          <div
            data-testid="chip-drag-overlay"
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
              label={participantLabel(participantNames, activeChip)}
              isGuest={guestFlags[activeChip] ?? false}
              selected
            />
          </div>
        ) : activeBreakfast !== null ? (
          // landr-z59y: floating Breakfast chip clone while it is being dragged
          // onto another occupant.
          <div
            data-testid="breakfast-drag-overlay"
            style={{ transform: 'rotate(6deg) scale(1.06)', cursor: 'grabbing' }}
            className="inline-flex items-center gap-1 rounded-full border border-primary/60 bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground shadow-xl shadow-black/30"
          >
            <span aria-hidden>🥐</span>
            <span>Breakfast</span>
          </div>
        ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}

/** The unassigned-participants tray — itself a drop zone (drag back to here). */
function UnassignedTray({
  unassignedIndices,
  participantNames,
  guestFlags,
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
  guestFlags: boolean[]
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
        // landr-3mo4: the unassigned tray is a recessed well so it reads as
        // the "holding area" the chips lift out of.
        'flex flex-col gap-2 rounded-lg border p-3 transition-colors',
        isOver
          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
          : 'border-border bg-surface-well shadow-well',
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
                isGuest={guestFlags[pIdx] ?? false}
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
                      {unitOptionLabel(u)}
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
