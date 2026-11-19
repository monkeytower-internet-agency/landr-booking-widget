import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TopBanner } from './TopBanner'

vi.mock('@/lib/tier', () => ({ getTier: vi.fn() }))
import { getTier } from '@/lib/tier'
const mockGetTier = vi.mocked(getTier)

describe('TopBanner', () => {
  it.each(['dev', 'staging'] as const)('reserves badge clearance on %s', (t) => {
    mockGetTier.mockReturnValue(t)
    render(<TopBanner>x</TopBanner>)
    expect(screen.getByTestId('top-banner').className).toContain('pt-20')
  })
  it.each(['prod', undefined] as const)('adds no clearance on %s', (t) => {
    mockGetTier.mockReturnValue(t)
    render(<TopBanner>x</TopBanner>)
    expect(screen.getByTestId('top-banner').className).not.toContain('pt-')
  })
})
