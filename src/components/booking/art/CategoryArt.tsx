/**
 * landr-d8rg.3: CategoryArt — designed SVG fallback for a product GROUP /
 * category tile that has no uploaded image. Big centred line-art icon over a
 * brand-coloured gradient; deterministic from the category slug.
 *
 * Usage (later slices):
 *   <CategoryArt seed={group.slug} aspect="4:3" title={group.name} />
 *
 * Props:
 *   seed    — category slug (drives gradient accent + icon). Required.
 *   aspect  — '4:3' | '16:9' | '1:1' | '3:2'. Default '4:3' (tile).
 *   title   — accessible label; omit for purely-decorative use.
 *   className — class string for the <svg> (size it via the wrapper).
 *
 * Component-only file (react-refresh/only-export-components CI gate).
 */

import { ArtSurface } from './ArtSurface'
import type { Aspect } from './artCore'

export interface CategoryArtProps {
  seed: string
  aspect?: Aspect
  title?: string
  className?: string
}

export function CategoryArt({
  seed,
  aspect = '4:3',
  title,
  className,
}: CategoryArtProps) {
  return (
    <ArtSurface
      seed={seed}
      aspect={aspect}
      iconPlacement="center"
      title={title}
      className={className}
    />
  )
}
