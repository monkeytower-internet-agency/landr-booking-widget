import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextAction } from './NextAction'

describe('NextAction (landr-80ubl.1)', () => {
  it('active: accent ring + tint and a visible "Next:" cue', () => {
    render(
      <NextAction active cue="pick a date" data-testid="na">
        <button type="button">Pick</button>
      </NextAction>,
    )
    const box = screen.getByTestId('na')
    expect(box).toHaveAttribute('data-next-action', 'active')
    expect(box.className).toContain('ring-primary')
    expect(box.className).toContain('bg-surface-tint')
    expect(screen.getByTestId('next-action-cue')).toHaveTextContent('Next: pick a date')
    // Visible text, not a live region — it changes on every interaction.
    expect(screen.getByTestId('next-action-cue')).not.toHaveAttribute('aria-live')
  })

  it('inactive: plain box, no cue, children still rendered', () => {
    render(
      <NextAction active={false} cue="pick a date" data-testid="na">
        <button type="button">Pick</button>
      </NextAction>,
    )
    const box = screen.getByTestId('na')
    expect(box).toHaveAttribute('data-next-action', 'inactive')
    expect(box.className).not.toContain('ring-primary')
    expect(screen.queryByTestId('next-action-cue')).toBeNull()
    expect(screen.getByRole('button', { name: 'Pick' })).toBeInTheDocument()
  })

  it('keeps the same child element across the active flip (no remount)', () => {
    const { rerender } = render(
      <NextAction active cue="x">
        <input data-testid="child" />
      </NextAction>,
    )
    const before = screen.getByTestId('child')
    rerender(
      <NextAction active={false} cue="x">
        <input data-testid="child" />
      </NextAction>,
    )
    expect(screen.getByTestId('child')).toBe(before)
  })
})
