import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getProductSuggestions } from '@/api/client'
import type { ProductHint } from '@/api/types'
import { CrossSellHintCards, HINT_FLASH_MS, HINT_NONE_LEFT_MS } from './CrossSellHintCards'

vi.mock('@/api/client', () => ({ getProductSuggestions: vi.fn() }))

const hint = (id: string, price: string | number | null = '50.00'): ProductHint => ({
  product_id: id,
  name: `Product ${id}`,
  price_from: price,
  currency: 'EUR',
  source: 'product',
})

async function setup(
  hints: ProductHint[],
  available: Record<string, boolean>,
  onOpen = vi.fn(),
) {
  vi.mocked(getProductSuggestions).mockResolvedValue(hints)
  const onCheck = vi.fn(async (hs: ProductHint[]) =>
    Object.fromEntries(hs.map((h) => [h.product_id, available[h.product_id] ?? true])),
  )
  render(
    <CrossSellHintCards
      operatorToken="tok"
      productId="main"
      onOpen={onOpen}
      onCheckAvailability={onCheck}
    />,
  )
  await act(async () => {})
  return { onOpen, onCheck }
}

describe('CrossSellHintCards', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows one heading, name and price only, and "price on request" for 0', async () => {
    await setup([hint('a'), hint('b', 0)], {})
    expect(screen.getAllByText('You might also like')).toHaveLength(1)
    expect(screen.getByTestId('cross-sell-hint-a')).toHaveTextContent('from')
    expect(screen.getByTestId('cross-sell-hint-b')).toHaveTextContent('Price on request')
    expect(screen.getByTestId('cross-sell-hint-b')).not.toHaveTextContent('0.00')
  })

  it('checks every chip, flashes the unavailable one, then removes it', async () => {
    const { onCheck } = await setup([hint('a'), hint('b')], { b: false })
    await act(async () => {
      fireEvent.click(screen.getByTestId('cross-sell-check'))
    })
    expect(onCheck).toHaveBeenCalledWith([hint('a'), hint('b')])
    expect(screen.getByTestId('cross-sell-hint-flash-b')).toHaveTextContent('Sorry, not available')
    act(() => void vi.advanceTimersByTime(HINT_FLASH_MS))
    expect(screen.queryByTestId('cross-sell-hint-flash-b')).toBeNull()
    expect(screen.queryByTestId('cross-sell-hint-b')).toBeNull()
    expect(screen.getByTestId('cross-sell-checked')).toHaveTextContent('Available on your dates')
    expect(screen.queryByTestId('cross-sell-check')).toBeNull()
  })

  it('an unavailable chip tap flashes in place and does not open', async () => {
    const { onOpen } = await setup([hint('a'), hint('b')], { b: false })
    await act(async () => {
      fireEvent.click(screen.getByTestId('cross-sell-hint-b'))
    })
    expect(onOpen).not.toHaveBeenCalled()
    expect(screen.getByTestId('cross-sell-hint-flash-b')).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(HINT_FLASH_MS))
    expect(screen.queryByTestId('cross-sell-hint-b')).toBeNull()
    expect(screen.getByTestId('cross-sell-hint-a')).toBeInTheDocument()
  })

  it('an available chip tap opens the product', async () => {
    const { onOpen } = await setup([hint('a')], {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('cross-sell-hint-a'))
    })
    expect(onOpen).toHaveBeenCalledWith(hint('a'))
  })

  it('when every chip is unavailable, says so, then the whole block vanishes', async () => {
    await setup([hint('a'), hint('b')], { a: false, b: false })
    await act(async () => {
      fireEvent.click(screen.getByTestId('cross-sell-check'))
    })
    act(() => void vi.advanceTimersByTime(HINT_FLASH_MS))
    expect(screen.getByTestId('cross-sell-none-left')).toHaveTextContent(
      'Sorry, none of these are available on your dates.',
    )
    expect(screen.queryByTestId('cross-sell-checked')).toBeNull()
    act(() => void vi.advanceTimersByTime(HINT_NONE_LEFT_MS))
    expect(screen.queryByTestId('cross-sell-hints')).toBeNull()
  })
})
