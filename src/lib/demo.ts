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

/** Locale the demo renders in (`?lang=`); English unless German is asked for. */
export function demoLang(): 'en' | 'de' {
  if (typeof window === 'undefined') return 'en'
  const v = new URLSearchParams(window.location.search).get('lang')?.toLowerCase() ?? ''
  return v.startsWith('de') ? 'de' : 'en'
}

/** Synthetic operator token: the real flow is keyed on it, nothing resolves it. */
export const demoToken = (slug: string): string => `demo-${slug}`

/** Where the congrats screen sends visitors: signup with the template preselected. */
export function demoSignupUrl(slug: string, lang: 'en' | 'de' = demoLang()): string {
  const base = lang === 'de' ? 'https://www.landr.de/de/signup/' : 'https://www.landr.de/en/signup/'
  return `${base}?template=${encodeURIComponent(slug)}`
}

const COPY = {
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
} as const

export const demoCopy = (lang: 'en' | 'de' = demoLang()) => COPY[lang]
