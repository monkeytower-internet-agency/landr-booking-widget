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
 */
export interface VariantTokens {
  tileAspect: string
  tileOverlay: string
  cardRadius: string
  cardShadow: string
  cardDensity: string
  heroTreatment: string
  typeAccent: string
}

export const VARIANT_TOKENS: Record<Variant, VariantTokens> = {
  // aurora — brand-gradient immersive, rounded, soft-glass.
  aurora: {
    tileAspect: 'aspect-[4/3]',
    tileOverlay:
      'bg-gradient-to-t from-primary/70 via-primary/20 to-transparent mix-blend-multiply',
    cardRadius: 'rounded-2xl',
    cardShadow: 'shadow-lg shadow-primary/10 ring-1 ring-primary/10',
    cardDensity: 'p-5 gap-4',
    heroTreatment: 'aspect-[16/9] rounded-2xl ring-1 ring-primary/10',
    typeAccent: 'font-semibold tracking-tight',
  },
  // summit — editorial, image-forward, whitespace, serif accent.
  summit: {
    tileAspect: 'aspect-[3/2]',
    tileOverlay: 'bg-gradient-to-t from-black/45 to-transparent',
    cardRadius: 'rounded-lg',
    cardShadow: 'shadow-none border-b border-border',
    cardDensity: 'p-6 gap-5',
    heroTreatment: 'aspect-[3/2] rounded-lg',
    typeAccent: 'font-serif font-medium tracking-normal',
  },
  // alpine — crisp classic, dense, sharp radius, strong borders.
  alpine: {
    tileAspect: 'aspect-square',
    tileOverlay: 'bg-gradient-to-t from-black/55 to-black/0',
    cardRadius: 'rounded-sm',
    cardShadow: 'shadow-xs border border-border',
    cardDensity: 'p-3 gap-2',
    heroTreatment: 'aspect-[4/3] rounded-sm border border-border',
    typeAccent: 'font-medium uppercase tracking-wide text-sm',
  },
}

/**
 * Context value: the active variant plus its resolved token set. The
 * VariantProvider component (in variant.tsx) is the only thing that writes
 * this; everything else reads it through useVariant().
 */
export interface VariantContextValue {
  variant: Variant
  tokens: VariantTokens
}

/**
 * Shared context. Defaults to aurora so components rendered without a provider
 * (e.g. isolated unit tests) still get a valid token set — no null checks.
 */
export const VariantContext = createContext<VariantContextValue>({
  variant: DEFAULT_VARIANT,
  tokens: VARIANT_TOKENS[DEFAULT_VARIANT],
})

/** useVariant — returns the active variant plus its resolved token set. */
export function useVariant(): VariantContextValue {
  return useContext(VariantContext)
}
