/**
 * landr-7dya.20: TierBadge unit tests.
 *
 * Verifies:
 *  - prod → null (no badge in the DOM)
 *  - undefined → null (no badge when VITE_DEPLOY_TIER is unset)
 *  - staging → renders the in-flow 'Playground' ribbon with the build chip inside
 *  - dev     → renders 'DEV' pill
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TierBadge } from './TierBadge'

// We swap the tier module so we can control getTier() without setting env vars
// directly (Vite bakes import.meta.env at build time; vi.stubEnv works in
// tests but mocking the module is cleaner here).
vi.mock('@/lib/tier', () => ({
  getTier: vi.fn(),
}))

import { getTier } from '@/lib/tier'
const mockGetTier = vi.mocked(getTier)

describe('TierBadge', () => {
  it('renders nothing when tier is undefined', () => {
    mockGetTier.mockReturnValue(undefined)
    const { container } = render(<TierBadge />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when tier is prod', () => {
    mockGetTier.mockReturnValue('prod')
    const { container } = render(<TierBadge />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the Playground ribbon, with the build chip inside it, for staging', () => {
    mockGetTier.mockReturnValue('staging')
    render(<TierBadge />)
    const badge = screen.getByTestId('tier-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('Playground')
    expect(badge).toHaveAttribute('aria-label', 'Environment: PLAYGROUND')
    // Folded in: no fixed overlay, so nothing can overlap the page content.
    expect(badge.className).not.toContain('fixed')
    const chip = screen.getByTestId('build-chip')
    expect(badge).toContainElement(chip)
    expect(chip.className).not.toContain('fixed')
  })

  it('keeps the fixed overlay chip on dev', () => {
    mockGetTier.mockReturnValue('dev')
    render(<TierBadge />)
    expect(screen.getByTestId('build-chip').className).toContain('fixed')
  })

  it('renders DEV badge for dev tier', () => {
    mockGetTier.mockReturnValue('dev')
    render(<TierBadge />)
    const badge = screen.getByTestId('tier-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('DEV')
    expect(badge).toHaveAttribute('aria-label', 'Environment: DEV')
  })
})
