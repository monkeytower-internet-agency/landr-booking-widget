/**
 * landr-d8rg.3: Deterministic core for the fallback-art system.
 *
 * Products / categories without an uploaded photo must still look *designed*
 * (not a grey placeholder) — and the widget embeds in OPERATOR websites, so the
 * art has to be premium-neutral and adapt to ANY operator brand colour. We do
 * that with zero JS colour math: every fill references the operator's
 * `var(--primary)` (read live via CSS) and we vary appearance only through
 * opacity layers, blend modes, and a hash(seed)-selected accent rotation +
 * icon. Identical seed → identical output (no Math.random / Date).
 *
 * Pure helpers only — the SVG React components live in CategoryArt.tsx /
 * ProductArt.tsx (react-refresh/only-export-components CI gate).
 */

export type Aspect = '4:3' | '16:9' | '1:1' | '3:2'

/** Stable viewBox dimensions per aspect — the SVG scales to its container. */
export const ASPECT_DIMENSIONS: Record<Aspect, { w: number; h: number }> = {
  '4:3': { w: 400, h: 300 },
  '16:9': { w: 480, h: 270 },
  '1:1': { w: 360, h: 360 },
  '3:2': { w: 420, h: 280 },
}

/** Icon keys — a small elegant line-art set drawn in the components. */
export type IconKey =
  | 'paraglider'
  | 'mountain'
  | 'compass'
  | 'suitcase'
  | 'backpack'
  | 'gift'

export const ICON_KEYS: readonly IconKey[] = [
  'paraglider',
  'mountain',
  'compass',
  'suitcase',
  'backpack',
  'gift',
] as const

/**
 * FNV-1a 32-bit hash — small, dependency-free, well-distributed for short
 * slugs, and fully deterministic. Returns an unsigned 32-bit int.
 */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    // h *= 16777619, kept in 32-bit space via Math.imul
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Number of distinct accent rotations. Each rotation tweaks gradient angle +
 * accent-shape placement so two adjacent tiles never look identical, while
 * staying deterministic from the seed.
 */
export const ACCENT_ROTATIONS = 6

/** Deterministic accent-rotation index in [0, ACCENT_ROTATIONS). */
export function accentIndex(seed: string): number {
  return hashSeed(seed) % ACCENT_ROTATIONS
}

/**
 * Keyword → icon map. We match on substrings of the (lowercased) seed/kind so
 * a slug like "tandem-paragliding-flight" picks the paraglider wing, "via-
 * ferrata-summit" picks the mountain ridge, etc. Order matters: earlier
 * entries win. Falls back to a hash-selected icon when nothing matches, so the
 * choice is still deterministic and varied.
 */
const ICON_KEYWORDS: ReadonlyArray<readonly [IconKey, readonly string[]]> = [
  ['paraglider', ['paraglid', 'tandem', 'fly', 'flight', 'glide', 'wing', 'air', 'soar']],
  ['mountain', ['mountain', 'summit', 'peak', 'alpine', 'ridge', 'climb', 'ferrata', 'hike', 'trek', 'trail']],
  ['compass', ['tour', 'guide', 'course', 'explore', 'expedition', 'navig', 'compass', 'route', 'adventure']],
  ['suitcase', ['travel', 'trip', 'stay', 'hotel', 'package', 'holiday', 'vacation', 'getaway', 'lodge']],
  ['backpack', ['gear', 'pack', 'equip', 'rental', 'rent', 'kit', 'backpack', 'supply', 'outfit']],
  ['gift', ['gift', 'voucher', 'present', 'card', 'bundle', 'deal', 'special', 'offer']],
]

/**
 * Deterministically pick an icon for a seed or explicit kind string.
 * Exported so tests can assert determinism + keyword behaviour.
 */
export function pickIcon(seedOrKind: string): IconKey {
  const s = seedOrKind.toLowerCase()
  for (const [icon, keywords] of ICON_KEYWORDS) {
    if (keywords.some((kw) => s.includes(kw))) return icon
  }
  // No keyword hit → deterministic hash fallback across the full icon set.
  return ICON_KEYS[hashSeed(seedOrKind) % ICON_KEYS.length]
}

/**
 * Texture variants for the low-opacity background layer. Selected off a
 * different bit of the hash than the accent so texture + accent vary
 * semi-independently.
 */
export type Texture = 'dots' | 'contour'

export function pickTexture(seed: string): Texture {
  return (hashSeed(seed) >>> 8) % 2 === 0 ? 'dots' : 'contour'
}

/**
 * Resolved deterministic art recipe for a seed. The React components turn this
 * into SVG; tests assert it is stable across calls and distinct across seeds.
 */
export interface ArtRecipe {
  icon: IconKey
  accent: number
  texture: Texture
  /** Gradient rotation in degrees, derived from the accent index. */
  gradientAngle: number
}

export function artRecipe(seed: string, kind?: string): ArtRecipe {
  const accent = accentIndex(seed)
  return {
    icon: pickIcon(kind ?? seed),
    accent,
    texture: pickTexture(seed),
    gradientAngle: 90 + accent * 30,
  }
}
