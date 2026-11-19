/** Page-scoped de/en/es/fr/it/tr strings for the off-season pause screen. */

export type PausedLocale = 'de' | 'en' | 'es' | 'fr' | 'it' | 'tr'

export interface PausedBundle {
  title: string
  /** `{date}` is filled with the formatted resume date. */
  bodyWithDate: string
  bodyNoDate: string
}

const BUNDLES: Record<PausedLocale, PausedBundle> = {
  en: {
    title: 'Back in season soon',
    bodyWithDate: "We're not taking bookings right now. We're back from {date}.",
    bodyNoDate: "We're not taking bookings right now. Check back soon.",
  },
  de: {
    title: 'Bald geht die Saison wieder los',
    bodyWithDate: 'Derzeit nehmen wir keine Buchungen an. Ab dem {date} sind wir wieder für Sie da.',
    bodyNoDate: 'Derzeit nehmen wir keine Buchungen an. Schauen Sie bald wieder vorbei.',
  },
  es: {
    title: 'Volvemos pronto',
    bodyWithDate: 'Ahora mismo no aceptamos reservas. Volvemos el {date}.',
    bodyNoDate: 'Ahora mismo no aceptamos reservas. Vuelve a visitarnos pronto.',
  },
  fr: {
    title: 'Bientôt de retour pour la saison',
    bodyWithDate: 'Les réservations sont suspendues pour le moment. Nous reprenons la saison le {date}.',
    bodyNoDate: 'Les réservations sont suspendues pour le moment. Repassez nous voir bientôt.',
  },
  it: {
    title: 'Torniamo presto',
    bodyWithDate: 'Al momento non accettiamo prenotazioni. Torniamo dal {date}.',
    bodyNoDate: 'Al momento non accettiamo prenotazioni. Torna a trovarci presto.',
  },
  tr: {
    title: 'Sezon yakında başlıyor',
    bodyWithDate: 'Şu anda rezervasyon almıyoruz. {date} itibarıyla yeniden hizmetinizdeyiz.',
    bodyNoDate: 'Şu anda rezervasyon almıyoruz. Kısa süre sonra tekrar göz atın.',
  },
}

export function normalizePausedLocale(code: string | null | undefined): PausedLocale {
  const base = (code ?? '').split('-')[0].trim().toLowerCase()
  return base === 'de' || base === 'es' || base === 'fr' || base === 'it' || base === 'tr' ? base : 'en'
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
