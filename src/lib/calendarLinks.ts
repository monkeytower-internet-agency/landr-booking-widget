/**
 * Build "Add to calendar" deep-link URLs for Google Calendar and
 * Outlook.live.com without any external SDK or API call.
 *
 * landr-acew: companion to the ICS download already surfaced on the
 * booking confirmation screen. All three options (Google · Outlook ·
 * Download .ics) use exactly the same event data — the summary, dates,
 * description and location extracted from the booking confirmation
 * response.
 *
 * Spec refs:
 *   Google Calendar: https://calendar.google.com/calendar/render
 *     action=TEMPLATE, text, dates (YYYYMMDD/YYYYMMDD for all-day),
 *     details, location — all URL-encoded.
 *
 *   Outlook Web (Outlook.live.com deep link):
 *     https://outlook.live.com/calendar/0/deeplink/compose
 *     path=/calendar/action/compose, rru=addevent,
 *     subject, startdt (ISO-8601 date), enddt (ISO-8601 date),
 *     body, location — all URL-encoded.
 *
 * Both services accept all-day date strings (YYYY-MM-DD for Outlook;
 * YYYYMMDD/YYYYMMDD for Google where the end date is exclusive, i.e.
 * one day after the last day of the event — matching RFC 5545 §3.8.2.2
 * which is also how the ICS is built server-side).
 */

export interface CalendarEvent {
  /** Display title, e.g. "Tandem Classic — Para42" */
  title: string
  /**
   * First day of the event in ISO-8601 format (YYYY-MM-DD).
   * All bookings are all-day events.
   */
  start_date: string
  /**
   * Last day of the event (inclusive) in ISO-8601 format.
   * For a single-day event start_date === end_date.
   */
  end_date: string
  /** Optional plain-text body shown inside the calendar entry. */
  description?: string | null
  /** Optional location string, e.g. the operator name or venue. */
  location?: string | null
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Parse YYYY-MM-DD → Date (UTC midnight). */
function parseDate(iso: string): Date {
  // Split instead of `new Date(iso)` to avoid local-timezone interpretation
  // (new Date('2026-06-15') is midnight UTC, but be explicit for clarity).
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Format a Date (UTC) as YYYYMMDD — used in the Google dates= param. */
function toCompact(d: Date): string {
  const y = d.getUTCFullYear().toString().padStart(4, '0')
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = d.getUTCDate().toString().padStart(2, '0')
  return `${y}${m}${day}`
}

/** Format a Date (UTC) as YYYY-MM-DD — used in the Outlook startdt/enddt params. */
function toISO(d: Date): string {
  const y = d.getUTCFullYear().toString().padStart(4, '0')
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = d.getUTCDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Add n days to a Date (returns new Date, does not mutate). */
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000)
}

// ---------------------------------------------------------------------------
// Exported URL builders
// ---------------------------------------------------------------------------

/**
 * Build the Google Calendar "Add event" deep-link URL.
 *
 * Format: https://calendar.google.com/calendar/render
 *   ?action=TEMPLATE
 *   &text=<title>
 *   &dates=<YYYYMMDD>/<YYYYMMDD>   ← end is exclusive (next day)
 *   &details=<description>
 *   &location=<location>
 *
 * All parameter values are URL-encoded.
 */
export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const start = parseDate(event.start_date)
  const end = parseDate(event.end_date)
  // Google's all-day end date is exclusive → add 1 day.
  const endExclusive = addDays(end, 1)

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toCompact(start)}/${toCompact(endExclusive)}`,
  })
  if (event.description) params.set('details', event.description)
  if (event.location) params.set('location', event.location)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Build the Outlook Web "Add event" deep-link URL.
 *
 * Format: https://outlook.live.com/calendar/0/deeplink/compose
 *   ?path=/calendar/action/compose
 *   &rru=addevent
 *   &subject=<title>
 *   &startdt=<YYYY-MM-DD>
 *   &enddt=<YYYY-MM-DD>            ← end is the last day (inclusive)
 *   &body=<description>
 *   &location=<location>
 *
 * All parameter values are URL-encoded.
 * Outlook's enddt is inclusive for all-day events (unlike Google).
 */
export function buildOutlookUrl(event: CalendarEvent): string {
  const start = parseDate(event.start_date)
  const end = parseDate(event.end_date)

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: toISO(start),
    enddt: toISO(end),
  })
  if (event.description) params.set('body', event.description)
  if (event.location) params.set('location', event.location)

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}
