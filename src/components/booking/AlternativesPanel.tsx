import { createPortal } from 'react-dom'
import type { ProductAlternative } from '@/api/types'
import { formatDayLabel } from '@/components/booking/dateLabel'
import {
  anyRowsFor,
  courseRowsFor,
  dayRowsFor,
  monthKey,
  monthKeyOfIso,
  type AlternativeRow,
} from '@/components/booking/alternatives'
import { ALTERNATIVES_SLOT_ID } from '@/components/booking/alternativesSlot'
import { formatMoney } from '@/components/booking/priceSidebarHelpers'
import { useProductAlternatives } from '@/components/booking/useProductAlternatives'
import { browserLocale, pickLocalized } from '@/lib/locale'
import { tr } from '@/lib/strings'
import { useVariant } from '@/lib/variant'
import { cn } from '@/lib/utils'

/** What a tapped row hands over: the product, plus the date or course window the row stood for. */
export interface AlternativeSelection {
  product: ProductAlternative
  /** ISO day: a course row's start date, or the day picked on the date step. */
  date?: string
  /** Course row: the window to land on. */
  windowId?: string
}

export type AlternativeSelectHandler = (selection: AlternativeSelection) => void

function rowName(alt: ProductAlternative, locale: string): string {
  return pickLocalized(
    alt.name,
    alt.name_localized as Record<string, string> | null | undefined,
    locale,
  )
}

