import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AvailabilitySlot,
  FixedDateWindow,
  Product,
  ProductAlternative,
} from '@/api/types'
import { ALTERNATIVES_SLOT_ID } from './alternativesSlot'
import {
  courseRowsFor,
  dayRowsFor,
  mergeAlternatives,
  monthRange,
} from './alternatives'
import { AvailabilityPicker } from './AvailabilityPicker'
import { FixedDateWindowPicker } from './FixedDateWindowPicker'
import { FullyBookedNotice } from './FullyBookedNotice'
import { MultiDayStep } from './MultiDayStep'
import { SingleDatePicker } from './SingleDatePicker'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getAvailability: vi.fn<(...a: unknown[]) => Promise<AvailabilitySlot[]>>(),
    getFixedDateWindows: vi.fn<(...a: unknown[]) => Promise<FixedDateWindow[]>>(),
    getProductAlternatives:
      vi.fn<
        (id: string, from: string, to: string, party?: number) => Promise<ProductAlternative[]>
      >(),
  },
}))

vi.mock('@/api/client', () => ({
  getAvailability: mocks.getAvailability,
  getFixedDateWindows: mocks.getFixedDateWindows,
  getProductAlternatives: mocks.getProductAlternatives,
}))

const slot = (iso: string): AvailabilitySlot => ({
  availability_id: `slot-${iso}`,
  date: iso,
  start_time: null,
  end_time: null,
  capacity: 5,
  capacity_reserved: 0,
  available_seats: 5,
  status: 'open',
})

const product = (shape: Product['service_time_shape'], id = 'p-main'): Product =>
  ({
    product_id: id,
    slug: 'main',
    name: 'Main product',
    product_kind: 'service',
    service_time_shape: shape,
    is_contiguous: false,
    hotel_offering: 'none',
  }) as unknown as Product

const thermal: ProductAlternative = {
  product_id: 'p-thermal',
  slug: 'thermal',
  name: 'Thermal flight',
  service_time_shape: 'single_date',
  thumb_url: 'https://example.com/t.jpg',
  price_from: '179.00',
  currency: 'EUR',
  available_dates: ['2026-05-20', '2026-05-21'],
}
const action: ProductAlternative = {
  product_id: 'p-action',
  slug: 'action',
  name: 'Action flight',
  service_time_shape: 'single_date',
  price_from: '189.00',
  currency: 'EUR',
  available_dates: ['2026-05-21'],
}
const course: ProductAlternative = {
  product_id: 'p-course',
  slug: 'course',
  name: 'Beginner course',
  service_time_shape: 'fixed_window',
  price_from: '450.00',
  currency: 'EUR',
  windows: [
    { id: 'w1', start_date: '2026-05-25', end_date: '2026-05-27', available_seats: 4 },
    { id: 'w2', start_date: '2026-06-08', end_date: '2026-06-10', available_seats: 4 },
  ],
}

// The picker opens on today's month, so the 20th of that month is pickable.
const DAY = '2026-05-20'

function pickDay(n: number) {
  const btn = Array.from(
    document.querySelectorAll<HTMLButtonElement>('button[data-day]'),
  ).find((b) => new Date(b.dataset.day ?? '').getDate() === n)
  if (!btn) throw new Error(`no day ${n}`)
  fireEvent.click(btn)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))
  mocks.getAvailability.mockResolvedValue(
    ['2026-05-20', '2026-05-21', '2026-05-22'].map(slot),
  )
  mocks.getProductAlternatives.mockResolvedValue([thermal, action, course])
})
afterEach(() => {
  vi.useRealTimers()
  document.getElementById(ALTERNATIVES_SLOT_ID)?.remove()
})

