import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ContinueAction } from './ContinueAction'

describe('ContinueAction (landr-80ubl.1)', () => {
  it('not ready: muted disabled button, reason beside it, no active next-action', () => {
    const { container } = render(
      <ContinueAction
        ready={false}
        reason="Still waiting on Kay."
        reasonId="gate"
        onContinue={vi.fn()}
        data-testid="go"
      />,
    )
    const btn = screen.getByTestId('go')
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('data-variant', 'secondary')
    expect(btn).toHaveAttribute('aria-describedby', 'gate')
    expect(screen.getByRole('status')).toHaveTextContent('Still waiting on Kay.')
    expect(container.querySelector('[data-next-action="active"]')).toBeNull()
  })

  it('ready: solid accent button inside the active next-action', () => {
    const onContinue = vi.fn()
    const { container } = render(
      <ContinueAction ready reason="All set." reasonId="gate" onContinue={onContinue} data-testid="go" />,
    )
    const btn = screen.getByTestId('go')
    expect(btn).toBeEnabled()
    expect(btn).toHaveAttribute('data-variant', 'default')
    expect(container.querySelector('[data-next-action="active"]')).not.toBeNull()
    expect(screen.getByTestId('next-action-cue')).toHaveTextContent('Next: continue')
    fireEvent.click(btn)
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('active={false} yields the ring to another NextAction', () => {
    const { container } = render(
      <ContinueAction ready active={false} reason="" reasonId="gate" onContinue={vi.fn()} />,
    )
    expect(container.querySelector('[data-next-action="active"]')).toBeNull()
  })
})
