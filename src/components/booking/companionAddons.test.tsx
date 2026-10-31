/**
 * landr-a27k9.2: day-pickable companion add-ons (day_selection='parent_subset')
 * -- the card, the per-day stock, the submit lines and the price lines.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProductAddon } from '@/api/types'
import { AddonsList } from './AddonsList'
import {
  companionDaysMissing,
  companionOverCap,
  companionView,
  effectiveCompanionDays,
  selectionToLines,
  toggleCompanionDay,
  withoutSoldOut,
  type AddonSelection,
  type CompanionDayStock,
} from './addonsState'
import { flattenPerRoomAddons } from './accommodationCalc'
import { buildAddonLines, companionEstimate } from './priceSidebarHelpers'

const getProductAddons = vi.hoisted(() => vi.fn())
vi.mock('@/api/client', async (orig) => ({
  ...(await orig<typeof import('@/api/client')>()),
  getProductAddons,
}))

const DAYS = ['2026-11-10', '2026-11-11', '2026-11-12']

function bike(overrides: Partial<ProductAddon> = {}): ProductAddon {
  return {
    product_addon_id: 'pa-bike',
    addon_product_id: 'bike',
    name: 'City bike',
    name_localized: null,
    is_required: false,
    min_qty: 0,
    max_qty: null,
    sort_order: 1,
    price_per_unit: 12,
    currency: 'EUR',
    product_kind: 'service',
    addon_quantity_rule: 'one_per_participant',
    day_selection: 'parent_subset',
    thumb_url: 'https://img.example/bike-thumb.webp',
    images: [
      { thumb_url: 'https://img.example/bike-thumb.webp', hero_url: 'https://img.example/bike-hero.webp', alt: 'A red city bike' },
    ],
    ...overrides,
  }
}

/** A per-day addons endpoint: `stock` = remaining bikes per day (absent = unlimited). */
function stockByDay(stock: Record<string, number>) {
  getProductAddons.mockImplementation(
    async (_parent: string, q?: { selectedDays: string[] }) => {
      const day = q?.selectedDays[0] ?? ''
      const left = stock[day]
      return [
        bike({
          available: left === undefined || left > 0,
          unavailable_reason: left === 0 ? 'sold_out' : null,
          stock_remaining: left ?? null,
        }),
      ]
    },
  )
}

/** Let the three per-day stock lookups land before interacting. */
async function settle() {
  await waitFor(() => expect(getProductAddons).toHaveBeenCalledTimes(DAYS.length))
  await act(async () => {})
}

function Harness({
  party = 2,
  initial = {},
  initialDays = {},
  onState,
}: {
  party?: number
  initial?: Record<string, number>
  initialDays?: Record<string, string[]>
  onState?: (s: { qty: Record<string, number>; days: Record<string, string[]> }) => void
}) {
  const [qty, setQty] = useState(initial)
  const [days, setDays] = useState(initialDays)
  onState?.({ qty, days })
  return (
    <AddonsList
      addons={[bike()]}
      selection={qty}
      onChange={setQty}
      expectedQty={1}
      participantCount={party}
      parentProductId="parent-1"
      parentDays={DAYS}
      daysSelection={days}
      onDaysChange={setDays}
    />
  )
}

