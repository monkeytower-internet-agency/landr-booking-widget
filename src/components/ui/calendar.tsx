import * as React from "react"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
} from "react-day-picker"

import { de as dayPickerDe, es as dayPickerEs, tr as dayPickerTr } from "react-day-picker/locale"

import { cn } from "@/lib/utils"
import { browserLocale } from "@/lib/locale"
import { resolveUiLanguage, tr } from "@/lib/strings"
import { CalendarDayHintContext, CalendarPartyContext } from "@/components/ui/calendarDayHints"
import { Button, buttonVariants } from "@/components/ui/button"

// landr-8r6oc.4: month/weekday names follow the customer's resolved locale.
// English is react-day-picker's built-in default, so only the other widget
// languages need a catalog; a language without an entry falls back to English.
// react-day-picker's locale objects also carry the translated aria labels
// (Go to next month, day buttons, dropdowns), which DayPicker reads by itself.
const DAY_PICKER_LOCALES: Record<string, React.ComponentProps<typeof DayPicker>["locale"]> = {
  de: dayPickerDe,
  es: dayPickerEs,
  tr: dayPickerTr,
}

// react-day-picker appends ", <selected word>" to a selected day's label
// (in the customer's language); the diff view swaps that for its own state word.
function stripSelectedSuffix(label: string, selectedWord: string): string {
  const suffix = `, ${selectedWord}`
  return label.endsWith(suffix) ? label.slice(0, -suffix.length) : label
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  // landr-8yaz: default to Monday-first weeks for the European audience.
  // react-day-picker accepts 0=Sunday … 6=Saturday; callers can still
  // override per-instance if a locale-driven first day is wired up later
  // (operator.default_locale is the planned source for v2).
  weekStartsOn = 1,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()
  const customerLocale = browserLocale()
  // landr-53vao: several months side by side get a wider root and a row
  // layout driven by the month count (not a viewport breakpoint — the widget
  // lives inside host iframes); a single month keeps the 22rem column.
  const multiMonth = (props.numberOfMonths ?? 1) > 1

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      weekStartsOn={weekStartsOn}
      locale={DAY_PICKER_LOCALES[resolveUiLanguage(customerLocale)]}
      className={cn(
        // landr-3mo4: day cells are 44px on mobile (WCAG 2.5.5 touch target),
        // tightening to the original 36px from sm upward where pointer input
        // is precise and horizontal space is tighter inside the card.
        "group/calendar bg-background p-0 sm:p-3 [--cell-size:--spacing(11)] sm:[--cell-size:--spacing(9)] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString(customerLocale, { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn(
          "w-full",
          multiMonth ? "max-w-[44rem]" : "max-w-[22rem]",
          defaultClassNames.root
        ),
        months: cn(
          "relative flex",
          multiMonth ? "flex-row gap-6" : "flex-col gap-4",
          defaultClassNames.months
        ),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "relative rounded-md border border-input shadow-xs has-focus:border-ring has-focus:ring-[3px] has-focus:ring-ring/50",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "absolute inset-0 bg-popover opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "font-medium select-none",
          captionLayout === "label"
            ? "text-sm"
            : "flex h-8 items-center gap-1 rounded-md pr-1 pl-2 text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground",
          defaultClassNames.caption_label
        ),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "flex-1 rounded-md text-[0.8rem] font-normal text-muted-foreground select-none",
          defaultClassNames.weekday
        ),
        // landr-xxh5r: shadcn upstream sets this; without it WebKit lays the
        // table out with default (separate) borders.
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn(
          "w-(--cell-size) select-none",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "text-[0.8rem] text-muted-foreground select-none",
          defaultClassNames.week_number
        ),
        day: cn(
          "group/day relative h-(--cell-size) w-full min-w-0 flex-1 p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-md",
          props.showWeekNumber
            ? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-md"
            : "[&:first-child[data-selected=true]_button]:rounded-l-md",
          defaultClassNames.day
        ),
        range_start: cn(
          "rounded-l-md bg-accent",
          defaultClassNames.range_start
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("rounded-r-md bg-accent", defaultClassNames.range_end),
        today: cn(
          "rounded-md bg-accent text-accent-foreground data-[selected=true]:rounded-none",
          defaultClassNames.today
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon className={cn("size-4", className)} {...props} />
            )
          }

          if (orientation === "right") {
            return (
              <ChevronRightIcon
                className={cn("size-4", className)}
                {...props}
              />
            )
          }

          return (
            <ChevronDownIcon className={cn("size-4", className)} {...props} />
          )
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  // landr-otml0.3 — the invite-mode original-vs-new diff view, ported from
  // the dashboard's CalendarDayButton (landr-fxza.5 Section C). `diffAdded` /
  // `diffRemoved` are custom modifiers MultiDayPicker feeds through
  // Calendar's `modifiers` prop ONLY when it has an `originalValue` baseline
  // to diff against; both are `undefined` (falsy) for every other Calendar
  // usage in this widget, so this whole block is a no-op split there.
  const diffAdded = modifiers.diffAdded === true
  const diffRemoved = modifiers.diffRemoved === true
  // landr-rmcsu.5: `short` = the day has seats, but fewer than the group
  // needs (MultiDayPicker / SingleDatePicker feed it). Struck through in
  // amber; the hint context adds "n seats left" to the label + tooltip.
  const short = modifiers.short === true
  // Staff override pickers: a day customers cannot book (blocked weekday, full,
  // outside the schedule) that the operator may still force-book.
  const override = modifiers.override === true
  // The product itself is full that day but another activity is free: the day
  // stays clickable, marked by a small dot (never a fill colour).
  const altOnly = modifiers.altOnly === true
  // The product has no slot at all that day (not merely full): wording only.
  const notOffered = modifiers.notOffered === true
  const hintFor = React.useContext(CalendarDayHintContext)
  const party = React.useContext(CalendarPartyContext)
  const hint = hintFor?.(day.date)

  const isSelectedSingle =
    modifiers.selected &&
    !modifiers.range_start &&
    !modifiers.range_end &&
    !modifiers.range_middle

  // landr-711 / dashboard landr-fxza.5 parity: compute the primary-selected
  // background in JS (rather than the data-attribute CSS selector alone) so
  // it can be suppressed when a diff class applies — twMerge doesn't reliably
  // dedupe a bare `bg-diff-added-soft-bg` against
  // `data-[selected-single=true]:bg-primary` since they don't share a
  // variant chain.
  const isPlainSelected = isSelectedSingle && !diffAdded && !diffRemoved

  const { children, "aria-label": ariaLabelProp, ...restProps } = props
  // landr-8r6oc.18: the diff-state words follow the customer's language.
  const customerLocale = browserLocale()

  let content: React.ReactNode = children
  let ariaLabel: string | undefined = ariaLabelProp
  if (diffAdded || diffRemoved) {
    const base =
      typeof ariaLabelProp === "string"
        ? stripSelectedSuffix(ariaLabelProp, tr("calendarDaySelected", customerLocale))
        : undefined
    ariaLabel = `${base}, ${tr(diffAdded ? "calendarDayAdded" : "calendarDayRemoved", customerLocale)}`
    content = (
      <>
        <span
          aria-hidden="true"
          className="absolute top-0.5 right-1 text-[0.6em] leading-none"
        >
          {diffAdded ? "+" : "−"}
        </span>
        {children}
      </>
    )
  }

  if (altOnly) {
    const base =
      typeof ariaLabelProp === "string"
        ? stripSelectedSuffix(ariaLabelProp, tr("calendarDaySelected", customerLocale))
        : ""
    const altWord =
      short && party !== null
        ? tr("altDayShortAria", customerLocale).replace("{n}", String(party))
        : tr(notOffered ? "altDayNotOfferedAria" : "altDayAria", customerLocale)
    ariaLabel = `${base}: ${altWord}${
      modifiers.selected ? `, ${tr("calendarDaySelected", customerLocale)}` : ""
    }`
    content = (
      <>
        {content}
        <span
          aria-hidden="true"
          data-testid="alt-only-dot"
          className={cn(
            "absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary",
            modifiers.selected && "bg-primary-foreground",
          )}
        />
      </>
    )
  }

  if (hint) {
    ariaLabel = ariaLabel ? `${ariaLabel}, ${hint}` : hint
  }

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={isSelectedSingle}
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      data-diff={diffAdded ? "added" : diffRemoved ? "removed" : undefined}
      data-short={short || undefined}
      data-override={override || undefined}
      data-alt-only={altOnly || undefined}
      aria-label={ariaLabel}
      title={hint}
      className={cn(
        "relative flex size-auto h-(--cell-size) w-full min-w-0 flex-col gap-1 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-primary/15 data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-md data-[range-start=true]:rounded-l-md data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground [&>span]:text-xs [&>span]:opacity-70",
        // landr-tkgx8.2: the ghost variant's grey `hover:bg-accent` (the
        // widget theme only sets --primary, never --accent) painted over the
        // selected day while the pointer still rested on it after the click.
        // Unselected days hover in a light operator tint; selected / range
        // endpoints keep the solid operator colour while hovered. These
        // hover:* classes replace the ghost ones via tailwind-merge.
        "hover:bg-primary/10 hover:text-foreground dark:hover:bg-primary/20 dark:hover:text-foreground",
        "data-[range-end=true]:hover:bg-primary data-[range-end=true]:hover:text-primary-foreground data-[range-middle=true]:hover:bg-primary/15 data-[range-start=true]:hover:bg-primary data-[range-start=true]:hover:text-primary-foreground",
        isPlainSelected &&
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground dark:hover:bg-primary dark:hover:text-primary-foreground",
        diffAdded &&
          "bg-diff-added-soft-bg text-diff-added hover:bg-diff-added-soft-bg/70 hover:text-diff-added",
        diffRemoved &&
          "bg-destructive/10 text-destructive line-through hover:bg-destructive/15 hover:text-destructive",
        short && "line-through decoration-2",
        short &&
          !modifiers.selected &&
          "text-amber-700 decoration-amber-600 dark:text-amber-400 dark:decoration-amber-400",
        override &&
          !modifiers.selected &&
          "text-muted-foreground underline decoration-dotted underline-offset-4",
        defaultClassNames.day,
        className
      )}
      {...restProps}
    >
      {content}
    </Button>
  )
}

export { Calendar, CalendarDayButton }
