/**
 * landr-uuntm.3: best-guess billing country for the details step.
 *
 * Chain, first hit wins, each step best-effort (never throws):
 *   (a) GET <widget origin>/geo -> {country} from the Cloudflare Pages
 *       Function functions/geo.ts (request.cf.country), 1500 ms timeout.
 *   (a') the browser's IANA timezone -> country (landr-3a8mh.1). Stands in for
 *       (a) when the widget is served from Firebase Hosting, which has no edge
 *       geo: there /geo hits the SPA rewrite, the HTML fails to parse -> null.
 *   (b) first navigator.languages entry that carries a region subtag
 *       (de-DE -> DE; a bare "de" says nothing about the country -> skipped).
 *   (c) the operator's own country from the widget config (settings).
 *
 * Returns an upper-case ISO-3166-1 alpha-2 code, or null. The caller decides
 * whether to apply it (only while the field is empty and untouched).
 *
 * The widget is served from its own Pages origin and embedded as an <iframe>
 * (see autoHeight.ts), so `window.location.origin` IS the widget origin —
 * /geo is same-origin for the iframe. Embedded-on-the-host-page use of the
 * bundle would be cross-origin, which is why functions/geo.ts sends CORS
 * headers anyway.
 */
import { normalizeCountryCode } from './countries'

export const GEO_TIMEOUT_MS = 1500

function widgetOrigin(): string {
  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin
    }
  } catch {
    // fall through
  }
  return ''
}

export async function geoCountry(origin = widgetOrigin()): Promise<string | null> {
  if (!origin || origin === 'null') return null
  try {
    const res = await fetch(`${origin}/geo`, {
      signal: AbortSignal.timeout(GEO_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { country?: unknown }
    return typeof body.country === 'string'
      ? normalizeCountryCode(body.country)
      : null
  } catch {
    return null
  }
}

export async function timezoneCountry(): Promise<string | null> {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!tz) return null
    // Lazy: the ~550-zone table stays out of the main bundle.
    const { TZ_COUNTRIES } = await import('./tzCountries.gen')
    return normalizeCountryCode(TZ_COUNTRIES[tz])
  } catch {
    return null
  }
}

export function localeCountry(): string | null {
  if (typeof navigator === 'undefined') return null
  const langs: readonly string[] =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : navigator.language
        ? [navigator.language]
        : []
  for (const tag of langs) {
    // BCP-47: language[-script][-region]; region is 2 letters (or 3 digits).
    const region = /^[a-z]{2,3}(?:-[A-Za-z]{4})?-([A-Za-z]{2})(?:-|$)/.exec(tag)?.[1]
    const code = normalizeCountryCode(region)
    if (code) return code
  }
  return null
}

export async function guessCountry(
  operatorCountry?: string | null,
): Promise<string | null> {
  return (
    (await geoCountry()) ??
    (await timezoneCountry()) ??
    localeCountry() ??
    normalizeCountryCode(operatorCountry)
  )
}
