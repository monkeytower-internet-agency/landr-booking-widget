import { describe, expect, it } from 'vitest'
import {
  inviteBannerMessage,
  ownAccommodationNoRoomLabel,
  describeForceReasons,
  forceBookReasonMessage,
  isGermanLocale,
  pickBundle,
  plural,
  resolveUiLanguage,
  SUPPORTED_UI_LANGUAGES,
  seatFitCountLabel,
  seatFitNoneMessage,
  seatsShortDaysMessage,
  tr,
} from './strings'

// landr-5aih0.9: German UI (absorbs landr-wchwi). pickBundle/tr now resolve
// a real locale — 'de*' gets the German bundle, everything else (including
// no locale at all) still gets English, preserving landr-ifcu's v1 default.
describe('strings (pickBundle/tr locale resolution, landr-5aih0.9)', () => {
  it('pickBundle returns the German bundle for de/de-DE/de-AT, case-insensitively', () => {
    const de = pickBundle('de')
    expect(pickBundle('de-DE')).toBe(de)
    expect(pickBundle('de-AT')).toBe(de)
    expect(pickBundle('DE')).toBe(de)
    expect(pickBundle('De-de')).toBe(de)
    expect(de.multiDayPickerHelp).toMatch(/^Tippen Sie auf Tage/)
  })

  it('pickBundle falls back to English for every other locale, including none', () => {
    const en = pickBundle('en')
    expect(pickBundle(undefined)).toBe(en)
    expect(pickBundle('')).toBe(en)
    expect(pickBundle('fr-FR')).toBe(en)
    expect(pickBundle('pt-BR')).toBe(en)
    expect(pickBundle('constructor')).toBe(en)
    expect(en.multiDayPickerHelp).toMatch(/^Tap days to add or remove/)
  })

  it('pickBundle returns the Spanish and Turkish bundles (landr-8r6oc.4), case- and region-insensitively', () => {
    const es = pickBundle('es')
    expect(pickBundle('es-ES')).toBe(es)
    expect(pickBundle('ES-es')).toBe(es)
    expect(pickBundle('es_419')).toBe(es)
    const trBundle = pickBundle('tr')
    expect(pickBundle('tr-TR')).toBe(trBundle)
    expect(pickBundle('TR')).toBe(trBundle)
    expect(es).not.toBe(pickBundle('en'))
    expect(trBundle).not.toBe(es)
    expect(trBundle).not.toBe(pickBundle('de'))
  })

  it('resolveUiLanguage names the bundle language and SUPPORTED_UI_LANGUAGES lists them', () => {
    expect(resolveUiLanguage('de-AT')).toBe('de')
    expect(resolveUiLanguage('es-ES')).toBe('es')
    expect(resolveUiLanguage('tr_TR')).toBe('tr')
    expect(resolveUiLanguage('fr')).toBe('en')
    expect(resolveUiLanguage(undefined)).toBe('en')
    expect(resolveUiLanguage('it-IT')).toBe('it')
    expect([...SUPPORTED_UI_LANGUAGES].sort()).toEqual(['de', 'en', 'es', 'it', 'tr'])
  })

  it('tr resolves per the same locale rule as pickBundle', () => {
    expect(tr('multiDayPickerHelp', 'de')).toMatch(/^Tippen Sie auf Tage/)
    expect(tr('multiDayPickerHelp', 'de-DE')).toMatch(/^Tippen Sie auf Tage/)
    expect(tr('multiDayPickerHelp')).toMatch(/^Tap days to add or remove/)
    expect(tr('multiDayPickerHelp', 'fr-FR')).toMatch(/^Tap days to add or remove/)
  })

  it('isGermanLocale matches pickBundle', () => {
    expect(isGermanLocale('de-DE')).toBe(true)
    expect(isGermanLocale('de')).toBe(true)
    expect(isGermanLocale('en')).toBe(false)
    expect(isGermanLocale(undefined)).toBe(false)
    expect(isGermanLocale('es')).toBe(false)
  })
})

describe('poweredByLandr (landr-xtkae.10)', () => {
  it('ships in every language the widget ships (en, de)', () => {
    expect(tr('poweredByLandr', 'en')).toBe('Powered by LANDR')
    expect(tr('poweredByLandr', 'de-DE')).toBe('Bereitgestellt von LANDR')
    expect(tr('poweredByLandr')).toBe('Powered by LANDR')
    expect(tr('poweredByLandr', 'es-ES')).toMatch(/LANDR/)
    expect(tr('poweredByLandr', 'tr-TR')).toMatch(/LANDR/)
  })
})

describe('plural', () => {
  it('picks the singular form only for exactly 1', () => {
    expect(plural(1, 'one', 'other')).toBe('one')
    expect(plural(0, 'one', 'other')).toBe('other')
    expect(plural(2, 'one', 'other')).toBe('other')
  })
})

