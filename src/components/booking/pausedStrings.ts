/** Page-scoped de/en/es/tr strings for the off-season pause screen. */

export type PausedLocale = 'de' | 'en' | 'es' | 'tr'

export interface PausedBundle {
  title: string
  /** `{date}` is filled with the formatted resume date. */
  bodyWithDate: string
  bodyNoDate: string
}

const BUNDLES: Record<PausedLocale, PausedBundle> = {
  en: {
    title: 'Back in season soon',
    bodyWithDate: 'Bookings are paused for now. We are back in season from {date}.',
    bodyNoDate: 'Bookings are paused for now. Please check back soon.',
  },
  de: {
    title: 'Bald wieder in der Saison',
    bodyWithDate: 'Buchungen sind derzeit pausiert. Ab dem {date} sind wir wieder für dich da.',
    bodyNoDate: 'Buchungen sind derzeit pausiert. Schau bald wieder vorbei.',
  },
  es: {
    title: 'Pronto de vuelta en temporada',
    bodyWithDate: 'Las reservas están en pausa por ahora. Volvemos en temporada el {date}.',
    bodyNoDate: 'Las reservas están en pausa por ahora. Vuelve a visitarnos pronto.',
  },
  tr: {
    title: 'Yakında sezon yeniden başlıyor',
    bodyWithDate: 'Rezervasyonlar şu anda durduruldu. {date} tarihinde sezona geri dönüyoruz.',
    bodyNoDate: 'Rezervasyonlar şu anda durduruldu. Lütfen kısa süre sonra tekrar bakın.',
  },
}

export function normalizePausedLocale(code: string | null | undefined): PausedLocale {
  const base = (code ?? '').split('-')[0].trim().toLowerCase()
  return base === 'de' || base === 'es' || base === 'tr' ? base : 'en'
}

export function pausedCopy(
  resumeOn: string | null,
  localeCode: string | null | undefined,
): { title: string; body: string } {
  const locale = normalizePausedLocale(localeCode)
  const b = BUNDLES[locale]
  if (!resumeOn) return { title: b.title, body: b.bodyNoDate }
  let date = resumeOn
  const d = new Date(`${resumeOn}T00:00:00Z`)
  if (!Number.isNaN(d.getTime())) {
    try {
      date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(d)
    } catch {
      /* keep ISO date */
    }
  }
  return { title: b.title, body: b.bodyWithDate.replace('{date}', date) }
}
