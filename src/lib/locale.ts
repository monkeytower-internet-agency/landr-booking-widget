import type { CustomerStageLabel } from '@/api/types'

export function pickLocalized(
  fallback: string | null | undefined,
  localized: Record<string, string> | null | undefined,
  locale: string,
): string {
  if (localized) {
    const exact = localized[locale]
    if (exact) return exact
    const base = locale.split('-')[0]
    if (base && localized[base]) return localized[base]
  }
  return fallback ?? ''
}

/**
 * landr-821d6.7: operator-configured customer-facing locale whitelist,
 * applied by browserLocale() below. Module-level (not React state) so the
 * ~16 existing `browserLocale()` call sites across the widget pick up the
 * resolved locale for free once configureCustomerLocale() runs — no prop
 * threading through the component tree.
 *
 * Absent/empty customerLanguages (rolling deploy, or an operator who
 * hasn't set the field yet) means NO whitelist — browserLocale() keeps
 * today's raw-navigator-locale behaviour unchanged.
 */
let customerLocaleWhitelist: Set<string> | null = null
let operatorDefaultLocale: string | null = null

/**
 * Call once the operator's public settings resolve (see App.tsx). Resets
 * the whitelist for every mount/settings-refetch, so tests that render the
 * widget for a different operator never see a stale whitelist.
 *
 * landr-821d6.7 review round: `default_locale` is not yet returned by
 * `GET .../settings` (landr-821d6.2 follow-up, tracked separately) — until
 * it is, fall back to the FIRST entry of `customer_languages` (by epic
 * decision that array must include the operator's default locale and is
 * ordered with it first), so the whitelist-miss fallback still resolves to
 * something sane rather than silently doing nothing.
 */
export function configureCustomerLocale(
  customerLanguages: string[] | null | undefined,
  defaultLocale: string | null | undefined,
): void {
  customerLocaleWhitelist =
    customerLanguages && customerLanguages.length > 0
      ? new Set(customerLanguages)
      : null
  operatorDefaultLocale =
    defaultLocale ??
    (customerLanguages && customerLanguages.length > 0 ? customerLanguages[0] : null)
}

function rawBrowserLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language
  }
  return 'en'
}

/**
 * landr-otml0.3 review fix (MAJOR 2): an invite link (`?invite=<token>`)
 * carries the invitee's `language`, distinct from whatever the browser
 * happens to report — the two customarily agree, but an invitee opening the
 * link on a shared/borrowed device, or one whose OS locale never matched
 * their preferred language, is exactly the case this exists to cover.
 * Module-level (not React state), same reasoning as customerLocaleWhitelist
 * above: every existing `browserLocale()` call site picks it up for free.
 * Wins over BOTH the raw navigator locale and the operator's whitelist —
 * the invite already told us what language this specific person wants.
 * Set from App.tsx once the invite resolves; cleared (null) on a 404/failed
 * resolution so the fallback plain wizard behaves exactly like any other
 * booking.
 */
let bookingLocaleOverride: string | null = null

export function overrideBookingLocale(locale: string | null | undefined): void {
  bookingLocaleOverride = locale ?? null
}

export function browserLocale(): string {
  if (bookingLocaleOverride) return bookingLocaleOverride
  const raw = rawBrowserLocale()
  if (!customerLocaleWhitelist) return raw
  if (customerLocaleWhitelist.has(raw)) return raw
  const base = raw.split('-')[0]
  if (base && customerLocaleWhitelist.has(base)) return base
  // Browser locale isn't one of the operator's customer_languages —
  // epic decision: fall back to the operator's default_locale (which is
  // itself always a member of customer_languages by construction).
  return operatorDefaultLocale ?? raw
}

/**
 * landr-nva1a.4 review round: shape a browser locale down to the wire
 * format the API's `EstimateRequest.locale` field actually accepts —
 * `language[-region]`, `max_length=16` (app/routers/public_operators.py).
 * `navigator.language` can carry extended BCP-47 tags (script subtags,
 * `-u-...` extensions, etc.) that are longer than 16 chars or carry more
 * than two subtags; sending one of those verbatim 422s the estimate
 * request. Keeping only the first two `-`-separated parts covers every
 * `language` / `language-REGION` case this widget actually needs (the
 * API only branches on the language subtag — see `_pick` in
 * booking_savings.py) and the trailing `.slice(0, 16)` is a hard
 * backstop for anything that still slips through.
 */
export function apiLocale(locale: string): string {
  return locale.split('-').slice(0, 2).join('-').slice(0, 16)
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * landr-821d6.7: resolve a booking's CustomerStageLabel to display text.
 *
 * NOTE the customer_label-vs-staff-label fallback is done SERVER-SIDE
 * (`public_get_booking_by_token` / `booking_submit.finalize` — see the
 * `label`/`label_localized` comments in `api/types.ts`'s `CustomerStageLabel`)
 * — the wire payload only ever carries the ALREADY-CHOSEN pair. This
 * function's only job is localizing that pair to the viewer's locale.
 */
export function resolveCustomerStageLabel(
  stage: CustomerStageLabel,
  locale: string,
): string {
  return pickLocalized(stage.label, stage.label_localized, locale)
}