describe('companion add-on card', () => {
  beforeEach(() => {
    getProductAddons.mockReset()
    stockByDay({})
  })

  it('draws a card: picture, name, price per day and one chip per parent day, none picked', async () => {
    render(<Harness />)
    expect(screen.getByTestId('addon-image-bike')).toHaveAttribute('src', 'https://img.example/bike-thumb.webp')
    expect(screen.getByTestId('addon-image-bike')).toHaveAttribute('alt', 'A red city bike')
    expect(screen.getByText('City bike')).toBeInTheDocument()
    expect(screen.getByTestId('addon-day-price-bike')).toHaveTextContent(/12/)
    for (const d of DAYS) {
      expect(screen.getByTestId(`addon-day-bike-${d}`)).toHaveAttribute('aria-pressed', 'false')
    }
    await waitFor(() => expect(getProductAddons).toHaveBeenCalledTimes(DAYS.length))
  })

  it('asks the stock one day at a time and disables the chip of a day with none left', async () => {
    stockByDay({ '2026-11-11': 0 })
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('addon-day-bike-2026-11-11')).toBeDisabled())
    expect(screen.getByTestId('addon-day-bike-2026-11-10')).not.toBeDisabled()
    for (const call of getProductAddons.mock.calls) {
      expect(call[1].selectedDays).toHaveLength(1)
      expect(call[1].participants).toBe(2)
    }
  })

  it('caps the stepper at min(party size, lowest remaining across the picked days)', async () => {
    stockByDay({ '2026-11-10': 5, '2026-11-11': 1, '2026-11-12': 5 })
    render(<Harness party={3} />)
    await waitFor(() => expect(getProductAddons).toHaveBeenCalledTimes(3))
    const plus = screen.getByRole('button', { name: /increase/i })
    // Day 10 only: min(3 guests, 5 left) = 3.
    fireEvent.click(screen.getByTestId('addon-day-bike-2026-11-10'))
    for (let i = 0; i < 5; i++) fireEvent.click(plus)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(plus).toBeDisabled()
    // Adding the day with 1 left lowers the cap to 1 and re-clamps the quantity.
    fireEvent.click(screen.getByTestId('addon-day-bike-2026-11-11'))
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('needs at least one day once the quantity is above zero', async () => {
    render(<Harness />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /increase/i }))
    expect(screen.getByTestId('addon-days-required-bike')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('addon-day-bike-2026-11-10'))
    expect(screen.queryByTestId('addon-days-required-bike')).toBeNull()
  })

  it('keeps the picked days and drops the ones the stay no longer has', async () => {
    let seen: { days: Record<string, string[]> } | undefined
    render(
      <Harness
        initial={{ bike: 1 }}
        initialDays={{ bike: ['2026-11-09', '2026-11-10'] }}
        onState={(s) => (seen = s)}
      />,
    )
    await settle()
    expect(screen.getByTestId('addon-day-bike-2026-11-10')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('addon-day-bike-2026-11-11')).toHaveAttribute('aria-pressed', 'false')
    expect(seen?.days.bike).toContain('2026-11-09') // stored as picked; trimmed when read
    expect(effectiveCompanionDays(seen?.days.bike, DAYS)).toEqual(['2026-11-10'])
  })

  it('re-clamps the quantity when the stock on the picked days drops, without a chip toggle', async () => {
    stockByDay({ '2026-11-10': 1 })
    render(<Harness party={4} initial={{ bike: 3 }} initialDays={{ bike: ['2026-11-10'] }} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /increase/i })).toBeDisabled())
    expect(screen.getByLabelText(/increase/i).previousElementSibling).toHaveTextContent('1')
  })

  it('re-clamps to the party size when the parent days or party change', async () => {
    let seen: number | undefined
    render(<Harness party={2} initial={{ bike: 3 }} initialDays={{ bike: ['2026-11-10'] }} onState={(s) => (seen = s.qty.bike)} />)
    await waitFor(() => expect(seen).toBe(2))
  })

  it('a list without parent days draws a companion as a plain row', () => {
    render(<AddonsList addons={[bike()]} selection={{}} onChange={vi.fn()} expectedQty={1} />)
    expect(screen.queryByTestId('addon-days-bike')).toBeNull()
    expect(screen.getByTestId('addon-row-bike')).toBeInTheDocument()
  })
})

