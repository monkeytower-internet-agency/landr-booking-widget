import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/tier', () => ({ getTier: vi.fn() }))
vi.mock('@/lib/locale', () => ({ browserLocale: () => 'de' }))

import { getTier } from '@/lib/tier'
import { TierBadge } from './TierBadge'
import { resetVersionCheckForTests, setBookingIdle, checkNow } from '@/lib/versionCheck'

const tier = vi.mocked(getTier)

function stubRemote(buildId: string) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ buildId }) })))
}

beforeEach(() => {
  resetVersionCheckForTests('aaaaaaa1111')
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BuildChip via TierBadge', () => {
  it('renders nothing in prod', () => {
    tier.mockReturnValue('prod')
    const { container } = render(<TierBadge />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows sha7 and German age lines on dev, up-to-date after a check', async () => {
    tier.mockReturnValue('dev')
    stubRemote('aaaaaaa1111')
    render(<TierBadge />)
    await act(async () => {
      await checkNow()
    })
    expect(screen.getByTestId('build-chip')).toHaveAttribute('data-status', 'up-to-date')
    expect(screen.getByTestId('build-chip-checked').textContent).toMatch(/^geprüft /)
    expect(screen.getByTestId('build-chip-built').textContent).toMatch(/^gebaut /)
  })

  it('goes amber on a newer build; click reloads only when idle', async () => {
    tier.mockReturnValue('staging')
    stubRemote('bbbbbbb2222')
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    render(<TierBadge />)
    await act(async () => {
      await checkNow()
    })
    const chip = screen.getByTestId('build-chip')
    expect(chip).toHaveAttribute('data-status', 'update-available')
    expect(chip).toBeDisabled()
    chip.click()
    expect(reload).not.toHaveBeenCalled()
    act(() => setBookingIdle(true))
    expect(chip).not.toBeDisabled()
    chip.click()
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
