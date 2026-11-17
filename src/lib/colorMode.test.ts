import { afterEach, describe, expect, it } from 'vitest'
import {
  effectiveColorMode,
  parseColorMode,
  resetColorModeForTests,
  resolveIsDark,
  setDark,
  setOperatorColorMode,
  startColorMode,
} from './colorMode'

const html = () => document.documentElement

describe('parseColorMode', () => {
  it('accepts light, dark and auto, case-insensitively', () => {
    expect(parseColorMode('dark')).toBe('dark')
    expect(parseColorMode(' DARK ')).toBe('dark')
    expect(parseColorMode('auto')).toBe('auto')
    expect(parseColorMode('light')).toBe('light')
  })
  it('null for absent or unknown values', () => {
    expect(parseColorMode(null)).toBeNull()
    expect(parseColorMode('')).toBeNull()
    expect(parseColorMode('purple')).toBeNull()
  })
})

describe('resolveIsDark', () => {
  it('dark is always dark, light never, auto follows the OS', () => {
    expect(resolveIsDark('dark', false)).toBe(true)
    expect(resolveIsDark('light', true)).toBe(false)
    expect(resolveIsDark('auto', true)).toBe(true)
    expect(resolveIsDark('auto', false)).toBe(false)
  })
})

describe('effectiveColorMode', () => {
  it('visitor > url > operator > light', () => {
    expect(effectiveColorMode({ visitor: null, url: null, operator: null })).toBe('light')
    expect(effectiveColorMode({ visitor: null, url: null, operator: 'dark' })).toBe('dark')
    expect(effectiveColorMode({ visitor: null, url: 'light', operator: 'dark' })).toBe('light')
    expect(effectiveColorMode({ visitor: 'dark', url: 'light', operator: 'light' })).toBe('dark')
  })
})

describe('colour mode wiring', () => {
  afterEach(() => resetColorModeForTests())

  it('?theme=dark puts .dark and color-scheme on <html>', () => {
    startColorMode('?w=x&theme=dark')
    expect(html().classList.contains('dark')).toBe(true)
    expect(html().style.colorScheme).toBe('dark')
  })

  it('no param and no operator setting stays light', () => {
    startColorMode('?w=x')
    expect(html().classList.contains('dark')).toBe(false)
    expect(html().style.colorScheme).toBe('light')
  })

  it('operator dark applies once settings load; URL param overrides it', () => {
    startColorMode('?w=x')
    setOperatorColorMode('dark')
    expect(html().classList.contains('dark')).toBe(true)
    startColorMode('?w=x&theme=light')
    expect(html().classList.contains('dark')).toBe(false)
  })

  it("the visitor's switch wins and is remembered for the next visit", () => {
    startColorMode('?w=x')
    setOperatorColorMode('dark')
    setDark(false)
    expect(html().classList.contains('dark')).toBe(false)
    startColorMode('?w=x')
    expect(html().classList.contains('dark')).toBe(false)
  })

  it("remembers the operator's mode per token for the next visit's first paint", () => {
    startColorMode('?w=tok')
    setOperatorColorMode('dark', 'tok')
    resetColorModeForTests_keepStorage()
    startColorMode('?w=tok')
    expect(html().classList.contains('dark')).toBe(true)
    startColorMode('?w=other')
    expect(html().classList.contains('dark')).toBe(false)
  })
})

function resetColorModeForTests_keepStorage() {
  html().classList.remove('dark')
}
