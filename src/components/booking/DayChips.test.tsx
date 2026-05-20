import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DayChips } from './DayChips'

describe('DayChips (landr-2wyi)', () => {
  it('renders nothing when the date list is empty', () => {
    const { container } = render(<DayChips dates={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders one chip per date for a single-day selection', () => {
    render(<DayChips dates={['2026-05-25']} locale="en-GB" />)
    const chips = screen.getByTestId('day-chips')
    expect(chips.children).toHaveLength(1)
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
    expect(chips.children).toHaveLength(3)
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
    expect(chips.children).toHaveLength(2)
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
    const labels = Array.from(chips.children).map((c) => c.textContent)
    expect(labels).toEqual(['Mon 25 May', 'Tue 26 May', 'Wed 27 May'])
  })
})
