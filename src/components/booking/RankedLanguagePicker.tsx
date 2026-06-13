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
 * Reorder uses @dnd-kit/sortable — the SAME "the row/box lifts and moves in
 * place" interaction as the dashboard's pricing-rule reorder (each row carries
 * the live CSS.Transform from useSortable; verticalListSortingStrategy shifts
 * the others). No separate floating chip clone — the box itself moves.
 *
 * The no-options `language` branch stays a free-text <input> in CustomFormStep
 * (this picker is only used when the field carries options).
 */
import { useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

/** A single sortable language row — the whole box lifts + moves while dragged. */
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: code })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`cf-lang-row-${code}`}
      className={cn(
        'flex items-center gap-3 border p-3 transition-[background-color,border-color]',
        optionCardRadius,
        checked ? optionSelected : 'border-border bg-surface-raised shadow-elev-1',
        // While dragging, the box lifts: elevated above siblings with a strong
        // shadow so it clearly reads as "picked up and moving" (price-rule feel).
        isDragging ? 'relative z-10 shadow-xl shadow-black/30 opacity-95' : '',
      )}
    >
      {/* Drag handle — the grab target for pointer/touch/keyboard reorder. The
          checkbox toggles inclusion without starting a drag. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
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
    for (const o of options)
      m.set(o.value, pickLocalized(o.label, o.label_localized, locale))
    return m
  }, [options, locale])

  // Display/drag order: ALL option codes; selected ones float to the top in
  // their incoming preference order. Initialised once from `value`.
  const [order, setOrder] = useState<string[]>(() =>
    initialOrder(optionValues, value),
  )
  // Selected set initialised from `value` (only real options).
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(value.filter((v) => optionValues.includes(v))),
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  /** Emit the SELECTED codes in current top-down order. */
  function emit(nextOrder: string[], nextSelected: Set<string>) {
    onChange(
      field.key,
      nextOrder.filter((c) => nextSelected.has(c)),
    )
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrder((prev) => {
      const oldIndex = prev.indexOf(String(active.id))
      const newIndex = prev.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return prev
      const next = arrayMove(prev, oldIndex, newIndex)
      emit(next, selected)
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
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
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
        </SortableContext>
      </DndContext>
    </div>
  )
}
