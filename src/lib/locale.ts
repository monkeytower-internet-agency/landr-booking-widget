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

export function browserLocale(): string {
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
