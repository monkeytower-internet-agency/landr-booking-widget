import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import type { BookingSelection } from './BookingForm'
import { ParticipantsStep } from './ParticipantsStep'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    product_id: 'p-1',
    slug: 'p-1',
    name: 'Tandem Flight',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'single_date',
    is_contiguous: false,
    duration_minutes: 30,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: null,
    group_slug: null,
    group_name: null,
    sort_order: 0,
    sport_subcategory_codes: [],
    location_ids: [],
    needs_pickup: false,
    hotel_offering: 'none',
    ...overrides,
  }
}

const DAYS_SELECTION: BookingSelection = {
  kind: 'days',
  selectedDays: ['2026-05-23'],
}

describe('ParticipantsStep (landr-mbge)', () => {
  it('renders the generic "How many participants?" header (landr-genericity-northstar)', () => {
    render(
      <ParticipantsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect(
      screen.getByText(/how many participants/i),
    ).toBeInTheDocument()
    // Must NOT use vertical-specific wording like "pilots"/"divers".
    expect(screen.queryByText(/pilots|divers/i)).not.toBeInTheDocument()
  })

  it('defaults to "Just me" (count=1) and confirms 1 on Continue', () => {
    const onConfirm = vi.fn()
    render(
      <ParticipantsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    const aloneRadio = screen.getByRole('radio', { name: /just me/i })
    expect(aloneRadio).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onConfirm).toHaveBeenCalledWith(1)
  })

  it('reveals the additional-participants stepper when "Add more" is selected', () => {
    render(
      <ParticipantsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    // Stepper input is hidden initially.
    expect(
      screen.queryByLabelText(/how many additional participants/i),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /add more/i }))

    expect(
      screen.getByLabelText(/how many additional participants/i),
    ).toBeInTheDocument()
  })

  it('confirms the total count (additional + 1) when "Add more" is chosen', () => {
    const onConfirm = vi.fn()
    render(
      <ParticipantsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    fireEvent.click(screen.getByRole('radio', { name: /add more/i }))
    const input = screen.getByLabelText(/how many additional participants/i)
    fireEvent.change(input, { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    // 3 additional + 1 booker = 4 total.
    expect(onConfirm).toHaveBeenCalledWith(4)
  })

  it('clamps the additional count to 1-5 (total cap 2-6)', () => {
    const onConfirm = vi.fn()
    render(
      <ParticipantsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    fireEvent.click(screen.getByRole('radio', { name: /add more/i }))
    const input = screen.getByLabelText(
      /how many additional participants/i,
    ) as HTMLInputElement
    // Way too many → clamps to 5 (total 6).
    fireEvent.change(input, { target: { value: '99' } })
    expect(input.value).toBe('5')
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onConfirm).toHaveBeenCalledWith(6)
  })

  it('+/- buttons step the additional count within bounds', () => {
    render(
      <ParticipantsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('radio', { name: /add more/i }))
    const input = screen.getByLabelText(
      /how many additional participants/i,
    ) as HTMLInputElement
    expect(input.value).toBe('1')
    // − is disabled at min.
    const minus = screen.getByRole('button', { name: 'Decrease' })
    expect(minus).toBeDisabled()
    // + adds one.
    fireEvent.click(screen.getByRole('button', { name: 'Increase' }))
    expect(input.value).toBe('2')
  })

  it('calls onBack when Back is clicked', () => {
    const onBack = vi.fn()
    render(
      <ParticipantsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={onBack}
        onConfirm={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
