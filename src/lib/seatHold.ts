/**
 * landr-f987a.4: seat-hold helpers — the party-size check (guiding
 * participants + invited separate_guiding companions) and the hold-deadline
 * formatting (absolute viewer-locale time plus a relative hint).
 */
import type { AvailabilitySlot, HotelOffering } from '@/api/types'
import type { CompanionDetails } from '@/components/booking/detailsTypes'
import { isDayBookable } from '@/components/booking/bookability'
import { dateFromIso } from '@/components/booking/dateUtils'
import { holdRelativeTemplates } from '@/lib/strings'

/** Seats the host party needs on every day: guiding participants + invitees. */
export function seatsNeeded(
  participantCount: number,
  companions: readonly Pick<CompanionDetails, 'companion_kind'>[] = [],
  /** Product's invite_hold_hours: 0 = nothing held for invitees, absent = on. */
  inviteHoldHours?: number | null,
): number {
  if (inviteHoldHours === 0) return participantCount
  const invitees = companions.filter((c) => c.companion_kind === 'separate_guiding').length
  return participantCount + invitees
}

export interface ShortDay {
  date: string
  left: number
  need: number
}

/** Days (sorted) whose free seats cannot take `need` people. Missing rows are not judged. */
export function shortDays(
  slots: readonly AvailabilitySlot[],
  days: readonly string[],
  need: number,
): ShortDay[] {
  if (need <= 1) return []
  const byDate = new Map(slots.map((s) => [s.date, s.available_seats]))
  return [...days]
    .sort()
    .filter((d) => byDate.has(d) && (byDate.get(d) as number) < need)
    .map((d) => ({ date: d, left: Math.max(0, byDate.get(d) as number), need }))
}

/**
 * landr-rmcsu.5: the widget's party-size fallback when the product sets no
 * `max_party_size` (6 = booker + the legacy 5 additional participants).
 */
export const DEFAULT_MAX_PARTY_SIZE = 6

/** Largest group the dates-step stepper offers: `max_party_size`, else 6. */
export function maxPartySize(maxPartySizeField: number | null | undefined): number {
  return typeof maxPartySizeField === 'number' &&
    Number.isFinite(maxPartySizeField) &&
    maxPartySizeField >= 1
    ? Math.floor(maxPartySizeField)
    : DEFAULT_MAX_PARTY_SIZE
}

/**
 * landr-rmcsu.5: one loaded availability window split by whether each
 * bookable day can take the whole group of `need`:
 *  - `fit`   — bookable (lead time / mandatory stay ok) with >= need free
 *              seats; the only days a customer can pick.
 *  - `short` — bookable with some seats left, but fewer than `need`; ISO →
 *              seats left. Rendered disabled + marked, never selectable for
 *              a customer.
 * Sold-out / not-bookable days are in neither. `need` <= 1 behaves exactly
 * like the old `available_seats > 0` rule, so `short` is always empty then.
 */
export interface SeatFit {
  fit: Set<string>
  short: Map<string, number>
}

export function seatFit(
  slots: readonly AvailabilitySlot[],
  hotelOffering: HotelOffering | undefined,
  need: number | undefined,
): SeatFit {
  const n = Math.max(1, need ?? 1)
  const fit = new Set<string>()
  const short = new Map<string, number>()
  for (const slot of slots) {
    if (slot.available_seats <= 0 || !isDayBookable(slot, hotelOffering)) continue
    if (slot.available_seats >= n) fit.add(slot.date)
    else short.set(slot.date, slot.available_seats)
  }
  return { fit, short }
}

/**
 * landr-rmcsu.5: the loaded availability window as "October 2026 – October
 * 2027" (one month when both ends share it), for the none-fit notice.
 */
export function windowRangeLabel(fromIso: string, toIso: string, locale?: string): string {
  const fmt = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
  const from = fmt.format(dateFromIso(fromIso))
  const to = fmt.format(dateFromIso(toIso))
  return from === to ? from : `${from} – ${to}`
}

/** Hold still live at `now`. null/absent/unparseable → not live. */
export function holdIsLive(iso: string | null | undefined, now: Date = new Date()): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  return !Number.isNaN(t) && t > now.getTime()
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/**
 * "Sat, 17 Oct, 15:00 (tomorrow at 3:00 PM)" in the viewer's locale and
 * timezone. The relative hint only exists for today / tomorrow.
 */
export function formatHoldDeadline(
  iso: string,
  locale?: string,
  now: Date = new Date(),
): string {
  const d = new Date(iso)
  const absolute = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
  const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(d)
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const t = holdRelativeTemplates(locale)
  let hint: string | null = null
  if (dayKey(d) === dayKey(now)) hint = d.getHours() >= 18 ? t.tonight : t.today
  else if (dayKey(d) === dayKey(tomorrow)) hint = t.tomorrow
  return hint ? `${absolute} (${hint.replace('{time}', time)})` : absolute
}
