/**
 * StayRangePicker under non-UTC browser timezones. Runs in the `tz-*` vitest
 * projects (vitest.config.ts: forks pool, TZ set per project — a TZ set
 * inside a file is ignored by the threads pool), once under Pacific/Auckland
 * and once under America/Los_Angeles: the nights the customer clicks must
 * reach onConfirm as the same ISO dates whatever the browser's offset.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { AvailabilitySlot, Product } from '@/api/types'
import { StayRangePicker } from './StayRangePicker'
import { startOfToday } from './calendarStart'
import { dateFromIso, isoDate } from './dateUtils'

const OPERATOR_TZ = 'Atlantic/Canary'
// A whole calendar renders per step; keep a loaded runner from timing out.
vi.setConfig({ testTimeout: 30_000 })
const SLOW = { timeout: 8000 }
// The app tsconfig carries no @types/node.
const HOST_TZ = (
  globalThis as unknown as { process: { env: Record<string, string | undefined> } }
).process.env.TZ

function addDays(iso: string, n: number): string {
  const d = dateFromIso(iso)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

const TODAY = isoDate(startOfToday(OPERATOR_TZ))

function makeStay(): Product {
  return {
    product_id: 'p-stay',
    slug: 'sea-view-apartment',
    name: 'Sea view apartment',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'stay',
    service_time_shape: null,
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
    stay: {
      min_nights: 2,
      max_nights: null,
      cleaning_fee_cents: 3000,
      check_in_time: '15:00',
      check_out_time: '11:00',
      sleeps: 4,
    },
  }
}

/** 40 nights from today; the night of today+5 is taken (another guest arrives). */
function nights(): AvailabilitySlot[] {
  return Array.from({ length: 40 }, (_, i) => {
    const date = addDays(TODAY, i)
    return {
      availability_id: null,
      date,
      start_time: '15:00:00',
      end_time: '11:00:00',
      capacity: 1,
      capacity_reserved: 0,
      available_seats: i === 5 ? 0 : 1,
      status: 'open',
      activity_bookable: true,
    }
  })
}

/** The Calendar stamps each day button with the LOCAL date's toLocaleDateString(). */
function dayButton(iso: string): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(
    `button[data-day="${dateFromIso(iso).toLocaleDateString()}"]`,
  )
}

async function clickDay(iso: string) {
  for (let i = 0; i < 3; i += 1) {
    const btn = dayButton(iso)
    if (btn) {
      fireEvent.click(btn)
      return
    }
    fireEvent.click(screen.getByRole('button', { name: /next month/i }))
  }
  throw new Error(`no day button for ${iso}`)
}

describe(`StayRangePicker in ${HOST_TZ ?? 'default'} (operator ${OPERATOR_TZ})`, () => {
  it('runs in the timezone its project configured', () => {
    // Guards the project wiring itself: a threads-pool run would silently
    // stay on the host zone and prove nothing.
    expect(HOST_TZ).toBeTruthy()
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(HOST_TZ)
  })

  it('confirms the clicked nights as ISO dates; check-out may land on a taken night', async () => {
    const onConfirm = vi.fn()
    render(
      <StayRangePicker
        product={makeStay()}
        operatorTimezone={OPERATOR_TZ}
        onConfirm={onConfirm}
        loadAvailability={() => Promise.resolve(nights())}
      />,
    )
    await waitFor(() =>
      expect(dayButton(TODAY)).not.toBeNull(),
    SLOW)
    await clickDay(addDays(TODAY, 2))
    await clickDay(addDays(TODAY, 5))
    const submit = screen.getByTestId('stay-picker-submit')
    await waitFor(() => expect(submit).not.toBeDisabled(), SLOW)
    fireEvent.click(submit)
    expect(onConfirm).toHaveBeenCalledWith([
      addDays(TODAY, 2),
      addDays(TODAY, 3),
      addDays(TODAY, 4),
    ])
  })

  it('refuses a range over a taken night', async () => {
    const onConfirm = vi.fn()
    render(
      <StayRangePicker
        product={makeStay()}
        operatorTimezone={OPERATOR_TZ}
        onConfirm={onConfirm}
        loadAvailability={() => Promise.resolve(nights())}
      />,
    )
    await waitFor(() =>
      expect(dayButton(TODAY)).not.toBeNull(),
    SLOW)
    await clickDay(addDays(TODAY, 4))
    await clickDay(addDays(TODAY, 7))
    expect(await screen.findByTestId('stay-picker-errors', undefined, SLOW)).toBeInTheDocument()
    expect(screen.getByTestId('stay-picker-submit')).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
