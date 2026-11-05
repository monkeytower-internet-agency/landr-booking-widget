/**
 * Offer lines replaced the product_addons surface: nothing in the widget may
 * read it again (the add-ons list, its state module, the service add-ons
 * step, the per-room add-on map). Generated API types are exempt.
 */
import { describe, expect, it } from 'vitest'

const SOURCES = import.meta.glob('../../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const FORBIDDEN =
  /product_addons|ProductAddon\b|getProductAddons\b|AddonsList|addonsState|ServiceAddonsStep|perRoomAddons|AddonSelection/

describe('no product_addons reader is left', () => {
  it('no source file names the old add-on surface', () => {
    const hits = Object.entries(SOURCES)
      .filter(([path]) => !path.endsWith('.gen.ts') && !path.endsWith('noProductAddons.test.ts'))
      .flatMap(([path, src]) =>
        src
          .split('\n')
          .map((line, i) => ({ path, line: i + 1, text: line }))
          .filter((l) => FORBIDDEN.test(l.text)),
      )
      .map((h) => `${h.path}:${h.line}: ${h.text.trim()}`)
    expect(hits).toEqual([])
  })
})
