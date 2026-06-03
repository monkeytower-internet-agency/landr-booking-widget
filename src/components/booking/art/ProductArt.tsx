/**
 * landr-d8rg.3: ProductArt — designed SVG fallback for an individual PRODUCT
 * card / hero with no uploaded photo. Same brand-gradient surface as
 * CategoryArt, but with the line-art icon placed as a smaller corner badge so
 * the tile reads as a product (vs. a category hero). Deterministic from the
 * product slug; pass `kind` to bias the icon by product type/name.
 *
 * Usage (later slices):
 *   <ProductArt seed={product.slug} kind={product.name} aspect="4:3" />
 *   <ProductArt seed={product.slug} aspect="16:9" title={product.name} />  // detail hero
 *
 * Props:
 *   seed    — product slug (drives gradient accent + icon fallback). Required.
 *   kind    — optional name/type string for icon keyword-matching.
 *   aspect  — '4:3' | '16:9' | '1:1' | '3:2'. Default '4:3' (card).
 *   title   — accessible label; omit for purely-decorative use.
 *   className — class string for the <svg> (size it via the wrapper).
 *
 * Component-only file (react-refresh/only-export-components CI gate).
 */

import { ArtSurface } from './ArtSurface'
import type { Aspect } from './artCore'

export interface ProductArtProps {
  seed: string
  kind?: string
  aspect?: Aspect
  title?: string
  className?: string
}

export function ProductArt({
  seed,
  kind,
  aspect = '4:3',
  title,
  className,
}: ProductArtProps) {
  return (
    <ArtSurface
      seed={seed}
      kind={kind}
      aspect={aspect}
      iconPlacement="corner"
      title={title}
      className={className}
    />
  )
}
