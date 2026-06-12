/**
 * landr-d8rg.3: Mini line-art icon set for the fallback art.
 *
 * Six elegant, hand-drawn-feel glyphs rendered as stroked SVG <path>s — drawn
 * to read as premium line-art (≈1.5px strokes, round caps/joins), never
 * clipart. The icon is sized + positioned by the parent <ArtSurface>; this
 * component only emits the path group inside a 24×24 unit box. Stroke colour is
 * inherited (currentColor) so the surface can mute it against the gradient.
 *
 * Component-only file (react-refresh/only-export-components CI gate). Icon
 * geometry is static — the deterministic *selection* lives in artCore.pickIcon.
 */

import type { IconKey } from './artCore'

/** Path data per icon, authored on a 24×24 grid. */
const ICON_PATHS: Record<IconKey, string> = {
  // Paraglider — canopy arc with three risers down to a small pilot.
  paraglider:
    'M3 8 C7 3 17 3 21 8 M3 8 L6.5 7.4 M9.5 7 L12 6.8 L14.5 7 M17.5 7.4 L21 8 ' +
    'M5 8.2 L11.4 15 M19 8.2 L12.6 15 M12 15 L12 17 M10.5 17 L13.5 17',
  // Mountain — layered twin ridge with a snow notch.
  mountain:
    'M2 19 L9 7 L13 13 L16 9 L22 19 Z M7.4 9.6 L9 7 L10.7 9.8 M14.6 10.6 L16 9 L17.4 11',
  // Compass rose — circle with a four-point needle.
  compass:
    'M12 3 A9 9 0 1 0 12.01 3 M12 6 L13.6 12 L12 18 L10.4 12 Z ' +
    'M6 12 L18 12 M12 6 L12 18',
  // Suitcase — body with handle and centre seam.
  suitcase:
    'M4 8 H20 A1 1 0 0 1 21 9 V18 A1 1 0 0 1 20 19 H4 A1 1 0 0 1 3 18 V9 A1 1 0 0 1 4 8 Z ' +
    'M9 8 V6 A1 1 0 0 1 10 5 H14 A1 1 0 0 1 15 6 V8 M12 9 V18',
  // Backpack — rounded body, top flap, front pocket and straps.
  backpack:
    'M7 7 A5 5 0 0 1 17 7 V19 A1 1 0 0 1 16 20 H8 A1 1 0 0 1 7 19 Z ' +
    'M7 10 H17 M9.5 13 H14.5 V17 H9.5 Z M9.5 7 V4.5 M14.5 7 V4.5',
  // Gift box — lid, body, vertical ribbon and a small bow.
  gift:
    'M4 9 H20 V11 H4 Z M5 11 H19 V20 H5 Z M12 9 V20 ' +
    'M12 9 C12 6 9 6 9 8 C9 9 11 9 12 9 M12 9 C12 6 15 6 15 8 C15 9 13 9 12 9',
}

export function ArtIcon({ icon }: { icon: IconKey }) {
  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    >
      <path d={ICON_PATHS[icon]} />
    </g>
  )
}
