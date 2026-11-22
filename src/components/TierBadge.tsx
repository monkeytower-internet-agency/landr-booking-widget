/**
 * landr-7dya.20: TierBadge — renders an unmissable pill in the widget chrome
 * whenever VITE_DEPLOY_TIER is 'dev' or 'staging'.
 *
 * - prod / undefined → renders nothing (no DOM nodes).
 * - staging          → a full-width "Playground" ribbon at the top of the page
 *                      (landr-tbzye.12): in normal flow, so it pushes content
 *                      down instead of overlaying it, and it carries the
 *                      build chip (build number) inside it.
 * - dev              → blue background, white text, "DEV" label.
 *
 * The dev badge is positioned as a fixed overlay in the top-left corner (a host page's close button usually sits top-right) of the
 * viewport so it is always visible regardless of which booking step is shown,
 * survives iframe scrolling, and doesn't displace any booking UI.
 */

import { BuildChip } from '@/components/BuildChip'
import { getTier } from '@/lib/tier'

export function TierBadge() {
  const tier = getTier()

  if (!tier || tier === 'prod') return null

  if (tier === 'staging') {
    return (
      <div
        aria-label="Environment: PLAYGROUND"
        role="status"
        data-testid="tier-badge"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-sky-300 bg-sky-100 px-3 py-1.5 text-sky-900"
      >
        <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-xs font-bold tracking-widest text-white uppercase select-none">
          Playground
        </span>
        <BuildChip inline />
      </div>
    )
  }

  const label = 'DEV'
  const colorClass = 'bg-blue-600 text-white'

  return (
    <>
    <div
      aria-label={`Environment: ${label}`}
      role="status"
      data-testid="tier-badge"
      className={[
        'fixed top-2 left-2 z-[9999]',
        'rounded-full px-2.5 py-0.5',
        'text-xs font-bold tracking-widest uppercase',
        'shadow-md select-none pointer-events-none',
        colorClass,
      ].join(' ')}
    >
      {label}
    </div>
    <BuildChip />
    </>
  )
}
