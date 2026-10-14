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

describe('MultiDayStep — party size incl. invitees (landr-f987a.4)', () => {
  it('blocks Continue naming the day when the party no longer fits', async () => {
    vi.mocked(getAvailability).mockResolvedValue([slot(OPEN_A, 1), slot(OPEN_B, 5)])
    render(
      <MultiDayStep
        product={PRODUCT}
        onConfirm={vi.fn()}
        initialSelectedDays={[OPEN_A, OPEN_B]}
        seatsNeeded={2}
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('multi-day-step-submit')).toBeDisabled(),
    )
    expect(screen.getByText(/Only 1 seat left on .* — you need 2\./)).toBeInTheDocument()
  })

  it('does not block when everyone fits', async () => {
    vi.mocked(getAvailability).mockResolvedValue([slot(OPEN_A, 2), slot(OPEN_B, 5)])
    render(
      <MultiDayStep
        product={PRODUCT}
        onConfirm={vi.fn()}
        initialSelectedDays={[OPEN_A, OPEN_B]}
        seatsNeeded={2}
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('multi-day-step-submit')).not.toBeDisabled(),
    )
  })

  it('sends the invite token with the availability call', async () => {
    render(
      <MultiDayStep
        product={PRODUCT}
        onConfirm={vi.fn()}
        originalDays={[OPEN_A]}
        originalDaysLabel="Ada"
        initialSelectedDays={[OPEN_A]}
        inviteToken="tok-123"
      />,
    )
    await waitFor(() => expect(getAvailability).toHaveBeenCalled())
    expect(vi.mocked(getAvailability).mock.calls.at(-1)?.[3]).toBe('tok-123')
  })
})

