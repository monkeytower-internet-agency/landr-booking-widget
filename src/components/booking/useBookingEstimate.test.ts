import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from '@/api/client'
import type { EstimateResponse } from '@/api/types'
import { useBookingEstimate } from './useBookingEstimate'

const SAMPLE_ESTIMATE: EstimateResponse = {
  line_items: [
    {
      product_id: 'p-1',
      label: 'Guided Day Dive',
      qty: 1,
      units: 3,
      unit_price: '60.00',
      line_total: '180.00',
      paid_to: 'operator',
    },
  ],
  operator_total: '180.00',
  hotel_total: '0.00',
  grand_total: '180.00',
  currency: 'EUR',
  applied_rules: [],
  warnings: [],
  un_priceable: false,
}

describe('useBookingEstimate (landr-qez0)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('does not call the API when disabled', async () => {
    const spy = vi
      .spyOn(client, 'estimateBookingPrice')
      .mockResolvedValue(SAMPLE_ESTIMATE)
    renderHook(() =>
      useBookingEstimate({
        operatorToken: 'para42',
        productId: 'p-1',
        selectedDays: ['2026-05-23'],
        participantCount: 1,
        addonLines: [],
        enabled: false,
      }),
    )
    // give microtasks + initial render a chance
    await new Promise((r) => setTimeout(r, 50))
    expect(spy).not.toHaveBeenCalled()
  })

  it('does not call the API when productId is null', async () => {
    const spy = vi
      .spyOn(client, 'estimateBookingPrice')
      .mockResolvedValue(SAMPLE_ESTIMATE)
    renderHook(() =>
      useBookingEstimate({
        operatorToken: 'para42',
        productId: null,
        selectedDays: ['2026-05-23'],
        participantCount: 1,
        addonLines: [],
      }),
    )
    await new Promise((r) => setTimeout(r, 50))
    expect(spy).not.toHaveBeenCalled()
  })

  it('fetches once on mount and resolves with data', async () => {
    const spy = vi
      .spyOn(client, 'estimateBookingPrice')
      .mockResolvedValue(SAMPLE_ESTIMATE)
    const { result } = renderHook(() =>
      useBookingEstimate({
        operatorToken: 'para42',
        productId: 'p-1',
        selectedDays: ['2026-05-23'],
        participantCount: 1,
        addonLines: [],
      }),
    )
    await waitFor(() => {
      expect(result.current.data).toEqual(SAMPLE_ESTIMATE)
    })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('para42', 'p-1', {
      selected_days: ['2026-05-23'],
      participants_count: 1,
      addon_lines: [],
    })
  })

  it('debounces input changes — fast burst collapses to one call', async () => {
    vi.useFakeTimers()
    const spy = vi
      .spyOn(client, 'estimateBookingPrice')
      .mockResolvedValue(SAMPLE_ESTIMATE)
    const { rerender } = renderHook(
      ({ count }: { count: number }) =>
        useBookingEstimate({
          operatorToken: 'para42',
          productId: 'p-1',
          selectedDays: ['2026-05-23'],
          participantCount: count,
          addonLines: [],
          debounceMs: 300,
        }),
      { initialProps: { count: 1 } },
    )
    // initial render: debouncedKey === liveKey on first tick, so the
    // effect should fire once immediately (the debounce starts at the
    // current value).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(spy).toHaveBeenCalledTimes(1)
    // burst of count changes within the debounce window
    for (const c of [2, 3, 4, 5]) {
      rerender({ count: c })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })
    }
    // not yet flushed
    expect(spy).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenLastCalledWith(
      'para42',
      'p-1',
      expect.objectContaining({ participants_count: 5 }),
    )
  })

  it('surfaces an error when the API call rejects', async () => {
    vi.spyOn(client, 'estimateBookingPrice').mockRejectedValue(
      new Error('boom'),
    )
    const { result } = renderHook(() =>
      useBookingEstimate({
        operatorToken: 'para42',
        productId: 'p-1',
        selectedDays: ['2026-05-23'],
        participantCount: 1,
        addonLines: [],
      }),
    )
    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })
    expect(result.current.error?.message).toBe('boom')
    expect(result.current.data).toBeNull()
  })

  it('drops a stale response if a fresher fetch has started', async () => {
    let resolveFirst!: (v: EstimateResponse) => void
    const firstPromise = new Promise<EstimateResponse>((res) => {
      resolveFirst = res
    })
    const second: EstimateResponse = {
      ...SAMPLE_ESTIMATE,
      grand_total: '999.00',
    }
    const spy = vi
      .spyOn(client, 'estimateBookingPrice')
      .mockImplementationOnce(() => firstPromise)
      .mockResolvedValueOnce(second)
    const { result, rerender } = renderHook(
      ({ count }: { count: number }) =>
        useBookingEstimate({
          operatorToken: 'para42',
          productId: 'p-1',
          selectedDays: ['2026-05-23'],
          participantCount: count,
          addonLines: [],
          debounceMs: 1,
        }),
      { initialProps: { count: 1 } },
    )
    await new Promise((r) => setTimeout(r, 10))
    rerender({ count: 2 })
    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(result.current.data?.grand_total).toBe('999.00')
    })
    // Now resolve the stale first call — must NOT overwrite the fresh data
    resolveFirst(SAMPLE_ESTIMATE)
    await new Promise((r) => setTimeout(r, 20))
    expect(result.current.data?.grand_total).toBe('999.00')
  })
})
