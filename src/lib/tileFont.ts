/**
 * landr-jb1k.2: tile-font lazy-loader.
 *
 * Operator-configurable font stack for category tile titles and the
 * CategoryStep entrance heading. Each non-system font is backed by a
 * @fontsource package (GDPR-safe: no Google Fonts CDN; Latin 400+700
 * weight CSS imports only). Fonts are lazy-loaded via dynamic import()
 * so Vite code-splits the CSS+woff2 and the font only loads when the
 * operator has configured it — the default 'system' path loads nothing.
 *
 * Resolution: App reads operatorSettings.widget_tile_font (null = system)
 * and calls loadTileFont() once after settings resolve. The font-family
 * string is looked up from TILE_FONT_FAMILY_MAP and passed down to
 * CategoryTile via props.
 */

export type TileFontKey = 'system' | 'playfair' | 'montserrat' | 'bebas' | 'space-grotesk' | 'caveat'

/**
 * Static map: font key → CSS font-family string.
 * Applied as an inline fontFamily style (not a Tailwind class) so the
 * purge constraint does not apply — these strings are data values, not
 * Tailwind utility class names.
 * 'system' maps to undefined (no override; the built-in ui-sans-serif stack
 * wins without any inline style being set).
 */
export const TILE_FONT_FAMILY_MAP: Record<TileFontKey, string | undefined> = {
  system: undefined,
  playfair: "'Playfair Display', Georgia, serif",
  montserrat: "'Montserrat', 'Arial', sans-serif",
  bebas: "'Bebas Neue', 'Impact', sans-serif",
  'space-grotesk': "'Space Grotesk', 'Inter', system-ui, sans-serif",
  caveat: "'Caveat', 'Comic Sans MS', cursive",
}

/**
 * Lazy-load the @fontsource CSS for the given font key. Resolves
 * immediately (no-op) for 'system' and for the undefined/null case.
 * Each font-CSS import pulls in only the latin subset at 400+700 weights.
 *
 * Vite tree-shakes the un-selected branches at build time and emits a
 * separate chunk per font, so only the selected font's CSS+woff2 files
 * are fetched at runtime.
 *
 * The returned Promise always resolves (never throws to the caller) —
 * a font-load failure is non-fatal; the browser falls back to the next
 * family in the stack automatically.
 */
export async function loadTileFont(key: TileFontKey | null | undefined): Promise<void> {
  if (!key || key === 'system') return
  try {
    switch (key) {
      case 'playfair':
        await import('@fontsource/playfair-display/latin.css')
        break
      case 'montserrat':
        await import('@fontsource/montserrat/latin.css')
        break
      case 'bebas':
        await import('@fontsource/bebas-neue/latin.css')
        break
      case 'space-grotesk':
        await import('@fontsource/space-grotesk/latin.css')
        break
      case 'caveat':
        await import('@fontsource/caveat/latin.css')
        break
    }
  } catch {
    // Non-fatal: the browser falls back to the next family in the CSS stack.
  }
}
