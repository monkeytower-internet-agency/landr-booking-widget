import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

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
