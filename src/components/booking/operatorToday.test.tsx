/**
 * landr-8ht3m.12: the calendars' "today" (past-day disabling and the start of
 * the availability fetch window) is the OPERATOR's calendar day, not the
 * browser's. A fake TZ puts the browser on the other side of midnight.
 */
import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AvailabilitySlot, Product } from '@/api/types'
import { AvailabilityPicker } from './AvailabilityPicker'
import { SingleDatePicker } from './SingleDatePicker'
import { availabilityWindow, startOfToday } from './calendarStart'
import { StaffModeProvider } from '@/lib/staffMode.tsx'
import { ALL_STAFF_POWERS, type StaffSession } from '@/lib/staffMode'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getAvailability: vi.fn<
      (id: string, from: string, to: string) => Promise<AvailabilitySlot[]>
    >(),
  },
}))
vi.mock('@/api/client', () => ({ getAvailability: mocks.getAvailability, getProductAlternatives: vi.fn().mockResolvedValue([]) }))

const STAFF: StaffSession = {
  active: true,
  token: 'staff.token',
  powers: ALL_STAFF_POWERS,
  operatorId: 'op-uuid-1',
}

// 2026-05-16T09:30Z is 11:30 on May 16 in Berlin and 23:30 on May 15 in Honolulu.
const NOW = new Date('2026-05-16T09:30:00Z')
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const realTz = env.TZ

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
    ...over,
  }
}

// react-day-picker stamps data-day as M/D/YYYY (no zero padding).
function dayButton(iso: string): HTMLButtonElement {
  const [y, m, d] = iso.split('-').map(Number)
  const stamp = `${m}/${d}/${y}`
  const match = Array.from(
    document.querySelectorAll<HTMLButtonElement>('button[data-day]'),
  ).find((b) => b.dataset.day === stamp)
  if (!match) throw new Error(`No day button for ${iso}`)
  return match
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  mocks.getAvailability.mockResolvedValue([])
})
afterEach(() => {
  vi.useRealTimers()
  if (realTz === undefined) delete env.TZ
  else env.TZ = realTz
})

describe('startOfToday / availabilityWindow with an operator zone', () => {
  it('browser behind the operator: today is the operator day', () => {
    env.TZ = 'Pacific/Honolulu' // browser still on May 15
    expect(startOfToday('Europe/Berlin')).toEqual(new Date(2026, 4, 16))
    expect(availabilityWindow(startOfToday('Europe/Berlin')).fromIso).toBe('2026-05-16')
  })

  it('browser ahead of the operator: today is still the operator day', () => {
    env.TZ = 'Europe/Berlin' // browser already on May 16
    expect(startOfToday('Pacific/Honolulu')).toEqual(new Date(2026, 4, 15))
    expect(availabilityWindow(startOfToday('Pacific/Honolulu')).fromIso).toBe('2026-05-15')
  })

  it('missing or unknown zone falls back to the browser clock', () => {
    env.TZ = 'Pacific/Honolulu'
    expect(startOfToday(null)).toEqual(new Date(2026, 4, 15))
    expect(startOfToday(undefined)).toEqual(new Date(2026, 4, 15))
    expect(startOfToday('Not/AZone')).toEqual(new Date(2026, 4, 15))
  })
})

describe('SingleDatePicker past-day disabling (staff force-book opens every non-past day)', () => {
  function renderStaff(operatorTimezone: string | null) {
    render(
      <StaffModeProvider value={STAFF}>
        <SingleDatePicker
          product={makeProduct()}
          onBack={() => {}}
          onConfirm={() => {}}
          operatorTimezone={operatorTimezone}
        />
      </StaffModeProvider>,
    )
  }

  it('operator ahead of the browser: the browser "today" is already past', async () => {
    env.TZ = 'Pacific/Honolulu'
    renderStaff('Europe/Berlin')
    await waitFor(() => expect(mocks.getAvailability).toHaveBeenCalled())
    expect(mocks.getAvailability.mock.calls[0]![1]).toBe('2026-05-16')
    await waitFor(() => dayButton('2026-05-15'))
    expect(dayButton('2026-05-15')).toBeDisabled()
    expect(dayButton('2026-05-16')).not.toBeDisabled()
  })

  it('operator behind the browser: the operator "today" is still open', async () => {
    env.TZ = 'Europe/Berlin'
    renderStaff('Pacific/Honolulu')
    await waitFor(() => expect(mocks.getAvailability).toHaveBeenCalled())
    expect(mocks.getAvailability.mock.calls[0]![1]).toBe('2026-05-15')
    await waitFor(() => dayButton('2026-05-15'))
    expect(dayButton('2026-05-15')).not.toBeDisabled()
  })

  it('no operator zone keeps the browser clock', async () => {
    env.TZ = 'Pacific/Honolulu'
    renderStaff(null)
    await waitFor(() => expect(mocks.getAvailability).toHaveBeenCalled())
    expect(mocks.getAvailability.mock.calls[0]![1]).toBe('2026-05-15')
    await waitFor(() => dayButton('2026-05-15'))
    expect(dayButton('2026-05-15')).not.toBeDisabled()
  })
})

describe('AvailabilityPicker past-day disabling and fetch window', () => {
  function renderFixedTimes(operatorTimezone: string | null) {
    render(
      <StaffModeProvider value={STAFF}>
        <AvailabilityPicker
          product={makeProduct({ daily_start_times: ['09:00', '13:00'] })}
          onBack={() => {}}
          onConfirm={() => {}}
          operatorTimezone={operatorTimezone}
        />
      </StaffModeProvider>,
    )
  }

  it('fetches from the operator day and disables the operator past', async () => {
    env.TZ = 'Pacific/Honolulu'
    renderFixedTimes('Europe/Berlin')
    await waitFor(() => expect(mocks.getAvailability).toHaveBeenCalled())
    expect(mocks.getAvailability.mock.calls[0]![1]).toBe('2026-05-16')
    await waitFor(() => dayButton('2026-05-15'))
    expect(dayButton('2026-05-15')).toBeDisabled()
    expect(dayButton('2026-05-16')).not.toBeDisabled()
  })
})