describe('alternatives helpers', () => {
  it('shows a day alternative only when open on every selected day', () => {
    const alts = [thermal, action, course]
    expect(dayRowsFor(alts, [])).toEqual([])
    expect(dayRowsFor(alts, ['2026-05-21']).map((r) => r.key)).toEqual([
      'p-thermal',
      'p-action',
    ])
    expect(dayRowsFor(alts, ['2026-05-20', '2026-05-21']).map((r) => r.key)).toEqual([
      'p-thermal',
    ])
  })

  it('lists one course row per window starting in the visible month', () => {
    const rows = courseRowsFor([thermal, course], ['2026-05'])
    expect(rows.map((r) => [r.key, r.startDate])).toEqual([
      ['p-course:w1', '2026-05-25'],
    ])
  })

  it('merges months by product and clamps the range to today', () => {
    const merged = mergeAlternatives([
      [{ ...thermal, available_dates: ['2026-05-20'] }],
      [{ ...thermal, available_dates: ['2026-06-02'] }],
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.available_dates).toEqual(['2026-05-20', '2026-06-02'])
    expect(monthRange('2026-05', '2026-05-15')).toEqual({
      from: '2026-05-15',
      to: '2026-05-31',
    })
    expect(monthRange('2026-04', '2026-05-15')).toBeNull()
  })
})

describe('SingleDatePicker panel', () => {
  it('stays hidden until a day is picked, then lists rows in order with price', async () => {
    const onSelectAlternative = vi.fn()
    render(
      <SingleDatePicker
        product={product('single_date')}
        onConfirm={() => {}}
        onSelectAlternative={onSelectAlternative}
      />,
    )
    await waitFor(() => expect(mocks.getProductAlternatives).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Pick a date')).toBeInTheDocument())
    // Courses starting this month show even before a day is picked.
    expect(screen.queryByText('Also available on this day')).toBeNull()
    pickDay(21)
    expect(await screen.findByText('Also available on this day')).toBeInTheDocument()
    const row = screen.getByRole('button', { name: 'Thermal flight, from €179.00' })
    expect(screen.getByRole('button', { name: 'Action flight, from €189.00' })).toBeInTheDocument()
    expect(row.querySelector('img')).not.toBeNull()
    fireEvent.click(row)
    expect(onSelectAlternative).toHaveBeenCalledWith(
      expect.objectContaining({ product: thermal, date: expect.stringMatching(/-21$/) }),
    )
    // Picking another day drops an alternative that is not open there.
    pickDay(20)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Action flight/ })).toBeNull(),
    )
    expect(DAY).toBe('2026-05-20')
  })

  it('lists courses starting in the visible month with their start date', async () => {
    render(<SingleDatePicker product={product('single_date')} onConfirm={() => {}} />)
    expect(await screen.findByText('Also starting in May')).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /Beginner course, Starts .*25.*, from €450\.00/ })
        .length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText(/Jun/)).toBeNull()
  })

  it('renders no panel and no wrapper when nothing is linked', async () => {
    mocks.getProductAlternatives.mockResolvedValue([])
    render(<SingleDatePicker product={product('single_date')} onConfirm={() => {}} />)
    await waitFor(() => expect(mocks.getProductAlternatives).toHaveBeenCalled())
    pickDay(21)
    await waitFor(() => expect(screen.getByTestId('single-date-selected')).toBeInTheDocument())
    expect(screen.queryByTestId('alternatives-panel-mobile')).toBeNull()
    expect(screen.queryByTestId('alternatives-panel-desktop')).toBeNull()
  })

  it('fetches again for a month not seen yet and caches the ones it has', async () => {
    render(<SingleDatePicker product={product('single_date')} onConfirm={() => {}} />)
    await waitFor(() => expect(mocks.getProductAlternatives).toHaveBeenCalledTimes(1))
    expect(mocks.getProductAlternatives.mock.calls[0]?.slice(0, 3)).toEqual([
      'p-main',
      '2026-05-15',
      '2026-05-31',
    ])
    await waitFor(() => expect(document.querySelector('button[data-day]')).not.toBeNull())
    const next = await screen.findByRole('button', { name: /next month/i })
    await waitFor(() => expect(next).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /next month/i }))
    await waitFor(() => expect(mocks.getProductAlternatives).toHaveBeenCalledTimes(2))
    expect(mocks.getProductAlternatives.mock.calls[1]?.slice(1, 3)).toEqual([
      '2026-06-01',
      '2026-06-30',
    ])
    fireEvent.click(screen.getByRole('button', { name: /previous month/i }))
    await screen.findByText('Also starting in May')
    expect(mocks.getProductAlternatives).toHaveBeenCalledTimes(2)
  })

  it('puts the strip under the calendar alone, or in the desktop slot too', async () => {
    const { unmount } = render(
      <SingleDatePicker product={product('single_date')} onConfirm={() => {}} />,
    )
    const strip = await screen.findByTestId('alternatives-panel-mobile')
    expect(strip.className).not.toContain('md:hidden')
    expect(screen.queryByTestId('alternatives-panel-desktop')).toBeNull()
    // The strip sits above Continue.
    const submit = screen.getByTestId('single-date-picker-submit')
    expect(
      strip.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    unmount()

    const slotEl = document.createElement('div')
    slotEl.id = ALTERNATIVES_SLOT_ID
    document.body.appendChild(slotEl)
    render(<SingleDatePicker product={product('single_date')} onConfirm={() => {}} />)
    const mobile = await screen.findByTestId('alternatives-panel-mobile')
    expect(mobile.className).toContain('md:hidden')
    const desktop = await screen.findByTestId('alternatives-panel-desktop')
    expect(slotEl.contains(desktop)).toBe(true)
  })

  it('scrolls instead of growing: every row is rendered, none capped', async () => {
    const many: ProductAlternative[] = Array.from({ length: 12 }, (_, i) => ({
      ...thermal,
      product_id: `p-${i}`,
      name: `Flight ${i}`,
    }))
    mocks.getProductAlternatives.mockResolvedValue(many)
    render(<SingleDatePicker product={product('single_date')} onConfirm={() => {}} />)
    await waitFor(() => expect(mocks.getProductAlternatives).toHaveBeenCalled())
    pickDay(21)
    await screen.findByText('Flight 11')
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(12)
    const strip = screen.getByTestId('alternatives-panel-mobile').querySelector('ul')
    expect(strip?.className).toContain('overflow-x-auto')
  })
})

