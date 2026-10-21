/**
 * landr-bwm91.4: the product page's price notes, e.g.
 *   "Base price €150 · Weekends +€20 · 09:00 start −€10"
 *   "Grundpreis 150 € · Wochenende +20 € · Start 09:00 −10 €"
 *
 * Built from the public products payload's `price_base` + `price_notes`.
 * Labels come from the notes' structured fields (weekdays / time_from /
 * time_to) and the locale bundle, so nothing English leaks into DE; the API's
 * English `label` is only a fallback for a note without structure. The base
 * item is omitted when `price_base` is absent. No adjustment notes -> an
 * empty list (the caller renders nothing). Kept in a plain .ts file so the
 * react-refresh/only-export-components CI gate stays happy.
 */
import type { Product } from '@/api/types'
import { fmt, tr } from '@/lib/strings'

type PriceNote = NonNullable<Product['price_notes']>[number]

const MINUS = '−'

/** "150" / "20.5" / "19.99": whole amounts drop the trailing ".00". */
function money(n: number, currency: string, locale: string): string {
  const digits = Number.isInteger(n) ? 0 : 2
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `${n.toFixed(digits)} ${currency}`
  }
}

function weekdayLabel(days: number[], locale: string): string {
  const key = days.join(',')
  if (key === '6,7') return tr('priceNoteWeekends', locale)
  if (key === '1,2,3,4,5') return tr('priceNoteWeekdays', locale)
  // 2024-01-01 is a Monday, so ISO weekday d is 2024-01-0d.
  const fmtDay = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
  return days.map((d) => fmtDay.format(new Date(Date.UTC(2024, 0, d)))).join(', ')
}

function noteLabel(note: PriceNote, locale: string): string {
  if (note.weekdays && note.weekdays.length > 0) {
    return weekdayLabel(note.weekdays, locale)
  }
  if (note.time_from) {
    const to = note.time_to || note.time_from
    return to === note.time_from
      ? fmt(tr('priceNoteStartTemplate', locale), { time: note.time_from })
      : `${note.time_from}–${to}`
  }
  return note.label
}

function noteAmount(note: PriceNote, currency: string, locale: string): string {
  const n = Number(note.amount)
  if (!Number.isFinite(n) || n === 0) return ''
  const abs = Math.abs(n)
  const body =
    note.amount_type === 'percent'
      ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(abs)}%`
      : money(abs, currency, locale)
  return `${n > 0 ? '+' : MINUS}${body}`
}

export function formatPriceNotes(
  product: Pick<Product, 'price_base' | 'price_notes' | 'currency'>,
  locale: string,
): string[] {
  const notes = (product.price_notes ?? []).filter(
    (n) => noteAmount(n, 'EUR', locale) !== '',
  )
  if (notes.length === 0) return []
  const currency = product.currency || 'EUR'
  const ordered = [
    ...notes.filter((n) => n.kind === 'surcharge'),
    ...notes.filter((n) => n.kind !== 'surcharge'),
  ]
  const items: string[] = []
  const base = product.price_base == null ? NaN : Number(product.price_base)
  if (product.price_base != null && product.price_base.trim() !== '' && Number.isFinite(base)) {
    items.push(fmt(tr('priceNoteBase', locale), { amount: money(base, currency, locale) }))
  }
  for (const n of ordered) {
    items.push(`${noteLabel(n, locale)} ${noteAmount(n, currency, locale)}`)
  }
  return items
}