describe('MultiDayStep — group-size stepper + seat-aware calendar (landr-rmcsu.5)', () => {
  const dayBtn = (iso: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-day]')).find(
      (b) => b.dataset.day && isoDate(new Date(b.dataset.day)) === iso,
    )!

  it('the stepper starts at the known need, is capped by max_party_size and persists', async () => {
    vi.mocked(getAvailability).mockResolvedValue([slot(OPEN_A, 2), slot(OPEN_B, 5)])
    const onPartySizeChange = vi.fn()
    render(
      <MultiDayStep
        product={{ ...PRODUCT, max_party_size: 3 } as Product}
        onConfirm={vi.fn()}
        seatsNeeded={2}
        showPartySizeStepper
        onPartySizeChange={onPartySizeChange}
      />,
    )
    const group = screen.getByRole('group', { name: 'How many of you?' })
    expect(group).toBeInTheDocument()
    expect(screen.getByTestId('party-size-value')).toHaveTextContent('2')
    await waitFor(() => expect(screen.getByTestId('seat-fit-count')).toBeInTheDocument())
    expect(screen.getByTestId('seat-fit-count')).toHaveTextContent('2 dates fit 2 people')

    fireEvent.click(screen.getByRole('button', { name: 'One person more' }))
    expect(screen.getByTestId('party-size-value')).toHaveTextContent('3')
    expect(onPartySizeChange).toHaveBeenLastCalledWith(3)
    expect(screen.getByRole('button', { name: 'One person more' })).toBeDisabled()
    // OPEN_A has 2 seats: now short for 3 → marked + disabled.
    expect(screen.getByTestId('seat-fit-count')).toHaveTextContent('1 date fits 3 people')
    expect(dayBtn(OPEN_A)).toBeDisabled()
    expect(dayBtn(OPEN_A)).toHaveAttribute('data-short', 'true')
    expect(dayBtn(OPEN_B)).not.toBeDisabled()
  })

  it('max_party_size absent falls back to 6', () => {
    render(
      <MultiDayStep
        product={PRODUCT}
        onConfirm={vi.fn()}
        seatsNeeded={6}
        showPartySizeStepper
      />,
    )
    expect(screen.getByTestId('party-size-value')).toHaveTextContent('6')
    expect(screen.getByRole('button', { name: 'One person more' })).toBeDisabled()
  })

  it('no stepper unless asked for (participants already known — landr-rmcsu.6)', () => {
    render(<MultiDayStep product={PRODUCT} onConfirm={vi.fn()} seatsNeeded={2} />)
    expect(screen.queryByTestId('party-size-stepper')).not.toBeInTheDocument()
  })

  it('never stranded: no day fits → notice with "Fewer people" and the group inquiry', async () => {
    vi.mocked(getAvailability).mockResolvedValue([slot(OPEN_A, 2), slot(OPEN_B, 1)])
    render(
      <MultiDayStep
        product={PRODUCT}
        onConfirm={vi.fn()}
        seatsNeeded={3}
        showPartySizeStepper
        operatorToken="tok"
      />,
    )
    await waitFor(() => expect(screen.getByTestId('seat-fit-none')).toBeInTheDocument())
    expect(screen.getByTestId('seat-fit-none')).toHaveTextContent(
      /^No dates with room for 3 people in .+\./,
    )
    fireEvent.click(screen.getByTestId('seat-fit-fewer'))
    expect(screen.getByTestId('party-size-decrease')).toHaveFocus()

    fireEvent.click(screen.getByTestId('seat-fit-inquiry'))
    const modal = await screen.findByTestId('seat-fit-inquiry-modal')
    expect(modal).toBeInTheDocument()
    // The group size carries into the inquiry form.
    expect(screen.getByDisplayValue('3')).toBeInTheDocument()

    // Two fewer people → some days fit again and the notice goes away.
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    fireEvent.click(screen.getByTestId('party-size-decrease'))
    expect(screen.queryByTestId('seat-fit-none')).not.toBeInTheDocument()
    expect(screen.getByTestId('seat-fit-count')).toHaveTextContent('1 date fits 2 people')
  })

  it('the gate names every short selected day, not only the first', async () => {
    vi.mocked(getAvailability).mockResolvedValue([
      slot(FULL, 2),
      slot(OPEN_A, 1),
      slot(OPEN_B, 5),
    ])
    render(
      <MultiDayStep
        product={PRODUCT}
        onConfirm={vi.fn()}
        initialSelectedDays={[FULL, OPEN_A, OPEN_B]}
        seatsNeeded={3}
        showPartySizeStepper
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('multi-day-step-submit')).toBeDisabled(),
    )
    expect(screen.getByText(/ and .* have fewer than 3 seats left\./)).toBeInTheDocument()
  })
})

