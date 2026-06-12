/**
 * landr-d8rg.8: tests for the floating preview variant switcher.
 *
 * Covers the two contractual behaviours:
 *   1. The switcher renders ONLY when preview is enabled (previewEnabled
 *      prop on VariantProvider — driven by ?preview=1 / preview_token).
 *      A customer-facing render (previewEnabled=false, the default) shows
 *      nothing.
 *   2. Clicking a chip flips the active variant live — a sibling consumer
 *      of useVariant() re-renders with the new variant + its resolved
 *      tokens, and the URL ?variant= param is updated (no reload).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { VariantProvider } from '@/lib/variant.tsx'
import { useVariant, VARIANT_TOKENS } from '@/lib/variant'
import { VariantSwitcher } from './VariantSwitcher'

// A tiny consumer that surfaces the active variant + a token so the test can
// assert that a switch propagates through the context.
function Probe() {
  const { variant, tokens } = useVariant()
  return (
    <div
      data-testid="probe"
      data-variant={variant}
      data-radius={tokens.cardRadius}
    />
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('VariantSwitcher (landr-d8rg.8)', () => {
  it('does NOT render when preview is disabled (customer embed)', () => {
    render(
      <VariantProvider value="aurora">
        <VariantSwitcher />
      </VariantProvider>,
    )
    expect(screen.queryByTestId('variant-switcher')).toBeNull()
  })

  it('renders a chip per variant when preview is enabled', () => {
    render(
      <VariantProvider value="aurora" previewEnabled>
        <VariantSwitcher />
      </VariantProvider>,
    )
    expect(screen.getByTestId('variant-switcher')).toBeInTheDocument()
    expect(screen.getByTestId('variant-switcher-aurora')).toBeInTheDocument()
    expect(screen.getByTestId('variant-switcher-summit')).toBeInTheDocument()
    expect(screen.getByTestId('variant-switcher-alpine')).toBeInTheDocument()
    // The seeded variant is marked active.
    expect(
      screen.getByTestId('variant-switcher-aurora').dataset.active,
    ).toBe('true')
  })

  it('switching a chip flips the active variant + tokens for consumers', () => {
    render(
      <VariantProvider value="aurora" previewEnabled>
        <VariantSwitcher />
        <Probe />
      </VariantProvider>,
    )
    // Starts on aurora.
    expect(screen.getByTestId('probe').dataset.variant).toBe('aurora')
    expect(screen.getByTestId('probe').dataset.radius).toBe(
      VARIANT_TOKENS.aurora.cardRadius,
    )

    // Flip to alpine.
    fireEvent.click(screen.getByTestId('variant-switcher-alpine'))

    expect(screen.getByTestId('probe').dataset.variant).toBe('alpine')
    expect(screen.getByTestId('probe').dataset.radius).toBe(
      VARIANT_TOKENS.alpine.cardRadius,
    )
    // The clicked chip is now active, the previous one is not.
    expect(
      screen.getByTestId('variant-switcher-alpine').dataset.active,
    ).toBe('true')
    expect(
      screen.getByTestId('variant-switcher-aurora').dataset.active,
    ).toBe('false')
  })

  it('writes the chosen variant into the URL ?variant= param (no reload)', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState')
    render(
      <VariantProvider value="aurora" previewEnabled>
        <VariantSwitcher />
      </VariantProvider>,
    )
    fireEvent.click(screen.getByTestId('variant-switcher-summit'))

    expect(replaceState).toHaveBeenCalled()
    // The URL passed to replaceState carries variant=summit.
    const lastCall = replaceState.mock.calls.at(-1)
    const urlArg = String(lastCall?.[2])
    expect(urlArg).toContain('variant=summit')
  })
})
