// Strings for the dev/staging build badge (landr-70jcy.3). Page-scoped like
// cancelStrings.ts; the locale is the widget's resolved browser locale.
export interface BuildBadgeBundle {
  built: (ago: string) => string
  checked: (ago: string) => string
  never: string
  updateAvailable: string
  finishFirst: string
}

const EN: BuildBadgeBundle = {
  built: (a) => `built ${a}`,
  checked: (a) => `checked ${a}`,
  never: 'never',
  updateAvailable: 'Newer build available - click to reload',
  finishFirst: 'Newer build available - finish your booking first',
}

const BUNDLES: Record<string, BuildBadgeBundle> = {
  en: EN,
  de: {
    built: (a) => `gebaut ${a}`,
    checked: (a) => `geprüft ${a}`,
    never: 'noch nie',
    updateAvailable: 'Neuerer Build verfügbar - klicken zum Neuladen',
    finishFirst: 'Neuerer Build verfügbar - erst die Buchung abschließen',
  },
  es: {
    built: (a) => `compilado ${a}`,
    checked: (a) => `comprobado ${a}`,
    never: 'nunca',
    updateAvailable: 'Hay una versión más nueva - clic para recargar',
    finishFirst: 'Hay una versión más nueva - termina primero tu reserva',
  },
  it: {
    built: (a) => `compilato ${a}`,
    checked: (a) => `verificato ${a}`,
    never: 'mai',
    updateAvailable: 'Build più recente disponibile - clic per ricaricare',
    finishFirst: 'Build più recente disponibile - prima completa la prenotazione',
  },
  tr: {
    built: (a) => `derlendi ${a}`,
    checked: (a) => `kontrol edildi ${a}`,
    never: 'hiç',
    updateAvailable: 'Daha yeni sürüm var - yenilemek için tıklayın',
    finishFirst: 'Daha yeni sürüm var - önce rezervasyonu tamamlayın',
  },
}

export function pickBuildBadgeBundle(locale: string | undefined): BuildBadgeBundle {
  const base = (locale ?? 'en').toLowerCase().split('-')[0] ?? 'en'
  return BUNDLES[base] ?? EN
}

/** "vor 5 Minuten" / "5 minutes ago"; clamped to the past. */
export function agoLabel(thenMs: number, nowMs: number, locale: string): string {
  const diff = Math.min(0, thenMs - nowMs)
  let rtf: Intl.RelativeTimeFormat
  try {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  } catch {
    rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  }
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
    ['second', 1000],
  ]
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit)
  }
  return rtf.format(0, 'second')
}
