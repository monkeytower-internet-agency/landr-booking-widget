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

export function browserLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language
  }
  return 'en'
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
