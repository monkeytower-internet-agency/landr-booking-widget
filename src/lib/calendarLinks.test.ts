import { describe, expect, it } from 'vitest'
import {
  buildGoogleCalendarUrl,
  buildOutlookUrl,
  type CalendarEvent,
} from './calendarLinks'

/**
 * Unit tests for the calendar deep-link URL builders (landr-acew).
 *
 * These are pure functions over a CalendarEvent — no DOM, no network.
 *
 * Note: URLSearchParams encodes spaces as `+` (application/x-www-form-urlencoded)
 * rather than `%20`. Tests that check encoded text use the same `+` encoding.
 */

const SINGLE_DAY: CalendarEvent = {
  title: 'Tandem Classic — Para42',
  start_date: '2026-06-15',
  end_date: '2026-06-15',
  description: 'Booking for Jane Doe.',
  location: 'Para42',
}

const MULTI_DAY: CalendarEvent = {
  title: 'Alpine Week',
  start_date: '2026-07-01',
  end_date: '2026-07-07',
}

/** Parse a URL and return its query params for targeted assertions. */
function qs(url: string): URLSearchParams {
  return new URLSearchParams(url.split('?')[1] ?? '')
}

describe('buildGoogleCalendarUrl', () => {
  it('starts with the correct base URL', () => {
    const url = buildGoogleCalendarUrl(SINGLE_DAY)
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/)
  })

  it('includes action=TEMPLATE', () => {
    expect(qs(buildGoogleCalendarUrl(SINGLE_DAY)).get('action')).toBe('TEMPLATE')
  })

  it('carries the title in the text param', () => {
    expect(qs(buildGoogleCalendarUrl(SINGLE_DAY)).get('text')).toBe(SINGLE_DAY.title)
  })

  it('formats single-day dates as YYYYMMDD/YYYYMMDD with exclusive end', () => {
    // 2026-06-15 → start 20260615; end exclusive = 20260616
    expect(qs(buildGoogleCalendarUrl(SINGLE_DAY)).get('dates')).toBe('20260615/20260616')
  })

  it('formats multi-day dates with exclusive end', () => {
    // 2026-07-01..2026-07-07 → end exclusive = 20260708
    expect(qs(buildGoogleCalendarUrl(MULTI_DAY)).get('dates')).toBe('20260701/20260708')
  })

  it('carries the description in the details param when present', () => {
    expect(qs(buildGoogleCalendarUrl(SINGLE_DAY)).get('details')).toBe(SINGLE_DAY.description!)
  })

  it('carries the location in the location param when present', () => {
    expect(qs(buildGoogleCalendarUrl(SINGLE_DAY)).get('location')).toBe(SINGLE_DAY.location!)
  })

  it('omits details and location params when not set', () => {
    const params = qs(buildGoogleCalendarUrl(MULTI_DAY))
    expect(params.has('details')).toBe(false)
    expect(params.has('location')).toBe(false)
  })

  it('the dates param is present in the raw URL with %2F separator', () => {
    // dates=YYYYMMDD%2FYYYYMMDD in the raw URL string (URLSearchParams encodes /)
    const url = buildGoogleCalendarUrl(SINGLE_DAY)
    expect(url).toContain('dates=20260615%2F20260616')
  })
})

describe('buildOutlookUrl', () => {
  it('starts with the correct Outlook base URL', () => {
    const url = buildOutlookUrl(SINGLE_DAY)
    expect(url).toMatch(
      /^https:\/\/outlook\.live\.com\/calendar\/0\/deeplink\/compose\?/,
    )
  })

  it('includes path and rru params', () => {
    const params = qs(buildOutlookUrl(SINGLE_DAY))
    expect(params.get('path')).toBe('/calendar/action/compose')
    expect(params.get('rru')).toBe('addevent')
  })

  it('carries the title in the subject param', () => {
    expect(qs(buildOutlookUrl(SINGLE_DAY)).get('subject')).toBe(SINGLE_DAY.title)
  })

  it('uses ISO-8601 dates for startdt and enddt (inclusive end) — single day', () => {
    const params = qs(buildOutlookUrl(SINGLE_DAY))
    expect(params.get('startdt')).toBe('2026-06-15')
    expect(params.get('enddt')).toBe('2026-06-15')
  })

  it('uses ISO-8601 dates for startdt and enddt (inclusive end) — multi day', () => {
    const params = qs(buildOutlookUrl(MULTI_DAY))
    expect(params.get('startdt')).toBe('2026-07-01')
    expect(params.get('enddt')).toBe('2026-07-07')
  })

  it('carries the description in the body param when present', () => {
    expect(qs(buildOutlookUrl(SINGLE_DAY)).get('body')).toBe(SINGLE_DAY.description!)
  })

  it('carries the location in the location param when present', () => {
    expect(qs(buildOutlookUrl(SINGLE_DAY)).get('location')).toBe(SINGLE_DAY.location!)
  })

  it('omits body and location params when not set', () => {
    const params = qs(buildOutlookUrl(MULTI_DAY))
    expect(params.has('body')).toBe(false)
    expect(params.has('location')).toBe(false)
  })

  it('the raw URL contains startdt and enddt as plain ISO strings', () => {
    const url = buildOutlookUrl(SINGLE_DAY)
    expect(url).toContain('startdt=2026-06-15')
    expect(url).toContain('enddt=2026-06-15')
  })
})
