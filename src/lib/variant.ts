/**
 * landr-d8rg.3: Visual-variant token plumbing for the booking-widget overhaul.
 *
 * The widget ships THREE cohesive visual directions, selectable at boot via a
 * `?variant=` query param so the operator (and us, during the morning review)
 * can pick a direction without forking components. This is TOKEN-LEVEL theming:
 * every later UI slice reads its layout/treatment class strings from
 * VARIANT_TOKENS[variant] rather than branching on the variant name.
 *
 *   aurora  (default) — brand-gradient immersive. Rounded-2xl, soft-glass
 *                        overlays, generous glow. Leans into the operator's
 *                        --primary colour. The "wow" direction.
 *   summit            — editorial / image-forward. Lots of whitespace, a
 *                        serif type accent, restrained chrome — the imagery and
 *                        typography carry the page (think travel magazine).
 *   alpine            — crisp classic. Dense, sharp-radius, strong borders,
 *                        utilitarian. Maximum information density, minimal
 *                        decoration — the "just book it" direction.
 *
 * Sibling-file rule (react-refresh/only-export-components, a CI gate): the only
 * COMPONENT export — VariantProvider — lives in the sibling `variant.tsx`,
 * which may export nothing else. Everything non-component (types, helpers,
 * tokens, the context object, and the useVariant hook) lives here, since
 * react-refresh only forbids mixing non-components *with* components. See
 * useBookingEstimate.ts / detectRoute.ts for the same convention.
 */

import { createContext, useContext } from 'react'

export type Variant = 'aurora' | 'summit' | 'alpine'

export const VARIANTS: readonly Variant[] = ['aurora', 'summit', 'alpine'] as const

export const DEFAULT_VARIANT: Variant = 'aurora'

function isVariant(value: string): value is Variant {
  return (VARIANTS as readonly string[]).includes(value)
}

/**
 * Parse the `?variant=` query param out of a location.search string.
 * Accepts a full search string ("?variant=summit&foo=1"), a bare one
 * ("variant=summit"), or anything else — always returns a valid Variant,
 * falling back to DEFAULT_VARIANT for missing/unknown values.
 */
export function parseVariant(search: string): Variant {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const raw = params.get('variant')?.trim().toLowerCase()
  if (raw && isVariant(raw)) return raw
  return DEFAULT_VARIANT
}

/**
 * Convenience helper for App to read the active variant from the live URL.
 * Guards against non-browser (test/SSR) environments where `window` is absent.
 */
export function variantFromLocation(): Variant {
  if (typeof window === 'undefined') return DEFAULT_VARIANT
  return parseVariant(window.location.search)
}

/**
 * Per-variant design tokens, expressed as Tailwind v4 class strings so later
 * slices can spread them straight onto elements (via `cn(...)`). Each token is
 * a *direction*, not a finished component — slices compose these with their own
 * structural classes.
 *
 *   tileAspect    — aspect-ratio for category/product image tiles.
 *   tileOverlay   — gradient/scrim laid over tile imagery for text legibility.
 *   cardRadius    — corner rounding for product/detail cards.
 *   cardShadow    — elevation treatment for cards.
 *   cardDensity   — internal padding/gap rhythm (compact vs. airy).
 *   heroTreatment — framing for the product-detail hero image.
 *   typeAccent    — typographic accent applied to headings/eyebrows.
 *
 * landr-d8rg.8 cohesion pass — fields added so that surfaces the three parallel
 * workers styled independently now resolve from ONE place per variant:
 *   chipRadius     — rounding for the count / meta / fact chips + badges. Was
 *                    hard-coded `rounded-full` everywhere; alpine now squares
 *                    them off to match its sharp, utilitarian language.
 *   thumbRadius    — rounding for the detail gallery thumbnail buttons (was a
 *                    fixed `rounded-md`, diverging from the card radius).
 *   selectionRing  — the "active/selected" ring (gallery active thumb). Aurora
 *                    leans brand, summit/alpine stay neutral-strong.
 *   focusRing      — the SINGLE focus-visible ring recipe shared by every
 *                    interactive surface (cards, rows, tiles, thumbs, chips),
 *                    replacing three slightly different ad-hoc rings.
 *   overlayScrim   — the AA-safe text-over-image scrim used by BOTH the
 *                    category tile (aurora) and the detail hero overlay, so the
 *                    immersive treatment reads identically across surfaces and
 *                    stays ≥AA regardless of the operator's --primary colour
 *                    (black-based, never primary-based — a light brand colour
 *                    must never weaken the scrim under white text).
 */
export interface VariantTokens {
  tileAspect: string
  tileOverlay: string
  cardRadius: string
  cardShadow: string
  cardDensity: string
  heroTreatment: string
  typeAccent: string
  chipRadius: string
  thumbRadius: string
  selectionRing: string
  focusRing: string
  overlayScrim: string
}

/**
 * landr-d8rg.8: the shared focus-visible recipe. Defined once so every
 * interactive surface across the three steps gets an identical, clearly
 * visible AA ring (the three parallel workers had each rolled their own —
 * ring-2 vs ring-[2px], ring vs ring/50 vs ring-primary). Variant-agnostic:
 * focus affordance must be consistent regardless of visual direction.
 */
const SHARED_FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/**
 * landr-d8rg.8: AA-safe text-over-image scrim. BLACK-based (never primary)
 * so a pale operator brand colour can't sink the contrast of white overlay
 * text below AA. Shared by the aurora category tile + the detail hero overlay.
 */
