import { describe, it, expect } from 'vitest'
import {
  parseHex,
  readableTextOn,
  rgbToHsl,
  deriveDark,
  resolveDarkTheme,
  widgetThemeStyle,
} from './widgetTheme'
import type { WidgetTheme } from '@/api/types'

describe('parseHex', () => {
  it('parses #RRGGBB', () => {
    expect(parseHex('#1d4ed8')).toEqual([0x1d, 0x4e, 0xd8])
  })
  it('parses shorthand #RGB', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255])
  })
  it('returns null for non-hex input', () => {
    expect(parseHex('rebeccapurple')).toBeNull()
    expect(parseHex('#12')).toBeNull()
    expect(parseHex('#zzzzzz')).toBeNull()
  })
})

describe('readableTextOn (contrast safety)', () => {
  it('picks dark text on a light background', () => {
    expect(readableTextOn('#ffffff')).toBe('#111111')
    expect(readableTextOn('#ffe066')).toBe('#111111')
  })
  it('picks light text on a dark background', () => {
    expect(readableTextOn('#000000')).toBe('#ffffff')
    expect(readableTextOn('#1d4ed8')).toBe('#ffffff')
  })
})

describe('deriveDark (hue-preserving)', () => {
  it('keeps blue blue-ish (NOT orange) when darkening', () => {
    // #1d4ed8 is a saturated blue (hue ~224°). A naive 255−x invert would
    // produce #e2b127 — an ORANGE (hue ~43°). Hue-preserving derivation must
    // keep the hue near blue.
    const dark = deriveDark('#1d4ed8')
    const rgb = parseHex(dark)!
    const [h] = rgbToHsl(rgb)
    // Blue hues live roughly in [200, 260]. Orange would be ~30–50.
    expect(h).toBeGreaterThan(200)
    expect(h).toBeLessThan(260)
  })

  it('lightens a dark colour (flips lightness)', () => {
    const [, , lIn] = rgbToHsl(parseHex('#0a1a40')!) // very dark blue
    const dark = deriveDark('#0a1a40')
    const [, , lOut] = rgbToHsl(parseHex(dark)!)
    expect(lOut).toBeGreaterThan(lIn)
  })

  it('preserves the hue of a green', () => {
    const dark = deriveDark('#16a34a') // green, hue ~142°
    const [h] = rgbToHsl(parseHex(dark)!)
    expect(h).toBeGreaterThan(100)
    expect(h).toBeLessThan(180)
  })

  it('returns the input unchanged for unparseable colours', () => {
    expect(deriveDark('rebeccapurple')).toBe('rebeccapurple')
  })
})

describe('resolveDarkTheme', () => {
  it('prefers explicit dark overrides, derives the rest', () => {
    const theme: WidgetTheme = {
      brand: '#111111',
      accent: '#1d4ed8',
      background: '#ffffff',
      dark: { accent: '#3b82f6' },
    }
    const dark = resolveDarkTheme(theme)
    expect(dark.accent).toBe('#3b82f6') // explicit override wins
    expect(dark.background).toBe(deriveDark('#ffffff')) // derived
    expect(dark.brand).toBe(deriveDark('#111111')) // derived
  })
})

describe('widgetThemeStyle', () => {
  it('maps a 3-colour theme onto the widget CSS vars', () => {
    const style = widgetThemeStyle({
      theme: { brand: '#222222', accent: '#1d4ed8', background: '#f5f5f5' },
      primary_color: null,
    })
    expect(style['--background']).toBe('#f5f5f5')
    expect(style['--foreground']).toBe('#222222')
    expect(style['--brand']).toBe('#222222')
    expect(style['--primary']).toBe('#1d4ed8')
    // contrast-safe button label on a dark-blue accent → white
    expect(style['--primary-foreground']).toBe('#ffffff')
  })

  it('theme wins over a set primary_color', () => {
    const style = widgetThemeStyle({
      theme: { brand: '#222222', accent: '#1d4ed8', background: '#f5f5f5' },
      primary_color: '#ff8800',
    })
    expect(style['--primary']).toBe('#1d4ed8')
    expect(style['--background']).toBe('#f5f5f5')
  })

  it('falls back to legacy primary_color → --primary when theme is null', () => {
    const style = widgetThemeStyle({ theme: null, primary_color: '#ff8800' })
    expect(style['--primary']).toBe('#ff8800')
    expect(style['--background']).toBeUndefined()
    expect(style['--foreground']).toBeUndefined()
  })

  it('returns no inline vars when both theme and primary_color are null', () => {
    const style = widgetThemeStyle({ theme: null, primary_color: null })
    expect(Object.keys(style)).toHaveLength(0)
  })
})
