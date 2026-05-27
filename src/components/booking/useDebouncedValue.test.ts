import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue (landr-qez0)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the initial value synchronously on first render', () => {
    const { result } = renderHook(() => useDebouncedValue('hello', 300))
    expect(result.current).toBe('hello')
  })

  it('keeps returning the previous value until the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ v }: { v: string }) => useDebouncedValue(v, 300),
      { initialProps: { v: 'a' } },
    )
    expect(result.current).toBe('a')
    rerender({ v: 'b' })
    expect(result.current).toBe('a')
    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(result.current).toBe('a')
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('b')
  })

  it('cancels the in-flight timer when the input changes again', () => {
    const { result, rerender } = renderHook(
      ({ v }: { v: number }) => useDebouncedValue(v, 200),
      { initialProps: { v: 1 } },
    )
    rerender({ v: 2 })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    rerender({ v: 3 })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    // first 150ms timer was cancelled when value moved to 3 — still 1
    expect(result.current).toBe(1)
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(result.current).toBe(3)
  })

  it('handles a fast burst of changes with last-wins semantics', () => {
    const { result, rerender } = renderHook(
      ({ v }: { v: string }) => useDebouncedValue(v, 100),
      { initialProps: { v: 'a' } },
    )
    for (const v of ['b', 'c', 'd', 'e']) {
      rerender({ v })
      act(() => {
        vi.advanceTimersByTime(50)
      })
    }
    expect(result.current).toBe('a')
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('e')
  })

  it('respects a changed delayMs prop', () => {
    const { result, rerender } = renderHook(
      ({ v, d }: { v: string; d: number }) => useDebouncedValue(v, d),
      { initialProps: { v: 'a', d: 300 } },
    )
    rerender({ v: 'b', d: 50 })
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(result.current).toBe('b')
  })

  it('works with object values via referential identity', () => {
    const first = { id: 1 }
    const second = { id: 2 }
    const { result, rerender } = renderHook(
      ({ v }: { v: { id: number } }) => useDebouncedValue(v, 100),
      { initialProps: { v: first } },
    )
    expect(result.current).toBe(first)
    rerender({ v: second })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe(second)
  })
})
