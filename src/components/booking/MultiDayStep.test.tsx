/**
 * landr-f987a.1: an invited guest must not be able to continue with a day that
 * is fully booked, and never sees operator-override chrome. Staff force-book
 * behaviour stays covered by MultiDayPicker.staff.test.tsx.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AvailabilitySlot, Product } from '@/api/types'
import { getAvailability } from '@/api/client'
import { MultiDayStep } from './MultiDayStep'
import { StaffModeProvider } from '@/lib/staffMode.tsx'
import { ALL_STAFF_POWERS } from '@/lib/staffMode'
import { isoDate } from './dateUtils'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return { ...actual, getAvailability: vi.fn() }
})

const dayFromNow = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}
const FULL = isoDate(dayFromNow(10))
const OPEN_A = isoDate(dayFromNow(11))
const OPEN_B = isoDate(dayFromNow(12))

const slot = (iso: string, available: number): AvailabilitySlot => ({
  availability_id: `slot-${iso}`,
  date: iso,
  start_time: null,
  end_time: null,
  capacity: 5,
  capacity_reserved: 5 - available,
  available_seats: available,
  status: available > 0 ? 'open' : 'fully_booked',
})

const PRODUCT = {
  product_id: 'p1',
  name: 'Tandem',
  is_contiguous: false,
  hotel_offering: 'none',
} as unknown as Product

beforeEach(() => {
  vi.mocked(getAvailability).mockResolvedValue([
    slot(FULL, 0),
    slot(OPEN_A, 5),
    slot(OPEN_B, 5),
  ])
})

describe('MultiDayStep — invite with a now-full host day', () => {
  it('Change dates drops the full day, shows the notice, and Continue works', async () => {
    const onConfirm = vi.fn()
    const onLiveDaysChange = vi.fn()
    render(
      <MultiDayStep
        product={PRODUCT}
        onConfirm={onConfirm}
        onLiveDaysChange={onLiveDaysChange}
        originalDays={[FULL, OPEN_A]}
        originalDaysLabel="Ada"
        initialSelectedDays={[FULL, OPEN_A]}
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('invite-dates-unavailable')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByRole('button', { name: /change dates/i }))
    // Price sidebar contract: the dropped day no longer feeds the live estimate.
    expect(onLiveDaysChange).toHaveBeenLastCalledWith([OPEN_A])

    expect(screen.getByText('1 day selected')).toBeInTheDocument()
    expect(screen.getByTestId('multi-day-reset-dropped-notice')).toBeInTheDocument()
    expect(screen.queryByTestId('operator-override-badge')).not.toBeInTheDocument()
    const cont = screen.getByTestId('multi-day-step-submit')
    expect(cont).not.toBeDisabled()
    fireEvent.click(cont)
    expect(onConfirm).toHaveBeenCalledWith([OPEN_A], [], undefined)
  })

  it('a customer cannot re-add the full day', async () => {
    render(
      <MultiDayStep
        product={PRODUCT}
        onConfirm={vi.fn()}
        originalDays={[FULL, OPEN_A]}
        originalDaysLabel="Ada"
        initialSelectedDays={[FULL, OPEN_A]}
      />,
    )
    await waitFor(() => screen.getByTestId('invite-dates-unavailable'))
    fireEvent.click(screen.getByRole('button', { name: /change dates/i }))
    // Disabled by the calendar for non-staff sessions; select by full ISO date.
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button[data-day]'),
    ).filter((b) => b.dataset.day && isoDate(new Date(b.dataset.day)) === FULL)
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons.every((b) => b.disabled)).toBe(true)
  })
})

describe('MultiDayStep — Change dates before availability loads (landr-f987a.7)', () => {
  it('drops the full day once availability arrives and shows the notice', async () => {
    let resolve!: (v: AvailabilitySlot[]) => void
    vi.mocked(getAvailability).mockReturnValueOnce(
      new Promise<AvailabilitySlot[]>((r) => {
        resolve = r
      }),
    )
    const onLiveDaysChange = vi.fn()
    render(
      <MultiDayStep
        product={PRODUCT}
        onConfirm={vi.fn()}
        onLiveDaysChange={onLiveDaysChange}
        originalDays={[FULL, OPEN_A]}
        originalDaysLabel="Ada"
        initialSelectedDays={[FULL, OPEN_A]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /change dates/i }))
    expect(screen.getByText('2 days selected')).toBeInTheDocument()
    await act(async () => {
      resolve([slot(FULL, 0), slot(OPEN_A, 5), slot(OPEN_B, 5)])
    })
    await waitFor(() => expect(screen.getByText('1 day selected')).toBeInTheDocument())
    expect(screen.getByTestId('multi-day-reset-dropped-notice')).toBeInTheDocument()
    expect(onLiveDaysChange).toHaveBeenLastCalledWith([OPEN_A])
  })
})

describe('MultiDayStep — selection that became unavailable', () => {
  it('blocks Continue for a customer and names the day', async () => {
    const onConfirm = vi.fn()
    render(
      <MultiDayStep
        product={PRODUCT}
        onConfirm={onConfirm}
        initialSelectedDays={[FULL, OPEN_A]}
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('multi-day-step-submit')).toBeDisabled(),
    )
    expect(screen.getByText(/no longer available — remove it to continue/i)).toBeInTheDocument()
    expect(screen.queryByTestId('operator-override-badge')).not.toBeInTheDocument()
  })

  it('staff with force_book can still continue with the full day', async () => {
    const onConfirm = vi.fn()
    render(
      <StaffModeProvider
        value={{
          active: true,
          token: 't',
          powers: ALL_STAFF_POWERS,
          operatorId: 'op',
        }}
      >
        <MultiDayStep
          product={PRODUCT}
          onConfirm={onConfirm}
          initialSelectedDays={[FULL, OPEN_A]}
        />
      </StaffModeProvider>,
    )
    await waitFor(() =>
      expect(screen.getByTestId('operator-override-badge')).toBeInTheDocument(),
    )
    const cont = screen.getByTestId('multi-day-step-submit')
    expect(cont).not.toBeDisabled()
  })
})
