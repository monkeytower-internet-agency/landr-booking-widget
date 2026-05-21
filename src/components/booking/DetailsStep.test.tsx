import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Product, ServiceRole } from '@/api/types'
import type { BookingSelection } from './BookingForm'
import { DetailsStep } from './DetailsStep'

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

function byName<T extends HTMLElement = HTMLInputElement>(name: string): T {
  const el = document.querySelector<T>(`[name="${name}"]`)
  if (!el) throw new Error(`No input named ${name}`)
  return el
}

function fillBooker({
  first = 'Ada',
  last = 'Lovelace',
  email = 'ada@example.com',
  phone = '+34 600 000 000',
} = {}) {
  fireEvent.change(byName('booker_first_name'), { target: { value: first } })
  fireEvent.change(byName('booker_last_name'), { target: { value: last } })
  fireEvent.change(byName('booker_email'), { target: { value: email } })
  fireEvent.change(byName('booker_phone'), { target: { value: phone } })
}

describe('DetailsStep (landr-8c03)', () => {
  it('renders the generic "Your details" header (landr-genericity-northstar)', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.getByText(/your details/i)).toBeInTheDocument()
    // Must NOT use vertical-specific wording like "pilots"/"divers".
    expect(screen.queryByText(/pilots|divers/i)).not.toBeInTheDocument()
  })

  it('starts with only the booker section visible (0 additional participants)', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect(byName('booker_first_name')).toBeInTheDocument()
    // Heading should reflect 1 total when there are no additional rows.
    expect(screen.getByText(/\(1 total\)/i)).toBeInTheDocument()
    // No participant rows visible initially.
    expect(screen.queryByTestId('participant-row-2')).not.toBeInTheDocument()
  })

  it('disables Continue until the booker has filled all required fields', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    const cont = screen.getByRole('button', { name: /continue/i })
    expect(cont).toBeDisabled()
    fillBooker()
    expect(cont).not.toBeDisabled()
  })

  it('confirms with booker + a single participant (mirrored from booker) when no additionals', () => {
    const onConfirm = vi.fn()
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    fillBooker()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [booker, participants] = onConfirm.mock.calls[0]!
    expect(booker).toMatchObject({
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      phone: '+34 600 000 000',
    })
    expect(participants).toHaveLength(1)
    expect(participants[0]).toMatchObject({
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
    })
  })

  it('reveals an additional participant row when + is clicked, requiring first+last', () => {
    const onConfirm = vi.fn()
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    fillBooker()
    fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    expect(screen.getByTestId('participant-row-2')).toBeInTheDocument()
    // Continue must now be disabled until participant 2 has first+last.
    const cont = screen.getByRole('button', { name: /continue/i })
    expect(cont).toBeDisabled()

    fireEvent.change(byName('participant_2_first_name'), {
      target: { value: 'Grace' },
    })
    fireEvent.change(byName('participant_2_last_name'), {
      target: { value: 'Hopper' },
    })
    expect(cont).not.toBeDisabled()

    fireEvent.click(cont)
    const [, participants] = onConfirm.mock.calls[0]!
    expect(participants).toHaveLength(2)
    expect(participants[1]).toMatchObject({
      first_name: 'Grace',
      last_name: 'Hopper',
      email: '',
      phone: '',
    })
  })

  it('allows participant email + phone to remain empty (both optional)', () => {
    const onConfirm = vi.fn()
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    fillBooker()
    fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    fireEvent.change(byName('participant_2_first_name'), {
      target: { value: 'Grace' },
    })
    fireEvent.change(byName('participant_2_last_name'), {
      target: { value: 'Hopper' },
    })
    // intentionally leave participant_2_email and _phone blank
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('caps additional participants at 5 (total 6)', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    const add = screen.getByRole('button', { name: /add participant/i })
    for (let i = 0; i < 5; i += 1) fireEvent.click(add)
    expect(add).toBeDisabled()
    // 6 total = 1 booker + 5 additionals.
    expect(screen.getByText(/\(6 total\)/i)).toBeInTheDocument()
  })

  it('shrinks additional rows when − is clicked, never below 0', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    const remove = screen.getByRole('button', { name: /remove participant/i })
    expect(remove).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    expect(screen.getByTestId('participant-row-2')).toBeInTheDocument()
    expect(remove).not.toBeDisabled()
    fireEvent.click(remove)
    expect(screen.queryByTestId('participant-row-2')).not.toBeInTheDocument()
    expect(remove).toBeDisabled()
  })

  it('calls onBack when Back is clicked', () => {
    const onBack = vi.fn()
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={onBack}
        onConfirm={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  // landr-8yaz: the Back affordance lives in the top-left of the step
  // (above the CardHeader) rather than the bottom row. Assert via the
  // shared step-back-button testid + that it precedes the CardHeader in
  // DOM order so the layout doesn't silently regress to bottom-row Back.
  it('renders the Back button above the step header (top-left placement)', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    const back = screen.getByTestId('step-back-button')
    const header = document.querySelector('[data-slot="card-header"]')
    expect(back).toBeInTheDocument()
    expect(header).toBeInTheDocument()
    // DOCUMENT_POSITION_FOLLOWING (4) on the header means it follows `back`.
    expect(back.compareDocumentPosition(header!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('restores prior data when re-entered with initialBooker + initialParticipants', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        initialBooker={{
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
          phone: '+34 600 000 000',
        }}
        initialParticipants={[
          {
            first_name: 'Ada',
            last_name: 'Lovelace',
            email: 'ada@example.com',
            phone: '+34 600 000 000',
            service_role_code: '',
          },
          {
            first_name: 'Grace',
            last_name: 'Hopper',
            email: '',
            phone: '',
            service_role_code: '',
          },
        ]}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect(byName('booker_first_name').value).toBe('Ada')
    expect(byName('participant_2_first_name').value).toBe('Grace')
    expect(byName('participant_2_last_name').value).toBe('Hopper')
  })
})

// landr-mg0a: per-participant service_role picker. The dropdown only
// surfaces when the operator has >1 active role. With a single role
// the UI is unchanged and the lone code is assigned automatically.

const ONE_ROLE: ServiceRole[] = [
  {
    id: 'role-participant',
    code: 'participant',
    label: 'Participant',
    label_localized: null,
    sort_order: 0,
  },
]

const TWO_ROLES: ServiceRole[] = [
  {
    id: 'role-pilot',
    code: 'pilot',
    label: 'Pilot',
    label_localized: null,
    sort_order: 0,
  },
  {
    id: 'role-passenger',
    code: 'passenger',
    label: 'Passenger',
    label_localized: null,
    sort_order: 10,
  },
]

describe('DetailsStep — service_role selector (landr-mg0a)', () => {
  it('hides the role dropdown when the operator only has one role', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        serviceRoles={ONE_ROLE}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('booker-role-select')).not.toBeInTheDocument()
  })

  it('auto-assigns the single role code to the booker on submit', () => {
    const onConfirm = vi.fn()
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        serviceRoles={ONE_ROLE}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    fillBooker()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    const [, participants] = onConfirm.mock.calls[0]!
    expect(participants[0].service_role_code).toBe('participant')
  })

  it('shows the dropdown for the booker when >1 role + defaults to the first', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        serviceRoles={TWO_ROLES}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    const select = screen.getByTestId('booker-role-select') as HTMLSelectElement
    expect(select).toBeInTheDocument()
    // First role (lowest sort_order) is the default.
    expect(select.value).toBe('pilot')
    // Both options surfaced.
    const options = Array.from(select.options).map((o) => o.value)
    expect(options).toEqual(['pilot', 'passenger'])
  })

  it('lets the user pick a different role for the booker', () => {
    const onConfirm = vi.fn()
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        serviceRoles={TWO_ROLES}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    fillBooker()
    const select = screen.getByTestId('booker-role-select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'passenger' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    const [, participants] = onConfirm.mock.calls[0]!
    expect(participants[0].service_role_code).toBe('passenger')
  })

  it('shows a per-participant dropdown for additional rows when >1 role', () => {
    const onConfirm = vi.fn()
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        serviceRoles={TWO_ROLES}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    fillBooker()
    fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    fireEvent.change(byName('participant_2_first_name'), {
      target: { value: 'Grace' },
    })
    fireEvent.change(byName('participant_2_last_name'), {
      target: { value: 'Hopper' },
    })
    const p2Select = screen.getByTestId(
      'participant-role-select-2',
    ) as HTMLSelectElement
    // Participant 2 defaults to the first role too.
    expect(p2Select.value).toBe('pilot')
    fireEvent.change(p2Select, { target: { value: 'passenger' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    const [, participants] = onConfirm.mock.calls[0]!
    expect(participants).toHaveLength(2)
    expect(participants[0].service_role_code).toBe('pilot')
    expect(participants[1].service_role_code).toBe('passenger')
  })

  it('seeds the booker dropdown from initialParticipants[0] when re-entered', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        serviceRoles={TWO_ROLES}
        initialBooker={{
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
          phone: '+34 600 000 000',
        }}
        initialParticipants={[
          {
            first_name: 'Ada',
            last_name: 'Lovelace',
            email: 'ada@example.com',
            phone: '+34 600 000 000',
            service_role_code: 'passenger',
          },
        ]}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    const select = screen.getByTestId('booker-role-select') as HTMLSelectElement
    expect(select.value).toBe('passenger')
  })
})