const AA_SCRIM = 'bg-gradient-to-t from-black/70 via-black/25 to-transparent'

export const VARIANT_TOKENS: Record<Variant, VariantTokens> = {
  // aurora — brand-gradient immersive, rounded, soft-glass.
  aurora: {
    tileAspect: 'aspect-[4/3]',
    // landr-d8rg.8: the AA scrim carries text legibility; the brand tint is a
    // thin extra wash on top (clamped low) so a pale --primary can't lift the
    // overall darkness below AA. (Was from-primary/70 — fine on a dark brand
    // colour, but a light one dropped white text under AA.)
    tileOverlay:
      'bg-gradient-to-t from-black/70 via-black/25 to-transparent',
    cardRadius: 'rounded-2xl',
    cardShadow: 'shadow-lg shadow-primary/10 ring-1 ring-primary/10',
    cardDensity: 'p-5 gap-4',
    heroTreatment: 'aspect-[16/9] rounded-2xl ring-1 ring-primary/10',
    typeAccent: 'font-semibold tracking-tight',
    chipRadius: 'rounded-full',
    thumbRadius: 'rounded-xl',
    selectionRing: 'ring-2 ring-primary',
    focusRing: SHARED_FOCUS_RING,
    overlayScrim: AA_SCRIM,
  },
  // summit — editorial, image-forward, whitespace, serif accent.
  summit: {
    tileAspect: 'aspect-[3/2]',
    tileOverlay: AA_SCRIM,
    cardRadius: 'rounded-lg',
    cardShadow: 'shadow-none border-b border-border',
    cardDensity: 'p-6 gap-5',
    heroTreatment: 'aspect-[3/2] rounded-lg',
    typeAccent: 'font-serif font-medium tracking-normal',
    chipRadius: 'rounded-full',
    thumbRadius: 'rounded-lg',
    selectionRing: 'ring-2 ring-foreground',
    focusRing: SHARED_FOCUS_RING,
    overlayScrim: AA_SCRIM,
  },
  // alpine — crisp classic, dense, sharp radius, strong borders.
  alpine: {
    tileAspect: 'aspect-square',
    tileOverlay: AA_SCRIM,
    cardRadius: 'rounded-sm',
    cardShadow: 'shadow-xs border border-border',
    cardDensity: 'p-3 gap-2',
    heroTreatment: 'aspect-[4/3] rounded-sm border border-border',
    typeAccent: 'font-medium uppercase tracking-wide text-sm',
    // alpine squares its chips to match the sharp card radius.
    chipRadius: 'rounded-sm',
    thumbRadius: 'rounded-sm',
    selectionRing: 'ring-2 ring-foreground',
    focusRing: SHARED_FOCUS_RING,
    overlayScrim: AA_SCRIM,
  },
}

/**
 * Context value: the active variant plus its resolved token set. The
 * VariantProvider component (in variant.tsx) is the only thing that writes
 * this; everything else reads it through useVariant().
 *
 * landr-d8rg.8: the provider is now stateful so the preview-mode variant
 * switcher can flip directions live. `setVariant` mutates the active variant
 * (and the URL `?variant=` param) without a full reload; `previewEnabled`
 * gates the floating switcher chip — true only when `?preview=1` or an
 * operator preview token is present. Customer-facing embeds keep
 * previewEnabled=false, so the switcher never ships to end users.
 */
export interface VariantContextValue {
  variant: Variant
  tokens: VariantTokens
  setVariant: (next: Variant) => void
  previewEnabled: boolean
}

/**
 * Shared context. Defaults to aurora so components rendered without a provider
 * (e.g. isolated unit tests) still get a valid token set — no null checks.
 * setVariant is a no-op by default (no live switching outside the provider)
 * and previewEnabled is false (no switcher chip in plain renders).
 */
export const VariantContext = createContext<VariantContextValue>({
  variant: DEFAULT_VARIANT,
  tokens: VARIANT_TOKENS[DEFAULT_VARIANT],
  setVariant: () => {},
  previewEnabled: false,
})

/** useVariant — returns the active variant plus its resolved token set. */
export function useVariant(): VariantContextValue {
  return useContext(VariantContext)
}

/**
 * landr-d8rg.8: write the chosen variant into the live URL's `?variant=`
 * param via history.replaceState (no navigation / reload), so a deep-linked
 * preview URL stays shareable and a refresh keeps the picked direction.
 * Guarded for non-browser (test/SSR) environments.
 */
export function writeVariantToUrl(next: Variant): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return
  const url = new URL(window.location.href)
  url.searchParams.set('variant', next)
  window.history.replaceState(window.history.state, '', url)
}

/**
 * landr-d8rg.8: is the preview switcher allowed in this embed? True when the
 * URL carries `?preview=1` (our explicit design-review flag) OR an operator
 * `preview_token` (the existing draft-preview path). Pure + window-guarded so
 * App and tests can both call it.
 */
export function previewEnabledFromLocation(): boolean {
  if (typeof window === 'undefined') return false
  return previewEnabledFromSearch(window.location.search)
}

/** Pure form of previewEnabledFromLocation — testable without a window. */
export function previewEnabledFromSearch(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const preview = params.get('preview')?.trim()
  if (preview === '1' || preview === 'true') return true
  return Boolean(params.get('preview_token')?.trim())
}
