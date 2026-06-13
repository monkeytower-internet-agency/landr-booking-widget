/**
 * landr — RankedLanguagePicker
 *
 * The `language` custom-form field (WITH options) renders as a ranked,
 * draggable, multi-select picker: the customer TICKS every language they speak
 * (1–N) AND DRAGS them into preference order (favourite on top). The submitted
 * value is the array of SELECTED option codes in top-down order. The first
 * entry is the customer's preferred language (the backend uses it for the
 * email locale).
 *
 * Drag wiring MIRRORS RoomAssignment.tsx — accessible drag with @dnd-kit/core
 * only (the widget has @dnd-kit/core / -utilities / -accessibility but NOT
 * @dnd-kit/sortable, and adding a dependency would break the running dev
 * server). Each row is BOTH a draggable (useDraggable, id = option value) and a
 * droppable (useDroppable, id = option value). On dragEnd, if `over` is a
 * different row, the active code is moved to the over code's index in the order
 * array (an arrayMove-style splice). The KeyboardSensor makes the same reorder
 * operable with Space + arrows.
 *
 * The no-options `language` branch stays a free-text <input> in CustomFormStep
 * (this picker is only used when the field carries options).
 */
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useVariant } from '@/lib/variant'
import { cn } from '@/lib/utils'
import { pickLocalized } from '@/lib/locale'
import type { FlowFieldDef } from '@/api/flowTypes'

interface RankedLanguagePickerProps {
  field: FlowFieldDef
  /** Current ordered selected codes (top-down preference order). */
  value: string[]
  locale: string
  onChange: (key: string, value: string[]) => void
}

/**
 * arrayMove-style splice: move the item at `from` to `to`, shifting the rest.
 * Mirrors the reorder semantics @dnd-kit/sortable would provide, done by hand
 * since the widget deliberately does NOT depend on @dnd-kit/sortable.
 */
function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) {
    return arr
  }
  const next = arr.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/**
 * Build the initial display/drag order: the SELECTED codes first (in their
 * incoming order), then the remaining options in their declared order. Only
 * codes that are real options are kept (drops a stale draft value gracefully).
 */
function initialOrder(optionValues: string[], value: string[]): string[] {
  const optionSet = new Set(optionValues)
  const selectedInOrder = value.filter((v) => optionSet.has(v))
  const seen = new Set(selectedInOrder)
  const rest = optionValues.filter((v) => !seen.has(v))
  return [...selectedInOrder, ...rest]
}

/** A single language row — both draggable (handle/whole row) and droppable. */
function LanguageRow({
  field,
  code,
  label,
  checked,
  optionCardRadius,
  optionSelected,
  onToggle,
}: {
  field: FlowFieldDef
  code: string
  label: string
  checked: boolean
  optionCardRadius: string
  optionSelected: string
  onToggle: (code: string) => void
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: code,
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: code })

  return (
    <div
      ref={setDropRef}
      data-testid={`cf-lang-row-${code}`}
      className={cn(
        'flex items-center gap-3 border p-3 transition-[background-color,border-color]',
        optionCardRadius,
        checked ? optionSelected : 'border-border bg-surface-raised shadow-elev-1',
        isOver ? 'ring-1 ring-primary/40' : '',
        isDragging ? 'opacity-40' : '',
      )}
    >
      {/* Drag handle — the grab target for pointer/touch/keyboard reorder. The
          whole row is reorderable via this handle; the checkbox toggles
          inclusion without starting a drag. */}
      <button
        ref={setDragRef}
        type="button"
        {...listeners}
        {...attributes}
        data-testid={`cf-lang-handle-${code}`}
        aria-label={`Reorder ${label}`}
        className="cursor-grab touch-none select-none text-muted-foreground hover:text-foreground"
      >
        <span aria-hidden>≡</span>
      </button>
      <Checkbox
        id={`cf-${field.key}-${code}`}
        checked={checked}
        onCheckedChange={() => onToggle(code)}
        data-testid={`cf-lang-check-${code}`}
      />
      <Label
        htmlFor={`cf-${field.key}-${code}`}
        className="text-sm leading-snug cursor-pointer"
      >
        {label}
      </Label>
    </div>
  )
}

export function RankedLanguagePicker({
  field,
  value,
  locale,
  onChange,
}: RankedLanguagePickerProps) {
  const { tokens } = useVariant()

  const options = useMemo(() => field.options ?? [], [field.options])
  const optionValues = useMemo(() => options.map((o) => o.value), [options])
  const labelByCode = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of options) m.set(o.value, pickLocalized(o.label, o.label_localized, locale))
    return m
  }, [options, locale])

  // Display/drag order: ALL option codes; selected ones float to the top in
  // their incoming preference order. Initialised once from `value`.
  const [order, setOrder] = useState<string[]>(() => initialOrder(optionValues, value))
  // Selected set initialised from `value` (only real options).
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(value.filter((v) => optionValues.includes(v))),
  )
  // landr — the code currently being dragged, so the DragOverlay can render a
  // floating tilted clone that follows the cursor (matches the breakfast/name
  // chips in RoomAssignment). null when nothing is being dragged.
  const [activeCode, setActiveCode] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  )

  /** Emit the SELECTED codes in current top-down order. */
  function emit(nextOrder: string[], nextSelected: Set<string>) {
    const ordered = nextOrder.filter((c) => nextSelected.has(c))
    onChange(field.key, ordered)
  }

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      emit(order, next)
      return next
    })
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveCode(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCode(null)
    const activeId = event.active.id
    const overId = event.over?.id
    if (overId === undefined || overId === null || activeId === overId) return
    setOrder((prev) => {
      const from = prev.indexOf(String(activeId))
      const to = prev.indexOf(String(overId))
      const next = moveItem(prev, from, to)
      if (next !== prev) emit(next, selected)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-2" data-testid={`cf-field-${field.key}`}>
      <p className="text-xs text-muted-foreground">
        Tick every language you speak, and drag your preferred one to the top.
      </p>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveCode(null)}
      >
        <div className="flex flex-col gap-2">
          {order.map((code) => (
            <LanguageRow
              key={code}
              field={field}
              code={code}
              label={labelByCode.get(code) ?? code}
              checked={selected.has(code)}
              optionCardRadius={tokens.optionCardRadius}
              optionSelected={tokens.optionSelected}
              onToggle={toggle}
            />
          ))}
        </div>
        {/* Floating tilted clone of the dragged row, anchored to <body> so a
            transformed ancestor (the step transition) can't break position:fixed
            — same approach as RoomAssignment's chip overlay. */}
        {createPortal(
          <DragOverlay dropAnimation={null}>
            {activeCode !== null ? (
              <div
                data-testid="cf-lang-drag-overlay"
                style={{ transform: 'rotate(4deg) scale(1.05)', cursor: 'grabbing' }}
                className={cn(
                  'flex items-center gap-3 border p-3 shadow-xl shadow-black/30',
                  tokens.optionCardRadius,
                  selected.has(activeCode)
                    ? tokens.optionSelected
                    : 'border-border bg-surface-raised',
                )}
              >
                <span aria-hidden className="text-muted-foreground">≡</span>
                {selected.has(activeCode) ? (
                  <span aria-hidden className="text-primary text-xs">✓</span>
                ) : null}
                <span className="text-sm font-medium leading-snug">
                  {labelByCode.get(activeCode) ?? activeCode}
                </span>
              </div>
            ) : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
    </div>
  )
}
