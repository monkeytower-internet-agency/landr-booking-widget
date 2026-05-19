import { browserLocale } from '@/lib/locale'

type Bundle = {
  multiDayPickerHelp: string
}

const en: Bundle = {
  multiDayPickerHelp:
    'Click to pick a date. Click another to make a range. Hold Shift (or Cmd/Ctrl) to toggle individual days.',
}

const de: Bundle = {
  multiDayPickerHelp:
    'Klicke ein Datum an, klicke ein zweites für einen Zeitraum. Halte Umschalt (oder Cmd/Strg), um einzelne Tage an- oder abzuwählen.',
}

const bundles: Record<string, Bundle> = { en, de }

export function pickBundle(locale: string = browserLocale()): Bundle {
  const base = locale.split('-')[0]?.toLowerCase() ?? 'en'
  return bundles[base] ?? bundles.en!
}

export function tr(key: keyof Bundle, locale?: string): string {
  return pickBundle(locale)[key]
}
