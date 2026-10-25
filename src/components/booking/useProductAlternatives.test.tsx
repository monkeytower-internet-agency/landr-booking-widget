import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProductAlternative } from '@/api/types'
import { useProductAlternatives } from './useProductAlternatives'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getProductAlternatives:
      vi.fn<
        (id: string, from: string, to: string, party?: number) => Promise<ProductAlternative[]>
      >(),
  },
}))

vi.mock('@/api/client', () => ({
  getProductAlternatives: mocks.getProductAlternatives,
}))

const alt = (id: string, dates: string[]): ProductAlternative => ({
  product_id: id,
  slug: id,
  name: id,
  service_time_shape: 'single_date',
  available_dates: dates,
  windows: null,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('useProductAlternatives operator clock (range clamp)', () => {
  it('starts at the operator today, not the browser today', async () => {
    // 20:30 on Oct 25 in Berlin is already Oct 26 in Tokyo.
    vi.stubEnv('TZ', 'Asia/Tokyo')
    vi.setSystemTime(new Date('2026-10-25T18:30:00Z'))
    mocks.getProductAlternatives.mockResolvedValue([])
    renderHook(() => useProductAlternatives('p', ['2026-10'], 1, 'Europe/Berlin'))
    await waitFor(() => expect(mocks.getProductAlternatives).toHaveBeenCalled())
    expect(mocks.getProductAlternatives).toHaveBeenCalledWith('p', '2026-10-25', '2026-10-31', 1)
  })

  it('still requests the last operator day of a month the browser has left', async () => {
    vi.stubEnv('TZ', 'Asia/Tokyo')
    // Oct 31 23:30 in Berlin is Nov 1 in Tokyo.
    vi.setSystemTime(new Date('2026-10-31T22:30:00Z'))
    mocks.getProductAlternatives.mockResolvedValue([])
    renderHook(() => useProductAlternatives('p', ['2026-10'], 1, 'Europe/Berlin'))
    await waitFor(() => expect(mocks.getProductAlternatives).toHaveBeenCalled())
    expect(mocks.getProductAlternatives).toHaveBeenCalledWith('p', '2026-10-31', '2026-10-31', 1)
  })
})

describe('useProductAlternatives stale-while-revalidate', () => {
  it('keeps the last rows while a new month or party size is still loading', async () => {
    vi.setSystemTime(new Date('2026-10-05T10:00:00Z'))
    const first = [alt('a', ['2026-10-10'])]
    mocks.getProductAlternatives.mockResolvedValueOnce(first)
    const { result, rerender } = renderHook(
      ({ months, party }) => useProductAlternatives('p', months, party, 'Europe/Berlin'),
      { initialProps: { months: ['2026-10'], party: 1 } },
    )
    expect(result.current).toBeNull()
    await waitFor(() => expect(result.current).toEqual(first))

    // Page to November: the request never resolves, rows must stay.
    mocks.getProductAlternatives.mockReturnValueOnce(new Promise(() => {}))
    rerender({ months: ['2026-10', '2026-11'], party: 1 })
    await act(async () => {})
    expect(mocks.getProductAlternatives).toHaveBeenCalledTimes(2)
    expect(result.current).toEqual(first)

    // Party change: same, still the old rows while the new answer is pending.
    mocks.getProductAlternatives.mockReturnValue(new Promise(() => {}))
    rerender({ months: ['2026-10', '2026-11'], party: 3 })
    await act(async () => {})
    expect(result.current).toEqual(first)
  })

  it('swaps to the new rows once they arrive', async () => {
    vi.setSystemTime(new Date('2026-10-05T10:00:00Z'))
    const first = [alt('a', ['2026-10-10'])]
    const second = [alt('b', ['2026-10-10'])]
    mocks.getProductAlternatives.mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    const { result, rerender } = renderHook(
      ({ party }) => useProductAlternatives('p', ['2026-10'], party, 'Europe/Berlin'),
      { initialProps: { party: 1 } },
    )
    await waitFor(() => expect(result.current).toEqual(first))
    rerender({ party: 2 })
    await waitFor(() => expect(result.current).toEqual(second))
  })

  it('does not leak rows across products', async () => {
    vi.setSystemTime(new Date('2026-10-05T10:00:00Z'))
    mocks.getProductAlternatives.mockResolvedValueOnce([alt('a', ['2026-10-10'])])
    const { result, rerender } = renderHook(
      ({ id }) => useProductAlternatives(id, ['2026-10'], 1, 'Europe/Berlin'),
      { initialProps: { id: 'p1' } },
    )
    await waitFor(() => expect(result.current).not.toBeNull())
    mocks.getProductAlternatives.mockReturnValue(new Promise(() => {}))
    rerender({ id: 'p2' })
    await act(async () => {})
    expect(result.current).toBeNull()
  })
})
