import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VARIANT,
  VARIANTS,
  VARIANT_TOKENS,
  parseVariant,
  hasVariantInSearch,
  type Variant,
  type VariantTokens,
} from './variant'

describe('parseVariant (landr-d8rg.3)', () => {
  it('parses each known variant from a full search string', () => {
    expect(parseVariant('?variant=aurora')).toBe('aurora')
    expect(parseVariant('?variant=summit')).toBe('summit')
    expect(parseVariant('?variant=alpine')).toBe('alpine')
  })

  it('parses a bare search string (no leading ?)', () => {
    expect(parseVariant('variant=summit')).toBe('summit')
  })

  it('reads variant alongside other params in any order', () => {
    expect(parseVariant('?group=foo&variant=alpine&product=bar')).toBe('alpine')
  })

  it('is case-insensitive and trims', () => {
    expect(parseVariant('?variant=SUMMIT')).toBe('summit')
    expect(parseVariant('?variant=%20alpine%20')).toBe('alpine')
  })

  it('defaults to aurora for an empty/missing param', () => {
    expect(parseVariant('')).toBe(DEFAULT_VARIANT)
    expect(parseVariant('?')).toBe(DEFAULT_VARIANT)
    expect(parseVariant('?foo=bar')).toBe(DEFAULT_VARIANT)
    expect(DEFAULT_VARIANT).toBe('aurora')
  })

  it('falls back to aurora for an unknown variant', () => {
    expect(parseVariant('?variant=neon')).toBe('aurora')
    expect(parseVariant('?variant=')).toBe('aurora')
  })
})

describe('VARIANT_TOKENS (landr-d8rg.3 / landr-d8rg.8)', () => {
  const tokenKeys: (keyof VariantTokens)[] = [
    'tileAspect',
    'tileOverlay',
    'cardRadius',
    'cardShadow',
    'cardDensity',
    'heroTreatment',
    'typeAccent',
    // landr-d8rg.8 cohesion tokens.
    'chipRadius',
    'thumbRadius',
    'selectionRing',
    'focusRing',
    'overlayScrim',
  ]

  // landr-d8rg.8: tokens that are DELIBERATELY shared across variants for
  // cross-surface cohesion — the focus affordance and the AA text-over-image
  // scrim must read identically regardless of the visual direction. The tile
  // overlay is the same AA scrim (the immersive treatment differs by LAYOUT,
  // not by scrim strength). These are exempt from the "differs across
  // variants" assertion below.
  const intentionallySharedKeys: (keyof VariantTokens)[] = [
    'focusRing',
    'overlayScrim',
    'tileOverlay',
  ]

  it('defines a token set for all three variants', () => {
    expect(VARIANTS).toEqual(['aurora', 'summit', 'alpine'])
    for (const v of VARIANTS) {
      expect(VARIANT_TOKENS[v]).toBeDefined()
    }
  })

  it('every token field is present and a non-empty string per variant', () => {
    for (const v of VARIANTS) {
      const tokens = VARIANT_TOKENS[v]
      for (const key of tokenKeys) {
        expect(typeof tokens[key]).toBe('string')
        expect(tokens[key].length).toBeGreaterThan(0)
      }
    }
  })

  it('the three token sets are non-identical (distinct directions)', () => {
    const serialized = VARIANTS.map((v: Variant) => JSON.stringify(VARIANT_TOKENS[v]))
    expect(new Set(serialized).size).toBe(VARIANTS.length)
  })

  it('each direction-defining token differs across at least two variants', () => {
    for (const key of tokenKeys) {
      if (intentionallySharedKeys.includes(key)) continue
      const values = VARIANTS.map((v) => VARIANT_TOKENS[v][key])
      expect(new Set(values).size).toBeGreaterThan(1)
    }
  })

  it('the intentionally-shared tokens are identical across all variants', () => {
    for (const key of intentionallySharedKeys) {
      const values = VARIANTS.map((v) => VARIANT_TOKENS[v][key])
      expect(new Set(values).size).toBe(1)
    }
  })
})

describe('hasVariantInSearch (landr-jb1k.2)', () => {
  it('returns true when the URL carries a valid ?variant= param', () => {
    expect(hasVariantInSearch('?variant=aurora')).toBe(true)
    expect(hasVariantInSearch('?variant=summit')).toBe(true)
    expect(hasVariantInSearch('?variant=alpine')).toBe(true)
    // bare search string (no leading ?)
    expect(hasVariantInSearch('variant=summit')).toBe(true)
  })

  it('returns false when ?variant= is absent or invalid', () => {
    expect(hasVariantInSearch('')).toBe(false)
    expect(hasVariantInSearch('?foo=bar')).toBe(false)
    expect(hasVariantInSearch('?variant=neon')).toBe(false)
    expect(hasVariantInSearch('?variant=')).toBe(false)
  })

  it('returns true case-insensitively for known variants', () => {
    expect(hasVariantInSearch('?variant=ALPINE')).toBe(true)
    expect(hasVariantInSearch('?variant=Summit')).toBe(true)
  })
})
