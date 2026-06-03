import { describe, expect, it } from 'vitest'
import {
  ICON_KEYS,
  ACCENT_ROTATIONS,
  accentIndex,
  artRecipe,
  hashSeed,
  pickIcon,
  pickTexture,
} from './artCore'

describe('hashSeed (landr-d8rg.3)', () => {
  it('is deterministic for the same seed', () => {
    expect(hashSeed('tandem-paragliding')).toBe(hashSeed('tandem-paragliding'))
  })

  it('returns an unsigned 32-bit integer', () => {
    const h = hashSeed('anything')
    expect(Number.isInteger(h)).toBe(true)
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThanOrEqual(0xffffffff)
  })

  it('produces different hashes for different seeds', () => {
    expect(hashSeed('alpha')).not.toBe(hashSeed('beta'))
    expect(hashSeed('a')).not.toBe(hashSeed('b'))
  })
})

describe('pickIcon determinism + keyword matching (landr-d8rg.3)', () => {
  it('same seed → identical icon (called twice)', () => {
    expect(pickIcon('mystery-experience-42')).toBe(pickIcon('mystery-experience-42'))
  })

  it('keyword matches map to the expected glyph', () => {
    expect(pickIcon('tandem-paragliding-flight')).toBe('paraglider')
    expect(pickIcon('via-ferrata-summit-tour')).toBe('mountain') // mountain wins (earlier)
    expect(pickIcon('guided-explore-course')).toBe('compass')
    expect(pickIcon('weekend-travel-package')).toBe('suitcase')
    expect(pickIcon('gear-rental-kit')).toBe('backpack')
    expect(pickIcon('gift-voucher')).toBe('gift')
  })

  it('falls back to a hash-selected icon when no keyword matches', () => {
    const icon = pickIcon('zzqx-9981')
    expect(ICON_KEYS).toContain(icon)
    // deterministic fallback
    expect(pickIcon('zzqx-9981')).toBe(icon)
  })
})

describe('accentIndex (landr-d8rg.3)', () => {
  it('is deterministic and within range', () => {
    const a = accentIndex('product-slug')
    expect(a).toBe(accentIndex('product-slug'))
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(ACCENT_ROTATIONS)
  })

  it('varies across seeds (not all identical)', () => {
    const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']
    const indices = new Set(seeds.map(accentIndex))
    expect(indices.size).toBeGreaterThan(1)
  })
})

describe('artRecipe determinism (landr-d8rg.3)', () => {
  it('same seed → identical recipe (icon + accent + texture + angle)', () => {
    expect(artRecipe('summit-hike')).toEqual(artRecipe('summit-hike'))
  })

  it('distinct seeds → distinct recipes (at least one field differs)', () => {
    const a = artRecipe('alpha-product')
    const b = artRecipe('beta-product')
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })

  it('kind overrides icon selection but seed still drives accent/texture', () => {
    const seed = 'generic-slug-001'
    const base = artRecipe(seed)
    const withKind = artRecipe(seed, 'gift voucher bundle')
    expect(withKind.icon).toBe('gift')
    expect(withKind.accent).toBe(base.accent)
    expect(withKind.texture).toBe(base.texture)
  })

  it('pickTexture is deterministic and one of the two textures', () => {
    expect(pickTexture('x')).toBe(pickTexture('x'))
    expect(['dots', 'contour']).toContain(pickTexture('y'))
  })
})
