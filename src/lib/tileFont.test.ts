/**
 * landr-jb1k.2: tests for the tile-font lazy-loader module.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TILE_FONT_FAMILY_MAP, loadTileFont, type TileFontKey } from './tileFont'

describe('TILE_FONT_FAMILY_MAP', () => {
  it('maps system to undefined (no override)', () => {
    expect(TILE_FONT_FAMILY_MAP.system).toBeUndefined()
  })

  it('maps each non-system key to a non-empty string', () => {
    const nonSystem: TileFontKey[] = ['playfair', 'montserrat', 'bebas', 'space-grotesk', 'caveat']
    for (const key of nonSystem) {
      expect(typeof TILE_FONT_FAMILY_MAP[key]).toBe('string')
      expect((TILE_FONT_FAMILY_MAP[key] as string).length).toBeGreaterThan(0)
    }
  })

  it('each non-system font-family string contains the font name', () => {
    expect(TILE_FONT_FAMILY_MAP.playfair).toContain('Playfair')
    expect(TILE_FONT_FAMILY_MAP.montserrat).toContain('Montserrat')
    expect(TILE_FONT_FAMILY_MAP.bebas).toContain('Bebas')
    expect(TILE_FONT_FAMILY_MAP['space-grotesk']).toContain('Space Grotesk')
    expect(TILE_FONT_FAMILY_MAP.caveat).toContain('Caveat')
  })

  it('all values are distinct (no two fonts share the same family string)', () => {
    const nonSystem: TileFontKey[] = ['playfair', 'montserrat', 'bebas', 'space-grotesk', 'caveat']
    const values = nonSystem.map((k) => TILE_FONT_FAMILY_MAP[k])
    expect(new Set(values).size).toBe(nonSystem.length)
  })
})

describe('loadTileFont', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves immediately (no-op) for null', async () => {
    await expect(loadTileFont(null)).resolves.toBeUndefined()
  })

  it('resolves immediately (no-op) for undefined', async () => {
    await expect(loadTileFont(undefined)).resolves.toBeUndefined()
  })

  it('resolves immediately (no-op) for "system"', async () => {
    await expect(loadTileFont('system')).resolves.toBeUndefined()
  })

  it('resolves without throwing for each non-system font key (dynamic import may be mocked or real)', async () => {
    // In the test environment the @fontsource CSS imports resolve as empty
    // modules (vitest handles CSS imports as stubs by default). We just
    // verify the function resolves and never throws for the caller.
    const keys: TileFontKey[] = ['playfair', 'montserrat', 'bebas', 'space-grotesk', 'caveat']
    for (const key of keys) {
      await expect(loadTileFont(key)).resolves.toBeUndefined()
    }
  })
})
