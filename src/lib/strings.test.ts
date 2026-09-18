import { describe, expect, it } from 'vitest'
import { describeForceReasons, forceBookReasonMessage, pickBundle, tr } from './strings'

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
