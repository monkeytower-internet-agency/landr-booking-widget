/**
 * landr-7dya.20: TierBadge — renders an unmissable pill in the widget chrome
 * whenever VITE_DEPLOY_TIER is 'dev' or 'staging'.
 *
 * - prod / undefined → renders nothing (no DOM nodes).
 * - staging          → amber background, dark text, "STAGING" label.
 * - dev              → blue background, white text, "DEV" label.
 *
 * The badge is positioned as a fixed overlay in the top-right corner of the
 * viewport so it is always visible regardless of which booking step is shown,
 * survives iframe scrolling, and doesn't displace any booking UI.
 */

import { getTier } from '@/lib/tier'

export function TierBadge() {
  const tier = getTier()

  if (!tier || tier === 'prod') return null

  const label = tier === 'staging' ? 'STAGING' : 'DEV'

  const colorClass =
    tier === 'staging'
      ? 'bg-amber-400 text-amber-950'
      : 'bg-blue-600 text-white'

  return (
    <div
      aria-label={`Environment: ${label}`}
      role="status"
      data-testid="tier-badge"
      className={[
        'fixed top-2 right-2 z-[9999]',
        'rounded-full px-2.5 py-0.5',
        'text-xs font-bold tracking-widest uppercase',
        'shadow-md select-none pointer-events-none',
        colorClass,
      ].join(' ')}
    >
      {label}
    </div>
  )
}
