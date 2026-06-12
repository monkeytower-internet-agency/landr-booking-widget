/**
 * landr-ens5 — map an operator's configured brand theme onto the widget's
 * CSS custom properties.
 *
 * The widget paints `bg-background text-foreground` at its root and routes
 * buttons / CTAs through `--primary`. The dashboard saves a 3-colour theme
 * (brand = text/headings, accent = buttons/CTAs, background = page canvas)
 * to operators.theme; this module turns it into the inline CSS-var overrides
 * applied at the widget root (same non-global approach as the legacy
 * primary_color → --primary behaviour, so multiple embeds on one host page
 * stay isolated).
 *
 * Token mapping:
 *   theme.background → --background          (page canvas)
 *   theme.brand      → --foreground, --brand (text / headings)
 *   theme.accent     → --primary             (buttons / CTAs)
 *
 * Contrast safety (light touch): --primary-foreground (text on buttons) and
 * --foreground-derived legibility are kept readable by picking near-black or
 * near-white text against the chosen surface via relative luminance. We do
 * NOT override the operator's brand colour for body text — only the *button
 * label* colour, which the operator does not configure.
 *
 * Dark mode: the widget has NO active dark mode today (the `.dark` class in
 * index.css is never applied — no prefers-color-scheme toggle, no classList
 * manipulation). So `theme.dark` is intentionally NOT consumed here. The
 * hue-preserving deriveDark helper below is exported for when/if the widget
 * gains a dark mode (and to mirror the dashboard's matching derivation), but
 * it is not wired into the rendered style yet. See the handoff for status.
 */

import type { CSSProperties } from 'react'
import type { OperatorSettings, WidgetTheme } from '@/api/types'

/** A CSSProperties carrying arbitrary `--*` custom properties. */
type CSSVarStyle = CSSProperties & Record<`--${string}`, string>

const NEAR_BLACK = '#111111'
const NEAR_WHITE = '#ffffff'

/**
 * Parse a #RGB or #RRGGBB hex string to [r,g,b] (0–255). Returns null for
 * anything we don't recognise (non-hex colour strings, malformed input) — the
 * caller then skips contrast derivation and lets the CSS default stand.
 */
export function parseHex(input: string): [number, number, number] | null {
  const hex = input.trim().replace(/^#/, '')
  if (hex.length === 3) {
    const r = hex[0]
    const g = hex[1]
    const b = hex[2]
    if (!/^[0-9a-fA-F]{3}$/.test(hex)) return null
    return [
      parseInt(r + r, 16),
      parseInt(g + g, 16),
      parseInt(b + b, 16),
    ]
  }
  if (hex.length === 6) {
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ]
  }
  return null
}

/**
 * WCAG relative luminance (0 = black, 1 = white) for an [r,g,b] triple.
 */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number): number => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/**
 * Pick near-black or near-white text for legibility on the given background
 * colour. Falls back to near-white when the colour can't be parsed (callers
 * only reach here with a configured colour, so a sensible default is fine).
 */
export function readableTextOn(background: string): string {
  const rgb = parseHex(background)
  if (!rgb) return NEAR_WHITE
  // Threshold ~0.45 puts the flip a touch above mid-grey, biasing toward dark
  // text (which reads better on the pale-to-mid brand backgrounds operators
  // tend to choose).
  return relativeLuminance(rgb) > 0.45 ? NEAR_BLACK : NEAR_WHITE
}

/** Convert [r,g,b] (0–255) to HSL with h in [0,360), s/l in [0,1]. */
export function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l]
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  switch (max) {
    case rn:
      h = (gn - bn) / d + (gn < bn ? 6 : 0)
      break
    case gn:
      h = (bn - rn) / d + 2
      break
    default:
      h = (rn - gn) / d + 4
  }
  return [h * 60, s, l]
}

/** Convert HSL (h in [0,360), s/l in [0,1]) back to a #RRGGBB hex string. */
export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2
  let rp: number
  let gp: number
  let bp: number
  if (hue < 60) [rp, gp, bp] = [c, x, 0]
  else if (hue < 120) [rp, gp, bp] = [x, c, 0]
  else if (hue < 180) [rp, gp, bp] = [0, c, x]
  else if (hue < 240) [rp, gp, bp] = [0, x, c]
  else if (hue < 300) [rp, gp, bp] = [x, 0, c]
  else [rp, gp, bp] = [c, 0, x]
  const to255 = (v: number): string =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to255(rp)}${to255(gp)}${to255(bp)}`
}

/**
 * Derive a dark-mode variant of a colour HUE-PRESERVINGLY: convert to HSL,
 * keep hue + saturation, and flip lightness around the mid-point (l → 1 - l).
 * A blue stays blue (just lighter/darker) — NOT a naive 255−x RGB invert,
 * which would rotate the hue and turn blue into orange. Returns the input
 * unchanged when it can't be parsed.
 */
export function deriveDark(color: string): string {
  const rgb = parseHex(color)
  if (!rgb) return color
  const [h, s, l] = rgbToHsl(rgb)
  // Flip lightness but clamp away from the extremes so a pure-white brand
  // doesn't collapse to pure black (and vice-versa) — keeps some tonal range.
  const flipped = Math.min(0.92, Math.max(0.08, 1 - l))
  return hslToHex(h, s, flipped)
}

/**
 * Resolve the full dark theme from a WidgetTheme: explicit theme.dark values
 * win; any missing key is derived hue-preservingly from its light counterpart.
 * Exported for the (future) dark-mode wiring and for parity tests — NOT yet
 * consumed by widgetThemeStyle (the widget has no active dark mode).
 */
export function resolveDarkTheme(theme: WidgetTheme): {
  brand: string
  accent: string
  background: string
} {
  const d = theme.dark ?? {}
  return {
    brand: d.brand ?? deriveDark(theme.brand),
    accent: d.accent ?? deriveDark(theme.accent),
    background: d.background ?? deriveDark(theme.background),
  }
}

/**
 * Build the inline CSS-var overrides for the widget root from operator
 * settings. Resolution order:
 *
 *   1. theme present → map brand/accent/background onto the widget tokens
 *      (+ contrast-safe button/text-on-surface colours).
 *   2. else primary_color present (legacy) → --primary only (today's behaviour).
 *   3. else {} → no inline vars, index.css defaults stand.
 *
 * Returned object is spread into the root <div>'s `style`.
 */
export function widgetThemeStyle(
  settings: Pick<OperatorSettings, 'theme' | 'primary_color'>,
): CSSVarStyle {
  const theme = settings.theme
  if (theme) {
    const style: CSSVarStyle = {
      '--background': theme.background,
      '--foreground': theme.brand,
      // --brand is not a token the widget reads today, but expose it anyway so
      // any future heading-specific styling can pick the brand colour up
      // without a second pass.
      '--brand': theme.brand,
      '--primary': theme.accent,
      // Contrast safety (light touch): keep button labels legible on the
      // accent, and the page surface readable. We only override colours the
      // operator does NOT configure (the *foreground* pairs), never their
      // chosen brand/accent/background.
      '--primary-foreground': readableTextOn(theme.accent),
      // The card surface stays the widget's neutral card (index.css), so card
      // text keeps using --card-foreground; we leave that to the default.
    }
    return style
  }
  if (settings.primary_color) {
    return { '--primary': settings.primary_color }
  }
  return {}
}
