/**
 * Demo mode (marketing use-case pages).
 *
 * `?demo=<template-slug>` on the widget URL — or `data-demo="<template-slug>"`
 * on the `<html>` / `#root` element of a host that serves the widget itself —
 * turns the widget into a read-only showcase of an operator template: the
 * catalogue and the (always available, generated) slots are sample data, and
 * nothing is ever booked. The API layer (`src/api/demo.ts`) answers every
 * request locally; checkout is replaced by a "congrats" screen.
 *
 * Kept free of imports so `client.ts` can consult it without a cycle.
 */

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/

function clean(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().toLowerCase()
  return SLUG_RE.test(v) ? v : null
}

/** The template slug the widget is demoing, or null for a normal embed. */
export function demoSlug(): string | null {
  if (typeof window === 'undefined') return null
  const fromQuery = clean(new URLSearchParams(window.location.search).get('demo'))
  if (fromQuery) return fromQuery
  try {
    return (
      clean(document.documentElement.dataset.demo) ??
      clean(document.getElementById('root')?.dataset.demo)
    )
  } catch {
    return null
  }
}

export const isDemoMode = (): boolean => demoSlug() !== null

export type DemoLang = 'en' | 'de' | 'es' | 'it' | 'tr'

export const DEMO_LANGS: readonly DemoLang[] = ['en', 'de', 'es', 'it', 'tr']

/** Locale the demo renders in (`?lang=`); English for anything the widget has no catalog for (e.g. fr). */
export function demoLang(): DemoLang {
  if (typeof window === 'undefined') return 'en'
  const v = (new URLSearchParams(window.location.search).get('lang') ?? '')
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0]
  return (DEMO_LANGS as readonly string[]).includes(v) ? (v as DemoLang) : 'en'
}

/** Synthetic operator token: the real flow is keyed on it, nothing resolves it. */
export const demoToken = (slug: string): string => `demo-${slug}`

/** Where the congrats screen sends visitors: signup with the template preselected. */
export function demoSignupUrl(slug: string, lang: DemoLang = demoLang()): string {
  // English is the site's unprefixed default locale; the others are /xx/ prefixed.
  const prefix = lang === 'en' ? '' : `${lang}/`
  return `https://www.landr.de/${prefix}signup/?template=${encodeURIComponent(slug)}`
}

interface DemoCopy {
  badge: string
  banner: string
  congratsTitle: string
  congratsBody: string
  cta: string
  again: string
}

const COPY: Record<DemoLang, DemoCopy> = {
  en: {
    badge: 'Demo',
    banner: 'Demo — sample data. Nothing you do here is booked or charged.',
    congratsTitle: 'Congrats — this is what your customers would see',
    congratsBody:
      'Your customers pick an offer, a date and enter their details exactly like this. No real booking was made and nothing was sent.',
    cta: 'Set up my own booking page',
    again: 'Try the demo again',
  },
  de: {
    badge: 'Demo',
    banner: 'Demo mit Beispieldaten. Hier wird nichts gebucht oder abgerechnet.',
    congratsTitle: 'Glückwunsch — so sehen deine Kunden die Buchung',
    congratsBody:
      'Deine Kunden wählen Angebot und Termin und geben ihre Daten genau so ein. Es wurde nichts gebucht und nichts versendet.',
    cta: 'Meine eigene Buchungsseite einrichten',
    again: 'Demo noch einmal ausprobieren',
  },
  es: {
    badge: 'Demo',
    banner: 'Demo con datos de ejemplo. Aquí no se reserva ni se cobra nada.',
    congratsTitle: '¡Enhorabuena! Así verían la reserva tus clientes',
    congratsBody:
      'Tus clientes eligen una oferta y una fecha e introducen sus datos exactamente así. No se ha hecho ninguna reserva real y no se ha enviado nada.',
    cta: 'Crear mi propia página de reservas',
    again: 'Probar la demo otra vez',
  },
  it: {
    badge: 'Demo',
    banner: 'Demo con dati di esempio. Qui non viene prenotato né addebitato nulla.',
    congratsTitle: 'Complimenti! Ecco cosa vedrebbero i tuoi clienti',
    congratsBody:
      'I tuoi clienti scelgono un’offerta e una data e inseriscono i loro dati esattamente così. Non è stata fatta nessuna prenotazione reale e non è stato inviato nulla.',
    cta: 'Crea la mia pagina di prenotazione',
    again: 'Riprova la demo',
  },
  tr: {
    badge: 'Demo',
    banner: 'Örnek verilerle demo. Burada hiçbir şey rezerve edilmez veya ücretlendirilmez.',
    congratsTitle: 'Tebrikler! Müşterilerin rezervasyonu böyle görür',
    congratsBody:
      'Müşterilerin bir teklif ve tarih seçip bilgilerini tam olarak böyle girer. Gerçek bir rezervasyon yapılmadı ve hiçbir şey gönderilmedi.',
    cta: 'Kendi rezervasyon sayfamı oluştur',
    again: 'Demoyu tekrar dene',
  },
}