function PanelRows({
  rows,
  heading,
  onSelect,
  layout,
  pickedDay,
}: {
  rows: AlternativeRow[]
  heading: string
  onSelect?: AlternativeSelectHandler
  layout: 'strip' | 'list'
  /** First day picked on the date step; carried by rows that carry no date of their own. */
  pickedDay?: string
}) {
  const { tokens } = useVariant()
  const locale = browserLocale()
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h4 className="text-sm font-semibold">{heading}</h4>
      <ul
        className={cn(
          'flex gap-2',
          layout === 'strip'
            ? 'flex-row overflow-x-auto pb-1'
            : 'max-h-80 flex-col overflow-y-auto',
        )}
      >
        {rows.map((row) => {
          const alt = row.alternative
          const name = rowName(alt, locale)
          const price =
            alt.price_from && alt.currency
              ? tr('priceFromTemplate', locale).replace(
                  '{price}',
                  formatMoney(alt.price_from, alt.currency, locale),
                )
              : null
          const starts = row.startDate
            ? tr('alternativesStartsTemplate', locale).replace(
                '{date}',
                formatDayLabel(row.startDate, locale),
              )
            : null
          const label = [name, starts, price].filter(Boolean).join(', ')
          return (
            <li key={row.key} className={layout === 'strip' ? 'shrink-0' : undefined}>
              <button
                type="button"
                aria-label={label}
                data-testid={`alternative-row-${row.key}`}
                onClick={() =>
                  onSelect?.({
                    product: alt,
                    date: row.startDate ?? pickedDay,
                    windowId: row.windowId,
                  })
                }
                className={cn(
                  'tap-44 flex w-full items-center gap-3 border border-border bg-surface-raised p-2 text-left transition-colors hover:border-primary/40',
                  layout === 'strip' ? 'min-w-56' : null,
                  tokens.optionCardRadius,
                  tokens.focusRing,
                )}
              >
                {alt.thumb_url ? (
                  <img
                    src={alt.thumb_url}
                    alt=""
                    loading="lazy"
                    className="size-10 shrink-0 rounded-md object-cover"
                  />
                ) : null}
                <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{name}</span>
                    {starts ? (
                      <span className="text-xs text-muted-foreground">{starts}</span>
                    ) : null}
                  </span>
                  {price ? (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {price}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function PanelBody({
  groups,
  onSelect,
  layout,
  testId,
  className,
  pickedDay,
}: {
  groups: { heading: string; rows: AlternativeRow[] }[]
  onSelect?: AlternativeSelectHandler
  layout: 'strip' | 'list'
  testId: string
  className?: string
  pickedDay?: string
}) {
  return (
    <section
      data-testid={testId}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-xl border bg-surface-card p-4',
        className,
      )}
    >
      {groups.map((g) => (
        <PanelRows
          key={g.heading}
          rows={g.rows}
          heading={g.heading}
          onSelect={onSelect}
          layout={layout}
          pickedDay={pickedDay}
        />
      ))}
    </section>
  )
}

interface SectionProps {
  productId: string
  /** Seats the group needs; narrows the alternatives to days that fit. */
  party?: number
  /** ISO days picked so far; day-shaped alternatives must be open on all. */
  selectedDays?: string[]
  /** The calendar month in view; courses starting in it are listed. */
  month?: Date
  /** Fully-booked state: list everything open in the next two months. */
  anyOpen?: boolean
  /** Landr: tapping a row (wired by the product switch). No-op when absent. */
  onSelectAlternative?: AlternativeSelectHandler
  /**
   * Alternatives the caller already fetched (the calendar dots read the same
   * response). When given, this panel makes no request of its own.
   */
  alternatives?: ProductAlternative[] | null
  /** Operator IANA zone; the request range starts at the operator's today. */
  operatorTimezone?: string | null
}

/**
 * "Also available" panel of the date step: other products linked to this one
 * that are open on the picked day(s), plus courses starting in the visible
 * month. Renders nothing at all (no skeleton, no reserved space) until the
 * data is in and there is at least one row, so a product without linked
 * alternatives looks exactly as before.
 */
export function AlternativesSection({
  productId,
  party = 1,
  selectedDays = [],
  month,
  anyOpen = false,
  onSelectAlternative,
  alternatives,
  operatorTimezone,
}: SectionProps) {
  const locale = browserLocale()
  const visible = month ?? new Date()
  const visibleKey = monthKey(visible)
  const months = anyOpen
    ? [visibleKey, monthKey(new Date(visible.getFullYear(), visible.getMonth() + 1, 1))]
    : [...new Set([visibleKey, ...selectedDays.map(monthKeyOfIso)])].sort()
  const fetched = useProductAlternatives(
    productId,
    alternatives === undefined ? months : [],
    party,
    operatorTimezone,
  )
  const data = alternatives === undefined ? fetched : alternatives
  if (!data) return null

  const groups: { heading: string; rows: AlternativeRow[] }[] = []
  if (anyOpen) {
    const rows = anyRowsFor(data)
    if (rows.length > 0) groups.push({ heading: tr('alternativesHeadingAny', locale), rows })
  } else {
    const dayRows = dayRowsFor(data, selectedDays)
    if (dayRows.length > 0) {
      groups.push({
        heading: tr(
          selectedDays.length > 1 ? 'alternativesHeadingDays' : 'alternativesHeadingDay',
          locale,
        ),
        rows: dayRows,
      })
    }
    const courseRows = courseRowsFor(data, [visibleKey])
    if (courseRows.length > 0) {
      const monthName = new Intl.DateTimeFormat(locale, { month: 'long' }).format(visible)
      groups.push({
        heading: tr('alternativesHeadingCourses', locale).replace('{month}', monthName),
        rows: courseRows,
      })
    }
  }
  if (groups.length === 0) return null

  const slot =
    typeof document !== 'undefined' ? document.getElementById(ALTERNATIVES_SLOT_ID) : null
  return (
    <>
      <PanelBody
        groups={groups}
        onSelect={onSelectAlternative}
        pickedDay={selectedDays[0]}
        layout="strip"
        testId="alternatives-panel-mobile"
        className={slot ? 'md:hidden' : undefined}
      />
      {slot
        ? createPortal(
            <PanelBody
              groups={groups}
              onSelect={onSelectAlternative}
              pickedDay={selectedDays[0]}
              layout="list"
              testId="alternatives-panel-desktop"
            />,
            slot,
          )
        : null}
    </>
  )
}
