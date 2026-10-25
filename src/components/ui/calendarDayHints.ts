import { createContext } from 'react'

/**
 * landr-rmcsu.5: optional per-day hint ("2 seats left") a picker supplies to
 * every CalendarDayButton below it. Returned text is appended to the day's
 * aria-label and used as its title (tooltip). Undefined → no hint for that
 * day. A context (not a DayPicker prop) because react-day-picker only hands
 * boolean modifiers to the day button, and a stable provider value keeps the
 * calendar from re-rendering per parent render. Lives in a .ts sibling so
 * calendar.tsx keeps exporting components only (react-refresh lint).
 */
export type CalendarDayHint = (date: Date) => string | undefined

export const CalendarDayHintContext = createContext<CalendarDayHint | null>(null)

/**
 * Group size the picker is filtering for. A dot day that is only too small for
 * this party (not full) says so in its aria-label. Null → no party known.
 */
export const CalendarPartyContext = createContext<number | null>(null)
