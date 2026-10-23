/**
 * landr-8r6oc.18 - the non-English catalogs are lazy chunks. English is inline
 * and stays the fallback until the resolved language's catalog has loaded; a
 * failed or slow load never throws and never blanks the widget.
 *
 * Each test re-imports strings.ts on a fresh module registry, because the
 * shared test setup preloads every catalog into the default instance.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

async function freshStrings() {
  vi.resetModules()
  return import('./strings')
}

afterEach(() => {
  vi.doUnmock('./locales/tr')
  vi.resetModules()
})

describe('lazy UI catalogs', () => {
  it('serves English for a supported language until its catalog has loaded', async () => {
    const s = await freshStrings()
    expect(s.resolveUiLanguage('es-ES')).toBe('es')
    expect(s.pickBundle('es-ES')).toBe(s.pickBundle('en'))
    expect(s.pickBundle('es-ES').bookingConfirmed).toBe('Booking confirmed')

    await s.loadUiCatalog('es-ES')
    expect(s.pickBundle('es-ES').bookingConfirmed).toBe('Reserva confirmada')
    // Other languages are not dragged in.
    expect(s.pickBundle('tr-TR')).toBe(s.pickBundle('en'))
  })

  it.each([
    ['de-DE', 'Buchung bestätigt'],
    ['tr-TR', 'Rezervasyon onaylandı'],
  ])('loads %s on demand', async (locale, heading) => {
    const s = await freshStrings()
    await s.loadUiCatalog(locale)
    expect(s.pickBundle(locale).bookingConfirmed).toBe(heading)
    expect(s.isGermanLocale(locale)).toBe(locale.startsWith('de'))
  })

  it('is a no-op for English and unsupported languages', async () => {
    const s = await freshStrings()
    await expect(s.loadUiCatalog('en-US')).resolves.toBeUndefined()
    await expect(s.loadUiCatalog('fr-FR')).resolves.toBeUndefined()
    await expect(s.loadUiCatalog(undefined)).resolves.toBeUndefined()
    expect(s.pickBundle('fr-FR')).toBe(s.pickBundle('en'))
  })

  it('shares one in-flight import between concurrent callers', async () => {
    const s = await freshStrings()
    await Promise.all([s.loadUiCatalog('es'), s.loadUiCatalog('es-MX'), s.loadUiCatalog('ES')])
    expect(s.pickBundle('es').bookingConfirmed).toBe('Reserva confirmada')
  })

  it('keeps rendering English, without throwing, when the chunk fails to load', async () => {
    vi.doMock('./locales/tr', () => {
      throw new Error('chunk failed')
    })
    const s = await freshStrings()
    await expect(s.loadUiCatalog('tr-TR')).resolves.toBeUndefined()
    expect(s.pickBundle('tr-TR')).toBe(s.pickBundle('en'))
    expect(s.tr('bookingConfirmed', 'tr-TR')).toBe('Booking confirmed')
  })

  it('gives up waiting after maxWaitMs while a never-resolving loader stays pending', async () => {
    vi.doMock('./locales/de', () => new Promise(() => {}))
    const s = await freshStrings()
    vi.useFakeTimers()
    try {
      let settled = false
      const wait = s.loadUiCatalog('de', 1000).then(() => {
        settled = true
      })
      await vi.advanceTimersByTimeAsync(999)
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await wait
      expect(settled).toBe(true)
      // The catalog never landed: English keeps rendering.
      expect(s.pickBundle('de')).toBe(s.pickBundle('en'))
    } finally {
      vi.useRealTimers()
      vi.doUnmock('./locales/de')
    }
  })

  it('notifies subscribers once when a catalog lands after the wait deadline', async () => {
    let release: (mod: object) => void = () => {}
    vi.doMock('./locales/de', () => new Promise<object>((resolve) => (release = resolve)))
    const real = await vi.importActual<typeof import('./locales/de')>('./locales/de')
    const s = await freshStrings()
    const listener = vi.fn()
    const unsubscribe = s.subscribeUiCatalogs(listener)
    const before = s.getUiCatalogVersion()
    try {
      vi.useFakeTimers()
      const wait = s.loadUiCatalog('de', 50)
      await vi.advanceTimersByTimeAsync(50)
      await wait
      vi.useRealTimers()
      expect(listener).not.toHaveBeenCalled()
      expect(s.pickBundle('de').bookingConfirmed).toBe('Booking confirmed')

      release({ de: real.de })
      await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1))
      expect(s.getUiCatalogVersion()).toBe(before + 1)
      expect(s.pickBundle('de').bookingConfirmed).toBe('Buchung bestätigt')

      // Already loaded: no further notification.
      await s.loadUiCatalog('de')
      expect(listener).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
      unsubscribe()
      vi.doUnmock('./locales/de')
    }
  })
})