describe('AvailabilityPicker panel', () => {
  it('lists alternatives open on the picked day', async () => {
    mocks.getAvailability.mockResolvedValue([
      { ...slot('2026-05-21'), start_time: '09:00:00', end_time: '10:00:00' },
    ])
    render(<AvailabilityPicker product={product('time_slot')} onConfirm={() => {}} />)
    await waitFor(() => expect(document.querySelector('button[data-day]')).not.toBeNull())
    expect(screen.queryByText('Also available on this day')).toBeNull()
    pickDay(21)
    expect(await screen.findByText('Also available on this day')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Action flight/ })).toBeInTheDocument()
  })
})

describe('MultiDayStep panel', () => {
  it('needs the alternative open on all selected days', async () => {
    render(<MultiDayStep product={product('days_range')} onConfirm={() => {}} />)
    await waitFor(() => expect(mocks.getProductAlternatives).toHaveBeenCalled())
    await waitFor(() => expect(document.querySelector('button[data-day]')).not.toBeNull())
    pickDay(20)
    pickDay(21)
    await screen.findByText('Also available on these days')
    expect(screen.getByRole('button', { name: /Thermal flight/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Action flight/ })).toBeNull()
  })
})

describe('FixedDateWindowPicker panel', () => {
  it('shows day alternatives for the picked window and courses of its month', async () => {
    mocks.getFixedDateWindows.mockResolvedValue([
      {
        id: 'w-main',
        start_date: '2026-05-20',
        end_date: '2026-05-21',
        capacity: 8,
        capacity_reserved: 0,
      } as FixedDateWindow,
    ])
    render(<FixedDateWindowPicker product={product('fixed_window')} onConfirm={() => {}} />)
    await screen.findByText(/May 20, 2026/)
    expect(await screen.findByText('Also starting in May')).toBeInTheDocument()
    expect(screen.queryByText('Also available on these days')).toBeNull()
    fireEvent.click(screen.getByText(/May 20, 2026/))
    await screen.findByText('Also available on these days')
    expect(screen.getByRole('button', { name: /Thermal flight/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Action flight/ })).toBeNull()
  })
})

