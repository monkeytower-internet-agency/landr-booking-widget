import type { AlternativeWindow, ProductAlternative } from '@/api/types'

/** One tappable row of the "Also available" panel. */
export interface AlternativeRow {
  key: string
  alternative: ProductAlternative
  /** ISO start date; set on course rows only. */
  startDate?: string
}

export function monthKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${m}`
}

export function monthKeyOfIso(iso: string): string {
  return iso.slice(0, 7)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * ISO `[from, to]` of a `YYYY-MM` month, with `from` clamped to `todayIso` so
 * the request never reaches into the past. Null when the month is over.
 */
export function monthRange(
  key: string,
  todayIso: string,
): { from: string; to: string } | null {
  const [y, m] = key.split('-').map(Number) as [number, number]
  const last = new Date(y, m, 0).getDate()
  const to = `${y}-${pad(m)}-${pad(last)}`
  if (to < todayIso) return null
  const first = `${y}-${pad(m)}-01`
  return { from: first < todayIso ? todayIso : first, to }
}

/** Union the per-month responses into one list, keeping the API's order. */
export function mergeAlternatives(
  responses: ProductAlternative[][],
): ProductAlternative[] {
  const order: string[] = []
  const byId = new Map<string, ProductAlternative>()
  for (const list of responses) {
    for (const alt of list) {
      const prev = byId.get(alt.product_id)
      if (!prev) {
        order.push(alt.product_id)
        byId.set(alt.product_id, alt)
        continue
      }
      const dates = new Set([...(prev.available_dates ?? []), ...(alt.available_dates ?? [])])
      const seen = new Set((prev.windows ?? []).map((w) => w.id))
      const windows: AlternativeWindow[] = [...(prev.windows ?? [])]
      for (const w of alt.windows ?? []) if (!seen.has(w.id)) windows.push(w)
      byId.set(alt.product_id, {
        ...prev,
        available_dates: [...dates].sort(),
        windows,
      })
    }
  }
  return order.map((id) => byId.get(id) as ProductAlternative)
}

/** Day-shaped alternatives open on EVERY selected day (none until a day is picked). */
export function dayRowsFor(
  alternatives: ProductAlternative[],
  selectedDays: string[],
): AlternativeRow[] {
  if (selectedDays.length === 0) return []
  return alternatives
    .filter((alt) => {
      if (alt.service_time_shape === 'fixed_window') return false
      const open = new Set(alt.available_dates ?? [])
      return selectedDays.every((d) => open.has(d))
    })
    .map((alternative) => ({ key: alternative.product_id, alternative }))
}

/** Courses with a window starting in `month` (`YYYY-MM`), one row per window. */
export function courseRowsFor(
  alternatives: ProductAlternative[],
  months: string[],
): AlternativeRow[] {
  const rows: AlternativeRow[] = []
  for (const alternative of alternatives) {
    if (alternative.service_time_shape !== 'fixed_window') continue
    for (const w of alternative.windows ?? []) {
      if (!months.includes(monthKeyOfIso(w.start_date))) continue
      rows.push({
        key: `${alternative.product_id}:${w.id}`,
        alternative,
        startDate: w.start_date,
      })
    }
  }
  return rows.sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))
}

/** Fully-booked state: everything that has any date or window in range. */
export function anyRowsFor(alternatives: ProductAlternative[]): AlternativeRow[] {
  const rows: AlternativeRow[] = []
  for (const alternative of alternatives) {
    if (alternative.service_time_shape === 'fixed_window') {
      for (const w of alternative.windows ?? []) {
        rows.push({
          key: `${alternative.product_id}:${w.id}`,
          alternative,
          startDate: w.start_date,
        })
      }
    } else if ((alternative.available_dates ?? []).length > 0) {
      rows.push({ key: alternative.product_id, alternative })
    }
  }
  return rows
}
