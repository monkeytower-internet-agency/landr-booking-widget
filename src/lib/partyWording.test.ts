/**
 * Stay products word their people as guests in every locale; everything else
 * (and an unknown kind) keeps the participant wording. partyKey/partyTr are
 * the single selector — see STAY_PARTY_VARIANT in strings.ts.
 */
import { describe, expect, it } from 'vitest'

import {
  SUPPORTED_UI_LANGUAGES,
  isPartyKey,
  partyKey,
  partyTr,
  tr,
  type PartyKey,
} from './strings'

const PARTY_KEYS: PartyKey[] = [
  'crumbParticipants',
  'formPersonParticipantTag',
  'participantsTitle',
  'addParticipantAria',
  'addParticipantButton',
  'maxAdditionalParticipantsTemplate',
  'otherParticipantsTotalTemplate',
  'participantsTotalTemplate',
  'maxParticipantsReachedOne',
  'maxParticipantsReachedTemplate',
  'participantOrdinalTemplate',
  'youWillBeListedAsParticipant1',
  'participantsYouPayForHint',
  'partyIncludedHeading',
  'participantCountSingular',
  'participantCountPlural',
  'removeParticipantAriaTemplate',
]

// The participant word of each catalog (stem, case-insensitive).
const PARTICIPANT_WORD: Record<string, RegExp> = {
  en: /participant/i,
  de: /teilnehmer/i,
  it: /partecipant/i,
  es: /participante/i,
  tr: /katılımcı/i,
}

describe('partyTr', () => {
  it('covers every supported language in this suite', () => {
    expect(Object.keys(PARTICIPANT_WORD).sort()).toEqual([...SUPPORTED_UI_LANGUAGES].sort())
  })

  describe.each(SUPPORTED_UI_LANGUAGES)('%s', (lang) => {
    it('keeps the participant wording for services and unknown kinds', () => {
      for (const key of PARTY_KEYS) {
        expect(partyTr(key, lang, 'service')).toBe(tr(key, lang))
        expect(partyTr(key, lang, undefined)).toBe(tr(key, lang))
        expect(partyTr(key, lang, null)).toBe(tr(key, lang))
        expect(partyTr(key, lang, 'bogus' as never)).toBe(tr(key, lang))
      }
    })

    it('words every key as guests for a stay, with no participant word left', () => {
      for (const key of PARTY_KEYS) {
        const stay = partyTr(key, lang, 'stay')
        expect(stay, key).not.toBe('')
        expect(stay, key).not.toMatch(PARTICIPANT_WORD[lang] as RegExp)
        // Same placeholders as the participant string it replaces.
        const holes = (v: string) => (v.match(/\{\w+\}/g) ?? []).sort()
        expect(holes(stay), key).toEqual(holes(tr(key, lang)))
      }
    })
  })

  it('selects the key, never throws on garbage input', () => {
    expect(partyKey('participantsTitle', 'stay')).toBe('stayGuestsTitle')
    expect(partyKey('participantsTitle', 'service')).toBe('participantsTitle')
    expect(() => partyKey('participantsTitle', {} as never)).not.toThrow()
    expect(isPartyKey('participantsTitle')).toBe(true)
    expect(isPartyKey('backLabel')).toBe(false)
    expect(isPartyKey('toString' as never)).toBe(false)
  })
})
