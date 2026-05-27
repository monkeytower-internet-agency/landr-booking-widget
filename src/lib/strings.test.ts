import { describe, expect, it } from 'vitest'
import { pickBundle, tr } from './strings'

// landr-ifcu: widget is English-only in v1. pickBundle / tr must ignore the
// locale argument entirely — German-locale browsers still get English copy.
describe('strings (English-only, landr-ifcu)', () => {
  it('pickBundle returns the English bundle for any locale', () => {
    const en = pickBundle('en')
    const de = pickBundle('de')
    const deDE = pickBundle('de-DE')
    const fr = pickBundle('fr-FR')
    expect(en).toBe(de)
    expect(en).toBe(deDE)
    expect(en).toBe(fr)
    expect(en.multiDayPickerHelp).toMatch(/^Tap days to add or remove/)
  })

  it('tr returns the English string for any locale', () => {
    expect(tr('multiDayPickerHelp', 'de')).toMatch(/^Tap days to add or remove/)
    expect(tr('multiDayPickerHelp', 'de-DE')).toMatch(/^Tap days to add or remove/)
    expect(tr('multiDayPickerHelp')).toMatch(/^Tap days to add or remove/)
  })
})
