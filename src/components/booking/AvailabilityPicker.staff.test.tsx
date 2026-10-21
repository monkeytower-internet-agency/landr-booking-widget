/**
 * landr-xtkae.2: staff force-book on the time picker. Fixed-times products
 * (the solo tandem flight is single_date) were routed here from
 * SingleDatePicker, which carried the staff force-book path — so the picker
 * must keep it: with the force_book power staff can pick a full or
 * lead-time-closed time and onConfirm gets (slot, true, reasons); everyone
 * else keeps the plain one-argument call. Also pins that Continue is never
 * enabled while it would do nothing.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AvailabilitySlot, Product } from '@/api/types'
import { AvailabilityPicker } from './AvailabilityPicker'
import { StaffModeProvider } from '@/lib/staffMode.tsx'
import { ALL_STAFF_POWERS, type StaffSession } from '@/lib/staffMode'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getAvailability: vi.fn<
      (id: string, from: string, to: string) => Promise<AvailabilitySlot[]>
    >(),
  },
}))
vi.mock('@/api/client', () => ({ getAvailability: mocks.getAvailability }))

const STAFF: StaffSession = {
  active: true,
  token: 'staff.token',
  powers: ALL_STAFF_POWERS,
  operatorId: 'op-uuid-1',
}
const STAFF_NO_FORCE: StaffSession = {
  ...STAFF,
  powers: ALL_STAFF_POWERS.filter((p) => p !== 'force_book'),
}

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`

function makeProduct(over: Partial<Product> = {}): Product {
  return {
    product_id: 'p-tandem',
    slug: 'tandem-flight',
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
    daily_start_times: ['09:00', '11:00', '13:00'],
    ...over,
  }
}

function dayButton(date: Date): HTMLButtonElement {
  const match = Array.from(
    document.querySelectorAll<HTMLButtonElement>('button[data-day]'),
  ).find((b) => {
    const raw = b.dataset.day
    if (!raw) return false
    const p = new Date(raw)
    return (
      p.getFullYear() === date.getFullYear() &&
      p.getMonth() === date.getMonth() &&
      p.getDate() === date.getDate()
    )
  })
  if (!match) throw new Error(`No day button for ${isoOf(date)}`)
  return match
}

const timed = (
  date: Date,
  start: string,
  over: Partial<AvailabilitySlot> = {},
): AvailabilitySlot => ({
  availability_id: null,
  date: isoOf(date),
  start_time: start,
  end_time: null,
  capacity: 2,
  capacity_reserved: 0,
  available_seats: 2,
  status: 'open',
  activity_bookable: true,
  accommodation_bookable: null,
  ...over,
})

function renderPicker(
  session: StaffSession | undefined,
  onConfirm = vi.fn(),
  extra: Partial<React.ComponentProps<typeof AvailabilityPicker>> = {},
  product = makeProduct(),
) {
  render(
    <StaffModeProvider value={session}>
      <AvailabilityPicker
        product={product}
        onBack={() => {}}
        onConfirm={onConfirm}
        {...extra}
      />
    </StaffModeProvider>,
  )
  return onConfirm
}

describe('AvailabilityPicker — staff force-book on fixed start times (landr-xtkae.2)', () => {
  let tomorrow: Date
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))
    tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const daySlots = () => [
    timed(tomorrow, '09:00:00'),
    timed(tomorrow, '11:00:00', { available_seats: 0, capacity_reserved: 2 }),
    timed(tomorrow, '13:00:00', { activity_bookable: false }),
  ]

  it('staff with force_book can pick a FULL time and a lead-time-closed time; reasons name the gate', async () => {
    mocks.getAvailability.mockResolvedValue(daySlots())
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onConfirm = renderPicker(STAFF)
    await waitFor(() => dayButton(tomorrow))
    fireEvent.click(dayButton(tomorrow))

    const options = screen.getAllByTestId('start-time-option')
    expect(options[1]).not.toBeDisabled()
    expect(options[2]).not.toBeDisabled()

    fireEvent.click(options[1])
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('operator-override-badge')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('availability-picker-submit'))
    expect(onConfirm).toHaveBeenLastCalledWith(daySlots()[1], true, ['capacity'])

    fireEvent.click(options[2])
    fireEvent.click(screen.getByTestId('availability-picker-submit'))
    expect(onConfirm).toHaveBeenLastCalledWith(daySlots()[2], true, ['lead_time'])
  })

  it('declining the confirm selects nothing', async () => {
    mocks.getAvailability.mockResolvedValue(daySlots())
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onConfirm = renderPicker(STAFF)
    await waitFor(() => dayButton(tomorrow))
    fireEvent.click(dayButton(tomorrow))
    fireEvent.click(screen.getAllByTestId('start-time-option')[1])
    expect(screen.getByTestId('availability-picker-submit')).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('staff picking an ordinary free time is NOT a force-book (one-argument call, no badge)', async () => {
    mocks.getAvailability.mockResolvedValue(daySlots())
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onConfirm = renderPicker(STAFF)
    await waitFor(() => dayButton(tomorrow))
    fireEvent.click(dayButton(tomorrow))
    fireEvent.click(screen.getAllByTestId('start-time-option')[0])
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.queryByTestId('operator-override-badge')).toBeNull()
    fireEvent.click(screen.getByTestId('availability-picker-submit'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm.mock.calls[0]).toHaveLength(1)
  })

  it('staff can open a day whose every time is full', async () => {
    mocks.getAvailability.mockResolvedValue([
      timed(tomorrow, '09:00:00', { available_seats: 0 }),
    ])
    renderPicker(STAFF)
    await waitFor(() => dayButton(tomorrow))
    expect(dayButton(tomorrow)).not.toBeDisabled()
  })

  it('staff WITHOUT force_book and customers keep full / closed times disabled', async () => {
    for (const session of [STAFF_NO_FORCE, undefined]) {
      mocks.getAvailability.mockResolvedValue(daySlots())
      const { unmount } = (() => {
        const onConfirm = vi.fn()
        const r = render(
          <StaffModeProvider value={session}>
            <AvailabilityPicker product={makeProduct()} onBack={() => {}} onConfirm={onConfirm} />
          </StaffModeProvider>,
        )
        return r
      })()
      await waitFor(() => dayButton(tomorrow))
      fireEvent.click(dayButton(tomorrow))
      const options = screen.getAllByTestId('start-time-option')
      expect(options[1]).toBeDisabled()
      expect(options[2]).toBeDisabled()
      unmount()
    }
  })

  it('a product WITHOUT fixed times is unchanged for staff (no force path here)', async () => {
    mocks.getAvailability.mockResolvedValue([
      { ...timed(tomorrow, '09:00:00'), available_seats: 0 },
      timed(tomorrow, '11:00:00'),
    ])
    renderPicker(STAFF, vi.fn(), {}, makeProduct({
      service_time_shape: 'time_slot',
      daily_start_times: null,
    }))
    await waitFor(() => dayButton(tomorrow))
    fireEvent.click(dayButton(tomorrow))
    // The full slot is simply not offered, as before.
    expect(screen.getAllByRole('button', { name: /11:00/ })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /09:00/ })).toBeNull()
  })
})

describe('AvailabilityPicker — staff books ANY day, off-schedule confirm (landr-8ht3m.4)', () => {
  let offDay: Date
  let onDay: Date
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))
    onDay = new Date()
    onDay.setDate(onDay.getDate() + 3)
    offDay = new Date()
    offDay.setDate(offDay.getDate() + 2)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const schedule = () => [timed(onDay, '09:00:00'), timed(onDay, '11:00:00')]

  it('staff can open a day with no times; ONE confirm; the product daily times are offered; reason is off_schedule', async () => {
    mocks.getAvailability.mockResolvedValue(schedule())
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onConfirm = renderPicker(STAFF)
    await waitFor(() => dayButton(onDay))
    expect(dayButton(offDay)).not.toBeDisabled()

    fireEvent.click(dayButton(offDay))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy).toHaveBeenCalledWith('Outside your schedule — book anyway?')

    const options = screen.getAllByTestId('start-time-option')
    expect(options.map((o) => o.textContent)).toEqual(['09:00', '11:00', '13:00'])
    expect(options[1]).not.toBeDisabled()

    // Picking a time does NOT ask again.
    fireEvent.click(options[1])
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('operator-override-badge')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('availability-picker-submit'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [slot, forced, reasons] = onConfirm.mock.calls[0]
    expect(slot).toMatchObject({
      availability_id: null,
      date: isoOf(offDay),
      start_time: '11:00:00',
    })
    expect(forced).toBe(true)
    expect(reasons).toEqual(['off_schedule'])
  })

  it('declining the confirm opens nothing', async () => {
    mocks.getAvailability.mockResolvedValue(schedule())
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPicker(STAFF)
    await waitFor(() => dayButton(onDay))
    fireEvent.click(dayButton(offDay))
    expect(screen.queryAllByTestId('start-time-option')).toHaveLength(0)
  })

  it('a scheduled day needs no confirm and is not a force-book', async () => {
    mocks.getAvailability.mockResolvedValue(schedule())
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onConfirm = renderPicker(STAFF)
    await waitFor(() => dayButton(onDay))
    fireEvent.click(dayButton(onDay))
    fireEvent.click(screen.getAllByTestId('start-time-option')[0])
    expect(confirmSpy).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('availability-picker-submit'))
    expect(onConfirm.mock.calls[0]).toHaveLength(1)
  })

  it('past days stay disabled for staff', async () => {
    mocks.getAvailability.mockResolvedValue(schedule())
    renderPicker(STAFF)
    await waitFor(() => dayButton(onDay))
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(dayButton(yesterday)).toBeDisabled()
  })

  it('customers and staff WITHOUT force_book still cannot open an off-schedule day', async () => {
    for (const session of [STAFF_NO_FORCE, undefined]) {
      mocks.getAvailability.mockResolvedValue(schedule())
      const { unmount } = render(
        <StaffModeProvider value={session}>
          <AvailabilityPicker product={makeProduct()} onBack={() => {}} onConfirm={vi.fn()} />
        </StaffModeProvider>,
      )
      await waitFor(() => dayButton(onDay))
      expect(dayButton(offDay)).toBeDisabled()
      unmount()
    }
  })
})

describe('AvailabilityPicker — Continue never enabled while it would do nothing (landr-xtkae.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a restored time that has filled up meanwhile leaves Continue disabled for a customer', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const wasFree = timed(tomorrow, '11:00:00')
    mocks.getAvailability.mockResolvedValue([
      timed(tomorrow, '09:00:00'),
      { ...wasFree, available_seats: 0 },
    ])
    renderPicker(undefined, vi.fn(), { initialSlot: wasFree })
    await waitFor(() => expect(screen.getAllByTestId('start-time-option')).toHaveLength(2))
    expect(screen.getByTestId('availability-picker-submit')).toBeDisabled()
  })

  it('a restored time that is still free keeps Continue enabled', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const slot = timed(tomorrow, '11:00:00')
    mocks.getAvailability.mockResolvedValue([timed(tomorrow, '09:00:00'), slot])
    const onConfirm = renderPicker(undefined, vi.fn(), { initialSlot: slot })
    await waitFor(() => expect(screen.getAllByTestId('start-time-option')).toHaveLength(2))
    const cont = screen.getByTestId('availability-picker-submit')
    expect(cont).not.toBeDisabled()
    fireEvent.click(cont)
    expect(onConfirm).toHaveBeenCalledWith(slot)
  })
})

describe('AvailabilityPicker — "start time passed today" uses the operator clock (landr-8ht3m.9)', () => {
  const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
  const realTz = env.TZ
  // 2026-05-16T09:30Z is 23:30 on May 15 in Honolulu and 11:30 on May 16 in Berlin.
  const NOW = new Date('2026-05-16T09:30:00Z')

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    // A day with schedule rows elsewhere, so the 16th is off-schedule.
    mocks.getAvailability.mockResolvedValue([
      { ...timed(NOW, '09:00:00'), date: '2026-05-20' },
    ])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    if (realTz === undefined) delete env.TZ
    else env.TZ = realTz
  })

  async function offeredTimes(browserTz: string, operatorTz: string | null) {
    env.TZ = browserTz
    // Built after the zone switch: a Date made earlier would be a different local day.
    const may16 = new Date(2026, 4, 16)
    renderPicker(STAFF, vi.fn(), { operatorTimezone: operatorTz })
    await waitFor(() => dayButton(may16))
    fireEvent.click(dayButton(may16))
    return screen.queryAllByTestId('start-time-option').map((o) => o.textContent)
  }

  it('operator ahead of the browser: today is the operator day, so passed times are hidden', async () => {
    // The browser still reads May 15, so the old browser-clock check offered all three.
    expect(await offeredTimes('Pacific/Honolulu', 'Europe/Berlin')).toEqual(['13:00'])
  })

  it('operator behind the browser: the browser "today" is still the operator future, so every time is offered', async () => {
    // The browser reads 11:30 on May 16 and used to hide 09:00 and 11:00.
    expect(await offeredTimes('Europe/Berlin', 'Pacific/Honolulu')).toEqual([
      '09:00',
      '11:00',
      '13:00',
    ])
  })

  it('no operator timezone falls back to the browser clock', async () => {
    expect(await offeredTimes('Europe/Berlin', null)).toEqual(['13:00'])
  })
})

describe('AvailabilityPicker — staff types a free start time on a plain time_slot product (landr-8ht3m.5)', () => {
  let offDay: Date
  let onDay: Date
  const plain = () =>
    makeProduct({ service_time_shape: 'time_slot', daily_start_times: null })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))
    onDay = new Date()
    onDay.setDate(onDay.getDate() + 3)
    offDay = new Date()
    offDay.setDate(offDay.getDate() + 2)
    mocks.getAvailability.mockResolvedValue([timed(onDay, '10:00:00', { availability_id: 'row-1' })])
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('an off-schedule day shows a time input, confirms once, and commits the typed HH:MM as a forced off_schedule slot', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onConfirm = renderPicker(STAFF, vi.fn(), {}, plain())
    await waitFor(() => dayButton(onDay))
    expect(dayButton(offDay)).not.toBeDisabled()

    fireEvent.click(dayButton(offDay))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy).toHaveBeenCalledWith('Outside your schedule — book anyway?')
    expect(screen.queryAllByTestId('start-time-option')).toHaveLength(0)
    expect(screen.getByTestId('availability-picker-submit')).toBeDisabled()

    fireEvent.change(screen.getByTestId('free-start-time'), { target: { value: '14:30' } })
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('operator-override-badge')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('availability-picker-submit'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [slot, forced, reasons] = onConfirm.mock.calls[0]
    expect(slot).toMatchObject({
      availability_id: null,
      date: isoOf(offDay),
      start_time: '14:30:00',
    })
    expect(forced).toBe(true)
    expect(reasons).toEqual(['off_schedule'])
  })

  it('an incomplete time keeps Continue disabled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPicker(STAFF, vi.fn(), {}, plain())
    await waitFor(() => dayButton(onDay))
    fireEvent.click(dayButton(offDay))
    const input = screen.getByTestId('free-start-time')
    fireEvent.change(input, { target: { value: '' } })
    expect(screen.getByTestId('availability-picker-submit')).toBeDisabled()
  })

  it('declining the confirm opens nothing', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPicker(STAFF, vi.fn(), {}, plain())
    await waitFor(() => dayButton(onDay))
    fireEvent.click(dayButton(offDay))
    expect(screen.queryByTestId('free-start-time')).toBeNull()
  })

  it('a day that has slot rows keeps its normal slot buttons, with no time input', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onConfirm = renderPicker(STAFF, vi.fn(), {}, plain())
    await waitFor(() => dayButton(onDay))
    fireEvent.click(dayButton(onDay))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.queryByTestId('free-start-time')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /10:00/ }))
    fireEvent.click(screen.getByTestId('availability-picker-submit'))
    expect(onConfirm.mock.calls[0]).toHaveLength(1)
  })

  it('a time that already passed today is refused', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const today = new Date()
    renderPicker(STAFF, vi.fn(), { operatorTimezone: 'UTC' }, plain())
    await waitFor(() => dayButton(onDay))
    fireEvent.click(dayButton(today))
    // 12:00 UTC "now": 09:00 has passed, 18:00 has not.
    fireEvent.change(screen.getByTestId('free-start-time'), { target: { value: '09:00' } })
    expect(screen.getByTestId('free-start-time-past')).toBeInTheDocument()
    expect(screen.getByTestId('availability-picker-submit')).toBeDisabled()
    fireEvent.change(screen.getByTestId('free-start-time'), { target: { value: '18:00' } })
    expect(screen.queryByTestId('free-start-time-past')).toBeNull()
    expect(screen.getByTestId('availability-picker-submit')).not.toBeDisabled()
  })

  it('customers and staff WITHOUT force_book cannot open an off-schedule day or type a time', async () => {
    for (const session of [STAFF_NO_FORCE, undefined]) {
      mocks.getAvailability.mockResolvedValue([timed(onDay, '10:00:00', { availability_id: 'row-1' })])
      const { unmount } = render(
        <StaffModeProvider value={session}>
          <AvailabilityPicker product={plain()} onBack={() => {}} onConfirm={vi.fn()} />
        </StaffModeProvider>,
      )
      await waitFor(() => dayButton(onDay))
      expect(dayButton(offDay)).toBeDisabled()
      expect(screen.queryByTestId('free-start-time')).toBeNull()
      unmount()
    }
  })

  it('a fixed-times product still offers its own times, never a free input', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mocks.getAvailability.mockResolvedValue([timed(onDay, '09:00:00')])
    renderPicker(STAFF)
    await waitFor(() => dayButton(onDay))
    fireEvent.click(dayButton(offDay))
    expect(screen.queryByTestId('free-start-time')).toBeNull()
    expect(screen.getAllByTestId('start-time-option').length).toBeGreaterThan(0)
  })
})