export const demoCopy = (lang: DemoLang = demoLang()): DemoCopy => COPY[lang]

/** Sample customer the demo's details step starts with, so a viewer just clicks Continue. */
export interface DemoCustomer {
  first_name: string
  last_name: string
  email: string
  phone: string
  address_line1: string
  postal_code: string
  city: string
  country: string
}

const DEMO_CUSTOMERS: Record<DemoLang, DemoCustomer> = {
  en: {
    first_name: 'Alex', last_name: 'Morgan', email: 'alex.morgan@example.com', phone: '+4915112345678',
    address_line1: '12 Sample Street', postal_code: '80331', city: 'Munich', country: 'DE',
  },
  de: {
    first_name: 'Lena', last_name: 'Schneider', email: 'lena.schneider@example.com', phone: '+4915112345678',
    address_line1: 'Musterstraße 12', postal_code: '80331', city: 'München', country: 'DE',
  },
  es: {
    first_name: 'Lucía', last_name: 'García', email: 'lucia.garcia@example.com', phone: '+4915112345678',
    address_line1: 'Musterstraße 12', postal_code: '80331', city: 'München', country: 'DE',
  },
  it: {
    first_name: 'Giulia', last_name: 'Rossi', email: 'giulia.rossi@example.com', phone: '+4915112345678',
    address_line1: 'Musterstraße 12', postal_code: '80331', city: 'München', country: 'DE',
  },
  tr: {
    first_name: 'Elif', last_name: 'Yılmaz', email: 'elif.yilmaz@example.com', phone: '+4915112345678',
    address_line1: 'Musterstraße 12', postal_code: '80331', city: 'München', country: 'DE',
  },
}

/** Fellow travellers for a party larger than one (first names only differ). */
const DEMO_COMPANIONS: Record<DemoLang, [string, string][]> = {
  en: [['Sam', 'Morgan'], ['Robin', 'Morgan'], ['Jamie', 'Morgan'], ['Kim', 'Morgan']],
  de: [['Jonas', 'Schneider'], ['Mia', 'Schneider'], ['Paul', 'Schneider'], ['Emma', 'Schneider']],
  es: [['Pablo', 'García'], ['Marta', 'García'], ['Diego', 'García'], ['Sara', 'García']],
  it: [['Marco', 'Rossi'], ['Sofia', 'Rossi'], ['Luca', 'Rossi'], ['Elena', 'Rossi']],
  tr: [['Can', 'Yılmaz'], ['Zeynep', 'Yılmaz'], ['Emre', 'Yılmaz'], ['Deniz', 'Yılmaz']],
}

export const demoCustomer = (lang: DemoLang = demoLang()): DemoCustomer => DEMO_CUSTOMERS[lang]

/** Sample name of the n-th (0-based) extra traveller. */
export function demoCompanion(n: number, lang: DemoLang = demoLang()): { first_name: string; last_name: string } {
  const list = DEMO_COMPANIONS[lang]
  const [first_name, last_name] = list[n % list.length]!
  return { first_name, last_name }
}
