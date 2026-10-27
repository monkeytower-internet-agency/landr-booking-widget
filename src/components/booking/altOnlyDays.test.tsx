import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AvailabilitySlot, Product, ProductAlternative } from '@/api/types'
import { SingleDatePicker } from './SingleDatePicker'
import { altOnlyDaysFor } from './altOnlyDays'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getAvailability: vi.fn<(...a: unknown[]) => Promise<AvailabilitySlot[]>>(),
    getProductAlternatives: vi.fn<(...a: unknown[]) => Promise<ProductAlternative[]>>(),
  },
}))

vi.mock('@/api/client', () => ({
  getAvailability: mocks.getAvailability,
  getProductAlternatives: mocks.getProductAlternatives,
}))

const product = {
  product_id: 'p-main',
  slug: 'main',
  name: 'Tandem flight',
  name_localized: null,
  short_description: null,
  short_description_localized: null,
  description: null,
  product_kind: 'service',
  service_time_shape: 'single_date',
  is_contiguous: false,
  duration_minutes: null,
  fixed_start_date: null,
  fixed_end_date: null,
  product_group_id: null,
  group_slug: null,
  group_name: null,
  sort_order: 0,
  sport_subcategory_codes: [],
  location_ids: [],
  needs_pickup: false,
} as Product

const slot = (iso: string, seats: number): AvailabilitySlot => ({
  availability_id: `slot-${iso}`,
  date: iso,
  start_time: null,
  end_time: null,
  capacity: 5,
  capacity_reserved: 5 - seats,
  available_seats: seats,
  status: 'open',
})

const alt = (dates: string[], over: Partial<ProductAlternative> = {}): ProductAlternative => ({
  product_id: 'p-alt',
  slug: 'alt',
  name: 'Scenic flight',
  service_time_shape: 'single_date',
  available_dates: dates,
  windows: null,
  ...over,
})

function dayBtn(day: number): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-day]')).find(
    (b) => {
      const d = new Date(b.dataset.day ?? '')
      return d.getMonth() === 4 && d.getDate() === day
    },
  )
  if (!match) throw new Error(`no day ${day}`)
  return match
}

async function renderPicker() {
  render(<SingleDatePicker product={product} onBack={() => {}} onConfirm={() => {}} />)
  await waitFor(() => expect(mocks.getProductAlternatives).toHaveBeenCalled())
  await waitFor(() => dayBtn(22))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))
  // 20 full, 21 not scheduled, 22 bookable.
  mocks.getAvailability.mockResolvedValue([slot('2026-05-20', 0), slot('2026-05-22', 5)])
})
afterEach(() => {
  vi.useRealTimers()
})

describe('altOnlyDaysFor', () => {
  const base = {
    fit: new Set(['2026-05-22']),
    short: new Map<string, number>(),
    todayIso: '2026-05-15',
  }
  const slots = [slot('2026-05-20', 0), slot('2026-05-22', 5), slot('2026-05-25', 2)]

  it('marks full and unscheduled days with a free day alternative', () => {
    const days = altOnlyDaysFor({
      ...base,
      slots,
      alternatives: [alt(['2026-05-20', '2026-05-21', '2026-05-22'])],
    })
    expect([...days].sort()).toEqual(['2026-05-20', '2026-05-21'])
  })

  it('ignores courses, past days and unloaded data', () => {
    const course = alt([], {
      service_time_shape: 'fixed_window',
      windows: [{ id: 'w', start_date: '2026-05-20', end_date: '2026-05-24' } as never],
    })
    expect(altOnlyDaysFor({ ...base, slots, alternatives: [course] }).size).toBe(0)
    expect(
      altOnlyDaysFor({ ...base, slots, alternatives: [alt(['2026-05-10'])] }).size,
    ).toBe(0)
    expect(altOnlyDaysFor({ ...base, slots, alternatives: null }).size).toBe(0)
    expect(altOnlyDaysFor({ ...base, slots: null, alternatives: [alt(['2026-05-20'])] }).size).toBe(0)
  })
})

describe('altOnlyDaysFor short days', () => {
  const base = {
    fit: new Set(['2026-05-22']),
    short: new Map([['2026-05-25', 2]]),
    todayIso: '2026-05-15',
  }
  const slots = [slot('2026-05-22', 5), slot('2026-05-25', 2), slot('2026-05-26', 2)]

  it('rescues a day too small for the party when an alternative is free', () => {
    const days = altOnlyDaysFor({ ...base, slots, alternatives: [alt(['2026-05-25'])] })
    expect([...days]).toEqual(['2026-05-25'])
  })

  it('leaves a short day disabled without an alternative, and a lead-time-closed day with seats out', () => {
    expect(
      altOnlyDaysFor({ ...base, slots, alternatives: [alt(['2026-05-24'])] }).has('2026-05-25'),
    ).toBe(false)
    // 05-26 has seats but is neither fit nor short: closed by lead time.
    expect(altOnlyDaysFor({ ...base, slots, alternatives: [alt(['2026-05-26'])] }).size).toBe(0)
  })
})

