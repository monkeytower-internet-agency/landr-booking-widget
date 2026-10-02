import { browserLocale } from '@/lib/locale'
import { formatHoldDeadline, holdIsLive } from '@/lib/seatHold'
import { inviteHoldLabel } from '@/lib/strings'

/**
 * landr-f987a.4: invite landing line — "Your seat is held until …" while the
 * hold is live, "The hold on your seat has ended …" after. Never blocks.
 * Renders nothing when the invite carries no hold at all.
 */
export function InviteHoldNote({
  expiresAt,
  hours,
  now,
}: {
  expiresAt: string | null | undefined
  /** seat_hold_hours: 0 = never held, null/absent = unknown. */
  hours?: number | null
  now?: Date
}) {
  const locale = browserLocale()
  const live = holdIsLive(expiresAt, now)
  // The API reports expires=null once expired/claimed; the ended text only
  // makes sense when a hold demonstrably existed (hours > 0).
  if (!live && !(hours && hours > 0)) return null
  return (
    <span data-testid="invite-hold" data-hold={live ? 'live' : 'ended'}>
      {inviteHoldLabel(live ? formatHoldDeadline(expiresAt as string, locale, now) : null, locale)}
    </span>
  )
}
