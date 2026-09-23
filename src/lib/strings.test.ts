import { describe, expect, it } from 'vitest'
import {
  describeForceReasons,
  forceBookReasonMessage,
  isGermanLocale,
  pickBundle,
  plural,
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
    expect(pickBundle('es')).toBe(en)
    expect(en.multiDayPickerHelp).toMatch(/^Tap days to add or remove/)
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
