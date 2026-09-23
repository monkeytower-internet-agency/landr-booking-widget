/**
 * landr-r6e5x.4 — pure helpers behind the per-participant language board.
 *
 * The board itself is exercised through CustomFormStep (assignment, re-
 * assignment, column removal, the submit gate); this file pins the rules that
 * are easy to get subtly wrong and expensive to notice: the fallback when the
 * operator config predates `offered_languages`, the booker-first ordering the
 * email locale depends on, and the pruning that keeps a shrunken party or a
 * withdrawn language from carrying a stale assignment into the submit body.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_OFFERED_LANGUAGES,
  applyLanguageAssignment,
  distinctAssignedLanguages,
  isLanguageAssignmentComplete,
  joinLanguageNames,
  productAcceptsAnyLanguage,
  productDisplayLanguages,
  languageFlag,
  languageName,
  memberLabel,
  membersOfLanguage,
  normaliseOfferedLanguages,
  openLanguageColumns,
  pruneLanguageAssignment,
  unassignedMemberIndices,
} from './participantLanguages'

describe('normaliseOfferedLanguages', () => {
  it('lower-cases, trims and de-duplicates while preserving operator order', () => {
    expect(normaliseOfferedLanguages([' DE ', 'en', 'de', 'ES'])).toEqual([
      'de',
      'en',
      'es',
    ])
  })

  it('drops anything that is not a bare two-letter code', () => {
    expect(normaliseOfferedLanguages(['en', 'eng', 'e', 'de-AT', 42, null, 'fr'])).toEqual(
      ['en', 'fr'],
    )
  })

  it('falls back to the platform default when the config is absent or unusable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // A widget deployed ahead of landr-r6e5x.2 sees no column at all.
    expect(normaliseOfferedLanguages(undefined)).toEqual([
      ...DEFAULT_OFFERED_LANGUAGES,
    ])
    expect(normaliseOfferedLanguages([])).toEqual([...DEFAULT_OFFERED_LANGUAGES])
    expect(normaliseOfferedLanguages('en,de')).toEqual([
      ...DEFAULT_OFFERED_LANGUAGES,
    ])
    // Nothing throws — the widget has no error boundary.
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('honours a caller-supplied fallback (the form field options)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(normaliseOfferedLanguages(null, ['it', 'pt'])).toEqual(['it', 'pt'])
    warn.mockRestore()
  })
})

describe('assignment bookkeeping', () => {
  it('reports every member with no language, in party order', () => {
    expect(unassignedMemberIndices(4, { 1: 'de' })).toEqual([0, 2, 3])
    expect(unassignedMemberIndices(3, { 0: 'en', 1: 'en', 2: 'de' })).toEqual([])
  })

  it('counts a member added after the map was built as unassigned', () => {
    // The roster grew in DetailsStep; the map did not.
    expect(unassignedMemberIndices(3, { 0: 'en', 1: 'en' })).toEqual([2])
  })

  it('lists the members of one language in party order', () => {
    expect(membersOfLanguage({ 0: 'en', 1: 'de', 2: 'en' }, 'en', 3)).toEqual([0, 2])
  })

  it('assigns, re-assigns and unassigns without mutating the input', () => {
    const start = { 0: 'en' }
    const assigned = applyLanguageAssignment(start, 1, 'de')
    expect(assigned).toEqual({ 0: 'en', 1: 'de' })
    expect(start).toEqual({ 0: 'en' })

    const reassigned = applyLanguageAssignment(assigned, 1, 'es')
    expect(reassigned).toEqual({ 0: 'en', 1: 'es' })

    const cleared = applyLanguageAssignment(reassigned, 1, null)
    expect(cleared).toEqual({ 0: 'en' })
  })

  it('is complete only when the tray is empty', () => {
    expect(isLanguageAssignmentComplete(2, { 0: 'en' })).toBe(false)
    expect(isLanguageAssignmentComplete(2, { 0: 'en', 1: 'de' })).toBe(true)
    // A party of nobody cannot block a submit.
    expect(isLanguageAssignmentComplete(0, {})).toBe(true)
  })
})

describe('distinctAssignedLanguages', () => {
  it('puts the BOOKER first, then the rest alphabetically', () => {
    // Party index 0 is always the booker; the backend reads the first entry as
    // the preferred language for the confirmation email's locale.
    expect(
      distinctAssignedLanguages({ 0: 'es', 1: 'de', 2: 'en', 3: 'de' }, 4),
    ).toEqual(['es', 'de', 'en'])
  })

  it('falls back to plain alphabetical when the booker is unassigned', () => {
    expect(distinctAssignedLanguages({ 1: 'fr', 2: 'de' }, 3)).toEqual(['de', 'fr'])
  })

  it('ignores members beyond the current party size', () => {
    expect(distinctAssignedLanguages({ 0: 'en', 5: 'ja' }, 2)).toEqual(['en'])
  })
})

describe('pruneLanguageAssignment', () => {
  it('drops a language the operator no longer offers', () => {
    expect(pruneLanguageAssignment({ 0: 'en', 1: 'it' }, ['en', 'de'], 2)).toEqual({
      0: 'en',
    })
  })

  it('drops a member who has left the party', () => {
    expect(pruneLanguageAssignment({ 0: 'en', 1: 'de' }, ['en', 'de'], 1)).toEqual({
      0: 'en',
    })
  })
})

describe('openLanguageColumns', () => {
  const offered = ['en', 'de', 'es', 'fr']

  it('starts empty — the customer opens columns themselves (decision D3)', () => {
    expect(openLanguageColumns([], {}, offered, 3)).toEqual([])
  })

  it('always shows a column somebody is standing in, even if never opened', () => {
    // Back-nav restore: the assignment came from the draft, the opened list did not.
    expect(openLanguageColumns([], { 0: 'es' }, offered, 2)).toEqual(['es'])
  })

  it('orders columns by the OPERATOR list, not by when they were opened', () => {
    expect(openLanguageColumns(['fr', 'de'], { 0: 'es' }, offered, 1)).toEqual([
      'de',
      'es',
      'fr',
    ])
  })

  it('never shows a column for a language that is not offered', () => {
    expect(openLanguageColumns(['it'], {}, offered, 1)).toEqual([])
  })
})

describe('display', () => {
  it('names and flags the common codes, and degrades to the bare code', () => {
    expect(languageName('de')).toBe('German')
    expect(languageFlag('de')).toBe('🇩🇪')
    // An offered code the table has never heard of still renders a usable column.
    expect(languageName('zz')).toBe('ZZ')
    expect(languageFlag('zz')).toBe('🌐')
  })

  it('labels an unnamed party member positionally, like the room board', () => {
    expect(memberLabel(['Ada', ''], 0)).toBe('Ada')
    expect(memberLabel(['Ada', ''], 1)).toBe('Guest 2')
    expect(memberLabel(['Ada'], 3)).toBe('Guest 4')
  })
})

describe('productAcceptsAnyLanguage (landr-pv2r1)', () => {
  it('is true only for an empty array', () => {
    expect(productAcceptsAnyLanguage([])).toBe(true)
    expect(productAcceptsAnyLanguage(null)).toBe(false)
    expect(productAcceptsAnyLanguage(undefined)).toBe(false)
    expect(productAcceptsAnyLanguage(['en'])).toBe(false)
    expect(productAcceptsAnyLanguage('')).toBe(false)
    expect(productAcceptsAnyLanguage({})).toBe(false)
  })
})

describe('productDisplayLanguages (landr-pv2r1)', () => {
  it('returns [] with NO default fallback and no warning for null / undefined / [] / non-array', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(productDisplayLanguages(null)).toEqual([])
      expect(productDisplayLanguages(undefined)).toEqual([])
      expect(productDisplayLanguages([])).toEqual([])
      expect(productDisplayLanguages('en')).toEqual([])
      expect(productDisplayLanguages({ 0: 'en' })).toEqual([])
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('lower-cases, de-duplicates and preserves order', () => {
    expect(productDisplayLanguages(['EN', 'de', 'en', ' Es ', 'DE'])).toEqual([
      'en',
      'de',
      'es',
    ])
  })

  it('drops junk entries and yields [] when nothing usable remains', () => {
    expect(productDisplayLanguages(['eng', 42, null, '', 'fr', 'x'])).toEqual(['fr'])
    expect(productDisplayLanguages(['eng', 42])).toEqual([])
  })
})

describe('joinLanguageNames (landr-pv2r1)', () => {
  it('joins English names naturally', () => {
    expect(joinLanguageNames([])).toBe('')
    expect(joinLanguageNames(['en'])).toBe('English')
    expect(joinLanguageNames(['de', 'en'])).toBe('German and English')
    expect(joinLanguageNames(['en', 'es', 'de', 'fr'])).toBe(
      'English, Spanish, German and French',
    )
  })
})

// landr-5aih0.27 — review-gate follow-up on PR #327: languageName and
// joinLanguageNames were already locale-aware (Intl.DisplayNames('de', ...)
// with the LANGUAGE_NAMES_DE fallback table, and 'und' instead of 'and'),
// but neither had a test actually passing locale='de'.
describe('display — German UI (landr-5aih0.27)', () => {
  it('languageName(code, "de") names the common codes in German and degrades to the bare code', () => {
    expect(languageName('de', 'de')).toBe('Deutsch')
    expect(languageName('en', 'de')).toBe('Englisch')
    expect(languageName('es', 'de')).toBe('Spanisch')
    expect(languageName('fr', 'de')).toBe('Französisch')
    // An offered code neither Intl.DisplayNames nor the fallback table
    // recognises still degrades to the bare (uppercased) code, same as the
    // English path.
    expect(languageName('zz', 'de')).toBe('ZZ')
  })

  it('joinLanguageNames joins German names with "und", not "and"', () => {
    expect(joinLanguageNames([], 'de')).toBe('')
    expect(joinLanguageNames(['en'], 'de')).toBe('Englisch')
    expect(joinLanguageNames(['de', 'en'], 'de')).toBe('Deutsch und Englisch')
    expect(joinLanguageNames(['en', 'es', 'de', 'fr'], 'de')).toBe(
      'Englisch, Spanisch, Deutsch und Französisch',
    )
  })

  it('a regional German tag (de-AT) resolves the same as bare "de"', () => {
    expect(languageName('fr', 'de-AT')).toBe('Französisch')
  })
})