describe('FullyBookedNotice panel', () => {
  it('lists what is open instead when the product is fully booked', async () => {
    render(<FullyBookedNotice name="Main product" productId="p-main" />)
    expect(await screen.findByText('Also available')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Thermal flight/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Beginner course/ })).toHaveLength(2)
  })

  it('starts the alternatives range at the operator today, not the browser clock', async () => {
    // 12:00 UTC on May 15 is already May 16 in Kiritimati (UTC+14).
    render(
      <FullyBookedNotice
        name="Main product"
        productId="p-main"
        operatorTimezone="Pacific/Kiritimati"
      />,
    )
    await waitFor(() => expect(mocks.getProductAlternatives).toHaveBeenCalled())
    expect(mocks.getProductAlternatives.mock.calls[0]?.[1]).toBe('2026-05-16')
  })

  it('shows nothing extra in the compact catalogue card', () => {
    render(<FullyBookedNotice name="Main product" productId="p-main" compact />)
    expect(mocks.getProductAlternatives).not.toHaveBeenCalled()
  })
})

describe('dot day wording', () => {
  it('says "not offered" where the product has no slot and "fully booked" where it is full', async () => {
    mocks.getAvailability.mockResolvedValue([
      { ...slot('2026-05-21'), available_seats: 0, status: 'full' } as AvailabilitySlot,
    ])
    render(<SingleDatePicker product={product('single_date')} onConfirm={() => {}} />)
    await waitFor(() => expect(mocks.getProductAlternatives).toHaveBeenCalled())
    const label = async (n: number) => {
      await waitFor(() => {
        const b = Array.from(
          document.querySelectorAll<HTMLButtonElement>('button[data-alt-only]'),
        ).find((x) => new Date(x.dataset.day ?? '').getDate() === n)
        expect(b).toBeTruthy()
      })
      return Array.from(
        document.querySelectorAll<HTMLButtonElement>('button[data-alt-only]'),
      ).find((x) => new Date(x.dataset.day ?? '').getDate() === n)?.getAttribute('aria-label')
    }
    expect(await label(20)).toContain('not offered, other activities available')
    expect(await label(21)).toContain('fully booked, other activities available')
  })
})

describe('AlternativesSection max-guests chip (landr-kb7mh)', () => {
  it('shows the chip on a stay alternative only', async () => {
    const { AlternativesSection } = await import('./AlternativesPanel')
    const mk = (id: string, extra: Partial<ProductAlternative>): ProductAlternative => ({
      product_id: id,
      slug: id,
      name: id,
      service_time_shape: 'single_date',
      available_dates: ['2026-11-10'],
      windows: null,
      ...extra,
    })
    render(
      <AlternativesSection
        productId="p"
        selectedDays={['2026-11-10']}
        alternatives={[
          mk('loft', { product_kind: 'stay', capacity_per_unit: 4 }),
          mk('tour', { product_kind: 'service', capacity_per_unit: 4 }),
        ]}
      />,
    )
    expect(screen.getAllByTestId('max-guests-chip')[0]).toHaveTextContent('max. 4 guests')
    expect(screen.getAllByTestId('alternative-row-loft').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('max-guests-chip').length).toBe(1)
  })
})
