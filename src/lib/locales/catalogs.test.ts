/**
 * landr-8r6oc.4 — every widget language is a complete catalog.
 *
 * A further language is a drop-in file under src/lib/locales/ plus one
 * registry line in strings.ts; this suite is what keeps such a file honest:
 * the same keys as English, the same {placeholders} in every value, no value
 * left identical to English where translation is expected, and the helper
 * phrases (plurals, gates, lists) rendering real text in each language.
 */
import { describe, expect, it } from 'vitest'

import {
  SUPPORTED_UI_LANGUAGES,
  availabilityGate,
  daysSelectedLabel,
  fmt,
  hostRoomFullMessage,
  inviteRoomLabel,
  languageStepCue,
  languageStepGate,
  multiDayDiffSummary,
  multiDayGate,
  multiDayResetDroppedNotice,
  nightsWord,
  occupancyOverbookWarning,
  optionalRevealLabel,
  pickBundle,
  seatsLeftLabel,
  type Bundle,
} from '../strings'

const en = pickBundle('en')
const placeholders = (value: string): string[] =>
  [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort()

describe.each(SUPPORTED_UI_LANGUAGES.filter((l) => l !== 'en'))('%s catalog', (lang) => {
  const bundle = pickBundle(lang) as Record<string, string>
  const source = en as Record<string, string>

  it('has exactly the English keys', () => {
    expect(Object.keys(bundle).sort()).toEqual(Object.keys(source).sort())
  })

  it('keeps every {placeholder} of the English template (and adds none)', () => {
    const bad = Object.keys(source).filter(
      (key) => placeholders(String(bundle[key])).join() !== placeholders(String(source[key])).join(),
    )
    expect(bad).toEqual([])
  })

  it('has no empty values', () => {
    expect(Object.keys(bundle).filter((k) => String(bundle[k]).trim() === '')).toEqual([])
  })

  it('translates the bulk of the catalog (not a copy of English)', () => {
    const keys = Object.keys(source)
    const same = keys.filter((k) => bundle[k] === source[k])
    // Brand names, units and symbols legitimately stay identical.
    expect(same.length / keys.length).toBeLessThan(0.1)
  })
})

describe('locale-agnostic helper phrases (landr-8r6oc.4)', () => {
  it.each(['en', 'de', 'es', 'tr'])('%s: helpers fill their placeholders and never leak braces', (lang) => {
    const t: Bundle = pickBundle(lang)
    const outputs = [
      daysSelectedLabel(1, lang),
      daysSelectedLabel(3, lang),
      optionalRevealLabel('Your name', lang),
      languageStepCue(['Ada'], true, lang),
      languageStepCue(['Ada', 'Grace'], true, lang),
      languageStepCue(['Ada', 'Grace', 'Linus'], false, lang),
      languageStepCue(['Ada', 'Grace'], false, lang),
      languageStepGate([], lang),
      languageStepGate(['Ada', 'Grace'], lang),
      multiDayGate(0, lang),
      multiDayGate(1, lang),
      multiDayGate(4, lang),
      availabilityGate(true, false, lang),
      availabilityGate(true, true, lang),
      occupancyOverbookWarning(3, 2, lang),
      multiDayDiffSummary(1, 2, 'Ada', lang),
      multiDayDiffSummary(1, 2, null, lang),
      multiDayResetDroppedNotice(1, 'Ada', lang),
      multiDayResetDroppedNotice(3, null, lang),
      hostRoomFullMessage(0, 1, lang),
      hostRoomFullMessage(1, 2, lang),
      hostRoomFullMessage(3, 2, lang),
      inviteRoomLabel('', lang),
      seatsLeftLabel(4, lang),
      `${4} ${nightsWord(4, lang)}`,
      t.listAndWord,
    ]
    for (const out of outputs) {
      expect(out.trim()).not.toBe('')
      expect(out).not.toMatch(/\{\w+\}/)
    }
    expect(daysSelectedLabel(3, lang)).toContain('3')
    expect(multiDayGate(4, lang)).toContain('4')
    expect(hostRoomFullMessage(3, 2, lang)).toContain('3')
  })

  it('Spanish and Turkish helper copy is in the right language', () => {
    expect(multiDayGate(0, 'es')).toMatch(/fecha|día/i)
    expect(multiDayGate(0, 'tr')).toMatch(/tarih|gün/i)
    expect(languageStepGate([], 'es')).toMatch(/idioma/i)
    expect(languageStepGate([], 'tr')).toMatch(/dil/i)
  })

  it('fmt leaves unknown placeholders untouched', () => {
    expect(fmt('{a} {b}', { a: 1 })).toBe('1 {b}')
  })
})