describe('MultiDayStep — invite summary honours the group size (landr-rmcsu.7)', () => {
  const dayBtn = (iso: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-day]')).find(
      (b) => b.dataset.day && isoDate(new Date(b.dataset.day)) === iso,
    )!

  it('blocks "Continue with these dates" when a host day has room for fewer than the group', async () => {
    vi.mocked(getAvailability).mockResolvedValue([slot(OPEN_A, 5), slot(OPEN_B, 2)])
    const onConfirm = vi.fn()
    render(
      <MultiDayStep
        product={PRODUCT}
        onConfirm={onConfirm}
        originalDays={[OPEN_A, OPEN_B]}
        originalDaysLabel="Ada"
        initialSelectedDays={[OPEN_A, OPEN_B]}
        seatsNeeded={3}
      />,
    )
    const msg = await screen.findByTestId('invite-dates-short')
    expect(msg).toHaveTextContent(/Only 2 seats left on .* — you need 3\./)
    expect(screen.getByTestId('multi-day-step-invite-submit')).toBeDisabled()
    expect(screen.queryByTestId('invite-dates-unavailable')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /change dates/i })).toBeInTheDocument()
  })

  it('stays ready when every host day takes the group', async () => {
    vi.mocked(getAvailability).mockResolvedValue([slot(OPEN_A, 5), slot(OPEN_B, 3)])
    const onConfirm = vi.fn()
    render(
      <MultiDayStep
        product={PRODUCT}
        onConfirm={onConfirm}
        originalDays={[OPEN_A, OPEN_B]}
        originalDaysLabel="Ada"
        initialSelectedDays={[OPEN_A, OPEN_B]}
        seatsNeeded={3}
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('multi-day-step-invite-submit')).not.toBeDisabled(),
    )
    expect(screen.queryByTestId('invite-dates-short')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('multi-day-step-invite-submit'))
    expect(onConfirm).toHaveBeenCalledWith([OPEN_A, OPEN_B].sort())
  })

  it('Change dates drops the host day that is short and shows the notice', async () => {
    vi.mocked(getAvailability).mockResolvedValue([slot(OPEN_A, 5), slot(OPEN_B, 2)])
    render(
      <MultiDayStep
        product={PRODUCT}
        onConfirm={vi.fn()}
        originalDays={[OPEN_A, OPEN_B]}
        originalDaysLabel="Ada"
        initialSelectedDays={[OPEN_A, OPEN_B]}
        seatsNeeded={3}
      />,
    )
    await screen.findByTestId('invite-dates-short')
    fireEvent.click(screen.getByRole('button', { name: /change dates/i }))
    expect(screen.getByText('1 day selected')).toBeInTheDocument()
    expect(screen.getByTestId('multi-day-reset-dropped-notice')).toBeInTheDocument()
    expect(screen.getByTestId('multi-day-step-submit')).not.toBeDisabled()
  })

  it('staff with force_book are not blocked by a short host day', async () => {
    vi.mocked(getAvailability).mockResolvedValue([slot(OPEN_A, 5), slot(OPEN_B, 2)])
    render(
      <StaffModeProvider
        value={{ active: true, token: 't', powers: ALL_STAFF_POWERS, operatorId: 'op' }}
      >
        <MultiDayStep
          product={PRODUCT}
          onConfirm={vi.fn()}
          originalDays={[OPEN_A, OPEN_B]}
          originalDaysLabel="Ada"
          initialSelectedDays={[OPEN_A, OPEN_B]}
          seatsNeeded={3}
        />
      </StaffModeProvider>,
    )
    await waitFor(() =>
      expect(screen.getByTestId('multi-day-step-invite-submit')).not.toBeDisabled(),
    )
  })

  it('a selected day that becomes short after raising the stepper can be deselected', async () => {
    vi.mocked(getAvailability).mockResolvedValue([slot(OPEN_A, 5), slot(OPEN_B, 2)])
    render(
      <MultiDayStep
        product={{ ...PRODUCT, max_party_size: 4 } as Product}
        onConfirm={vi.fn()}
        initialSelectedDays={[OPEN_A, OPEN_B]}
        seatsNeeded={2}
        showPartySizeStepper
      />,
    )
    await waitFor(() => expect(dayBtn(OPEN_B)).toBeDefined())
    expect(screen.getByText('2 days selected')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'One person more' }))
    // OPEN_B (2 seats) is now short for 3: Continue is gated with the reason ...
    await waitFor(() => expect(screen.getByTestId('multi-day-step-submit')).toBeDisabled())
    expect(document.getElementById('multi-day-step-gate')).toHaveTextContent(
      /Only 2 seats left on .* — you need 3\./,
    )
    // ... but the day is still clickable, so the customer can drop it.
    expect(dayBtn(OPEN_B)).not.toBeDisabled()
    fireEvent.click(dayBtn(OPEN_B))
    expect(screen.getByText('1 day selected')).toBeInTheDocument()
    expect(screen.getByTestId('multi-day-step-submit')).not.toBeDisabled()
    // A short day that is NOT selected cannot be re-added (react-day-picker
    // keeps the just-clicked, focused day aria-disabled rather than disabled).
    fireEvent.click(dayBtn(OPEN_B))
    expect(screen.getByText('1 day selected')).toBeInTheDocument()
  })
})
