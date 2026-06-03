/**
 * landr-d8rg.6: tests for the view-mode storage helpers. Covers the persisted
 * preference round-trip, the responsive default (jsdom has no matchMedia ⇒
 * grid), and the sandboxed-storage guard (read/write must never throw).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  VIEW_MODE_STORAGE_KEY,
  defaultViewMode,
  readStoredViewMode,
  resolveInitialViewMode,
  writeStoredViewMode,
} from './useViewMode'

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('readStoredViewMode / writeStoredViewMode', () => {
  it('round-trips a stored preference', () => {
    writeStoredViewMode('list')
    expect(window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)).toBe('list')
    expect(readStoredViewMode()).toBe('list')
  })

  it('returns null when nothing is stored', () => {
    expect(readStoredViewMode()).toBeNull()
  })

  it('returns null for a junk stored value', () => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, 'sideways')
    expect(readStoredViewMode()).toBeNull()
  })

  it('does not throw when getItem throws (sandboxed embed)', () => {
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage blocked')
    })
    expect(() => readStoredViewMode()).not.toThrow()
    expect(readStoredViewMode()).toBeNull()
  })

  it('does not throw when setItem throws (sandboxed embed)', () => {
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: storage blocked')
    })
    expect(() => writeStoredViewMode('grid')).not.toThrow()
  })
})

describe('defaultViewMode', () => {
  it('falls back to grid when matchMedia is unavailable (jsdom)', () => {
    expect(defaultViewMode()).toBe('grid')
  })

  it('returns grid on a ≥md viewport and list below', () => {
    const mm = vi
      .fn()
      .mockReturnValue({ matches: true } as MediaQueryList)
    vi.stubGlobal('matchMedia', mm)
    expect(defaultViewMode()).toBe('grid')

    mm.mockReturnValue({ matches: false } as MediaQueryList)
    expect(defaultViewMode()).toBe('list')
    vi.unstubAllGlobals()
  })
})

describe('resolveInitialViewMode', () => {
  it('prefers a stored value over the responsive default', () => {
    writeStoredViewMode('list')
    expect(resolveInitialViewMode()).toBe('list')
  })

  it('uses the responsive default (grid in jsdom) when nothing stored', () => {
    expect(resolveInitialViewMode()).toBe('grid')
  })
})
