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
  now,
}: {
  expiresAt: string | null | undefined
  now?: Date
}) {
  if (!expiresAt) return null
  const locale = browserLocale()
  const live = holdIsLive(expiresAt, now)
  return (
    <span data-testid="invite-hold" data-hold={live ? 'live' : 'ended'}>
      {inviteHoldLabel(live ? formatHoldDeadline(expiresAt, locale, now) : null, locale)}
    </span>
  )
}