describe('companion helpers', () => {
  it('toggleCompanionDay adds and removes, sorted', () => {
    expect(toggleCompanionDay(['2026-11-12'], '2026-11-10')).toEqual(['2026-11-10', '2026-11-12'])
    expect(toggleCompanionDay(['2026-11-10', '2026-11-12'], '2026-11-10')).toEqual(['2026-11-12'])
  })

  it('companionView judges the stock on the picked days only', () => {
    const stock: CompanionDayStock = {
      '2026-11-10': { bike: { available: true, remaining: 4 } },
      '2026-11-11': { bike: { available: false, remaining: 0 } },
    }
    const row = bike({ available: false, stock_remaining: 0 })
    expect(companionView(row, ['2026-11-10'], stock).stock_remaining).toBe(4)
    expect(companionView(row, ['2026-11-10'], stock).available).toBe(true)
    expect(companionView(row, [], stock).stock_remaining).toBeNull()
  })

  it('companionOverCap blocks a quantity above the party size (less other rooms\' share)', () => {
    const a = [bike()]
    expect(companionOverCap(a, { bike: 3 }, 2)).toBe(true)
    expect(companionOverCap(a, { bike: 2 }, 2)).toBe(false)
    expect(companionOverCap(a, { bike: 2 }, 3, { bike: 2 })).toBe(true)
    expect(companionOverCap(a, { bike: 1 }, 3, { bike: 2 })).toBe(false)
    expect(companionOverCap(a, { bike: 5 }, undefined)).toBe(false)
  })

  it('companionDaysMissing flags a companion with a quantity and no valid day', () => {
    const a = [bike()]
    expect(companionDaysMissing(a, { bike: 1 }, {}, DAYS)).toBe(true)
    expect(companionDaysMissing(a, { bike: 1 }, { bike: ['2026-11-10'] }, DAYS)).toBe(false)
    expect(companionDaysMissing(a, { bike: 1 }, { bike: ['2030-01-01'] }, DAYS)).toBe(true)
    expect(companionDaysMissing(a, {}, {}, DAYS)).toBe(false)
  })

  it('withoutSoldOut keeps a companion whose all-days verdict is sold out', () => {
    const row = bike({ available: false, stock_remaining: 0 })
    expect(withoutSoldOut({ bike: 1 }, [row], 2)).toEqual({ bike: 1 })
    // ... but still trims it to the party-size rule.
    expect(withoutSoldOut({ bike: 5 }, [row], 2)).toEqual({ bike: 2 })
  })

  it('selectionToLines gives a companion its own days and leaves it out without any', () => {
    const rows = [bike(), bike({ addon_product_id: 'video', name: 'Video', day_selection: 'parent_all' })]
    const lines = selectionToLines({ bike: 2, video: 1 }, rows, { bike: ['2026-11-10', '2026-11-12'] })
    expect(lines.find((l) => l.productId === 'bike')).toMatchObject({
      quantity: 2,
      selectedDays: ['2026-11-10', '2026-11-12'],
      unitPrice: 12,
    })
    expect(lines.find((l) => l.productId === 'video')?.selectedDays).toBeUndefined()
    expect(selectionToLines({ bike: 2 }, rows, {})).toEqual([])
  })

  it('flattenPerRoomAddons never merges rooms with different days into qty x union (2 bikes on 10 Nov + 1 bike on 11 Nov = 3 bike-days)', () => {
    const lines = flattenPerRoomAddons(
      { r1: { bike: 2 }, r2: { bike: 1 } },
      { r1: 1, r2: 1 },
      { r1: [bike()], r2: [bike()] },
      {
        daysByRoom: { r1: { bike: ['2026-11-10'] }, r2: { bike: ['2026-11-11'] } },
        nights: DAYS,
        partySize: 3,
      },
    )
    expect(lines.map((l) => [l.productId, l.quantity, l.selectedDays])).toEqual([
      ['bike', 2, ['2026-11-10']],
      ['bike', 1, ['2026-11-11']],
    ])
    const bikeDays = lines.reduce((n, l) => n + l.quantity * (l.selectedDays?.length ?? 0), 0)
    expect(bikeDays).toBe(3)
  })

  it('flattenPerRoomAddons sums rooms with the same day set, trims to the nights, caps at the party size', () => {
    const lines = flattenPerRoomAddons(
      { r1: { bike: 2 }, r2: { bike: 2 } },
      { r1: 1, r2: 1 },
      { r1: [bike()], r2: [bike()] },
      {
        daysByRoom: {
          r1: { bike: ['2026-11-10', '2030-01-01'] },
          r2: { bike: ['2026-11-10'] },
        },
        nights: DAYS,
        partySize: 3,
      },
    )
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ quantity: 3, selectedDays: ['2026-11-10'] })
    // No valid day: no line.
    expect(
      flattenPerRoomAddons({ r1: { bike: 1 } }, { r1: 1 }, { r1: [bike()] }, { daysByRoom: {}, nights: DAYS }),
    ).toEqual([])
  })
})

describe('companion pricing in the sidebar', () => {
  const line: AddonSelection = {
    productId: 'bike',
    quantity: 2,
    selectedDays: ['2026-11-10', '2026-11-11', '2026-11-12'],
    name: 'City bike',
    unitPrice: 12,
    currency: 'EUR',
  }

  it('keeps a companion out of the shared-days estimate lines', () => {
    expect(buildAddonLines([], [line, { productId: 'video', quantity: 1 }])).toEqual([
      { product_id: 'video', qty: 1 },
    ])
  })

  it('prices qty x days x price per day', () => {
    const est = companionEstimate([line], 'EUR', 'en')
    expect(est?.line_items[0]).toMatchObject({ qty: 2, units: 3, unit_price: '12.00', line_total: '72.00' })
    expect(est?.operator_total).toBe('72.00')
    expect(est?.grand_total).toBe('72.00')
    // Localized name, currency of the add-on's estimate (no EUR assumption).
    const de = companionEstimate(
      [{ ...line, currency: 'CHF', nameLocalized: { de: 'Stadtrad' } }],
      'CHF',
      'de-DE',
    )
    expect(de?.line_items[0]?.label).toBe('Stadtrad')
    expect(de?.currency).toBe('CHF')
    // A line in another currency cannot be summed into the main estimate.
    expect(companionEstimate([{ ...line, currency: 'USD' }], 'CHF', 'en')).toBeNull()
    expect(companionEstimate([{ productId: 'video', quantity: 1 }], 'EUR', 'en')).toBeNull()
  })
})
