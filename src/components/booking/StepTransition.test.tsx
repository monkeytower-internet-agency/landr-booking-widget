/**
 * landr-d8rg.8: tests for the step-enter motion wrapper.
 *
 * The actual fade+translate is CSS (the `.step-enter` keyframe in index.css);
 * jsdom doesn't run animations, so these tests assert the WIRING that makes the
 * motion correct + reduced-motion-safe:
 *   1. The wrapper applies the `.step-enter` class (so the animation is opt-in
 *      via CSS, NOT forced inline — which is what lets the
 *      prefers-reduced-motion media query in index.css fully disable it; an
 *      inline `style={{animation:...}}` could not be overridden by the query).
 *   2. The wrapper does NOT carry an inline animation/transition style, so the
 *      reduced-motion media query is authoritative.
 *   3. Changing the `stepKey` RE-MOUNTS the wrapped subtree (new DOM node), so
 *      the enter animation replays on every step change.
 *
 * The reduced-motion guard itself lives in index.css
 * (`@media (prefers-reduced-motion: reduce) { .step-enter { animation: none } }`)
 * and is compiled by `vite build`; asserting (1)+(2) here guarantees the class
 * approach that makes that guard effective.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StepTransition } from './StepTransition'

describe('StepTransition (landr-d8rg.8)', () => {
  it('applies the .step-enter animation class (CSS-driven, overridable)', () => {
    render(
      <StepTransition stepKey="pick-product">
        <span>content</span>
      </StepTransition>,
    )
    const el = screen.getByTestId('step-transition')
    expect(el).toHaveClass('step-enter')
  })

  it('does not force motion via inline style (reduced-motion query wins)', () => {
    render(
      <StepTransition stepKey="pick-product">
        <span>content</span>
      </StepTransition>,
    )
    const el = screen.getByTestId('step-transition')
    // No inline animation/transition — so the prefers-reduced-motion media
    // query in index.css can fully suppress the motion. An inline style would
    // out-specify the media query and break the reduced-motion contract.
    expect(el.style.animation).toBe('')
    expect(el.style.transition).toBe('')
  })

  it('re-mounts the subtree when the step key changes (replay)', () => {
    const { rerender } = render(
      <StepTransition stepKey="pick-product">
        <span data-testid="child">a</span>
      </StepTransition>,
    )
    const first = screen.getByTestId('step-transition')

    rerender(
      <StepTransition stepKey="product-detail">
        <span data-testid="child">a</span>
      </StepTransition>,
    )
    const second = screen.getByTestId('step-transition')

    // A key change forces React to unmount + remount → a different DOM node,
    // which is exactly what replays the CSS enter animation.
    expect(second).not.toBe(first)
  })
})
