import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { de as dayPickerDe, es as dayPickerEs, tr as dayPickerTr } from 'react-day-picker/locale'

import { configureCustomerLocale } from '@/lib/locale'
import { pickBundle } from '@/lib/strings'

import { Calendar } from './calendar'

/**
 * landr-tkgx8.2 — a selected day keeps the operator colour while hovered.
 * The day is a ghost Button whose `hover:bg-accent` (neutral grey — the
 * widget theme never sets --accent) used to win over the selected
 * `bg-primary` for as long as the pointer rested on the just-clicked day.
 */

const month = new Date(2026, 5, 1)

function dayButton(container: HTMLElement, dayOfMonth: number): HTMLButtonElement {
  const match = Array.from(
    container.querySelectorAll<HTMLButtonElement>('button[data-day]'),
  ).find((b) => {
    const d = new Date(b.dataset.day!)
    return d.getMonth() === month.getMonth() && d.getDate() === dayOfMonth
  })
  if (!match) throw new Error(`No day button for ${dayOfMonth}`)
  return match
}

function hoverClasses(el: HTMLElement): string[] {
  return el.className.split(/\s+/).filter((c) => c.includes('hover:'))
}

describe('Calendar day hover colours', () => {
  it('keeps bg-primary on a selected day while hovered (single mode)', () => {
    const { container } = render(
      <Calendar mode="single" selected={new Date(2026, 5, 10)} month={month} />,
    )
    const btn = dayButton(container, 10)
    expect(btn.dataset.selectedSingle).toBe('true')
    expect(btn.className).toContain('bg-primary')
    expect(hoverClasses(btn)).toEqual(
      expect.arrayContaining(['hover:bg-primary', 'hover:text-primary-foreground']),
    )
    expect(btn.className).not.toMatch(/hover:bg-accent|hover:text-accent-foreground/)
  })

  it('keeps bg-primary on every selected day while hovered (multiple mode)', () => {
    const { container } = render(
      <Calendar
        mode="multiple"
        selected={[new Date(2026, 5, 10), new Date(2026, 5, 11), new Date(2026, 5, 12)]}
        month={month}
      />,
    )
    for (const d of [10, 11, 12]) {
      const btn = dayButton(container, d)
      expect(hoverClasses(btn)).toContain('hover:bg-primary')
      expect(btn.className).not.toMatch(/hover:bg-accent/)
    }
  })

  it('hovers unselected days in an operator tint, not neutral grey', () => {
    const { container } = render(
      <Calendar mode="single" selected={new Date(2026, 5, 10)} month={month} />,
    )
    const btn = dayButton(container, 11)
    expect(hoverClasses(btn)).toContain('hover:bg-primary/10')
    expect(hoverClasses(btn)).not.toContain('hover:bg-primary')
    expect(btn.className).not.toMatch(/hover:bg-accent/)
  })
})

/**
 * landr-8r6oc.4 — the month caption and weekday header follow the customer's
 * resolved locale (react-day-picker's own locale catalogs), not English.
 */
describe('Calendar locale', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    configureCustomerLocale(null, null)
  })

  it.each([
    ['en-US', /June 2026/, 'Mo'],
    ['de-DE', /Juni 2026/, 'Mo'],
    ['es-ES', /junio 2026/i, 'lu'],
    ['tr-TR', /Haziran 2026/, 'Pt'],
  ])('%s renders the month caption in its own language', (language, caption, weekday) => {
    vi.stubGlobal('navigator', { ...navigator, language })
    const { container } = render(<Calendar mode="single" month={month} />)
    expect(container.textContent ?? '').toMatch(caption)
    const headers = Array.from(container.querySelectorAll('th')).map((th) => th.textContent ?? '')
    expect(headers.some((h) => h.toLowerCase().startsWith(weekday.toLowerCase()))).toBe(true)
  })

  // landr-8r6oc.18: react-day-picker's aria labels follow the language too.
  it.each([
    ['en-US', 'Go to the Next Month', 'Go to the Previous Month'],
    ['de-DE', 'Zum nächsten Monat', 'Zum vorherigen Monat'],
    ['es-ES', 'Ir al mes siguiente', 'Ir al mes anterior'],
    ['tr-TR', 'Sonraki aya git', 'Önceki aya git'],
  ])('%s localises the month-navigation aria labels', (language, next, previous) => {
    vi.stubGlobal('navigator', { ...navigator, language })
    const { container } = render(<Calendar mode="single" month={month} />)
    const labels = Array.from(container.querySelectorAll('button[aria-label]')).map((b) =>
      b.getAttribute('aria-label'),
    )
    expect(labels).toEqual(expect.arrayContaining([next, previous]))
  })
})

/**
 * landr-8r6oc.18 — the invite diff view swaps react-day-picker's "selected"
 * word for added / removed; both words come from the language catalog, and the
 * catalog's "selected" word has to match the one react-day-picker appends.
 */
describe('Calendar diff-state aria labels', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    ['en-US', 'added', 'removed'],
    ['de-DE', 'hinzugefügt', 'entfernt'],
    ['es-ES', 'añadido', 'quitado'],
    ['tr-TR', 'eklendi', 'kaldırıldı'],
  ])('%s names the diff state in its own language', (language, added, removed) => {
    vi.stubGlobal('navigator', { ...navigator, language })
    const { container } = render(
      <Calendar
        mode="multiple"
        month={month}
        selected={[new Date(2026, 5, 10), new Date(2026, 5, 11)]}
        modifiers={{ diffAdded: [new Date(2026, 5, 10)], diffRemoved: [new Date(2026, 5, 11)] }}
      />,
    )
    const ten = dayButton(container, 10).getAttribute('aria-label') ?? ''
    const eleven = dayButton(container, 11).getAttribute('aria-label') ?? ''
    expect(ten.endsWith(`, ${added}`)).toBe(true)
    expect(eleven.endsWith(`, ${removed}`)).toBe(true)
    // The "selected" word react-day-picker added is gone, not doubled up.
    for (const label of [ten, eleven]) {
      expect(label).not.toMatch(/, (selected|ausgewählt|seleccionado|seçili)\b/)
    }
  })

  it.each([
    ['de', dayPickerDe],
    ['es', dayPickerEs],
    ['tr', dayPickerTr],
  ])('%s: the catalog "selected" word is the one react-day-picker appends', (lang, locale) => {
    const labelDayButton = locale.labels?.labelDayButton
    const label =
      typeof labelDayButton === 'function'
        ? labelDayButton(new Date(2026, 5, 10), { selected: true } as never)
        : undefined
    expect(label?.endsWith(`, ${pickBundle(lang).calendarDaySelected}`)).toBe(true)
  })
})
