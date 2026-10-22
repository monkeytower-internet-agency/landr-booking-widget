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

  it('gives up waiting after maxWaitMs but still lands the catalog later', async () => {
    const s = await freshStrings()
    await s.loadUiCatalog('de', 0)
    // Whether or not the chunk made the deadline, it must be usable afterwards.
    await s.loadUiCatalog('de')
    expect(s.pickBundle('de').bookingConfirmed).toBe('Buchung bestätigt')
  })
})
