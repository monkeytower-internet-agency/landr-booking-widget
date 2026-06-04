/**
 * landr-d8rg.3: ArtSurface — the shared SVG canvas behind CategoryArt /
 * ProductArt. Composes a brand-coloured, designed-looking fallback entirely
 * from `var(--primary)` so it adapts to ANY operator colour with zero JS colour
 * math:
 *
 *   1. base       — a flat primary wash (low opacity) so the whole tile is
 *                   tinted by the operator's brand colour.
 *   2. gradient   — a large soft radial + linear primary gradient, angled by
 *                   the seed's accent rotation, giving depth without hard edges.
 *   3. accents    — two big blurred soft shapes (circle + sweep) placed by the
 *                   accent index, blended so they read as light/shadow not
 *                   stickers. Hue/“saturation” shifts come purely from layered
 *                   opacity + mix-blend, never colour arithmetic.
 *   4. texture    — a low-opacity dot-grid OR contour-line layer (seed-picked).
 *   5. icon       — the muted line-art glyph, centred (category) or corner
 *                   (product), drawn by ArtIcon.
 *
 * Everything is deterministic from `seed` via artCore — same seed ⇒ same SVG.
 * Component-only file (react-refresh/only-export-components CI gate).
 */

import { useId } from 'react'
import {
  ASPECT_DIMENSIONS,
  artRecipe,
  type Aspect,
  type ArtRecipe,
} from './artCore'
import { ArtIcon } from './ArtIcon'

export interface ArtSurfaceProps {
  /** Stable seed (a slug) — drives every deterministic choice. */
  seed: string
  /** Optional explicit kind for icon keyword-matching (defaults to seed). */
  kind?: string
  aspect: Aspect
  /** 'center' for big category hero icons, 'corner' for product badges. */
  iconPlacement?: 'center' | 'corner'
  className?: string
  /** Accessible label; when omitted the SVG is decorative (aria-hidden). */
  title?: string
}

function Texture({ recipe, id }: { recipe: ArtRecipe; id: string }) {
  if (recipe.texture === 'dots') {
    return (
      <>
        <pattern id={id} width={18} height={18} patternUnits="userSpaceOnUse">
          <circle cx={2} cy={2} r={1.1} fill="var(--primary)" />
        </pattern>
        <rect width="100%" height="100%" fill={`url(#${id})`} opacity={0.06} />
      </>
    )
  }
  // Contour: stacked gentle sine-like ridges as stroked paths.
  return (
    <g
      fill="none"
      stroke="var(--primary)"
      strokeWidth={1}
      opacity={0.07}
      vectorEffect="non-scaling-stroke"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M-20 ${40 + i * 60} C 120 ${10 + i * 60}, 260 ${90 + i * 60}, 520 ${40 + i * 60}`}
        />
      ))}
    </g>
  )
}

export function ArtSurface({
  seed,
  kind,
  aspect,
  iconPlacement = 'center',
  className,
  title,
}: ArtSurfaceProps) {
  const { w, h } = ASPECT_DIMENSIONS[aspect]
  const recipe = artRecipe(seed, kind)
  const uid = useId().replace(/[:]/g, '')
  const gradId = `g-${uid}`
  const radId = `r-${uid}`
  const texId = `t-${uid}`

  // Accent placement: spread two soft shapes around the tile by accent index.
  const ax = 0.18 + (recipe.accent % 3) * 0.28 // 0.18 / 0.46 / 0.74
  const ay = recipe.accent < 3 ? 0.22 : 0.78

  // Icon box: large + centred for categories, smaller + bottom-left for products.
  const iconSize = iconPlacement === 'center' ? Math.min(w, h) * 0.34 : Math.min(w, h) * 0.2
  const iconX = iconPlacement === 'center' ? (w - iconSize) / 2 : w * 0.07
  const iconY = iconPlacement === 'center' ? (h - iconSize) / 2 : h - iconSize - h * 0.1

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient
          id={gradId}
          gradientTransform={`rotate(${recipe.gradientAngle} 0.5 0.5)`}
        >
          <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
          <stop offset="55%" stopColor="var(--primary)" stopOpacity={0.1} />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.32} />
        </linearGradient>
        <radialGradient id={radId} cx={ax} cy={ay} r={0.7}>
          <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
          <stop offset="70%" stopColor="var(--primary)" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* 1. base wash */}
      <rect width="100%" height="100%" fill="var(--primary)" opacity={0.08} />
      {/* 2. angled gradient depth */}
      <rect width="100%" height="100%" fill={`url(#${gradId})`} />
      {/* 3. soft accent shapes (blended as light, not stickers) */}
      <g style={{ mixBlendMode: 'soft-light' }}>
        <rect width="100%" height="100%" fill={`url(#${radId})`} />
        <circle
          cx={ax * w}
          cy={ay * h}
          r={Math.max(w, h) * 0.42}
          fill="var(--primary)"
          opacity={0.12}
        />
        <ellipse
          cx={(1 - ax) * w}
          cy={(1 - ay) * h}
          rx={w * 0.5}
          ry={h * 0.32}
          fill="var(--primary)"
          opacity={0.08}
        />
      </g>
      {/* 4. texture */}
      <Texture recipe={recipe} id={texId} />
      {/* 5. muted line-art icon */}
      <g
        transform={`translate(${iconX} ${iconY}) scale(${iconSize / 24})`}
        color="var(--primary)"
        opacity={iconPlacement === 'center' ? 0.5 : 0.45}
      >
        <ArtIcon icon={recipe.icon} />
      </g>
    </svg>
  )
}