// landr-t869m.5: the force-book review banner used to be a single hard-coded
// capacity-flavoured sentence regardless of why a pick was actually forced.
describe('forceBookReasonMessage', () => {
  it('capacity-only (days): renders the EXACT pre-existing copy', () => {
    expect(forceBookReasonMessage(['capacity'], 2)).toBe(
      '2 days booked past capacity. Capacity will be exceeded for this booking.',
    )
    expect(forceBookReasonMessage(['capacity'], 1)).toBe(
      '1 day booked past capacity. Capacity will be exceeded for this booking.',
    )
  })

  it('capacity-only (window / no forcedDays): renders the EXACT pre-existing copy', () => {
    expect(forceBookReasonMessage(['capacity'], 0)).toBe(
      'This window was booked past capacity. Capacity will be exceeded for this booking.',
    )
  })

  it('empty/omitted reasons fail open to the capacity copy (pre-t869m.5 callers)', () => {
    expect(forceBookReasonMessage([], 3)).toBe(
      '3 days booked past capacity. Capacity will be exceeded for this booking.',
    )
  })

  it('lead-time-only: names the lead-time reason, not capacity', () => {
    const message = forceBookReasonMessage(['lead_time'], 1)
    expect(message).toContain('inside the lead-time window')
    expect(message).not.toContain('Capacity will be exceeded')
    expect(message).not.toContain('past capacity')
  })

  it('accommodation-lead-time-only: names the hotel lead-time reason', () => {
    const message = forceBookReasonMessage(['accommodation_lead_time'], 1)
    expect(message).toContain("hotel stay past the hotel's own lead time")
    expect(message).not.toContain('Capacity will be exceeded')
  })

  it('capacity + lead_time together: names BOTH reasons', () => {
    const message = forceBookReasonMessage(['capacity', 'lead_time'], 2)
    expect(message).toContain('past capacity')
    expect(message).toContain('inside the lead-time window')
    expect(message).toContain('Capacity will be exceeded')
    expect(message).toContain('the customer will not have the normal preparation time')
  })
})

describe('describeForceReasons', () => {
  it('joins multiple reasons with "and"', () => {
    expect(describeForceReasons(['capacity', 'lead_time'])).toBe(
      'past capacity and inside the lead-time window',
    )
  })

  it('fails open to capacity for an empty list', () => {
    expect(describeForceReasons([])).toBe('past capacity')
  })
})

describe('inviteBannerMessage (landr-2jsaf)', () => {
  it('names the hotel only when the invite prefills one', () => {
    expect(inviteBannerMessage('Olaf K***n', '67C66263', true, 'en')).toBe(
      'You’re joining Olaf K***n’s booking (ref 67C66263). Dates and hotel are prefilled — change anything that differs for you.',
    )
    const datesOnly = inviteBannerMessage('Olaf K***n', '67C66263', false, 'en')
    expect(datesOnly).toContain('Dates are prefilled')
    expect(datesOnly).not.toMatch(/hotel/i)
  })

  it('has both variants in German', () => {
    expect(inviteBannerMessage('Olaf K***n', '67C66263', true, 'de')).toContain(
      'Termine und Hotel sind vorausgefüllt',
    )
    const datesOnly = inviteBannerMessage('Olaf K***n', '67C66263', false, 'de')
    expect(datesOnly).toContain('Die Termine sind vorausgefüllt')
    expect(datesOnly).not.toMatch(/hotel/i)
  })
})

describe('own-accommodation copy (landr-qw2v8.2)', () => {
  it('the invite banner never claims a hotel or a shared room', () => {
    const en = inviteBannerMessage('Olaf K***n', '67C66263', true, 'en', true)
    expect(en).toContain('No room is booked for you there')
    expect(en).not.toMatch(/hotel are prefilled/i)
    const de = inviteBannerMessage('Olaf K***n', '67C66263', true, 'de', true)
    expect(de).toContain('kein Zimmer gebucht')
  })

  it('names the person with the no-room suffix in both locales', () => {
    expect(ownAccommodationNoRoomLabel('Sophie Müller', 'en')).toBe(
      'Sophie Müller: own accommodation — no room booked',
    )
    expect(ownAccommodationNoRoomLabel('Sophie Müller', 'de')).toBe(
      'Sophie Müller: eigene Unterkunft — kein Zimmer gebucht',
    )
  })
})

describe('seat-fit copy (landr-rmcsu.5)', () => {
  const d = (label: string, left: number) => ({ label, left, need: 3 })
  it('one short day keeps the exact seats-left wording', () => {
    expect(seatsShortDaysMessage([d('Wed 11 Nov', 2)], 'en')).toBe(
      'Only 2 seats left on Wed 11 Nov — you need 3.',
    )
  })
  it('several short days are all named (EN + DE)', () => {
    const days = [d('Wed 11 Nov', 2), d('Thu 12 Nov', 2), d('Fri 13 Nov', 1)]
    expect(seatsShortDaysMessage(days, 'en')).toBe(
      'Wed 11 Nov, Thu 12 Nov, and Fri 13 Nov have fewer than 3 seats left.',
    )
    expect(seatsShortDaysMessage(days, 'de')).toBe(
      'Am Wed 11 Nov, Thu 12 Nov und Fri 13 Nov sind weniger als 3 Plätze frei.',
    )
  })
  it('fit count and none-fit notice in both bundles', () => {
    expect(seatFitCountLabel(12, 3, 'en')).toBe('12 dates fit 3 people')
    expect(seatFitCountLabel(1, 3, 'en')).toBe('1 date fits 3 people')
    expect(seatFitCountLabel(12, 3, 'de')).toBe('An 12 Tagen ist Platz für 3 Personen')
    expect(seatFitNoneMessage(4, 'Oktober 2026 – März 2027', 'de')).toBe(
      'Im Zeitraum Oktober 2026 – März 2027 gibt es keinen Tag mit Platz für 4 Personen.',
    )
  })
})

describe('time-confirmed-by-operator copy (EN + DE)', () => {
  it('replaces "Any time" with copy that says the operator confirms the time', () => {
    expect(tr('timeConfirmedByOperator', 'en')).toBe('Time confirmed by the operator')
    expect(tr('timeConfirmedHelper', 'en')).toBe(
      'The operator will confirm the exact time and details after you book.',
    )
    expect(tr('timeConfirmedByOperator', 'de')).toBe('Uhrzeit bestätigt der Anbieter')
    expect(tr('timeConfirmedHelper', 'de')).toBe(
      'Der Anbieter bestätigt Uhrzeit und Details nach deiner Buchung.',
    )
    expect(tr('timeConfirmedByOperator', 'en')).not.toMatch(/any time/i)
  })
})
