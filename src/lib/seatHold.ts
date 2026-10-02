/**
 * landr-f987a.4: seat-hold helpers — the party-size check (guiding
 * participants + invited separate_guiding companions) and the hold-deadline
 * formatting (absolute viewer-locale time plus a relative hint).
 */
import type { AvailabilitySlot } from '@/api/types'
import type { CompanionDetails } from '@/components/booking/detailsTypes'
import { holdRelativeTemplates } from '@/lib/strings'

/** Seats the host party needs on every day: guiding participants + invitees. */
export function seatsNeeded(
  participantCount: number,
  companions: readonly Pick<CompanionDetails, 'companion_kind'>[] = [],
): number {
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
