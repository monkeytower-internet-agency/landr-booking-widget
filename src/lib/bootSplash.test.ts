import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  applyBootLogo,
  BOOT_LOGO_ID,
  BOOT_SPLASH_ID,
  type BootReadiness,
  dismissBootSplash,
  isBootReady,
  logoCacheKey,
} from './bootSplash'

function mountSplash() {
  const boot = document.createElement('div')
  boot.id = BOOT_SPLASH_ID
  const img = document.createElement('img')
  img.id = BOOT_LOGO_ID
  img.setAttribute('src', '/landr-mark.svg')
  boot.appendChild(img)
  document.body.appendChild(boot)
  return img
}

afterEach(() => {
  document.getElementById(BOOT_SPLASH_ID)?.remove()
})

describe('applyBootLogo', () => {
  it('sets the operator logo on the splash and caches it', () => {
    const img = mountSplash()
    const storage = { setItem: vi.fn(), removeItem: vi.fn() }
    applyBootLogo('tok', 'https://x/logo.png', document, storage)
    expect(img.getAttribute('src')).toBe('https://x/logo.png')
    expect(storage.setItem).toHaveBeenCalledWith(logoCacheKey('tok'), 'https://x/logo.png')
  })

  it('keeps the Landr mark and clears the cache when there is no logo', () => {
    const img = mountSplash()
    const storage = { setItem: vi.fn(), removeItem: vi.fn() }
    applyBootLogo('tok', null, document, storage)
    expect(img.getAttribute('src')).toBe('/landr-mark.svg')
    expect(storage.removeItem).toHaveBeenCalledWith('landr:logo:tok')
  })

  it('swallows a throwing storage and works with the splash already gone', () => {
    const storage = {
      setItem: vi.fn(() => {
        throw new Error('SecurityError')
      }),
      removeItem: vi.fn(),
    }
    expect(() =>
      applyBootLogo('tok', 'https://x/logo.png', document, storage),
    ).not.toThrow()
  })
})

describe('dismissBootSplash', () => {
  it('removes the splash and is idempotent', () => {
    mountSplash()
    dismissBootSplash()
    expect(document.getElementById(BOOT_SPLASH_ID)).toBeNull()
    expect(() => dismissBootSplash()).not.toThrow()
  })
})

describe('isBootReady', () => {
  const base: BootReadiness = {
    settingsSettled: true,
    inviteResolving: false,
    stepName: 'pick-product',
    catalogMode: 'categories',
    deepLink: false,
    groupsSettled: true,
    productListLoaded: true,
    expandedCatalogLoaded: false,
    selectionNeedsData: false,
    selectionLoaded: false,
  }

  it('waits for the settings fetch', () => {
    expect(isBootReady({ ...base, settingsSettled: false })).toBe(false)
  })

  it('waits while an invite link is resolving', () => {
    expect(isBootReady({ ...base, inviteResolving: true })).toBe(false)
  })

  it('pick-product needs the products AND the groups fetch (it may still promote to categories)', () => {
    expect(isBootReady(base)).toBe(true)
    expect(isBootReady({ ...base, productListLoaded: false })).toBe(false)
    expect(isBootReady({ ...base, groupsSettled: false })).toBe(false)
    // A deep link skips the groups fetch entirely.
    expect(isBootReady({ ...base, groupsSettled: false, deepLink: true })).toBe(true)
  })

  it('pick-category: tiles are ready with the groups; the expanded catalog waits for its products', () => {
    const cat = { ...base, stepName: 'pick-category', productListLoaded: false }
    expect(isBootReady(cat)).toBe(true)
    expect(isBootReady({ ...cat, catalogMode: 'expanded' })).toBe(false)
    expect(
      isBootReady({ ...cat, catalogMode: 'expanded', expandedCatalogLoaded: true }),
    ).toBe(true)
  })

  it('pick-selection waits for the picker availability when it fetches any', () => {
    const sel = { ...base, stepName: 'pick-selection', productListLoaded: false }
    expect(isBootReady(sel)).toBe(true)
    expect(isBootReady({ ...sel, selectionNeedsData: true })).toBe(false)
    expect(
      isBootReady({ ...sel, selectionNeedsData: true, selectionLoaded: true }),
    ).toBe(true)
  })

  it('any other (restored / deep-linked) step is ready once settings settle', () => {
    expect(
      isBootReady({ ...base, stepName: 'product-detail', productListLoaded: false }),
    ).toBe(true)
    expect(isBootReady({ ...base, stepName: 'details', productListLoaded: false })).toBe(true)
  })
})
