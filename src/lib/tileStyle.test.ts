/**
 * landr-jb1k.4: tests for the tile-style option maps.
 */
import { describe, expect, it } from 'vitest'
import {
  TILE_RADIUS_CLASS_MAP,
  TILE_ASPECT_CLASS_MAP,
  TILE_SCRIM_MAP,
  TILE_HOVER_MAP,
  type TileRadiusKey,
  type TileAspectKey,
  type TileScrimKey,
  type TileHoverKey,
} from './tileStyle'

describe('TILE_RADIUS_CLASS_MAP', () => {
  it('maps the three radius keys to distinct rounded-* utilities', () => {
    expect(TILE_RADIUS_CLASS_MAP.sharp).toBe('rounded-none')
    expect(TILE_RADIUS_CLASS_MAP.rounded).toBe('rounded-xl')
    expect(TILE_RADIUS_CLASS_MAP.round).toBe('rounded-3xl')
    const keys: TileRadiusKey[] = ['sharp', 'rounded', 'round']
    expect(new Set(keys.map((k) => TILE_RADIUS_CLASS_MAP[k])).size).toBe(3)
  })
})

describe('TILE_ASPECT_CLASS_MAP', () => {
  it('maps the three aspect keys to the 1:1 / 4:3 / 16:9 utilities', () => {
    expect(TILE_ASPECT_CLASS_MAP.square).toBe('aspect-square')
    expect(TILE_ASPECT_CLASS_MAP.landscape).toBe('aspect-[4/3]')
    expect(TILE_ASPECT_CLASS_MAP.wide).toBe('aspect-video')
    const keys: TileAspectKey[] = ['square', 'landscape', 'wide']
    expect(new Set(keys.map((k) => TILE_ASPECT_CLASS_MAP[k])).size).toBe(3)
  })
})

describe('TILE_SCRIM_MAP', () => {
  it('dark and brand keep white overlay text (titleDark false)', () => {
    expect(TILE_SCRIM_MAP.dark.titleDark).toBe(false)
    expect(TILE_SCRIM_MAP.brand.titleDark).toBe(false)
  })

  it('dark is a black gradient (matches the current variant scrim)', () => {
    expect(TILE_SCRIM_MAP.dark.overlay).toContain('from-black')
  })

  it('brand tints the gradient with the operator --primary', () => {
    expect(TILE_SCRIM_MAP.brand.overlay).toContain('from-primary')
  })

  it('light is a white gradient AND forces dark title text (AA enforced)', () => {
    expect(TILE_SCRIM_MAP.light.overlay).toContain('from-white')
    expect(TILE_SCRIM_MAP.light.titleDark).toBe(true)
  })

  it('every scrim key resolves to a non-empty overlay gradient', () => {
    const keys: TileScrimKey[] = ['dark', 'brand', 'light']
    for (const k of keys) {
      expect(TILE_SCRIM_MAP[k].overlay).toContain('bg-gradient-to-t')
    }
  })
})

describe('TILE_HOVER_MAP', () => {
  it('lift translates the button only (no image scale)', () => {
    expect(TILE_HOVER_MAP.lift.button).toContain('hover:-translate-y-0.5')
    expect(TILE_HOVER_MAP.lift.image).toBe('')
  })

  it('zoom scales the image only (no button translate)', () => {
    expect(TILE_HOVER_MAP.zoom.image).toContain('group-hover:scale-105')
    expect(TILE_HOVER_MAP.zoom.button).toBe('')
  })

  it('none has neither motion', () => {
    expect(TILE_HOVER_MAP.none.button).toBe('')
    expect(TILE_HOVER_MAP.none.image).toBe('')
  })

  it('every hover key resolves to a defined button + image pair', () => {
    const keys: TileHoverKey[] = ['lift', 'zoom', 'none']
    for (const k of keys) {
      expect(typeof TILE_HOVER_MAP[k].button).toBe('string')
      expect(typeof TILE_HOVER_MAP[k].image).toBe('string')
    }
  })
})
