/**
 * landr-jb1k.4: creative tile-style option maps for the category grid.
 *
 * Four operator-configurable, NULLable tile-style axes. Each NULL/undefined =
 * the widget's current/auto behaviour (the variant token wins), so untouched
 * embeds never shift. Resolution: App reads the four operatorSettings fields,
 * passes them to CategoryStep, which resolves the class strings here and threads
 * them down to CategoryTile.
 *
 * Tailwind purge note: template-literal class names are BANNED. Every class a
 * tile can receive is a STATIC string in one of the maps below, so the purge
 * keeps them. (font-family in tileFont.ts is the only data-value-as-style; here
 * everything is a real utility class.)
 *
 * Radius/aspect/hover apply to ALL variants (they OVERRIDE the variant token for
 * tiles only). Scrim applies ONLY to the text-over-image layout (aurora) — the
 * other variants render copy in a block below the image and have no scrim.
 */

export type TileRadiusKey = 'sharp' | 'rounded' | 'round'
export type TileAspectKey = 'square' | 'landscape' | 'wide'
export type TileScrimKey = 'dark' | 'brand' | 'light'
export type TileHoverKey = 'lift' | 'zoom' | 'none'

/**
 * Radius key → tile corner-radius utility. OVERRIDES the variant token
 * (tokens.cardRadius) for the tile <button> only — the rest of the widget keeps
 * the variant radius. NULL/undefined → variant default (no override).
 *   sharp   → no rounding
 *   rounded → medium (rounded-xl)
 *   round   → large (rounded-3xl)
 */
export const TILE_RADIUS_CLASS_MAP: Record<TileRadiusKey, string> = {
  sharp: 'rounded-none',
  rounded: 'rounded-xl',
  round: 'rounded-3xl',
}

/**
 * Aspect key → media aspect-ratio utility. OVERRIDES the variant token
 * (tokens.tileAspect) for the tile media frame only. NULL/undefined → variant
 * default.
 *   square    → 1:1   (aspect-square)
 *   landscape → 4:3   (aspect-[4/3])
 *   wide      → 16:9  (aspect-video)
 */
export const TILE_ASPECT_CLASS_MAP: Record<TileAspectKey, string> = {
  square: 'aspect-square',
  landscape: 'aspect-[4/3]',
  wide: 'aspect-video',
}

/**
 * Resolved scrim treatment for the text-over-image (aurora) layout.
 *   overlay   — the gradient utility classes laid over the media for legibility.
 *   titleDark — true when the title text must flip to a dark colour (the 'light'
 *               scrim is a white gradient, so white text would fail AA — we force
 *               the title + description + count-chip to dark/neutral instead).
 *
 * NULL/undefined → the variant token scrim (tokens.overlayScrim, a black
 * gradient) with white text, i.e. current behaviour. Choosing 'dark' explicitly
 * reproduces that.
 */
export interface TileScrimResolved {
  overlay: string
  titleDark: boolean
}

/**
 * Scrim key → resolved treatment. dark/brand keep WHITE overlay text; light
 * forces DARK title text (AA: white text on a white gradient is illegible).
 * 'brand' tints the gradient with the operator's --primary so it reads on-brand
 * while staying dark enough at the bottom (where the text sits) for white text.
 */
export const TILE_SCRIM_MAP: Record<TileScrimKey, TileScrimResolved> = {
  // Black gradient — identical to the variant token AA scrim (current default).
  dark: {
    overlay: 'bg-gradient-to-t from-black/70 via-black/25 to-transparent',
    titleDark: false,
  },
  // Primary-tinted gradient. The bottom stop stays heavy (primary/80) where the
  // title sits, so white text stays legible regardless of the brand hue; it
  // fades through a black mid-stop to transparent so a pale --primary can't lift
  // the overall darkness under the text below AA.
  brand: {
    overlay: 'bg-gradient-to-t from-primary/80 via-black/30 to-transparent',
    titleDark: false,
  },
  // White gradient — the title flips to dark text (AA enforced).
  light: {
    overlay: 'bg-gradient-to-t from-white/85 via-white/35 to-transparent',
    titleDark: true,
  },
}

/**
 * Resolved hover treatment, split by the element each class targets.
 *   button — translate/lift classes for the tile <button>.
 *   image  — scale classes for the media <img>/<CategoryArt>.
 * Both include the focus-visible mirror and the motion-reduce escape hatch so
 * the keyboard + reduced-motion stories match the pointer story.
 *
 * NULL/undefined → 'lift' (current behaviour).
 */
export interface TileHoverResolved {
  button: string
  image: string
}

const HOVER_LIFT_BUTTON =
  'hover:-translate-y-0.5 focus-visible:-translate-y-0.5 motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0'
const HOVER_IMAGE_SCALE =
  'group-hover:scale-105 group-focus-visible:scale-105 motion-reduce:group-hover:scale-100 motion-reduce:group-focus-visible:scale-100'

/**
 * Hover key → resolved treatment.
 *   lift — the current behaviour: the whole tile translates up; the image does
 *          NOT scale (it stays put while the card floats).
 *   zoom — the image scales up on hover; the card does NOT translate.
 *   none — neither moves.
 */
export const TILE_HOVER_MAP: Record<TileHoverKey, TileHoverResolved> = {
  lift: { button: HOVER_LIFT_BUTTON, image: '' },
  zoom: { button: '', image: HOVER_IMAGE_SCALE },
  none: { button: '', image: '' },
}
