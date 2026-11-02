import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OfferEvaluateGuest, OfferEvaluateLine, OfferEvaluateResponse } from '@/api/types'
import { getOffers } from '@/api/client'
import { offersRequestKey, useOffers } from './useOffers'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return { ...actual, getOffers: vi.fn() }
})

const LINES: OfferEvaluateLine[] = [{ line_id: 'main', product_id: 'p1', selected_days: ['2027-01-01'] }]
const GUESTS: OfferEvaluateGuest[] = [{ id: 'g1', attributes: {} }]

function answer(lineId = 'main'): OfferEvaluateResponse {
  return { lines: [{ line_id: lineId, eligible: true, offers: [], draft: false }], required_attribute_keys: [] }
}

describe('useOffers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(getOffers).mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keys the request on the tree and the party only', () => {
    const a = offersRequestKey('t', LINES, GUESTS)
    expect(offersRequestKey('t', [...LINES], [{ id: 'g1', attributes: {} }])).toBe(a)
    expect(offersRequestKey('t', [{ ...LINES[0]!, selected_days: ['2027-01-02'] }], GUESTS)).not.toBe(a)
    expect(offersRequestKey('t', LINES, [{ id: 'g1', attributes: { age: 8 } }])).not.toBe(a)
    expect(offersRequestKey('t', [...LINES, { line_id: 'o1', product_id: 'x', parent_line_id: 'main' }], GUESTS)).not.toBe(a)
  })

  it('is pending until the answer for the current key lands', async () => {
    vi.mocked(getOffers).mockResolvedValue(answer())
    const { result } = renderHook(() => useOffers({ widgetToken: 't', lines: LINES, guests: GUESTS }))
    expect(result.current.isPending).toBe(true)
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(result.current.isPending).toBe(false)
    expect(result.current.byLine.main?.eligible).toBe(true)
    expect(getOffers).toHaveBeenCalledTimes(1)
  })

  it('refetches on a party change, debounced, latest wins; keeps the old verdict meanwhile', async () => {
    vi.mocked(getOffers).mockResolvedValue(answer())
    const { result, rerender } = renderHook(
      ({ guests }) => useOffers({ widgetToken: 't', lines: LINES, guests }),
      { initialProps: { guests: GUESTS } },
    )
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(getOffers).toHaveBeenCalledTimes(1)
    rerender({ guests: [{ id: 'g1', attributes: { age: 5 } }] })
    rerender({ guests: [{ id: 'g1', attributes: { age: 9 } }] })
    expect(result.current.isPending).toBe(true)
    expect(result.current.byLine.main).toBeDefined()
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(getOffers).toHaveBeenCalledTimes(2)
    expect(vi.mocked(getOffers).mock.calls[1]![0].guests[0]!.attributes).toEqual({ age: 9 })
    expect(result.current.isPending).toBe(false)
  })

  it('does not refetch for an equal request', async () => {
    vi.mocked(getOffers).mockResolvedValue(answer())
    const { rerender } = renderHook(
      ({ lines }) => useOffers({ widgetToken: 't', lines, guests: GUESTS }),
      { initialProps: { lines: LINES } },
    )
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    rerender({ lines: LINES.map((l) => ({ ...l })) })
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(getOffers).toHaveBeenCalledTimes(1)
  })

  it('a failed or rate-limited check sets checkFailed, clears pending and keeps the verdict', async () => {
    vi.mocked(getOffers).mockResolvedValueOnce(answer()).mockRejectedValueOnce(new Error('429'))
    const { result, rerender } = renderHook(
      ({ guests }) => useOffers({ widgetToken: 't', lines: LINES, guests }),
      { initialProps: { guests: GUESTS } },
    )
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    rerender({ guests: [{ id: 'g1', attributes: { age: 30 } }] })
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(result.current.checkFailed).toBe(true)
    expect(result.current.isPending).toBe(false)
    expect(result.current.byLine.main?.eligible).toBe(true)
  })

  it('asks again for the same cart when the refresh key moves', async () => {
    vi.mocked(getOffers).mockResolvedValue(answer())
    const { rerender } = renderHook(
      ({ n }) => useOffers({ widgetToken: 't', lines: LINES, guests: GUESTS, refreshKey: n }),
      { initialProps: { n: 0 } },
    )
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    rerender({ n: 1 })
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(getOffers).toHaveBeenCalledTimes(2)
  })
})
