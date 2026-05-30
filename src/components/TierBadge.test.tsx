/**
 * landr-7dya.20: TierBadge unit tests.
 *
 * Verifies:
 *  - prod → null (no badge in the DOM)
 *  - undefined → null (no badge when VITE_DEPLOY_TIER is unset)
 *  - staging → renders 'STAGING' pill
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

  it('renders STAGING badge for staging tier', () => {
    mockGetTier.mockReturnValue('staging')
    render(<TierBadge />)
    const badge = screen.getByTestId('tier-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('STAGING')
    expect(badge).toHaveAttribute('aria-label', 'Environment: STAGING')
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