describe('SingleDatePicker alt-only days', () => {
  it('puts a dot and a label on a full day with a free alternative and keeps it clickable', async () => {
    mocks.getProductAlternatives.mockResolvedValue([alt(['2026-05-20', '2026-05-21'])])
    await renderPicker()
    await waitFor(() => expect(dayBtn(20).dataset.altOnly).toBe('true'))
    expect(dayBtn(20)).not.toBeDisabled()
    expect(dayBtn(20).querySelector('[data-testid="alt-only-dot"]')).not.toBeNull()
    expect(dayBtn(20).getAttribute('aria-label')).toMatch(
      /: fully booked, other activities available$/,
    )
    expect(dayBtn(21).dataset.altOnly).toBe('true')
    // A normal bookable day carries no dot.
    expect(dayBtn(22).dataset.altOnly).toBeUndefined()
    expect(screen.getByTestId('alt-only-legend')).toHaveTextContent(
      'another activity is free on this day',
    )
  })

  it('labels a day only too small for the party as not enough places, not fully booked', async () => {
    mocks.getAvailability.mockResolvedValue([slot('2026-05-20', 0), slot('2026-05-22', 5), slot('2026-05-25', 2)])
    mocks.getProductAlternatives.mockResolvedValue([alt(['2026-05-20', '2026-05-25'])])
    render(
      <SingleDatePicker product={product} seatsNeeded={3} onBack={() => {}} onConfirm={() => {}} />,
    )
    await waitFor(() => expect(dayBtn(25).dataset.altOnly).toBe('true'))
    expect(dayBtn(25).getAttribute('aria-label')).toMatch(
      /: not enough places for 3 people, other activities available/,
    )
    expect(dayBtn(20).getAttribute('aria-label')).toMatch(/: fully booked, other activities available$/)
  })

  it('no dot, no legend and a disabled day when the alternative is also full', async () => {
    mocks.getProductAlternatives.mockResolvedValue([alt(['2026-05-22'])])
    await renderPicker()
    await waitFor(() => expect(mocks.getProductAlternatives).toHaveBeenCalled())
    expect(dayBtn(20)).toBeDisabled()
    expect(dayBtn(20).dataset.altOnly).toBeUndefined()
    expect(screen.queryByTestId('alt-only-legend')).toBeNull()
  })

  it('no dot without any alternatives', async () => {
    mocks.getProductAlternatives.mockResolvedValue([])
    await renderPicker()
    expect(dayBtn(20)).toBeDisabled()
    expect(screen.queryByTestId('alt-only-dot')).toBeNull()
    expect(screen.queryByTestId('alt-only-legend')).toBeNull()
  })

  it('reuses the panel request: one fetch per month, not two', async () => {
    mocks.getProductAlternatives.mockResolvedValue([alt(['2026-05-20'])])
    await renderPicker()
    await waitFor(() => expect(dayBtn(20).dataset.altOnly).toBe('true'))
    expect(mocks.getProductAlternatives).toHaveBeenCalledTimes(1)
  })

  it('clicking a full day shows the notice and the panel, and keeps Continue disabled', async () => {
    mocks.getProductAlternatives.mockResolvedValue([alt(['2026-05-20', '2026-05-21'])])
    await renderPicker()
    await waitFor(() => expect(dayBtn(20).dataset.altOnly).toBe('true'))
    fireEvent.click(dayBtn(20))
    expect(screen.getByTestId('alt-only-notice')).toHaveTextContent(
      /^Tandem flight is fully booked on /,
    )
    expect(await screen.findByText('Also available on this day')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Scenic flight/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    fireEvent.click(dayBtn(21))
    expect(screen.getByTestId('alt-only-notice')).toHaveTextContent(
      /^Tandem flight is not offered on /,
    )
  })

  async function pickDotDayThenRaiseParty(next: () => Promise<ProductAlternative[]>) {
    mocks.getProductAlternatives
      .mockResolvedValueOnce([alt(['2026-05-20', '2026-05-21'])])
      .mockImplementation(next)
    render(
      <SingleDatePicker
        product={{ ...product, max_party_size: 4 }}
        showPartySizeStepper
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    )
    await waitFor(() => expect(dayBtn(21).dataset.altOnly).toBe('true'))
    fireEvent.click(dayBtn(21))
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    fireEvent.click(screen.getByTestId('party-size-increase'))
    await waitFor(() => expect(mocks.getProductAlternatives).toHaveBeenCalledTimes(2))
  }

  it('keeps Continue off while alternatives reload after a party change', async () => {
    await pickDotDayThenRaiseParty(() => new Promise(() => {}))
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(screen.getByTestId('alt-only-notice')).toBeInTheDocument()
  })

  it('keeps Continue off when the alternative is gone after a party change', async () => {
    await pickDotDayThenRaiseParty(() => Promise.resolve([]))
    await waitFor(() => expect(mocks.getProductAlternatives).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(screen.getByTestId('alt-only-notice')).toBeInTheDocument()
  })
})

describe('SingleDatePicker short day rescue', () => {
  it('dots a short day, lists alternatives for the party and keeps Continue off', async () => {
    mocks.getAvailability.mockResolvedValue([slot('2026-05-20', 1), slot('2026-05-22', 5)])
    mocks.getProductAlternatives.mockResolvedValue([alt(['2026-05-20'])])
    render(
      <SingleDatePicker
        product={{ ...product, max_party_size: 4 }}
        showPartySizeStepper
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    )
    await waitFor(() => dayBtn(22))
    fireEvent.click(screen.getByTestId('party-size-increase'))
    await waitFor(() => expect(dayBtn(20).dataset.altOnly).toBe('true'))
    expect(dayBtn(20)).not.toBeDisabled()
    fireEvent.click(dayBtn(20))
    expect(screen.getByTestId('alt-only-notice')).toHaveTextContent(/too few seats/)
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(mocks.getProductAlternatives).toHaveBeenLastCalledWith(
      'p-main',
      expect.anything(),
      expect.anything(),
      2,
    )
  })
})
