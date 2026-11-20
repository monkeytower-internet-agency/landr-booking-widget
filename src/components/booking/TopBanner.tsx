import type { ReactNode } from 'react'
import { getTier } from '@/lib/tier'

/**
 * landr-54s9y: slot for banners at the top of the widget (DemoBanner,
 * Playground banner). On dev the fixed TierBadge + BuildChip overlay the
 * top-left corner (~76px tall), so reserve that space. Staging's ribbon is in
 * normal flow (landr-tbzye.12), so it needs no clearance; prod is unchanged.
 */
export function TopBanner({ children }: { children: ReactNode }) {
  const tier = getTier()
  const clear = tier === 'dev'
  return (
    <div
      data-testid="top-banner"
      className={['flex flex-col gap-2', clear ? 'pt-20' : ''].join(' ').trim()}
    >
      {children}
    </div>
  )
}
