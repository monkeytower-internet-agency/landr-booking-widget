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
 */
export function configureCustomerLocale(
  customerLanguages: string[] | null | undefined,
  defaultLocale: string | null | undefined,
): void {
  customerLocaleWhitelist =
    customerLanguages && customerLanguages.length > 0
      ? new Set(customerLanguages)
      : null
  operatorDefaultLocale = defaultLocale ?? null
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
 * landr-821d6.7: resolve a booking's CustomerStageLabel (raw pass-through
 * from the API — see api/types.ts) to display text. customer_label is the
 * operator's own customer-facing wording for this stage (e.g. "Payment
 * pending" instead of the internal "awaiting_payment"); falls back to the
 * staff label when the operator hasn't set one. Both localized.
 */
export function resolveCustomerStageLabel(
  stage: CustomerStageLabel,
  locale: string,
): string {
  if (stage.customer_label) {
    return pickLocalized(stage.customer_label, stage.customer_label_localized, locale)
  }
  return pickLocalized(stage.label, stage.label_localized, locale)
}
