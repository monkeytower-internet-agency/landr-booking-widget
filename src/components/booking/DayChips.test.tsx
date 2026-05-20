import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DayChips } from './DayChips'

describe('DayChips (landr-2wyi / landr-769w)', () => {
  it('renders nothing when the date list is empty', () => {
    const { container } = render(<DayChips dates={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders one chip per date for a single-day selection', () => {
    render(<DayChips dates={['2026-05-25']} locale="en-GB" />)
    const chips = screen.getByTestId('day-chips')
    expect(chips.querySelectorAll('[data-day]')).toHaveLength(1)
    // formatDayLabel('2026-05-25', 'en-GB') → 'Mon 25 May'
    expect(chips).toHaveTextContent(/Mon 25 May/)
  })

  it('renders one chip per date for a contiguous selection (3 chips)', () => {
    render(
      <DayChips
        dates={['2026-05-25', '2026-05-26', '2026-05-27']}
        locale="en-GB"
      />,
    )
    const chips = screen.getByTestId('day-chips')
    expect(chips.querySelectorAll('[data-day]')).toHaveLength(3)
    expect(chips).toHaveTextContent(/Mon 25 May/)
    expect(chips).toHaveTextContent(/Tue 26 May/)
    expect(chips).toHaveTextContent(/Wed 27 May/)
  })

  it('renders one chip per date for a NON-contiguous selection (2 chips, not a 3-day range)', () => {
    // 25 + 27 skipping 26 — the bug the chips replace: the old
    // "25 → 27 (2 days)" label conflated this with a contiguous range.
    render(
      <DayChips dates={['2026-05-25', '2026-05-27']} locale="en-GB" />,
    )
    const chips = screen.getByTestId('day-chips')
    expect(chips.querySelectorAll('[data-day]')).toHaveLength(2)
    expect(chips).toHaveTextContent(/Mon 25 May/)
    expect(chips).toHaveTextContent(/Wed 27 May/)
    // The middle day is NOT in the list.
    expect(chips).not.toHaveTextContent(/Tue 26 May/)
  })

  it('sorts dates chronologically even when passed out of order', () => {
    render(
      <DayChips
        dates={['2026-05-27', '2026-05-25', '2026-05-26']}
        locale="en-GB"
      />,
    )
    const chips = screen.getByTestId('day-chips')
    const labels = Array.from(chips.querySelectorAll('[data-day]')).map(
      (c) => c.textContent,
    )
    expect(labels).toEqual(['Mon 25 May', 'Tue 26 May', 'Wed 27 May'])
  })

  // ---- landr-769w: consecutive-run grouping with visible separators ----

  it('splits non-consecutive days into runs with a visible separator (landr-769w)', () => {
    // [25, 27] → 2 runs, 1 separator between them. The original
    // implementation rendered these as two chips with the same flex
    // gap as a contiguous pair, making them indistinguishable from
    // [25, 26] visually.
    const { container } = render(
      <DayChips dates={['2026-05-25', '2026-05-27']} locale="en-GB" />,
    )
    const runs = container.querySelectorAll('[data-run-start]')
    expect(runs).toHaveLength(2)
    expect(runs[0]).toHaveAttribute('data-run-start', '2026-05-25')
    expect(runs[1]).toHaveAttribute('data-run-start', '2026-05-27')
    const seps = container.querySelectorAll('[data-run-separator]')
    expect(seps).toHaveLength(1)
  })

  it('renders a contiguous range as a single run with no separators (landr-769w)', () => {
    const { container } = render(
      <DayChips
        dates={['2026-05-25', '2026-05-26', '2026-05-27']}
        locale="en-GB"
      />,
    )
    expect(container.querySelectorAll('[data-run-start]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-run-separator]')).toHaveLength(0)
  })

  it('renders a single day as one run with no separators (landr-769w)', () => {
    const { container } = render(
      <DayChips dates={['2026-05-25']} locale="en-GB" />,
    )
    expect(container.querySelectorAll('[data-run-start]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-run-separator]')).toHaveLength(0)
  })

  it('separators are aria-hidden so screen readers skip them (landr-769w)', () => {
    const { container } = render(
      <DayChips dates={['2026-05-25', '2026-05-27']} locale="en-GB" />,
    )
    const sep = container.querySelector('[data-run-separator]')
    expect(sep).not.toBeNull()
    expect(sep).toHaveAttribute('aria-hidden', 'true')
  })

  it('handles the canonical multi-run case [24, 27, 28, 30, 31] (landr-769w)', () => {
    // Mirror of the dashboard's canonical example: 3 runs (24), (27,28),
    // (30,31) with 2 separators between them.
    const { container } = render(
      <DayChips
        dates={[
          '2026-05-24',
          '2026-05-27',
          '2026-05-28',
          '2026-05-30',
          '2026-05-31',
        ]}
        locale="en-GB"
      />,
    )
    const runs = container.querySelectorAll('[data-run-start]')
    expect(runs).toHaveLength(3)
    expect(runs[0]).toHaveAttribute('data-run-start', '2026-05-24')
    expect(runs[1]).toHaveAttribute('data-run-start', '2026-05-27')
    expect(runs[2]).toHaveAttribute('data-run-start', '2026-05-30')
    expect(container.querySelectorAll('[data-run-separator]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-day]')).toHaveLength(5)
  })
})
