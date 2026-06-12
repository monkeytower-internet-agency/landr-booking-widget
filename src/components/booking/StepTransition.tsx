/**
 * landr-d8rg.8: subtle enter transition between widget steps.
 *
 * Wraps the active step content. App passes a `step` key (the step name) so a
 * step change RE-MOUNTS this element, replaying the `.step-enter` animation
 * (fade in + 8px upward translate, 200ms — defined in index.css). Under
 * prefers-reduced-motion the animation is suppressed in CSS, so the content
 * simply appears — no JS media-query branching needed here.
 *
 * Purely presentational, no variant coupling: the motion is the same across
 * all three directions (consistency of the interaction layer; the *look*
 * differs, the *feel* of moving between steps does not).
 *
 * Component-only file (react-refresh/only-export-components CI gate).
 */
import type { ReactNode } from 'react'

export function StepTransition({
  stepKey,
  children,
}: {
  /** Identifier that changes per step; drives the re-mount → replay. */
  stepKey: string
  children: ReactNode
}) {
  return (
    <div key={stepKey} className="step-enter" data-testid="step-transition">
      {children}
    </div>
  )
}
