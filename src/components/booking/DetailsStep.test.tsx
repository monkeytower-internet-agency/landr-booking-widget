import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as client from '@/api/client'
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
  it('renders the generic "Participants" header (landr-genericity-northstar)', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.getByText('Participants')).toBeInTheDocument()
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

  // landr-79re: Continue is ALWAYS tappable now (mobile blur fix). Tapping it
  // while the booker is incomplete must NOT advance (no onConfirm) and must
  // reveal the required-field errors; once complete, tapping advances.
  it('does not advance (and reveals errors) when Continue is tapped with an incomplete booker', () => {
    const onConfirm = vi.fn()
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    const cont = screen.getByRole('button', { name: /continue/i })
    // Button is never disabled — feedback comes from the tap, not a grey-out.
    expect(cont).not.toBeDisabled()
    fireEvent.click(cont)
    // Incomplete → no advance, and the empty booker fields are now flagged.
    expect(onConfirm).not.toHaveBeenCalled()
    expect(byName('booker_first_name')).toHaveAttribute('aria-invalid', 'true')
    expect(byName('booker_phone')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getAllByText('Required').length).toBeGreaterThan(0)
    // Once all required fields are filled, tapping Continue advances.
    fillBooker()
    fireEvent.click(cont)
    expect(onConfirm).toHaveBeenCalledTimes(1)
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

  it('reveals an additional participant row when + is clicked, requiring first+last+phone (landr-nkbi)', () => {
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
    // landr-79re: Continue stays tappable; tapping while participant 2 is
    // incomplete reveals its required-field errors and does NOT advance.
    const cont = screen.getByRole('button', { name: /continue/i })
    expect(cont).not.toBeDisabled()
    fireEvent.click(cont)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(byName('participant_2_phone')).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(byName('participant_2_first_name'), {
      target: { value: 'Grace' },
    })
    fireEvent.change(byName('participant_2_last_name'), {
      target: { value: 'Hopper' },
    })
    // landr-nkbi: still incomplete because phone is missing → tapping does
    // not advance.
    fireEvent.click(cont)
    expect(onConfirm).not.toHaveBeenCalled()

    fireEvent.change(byName('participant_2_phone'), {
      target: { value: '+34600000002' },
    })

    fireEvent.click(cont)
    const [, participants] = onConfirm.mock.calls[0]!
    expect(participants).toHaveLength(2)
    expect(participants[1]).toMatchObject({
      first_name: 'Grace',
      last_name: 'Hopper',
      email: '',
      phone: '+34600000002',
    })
  })

  it('allows participant email to remain empty (email optional) but requires phone (landr-nkbi)', () => {
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
    // landr-nkbi: participant phone is now required — tapping Continue while
    // phone is empty does NOT advance (landr-79re: button stays tappable).
    const cont = screen.getByRole('button', { name: /continue/i })
    fireEvent.click(cont)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(byName('participant_2_phone')).toHaveAttribute('aria-invalid', 'true')

    // Supplying the phone makes the form complete.
    fireEvent.change(byName('participant_2_phone'), {
      target: { value: '+34600000002' },
    })

    // Email can remain empty — that's fine.
    fireEvent.click(cont)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [, participants] = onConfirm.mock.calls[0]!
    expect(participants[1]).toMatchObject({
      first_name: 'Grace',
      last_name: 'Hopper',
      phone: '+34600000002',
      email: '',
    })
  })

  // landr-4uyu: at the participant max the "+ Add participant" button is
  // replaced by the "Maximum …" notice (no longer a disabled stepper button).
  it('caps additional participants at 5 (total 6) and hides Add at max', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    // Re-query each tap — the button disappears once we hit the cap.
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    }
    // 6 total = 1 booker + 5 additionals.
    expect(screen.getByText(/\(6 total\)/i)).toBeInTheDocument()
    // The Add button is gone and the max warning is shown.
    expect(
      screen.queryByRole('button', { name: /add participant/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/maximum of 5 additional participants reached/i),
    ).toBeInTheDocument()
  })

  // landr-4uyu: the per-card × control removes a SPECIFIC row. With zero rows
  // there is no remove control at all (and no stepper), and the Add button is
  // present at the bottom.
  it('removes a specific additional row via its per-card × control', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    // No rows → no remove control.
    expect(
      screen.queryByRole('button', { name: /remove participant/i }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    expect(screen.getByTestId('participant-row-2')).toBeInTheDocument()
    const remove = screen.getByRole('button', { name: /remove participant/i })
    fireEvent.click(remove)
    expect(screen.queryByTestId('participant-row-2')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /remove participant/i }),
    ).not.toBeInTheDocument()
  })

  // landr-4uyu: removing one row preserves the OTHER rows' entered data
  // (landr-nmed data-loss guard). Add two participants, fill both, remove the
  // first, and assert the second's data survived and re-indexed.
  it('preserves the other rows’ data when one row is removed (landr-nmed)', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    fireEvent.change(byName('participant_2_first_name'), {
      target: { value: 'Grace' },
    })
    fireEvent.change(byName('participant_3_first_name'), {
      target: { value: 'Mary' },
    })
    // Remove the FIRST added row (Participant 2) via its specific × control.
    fireEvent.click(
      screen.getByRole('button', { name: /remove participant 2/i }),
    )
    // Only one row remains; Mary's data survived and re-indexed to slot 2.
    expect(screen.getByTestId('participant-row-2')).toBeInTheDocument()
    expect(screen.queryByTestId('participant-row-3')).not.toBeInTheDocument()
    expect(byName('participant_2_first_name')).toHaveValue('Mary')
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
            // landr-nkbi: participant phone required — supply a value so
            // Back-restore re-entry leaves Continue enabled.
            phone: '+34 600 000 002',
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
    expect(byName('participant_2_phone').value).toBe('+34 600 000 002')
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
    // landr-nkbi: participant phone is now required — supply it so Continue is enabled.
    fireEvent.change(byName('participant_2_phone'), {
      target: { value: '+34600000002' },
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

// landr-gb2f.1: live participant count + names for PriceSidebar.
describe('DetailsStep — live participant updates (landr-gb2f.1)', () => {
  it('fires onLiveParticipantsChange with count=1 when the booker first name changes', () => {
    const onLive = vi.fn()
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
        onLiveParticipantsChange={onLive}
      />,
    )
    fireEvent.change(byName('booker_first_name'), { target: { value: 'Ada' } })
    // count=1 (only booker), names=['Ada']
    expect(onLive).toHaveBeenLastCalledWith(1, ['Ada'], 0)
  })

  it('fires count=2 when a participant is added via the + button', () => {
    const onLive = vi.fn()
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
        onLiveParticipantsChange={onLive}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    expect(onLive).toHaveBeenLastCalledWith(2, [], 0)
  })

  it('fires count=1 again when a participant is removed via the − button', () => {
    const onLive = vi.fn()
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
        onLiveParticipantsChange={onLive}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    fireEvent.click(screen.getByRole('button', { name: /remove participant/i }))
    expect(onLive).toHaveBeenLastCalledWith(1, [], 0)
  })

  it('includes additional participant first names (trimmed, non-empty) in names', () => {
    const onLive = vi.fn()
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
        onLiveParticipantsChange={onLive}
      />,
    )
    fireEvent.change(byName('booker_first_name'), { target: { value: 'Ada' } })
    fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    fireEvent.change(byName('participant_2_first_name'), {
      target: { value: '  Grace  ' },
    })
    expect(onLive).toHaveBeenLastCalledWith(2, ['Ada', 'Grace'], 0)
  })

  it('omits empty/whitespace-only first names from the names array', () => {
    const onLive = vi.fn()
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
        onLiveParticipantsChange={onLive}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    // participant 2 first name left blank; booker first name also blank
    expect(onLive).toHaveBeenLastCalledWith(2, [], 0)
  })

  it('does not break when onLiveParticipantsChange is not provided (backward compat)', () => {
    // No prop — adding a participant must not throw
    expect(() => {
      render(
        <DetailsStep
          product={makeProduct()}
          selection={DAYS_SELECTION}
          onBack={vi.fn()}
          onConfirm={vi.fn()}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    }).not.toThrow()
  })
})

describe('DetailsStep — non-guiding companions (landr-87n9.3)', () => {
  it('renders the "Others joining" section with generic copy (no activity-specific wording)', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    const section = screen.getByTestId('companions-section')
    expect(section).toBeInTheDocument()
    expect(section).toHaveTextContent(/others sharing your room/i)
    // landr-genericity-northstar: must NOT say "paragliding"/"pilots".
    expect(section).not.toHaveTextContent(/paragliding|pilots/i)
  })

  it('adds a companion row requiring first and last name, and passes companions to onConfirm (landr-rxjo)', () => {
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
    fireEvent.click(screen.getByRole('button', { name: /add companion/i }))
    expect(screen.getByTestId('companion-row-0')).toBeInTheDocument()
    // landr-79re: tapping Continue while the companion has no first name does
    // NOT advance and flags the missing companion first name.
    const cont = screen.getByRole('button', { name: /continue/i })
    fireEvent.click(cont)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(byName('companion_1_first_name')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    // landr-rxjo: filling first name alone is not enough — last name is now
    // also required, so the form is still blocked.
    fireEvent.change(byName('companion_1_first_name'), {
      target: { value: 'Mia' },
    })
    fireEvent.click(cont)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(byName('companion_1_last_name')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    // Fill last name → form advances.
    fireEvent.change(byName('companion_1_last_name'), {
      target: { value: 'Berg' },
    })
    fireEvent.click(cont)
    const [, participants, companions] = onConfirm.mock.calls[0]!
    // Companion is NOT in participants[].
    expect(participants).toHaveLength(1)
    expect(companions).toHaveLength(1)
    expect(companions[0]).toMatchObject({
      first_name: 'Mia',
      last_name: 'Berg',
      email: '',
      phone: '',
    })
  })

  it('reports the live companion count as the third callback arg', () => {
    const onLive = vi.fn()
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
        onLiveParticipantsChange={onLive}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add companion/i }))
    // count=1 (booker), names=[], companionCount=1
    expect(onLive).toHaveBeenLastCalledWith(1, [], 1)
  })

  it('restores companions from initialCompanions on back-nav re-entry', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
        initialCompanions={[
          { first_name: 'Mia', last_name: 'Berg', email: '', phone: '', companion_kind: 'guest' },
        ]}
      />,
    )
    expect(screen.getByTestId('companion-row-0')).toBeInTheDocument()
    expect(byName('companion_1_first_name')).toHaveValue('Mia')
    expect(byName('companion_1_last_name')).toHaveValue('Berg')
  })

  // landr-nkbi: companion phone is OPTIONAL — a blank companion phone must not
  // block submission. landr-79re: assert via the Continue tap advancing (the
  // button is always tappable now, so disabled-state can't prove this).
  it('does NOT require a phone for companions (companion phone exempt, landr-nkbi)', () => {
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
    fireEvent.click(screen.getByRole('button', { name: /add companion/i }))
    fireEvent.change(byName('companion_1_first_name'), {
      target: { value: 'Mia' },
    })
    fireEvent.change(byName('companion_1_last_name'), {
      target: { value: 'Berg' },
    })
    // Deliberately leave companion phone empty — Continue should still advance.
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  // landr-nkbi: companion phone label must read "Phone (optional)" to signal
  // it is not required (in contrast to participant phone which reads "Phone").
  it('labels companion phone as "Phone (optional)" (not required)', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add companion/i }))
    const companionRow = screen.getByTestId('companion-row-0')
    // The label "Phone (optional)" should appear within the companion row.
    expect(companionRow).toHaveTextContent(/phone \(optional\)/i)
  })
})

describe('DetailsStep — add-below-last + max + contact-us (landr-4uyu)', () => {
  // Helper: click the participant Add button until at max (re-querying each
  // tap because the button is removed at the cap).
  function addParticipantsToMax() {
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    }
  }

  it('renders the "+ Add participant" button AFTER the last participant card in DOM order', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    const card = screen.getByTestId('participant-row-2')
    const addBtn = screen.getByTestId('add-participant')
    // The Add button is BELOW (after) the last card in document order, so
    // tabbing out of the last card's last field lands on it.
    expect(
      card.compareDocumentPosition(addBtn) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(addBtn).toHaveTextContent(/\+ add participant/i)
  })

  it('hides the Add button and shows the max warning at the participant cap', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    addParticipantsToMax()
    expect(screen.queryByTestId('add-participant')).not.toBeInTheDocument()
    expect(
      screen.getByText(/maximum of 5 additional participants reached/i),
    ).toBeInTheDocument()
  })

  it('renders a mailto link to contact_email at the participant max', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        contactEmail="ops@para42.example"
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    addParticipantsToMax()
    const link = screen.getByTestId('participants-contact-mailto')
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:ops@para42.example'),
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    // landr-ehye: link text changed to "Or email us" — the email address is
    // in the href, not the text content, because the form is now the primary
    // contact path and the mailto is a secondary "Or email us" escape hatch.
    expect(link).toHaveTextContent(/or email us/i)
    // The mailto carries a sensible prefilled subject.
    expect(link.getAttribute('href')).toMatch(/[?&]subject=/)
  })

  it('shows the contact-us copy but NO mailto when contact_email is null (graceful degrade)', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        contactEmail={null}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    addParticipantsToMax()
    // The "larger group / custom booking" copy still renders…
    expect(
      screen.getByText(/larger group or a custom booking/i),
    ).toBeInTheDocument()
    // …but there is no (broken) mailto link.
    expect(
      screen.queryByTestId('participants-contact-mailto'),
    ).not.toBeInTheDocument()
    expect(
      document.querySelector('a[href^="mailto:"]'),
    ).not.toBeInTheDocument()
  })

  it('treats a blank/whitespace contact_email as absent (no empty mailto)', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        contactEmail="   "
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    addParticipantsToMax()
    expect(
      screen.queryByTestId('participants-contact-mailto'),
    ).not.toBeInTheDocument()
    expect(
      document.querySelector('a[href^="mailto:"]'),
    ).not.toBeInTheDocument()
  })

  it('renders the "+ Add guest" button AFTER the last companion card in DOM order', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add companion/i }))
    const card = screen.getByTestId('companion-row-0')
    const addBtn = screen.getByTestId('add-companion')
    expect(
      card.compareDocumentPosition(addBtn) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(addBtn).toHaveTextContent(/\+ add guest/i)
  })

  it('hides the Add guest button and shows the max warning at the companion cap (no contact-us)', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        contactEmail="ops@para42.example"
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    for (let i = 0; i < 12; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: /add companion/i }))
    }
    expect(screen.queryByTestId('add-companion')).not.toBeInTheDocument()
    expect(
      screen.getByText(/maximum of 12 guests reached/i),
    ).toBeInTheDocument()
    // Companions get NO contact-us line even when contact_email is set.
    expect(
      screen.queryByText(/larger group or a custom booking/i),
    ).not.toBeInTheDocument()
  })
})

describe('DetailsStep required-field blur validation (landr-opi3)', () => {
  function renderStep() {
    return render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
  }

  it('does NOT mark an empty required field invalid while it is untouched', () => {
    renderStep()
    const phone = byName('booker_phone')
    // Empty but never blurred → no red, no message.
    expect(phone).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByText('Required')).not.toBeInTheDocument()
  })

  it('marks an empty required field invalid once the customer leaves it (onBlur)', () => {
    renderStep()
    const phone = byName('booker_phone')
    fireEvent.blur(phone)
    // After leaving the empty field it turns red and shows the message.
    expect(phone).toHaveAttribute('aria-invalid', 'true')
    const msg = document.getElementById('booker-phone-error')
    expect(msg).toHaveTextContent('Required')
    // aria-describedby wires the input to its message for screen readers.
    expect(phone).toHaveAttribute('aria-describedby', 'booker-phone-error')
  })

  it('does NOT mark a filled field invalid on blur', () => {
    renderStep()
    const phone = byName('booker_phone')
    fireEvent.change(phone, { target: { value: '+34 600 111 222' } })
    fireEvent.blur(phone)
    expect(phone).not.toHaveAttribute('aria-invalid')
  })

  it('clears the red state as soon as the customer types a value into a flagged field', () => {
    renderStep()
    // Use first name (no format constraint, unlike phone post-landr-1url) to
    // demonstrate the generic required-field "clears on type" behavior.
    const firstName = byName('booker_first_name')
    fireEvent.blur(firstName)
    expect(firstName).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(firstName, { target: { value: 'Ada' } })
    // Re-render reflects the now-non-empty value → no longer invalid.
    expect(firstName).not.toHaveAttribute('aria-invalid')
  })

  // landr-1url: lightweight international-format nudge (no new dependency).
  // A non-empty phone lacking a leading '+' + country code is flagged with a
  // format message distinct from "Required", and clears once fixed.
  it('flags a booker phone missing the "+" country code, distinct from empty', () => {
    renderStep()
    const phone = byName('booker_phone')
    // Missing → Required.
    fireEvent.blur(phone)
    expect(document.getElementById('booker-phone-error')).toHaveTextContent(
      'Required',
    )
    // Present but no leading '+' → format message, not "Required".
    fireEvent.change(phone, { target: { value: '600123456' } })
    expect(phone).toHaveAttribute('aria-invalid', 'true')
    expect(document.getElementById('booker-phone-error')).toHaveTextContent(
      /country code/i,
    )
    // Valid international format (with human-friendly spaces) → no error.
    fireEvent.change(phone, { target: { value: '+34 600 123 456' } })
    expect(phone).not.toHaveAttribute('aria-invalid')
  })

  it('shows placeholder + help text nudging international format on the booker phone', () => {
    renderStep()
    const phone = byName('booker_phone')
    expect(phone).toHaveAttribute('placeholder', '+34 600 123 456')
    expect(screen.getByText('Include your country code')).toBeInTheDocument()
  })

  it('flags an added participant phone missing the "+" country code (landr-nkbi + landr-1url)', () => {
    renderStep()
    fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    const phone = byName('participant_2_phone')
    fireEvent.change(phone, { target: { value: '600123456' } })
    fireEvent.blur(phone)
    expect(phone).toHaveAttribute('aria-invalid', 'true')
    expect(document.getElementById('p-0-phone-error')).toHaveTextContent(
      /country code/i,
    )
    fireEvent.change(phone, { target: { value: '+34600123456' } })
    expect(phone).not.toHaveAttribute('aria-invalid')
  })

  // landr-1url: companion phone stays OPTIONAL (landr-nkbi) — blank never
  // errors — but a filled-but-malformed value is still nudged toward the
  // international format.
  it('flags a filled-but-malformed companion phone, but leaves a blank one alone', () => {
    renderStep()
    fireEvent.click(screen.getByRole('button', { name: /add companion/i }))
    const phone = byName('companion_1_phone')
    // Blank + blurred → no error (optional).
    fireEvent.blur(phone)
    expect(phone).not.toHaveAttribute('aria-invalid')
    // Filled but malformed → flagged.
    fireEvent.change(phone, { target: { value: '600123456' } })
    expect(phone).toHaveAttribute('aria-invalid', 'true')
    expect(document.getElementById('companion-0-phone-error')).toHaveTextContent(
      /country code/i,
    )
    // Fixed → clears.
    fireEvent.change(phone, { target: { value: '+34 600 123 456' } })
    expect(phone).not.toHaveAttribute('aria-invalid')
  })

  it('flags a malformed booker email and a missing one differently', () => {
    renderStep()
    const email = byName('booker_email')
    // Missing → Required.
    fireEvent.blur(email)
    expect(document.getElementById('booker-email-error')).toHaveTextContent(
      'Required',
    )
    // Present but no '@' → format message.
    fireEvent.change(email, { target: { value: 'ada-at-example' } })
    fireEvent.blur(email)
    expect(document.getElementById('booker-email-error')).toHaveTextContent(
      /valid email/i,
    )
    // Valid → no error.
    fireEvent.change(email, { target: { value: 'ada@example.com' } })
    expect(email).not.toHaveAttribute('aria-invalid')
  })

  it('flags an added participant’s required phone on blur (landr-nkbi)', () => {
    renderStep()
    fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    const phone = byName('participant_2_phone')
    expect(phone).not.toHaveAttribute('aria-invalid')
    fireEvent.blur(phone)
    expect(phone).toHaveAttribute('aria-invalid', 'true')
    expect(document.getElementById('p-0-phone-error')).toHaveTextContent(
      'Required',
    )
  })

  it('never flags an OPTIONAL field (participant email) on blur', () => {
    renderStep()
    fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    const email = byName('participant_2_email')
    fireEvent.blur(email)
    expect(email).not.toHaveAttribute('aria-invalid')
    expect(document.getElementById('p-0-email-error')).toBeNull()
  })
})

// landr-79re: the mobile path. On mobile, blur fires unreliably, so the
// onBlur-only touch never armed and an incomplete form showed NO red borders
// — the customer was stuck with nothing flagged. Tapping Continue (always
// tappable now) must reveal EVERY empty required field's error without any
// field having been blurred, and must NOT advance.
describe('DetailsStep — reveal required errors on Continue tap (mobile, landr-79re)', () => {
  function renderStep(onConfirm = vi.fn()) {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    return onConfirm
  }

  it('flags ALL empty booker required fields on a Continue tap without any blur', () => {
    const onConfirm = renderStep()
    // No field is touched (no blur) — simulating the mobile case where blur
    // never fires. Sanity-check nothing is flagged before the tap.
    expect(byName('booker_first_name')).not.toHaveAttribute('aria-invalid')

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    // Every empty booker required field is now flagged with aria-invalid + a
    // 'Required' message, and the form did NOT advance.
    expect(byName('booker_first_name')).toHaveAttribute('aria-invalid', 'true')
    expect(byName('booker_last_name')).toHaveAttribute('aria-invalid', 'true')
    expect(byName('booker_email')).toHaveAttribute('aria-invalid', 'true')
    expect(byName('booker_phone')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getAllByText('Required').length).toBeGreaterThanOrEqual(4)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('flags an empty participant phone + last name on a Continue tap without any blur', () => {
    const onConfirm = renderStep()
    fillBooker() // booker complete; the gap is on the added participant
    fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    fireEvent.change(byName('participant_2_first_name'), {
      target: { value: 'Grace' },
    })
    // Leave last name + phone empty — and blur NOTHING (mobile).

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(byName('participant_2_last_name')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(byName('participant_2_phone')).toHaveAttribute('aria-invalid', 'true')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('focuses the first invalid required field after a failed Continue tap', () => {
    renderStep()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    // First required field is the booker first name → it receives focus so the
    // mobile customer is taken straight to it.
    expect(document.activeElement).toBe(byName('booker_first_name'))
  })
})

// landr-fn4i / landr-5krc (widget half of landr-5krc): the optional
// member-perk code field + the OTP request fired on email blur.
describe('DetailsStep — member-perk OTP entry (landr-fn4i)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not show the code field before the email has been blurred', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        operatorToken="para42"
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect(
      screen.queryByTestId('member-perk-otp-section'),
    ).not.toBeInTheDocument()
  })

  it('fires requestSubscriptionPerkOtp on blur once the email looks valid, and reveals the code field', () => {
    const spy = vi
      .spyOn(client, 'requestSubscriptionPerkOtp')
      .mockResolvedValue({ ok: true })
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        operatorToken="para42"
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    const email = byName('booker_email')
    fireEvent.change(email, { target: { value: 'ada@example.com' } })
    fireEvent.blur(email)
    expect(spy).toHaveBeenCalledWith('para42', 'ada@example.com')
    expect(screen.getByTestId('member-perk-otp-section')).toBeInTheDocument()
    expect(
      screen.getByText(/enter the 6-digit code we emailed you/i),
    ).toBeInTheDocument()
  })

  it('does NOT fire the request (or show the field) on a blur with no email / an "@"-less value', () => {
    const spy = vi
      .spyOn(client, 'requestSubscriptionPerkOtp')
      .mockResolvedValue({ ok: true })
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        operatorToken="para42"
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    const email = byName('booker_email')
    // Blank blur — nothing to request.
    fireEvent.blur(email)
    expect(spy).not.toHaveBeenCalled()
    expect(
      screen.queryByTestId('member-perk-otp-section'),
    ).not.toBeInTheDocument()
    // Present but no '@' — same as above (matches the existing
    // isFieldInvalid loose email check the rest of this file already uses).
    fireEvent.change(email, { target: { value: 'not-an-email' } })
    fireEvent.blur(email)
    expect(spy).not.toHaveBeenCalled()
    expect(
      screen.queryByTestId('member-perk-otp-section'),
    ).not.toBeInTheDocument()
  })

  it('does not re-fire on a second blur of the SAME unchanged email (dedup, rate-limit friendly)', () => {
    const spy = vi
      .spyOn(client, 'requestSubscriptionPerkOtp')
      .mockResolvedValue({ ok: true })
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        operatorToken="para42"
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    const email = byName('booker_email')
    fireEvent.change(email, { target: { value: 'ada@example.com' } })
    fireEvent.blur(email)
    // Tab away and back, blurring the unchanged field again.
    fireEvent.blur(email)
    fireEvent.blur(email)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('fires again when the email is EDITED before the next blur', () => {
    const spy = vi
      .spyOn(client, 'requestSubscriptionPerkOtp')
      .mockResolvedValue({ ok: true })
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        operatorToken="para42"
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    const email = byName('booker_email')
    fireEvent.change(email, { target: { value: 'ada@example.com' } })
    fireEvent.blur(email)
    fireEvent.change(email, { target: { value: 'ada2@example.com' } })
    fireEvent.blur(email)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenNthCalledWith(1, 'para42', 'ada@example.com')
    expect(spy).toHaveBeenNthCalledWith(2, 'para42', 'ada2@example.com')
  })

  it('never surfaces a network failure to the customer (swallowed, field stays usable)', () => {
    const spy = vi
      .spyOn(client, 'requestSubscriptionPerkOtp')
      .mockRejectedValue(new Error('network down'))
    expect(() => {
      render(
        <DetailsStep
          product={makeProduct()}
          selection={DAYS_SELECTION}
          operatorToken="para42"
          onBack={vi.fn()}
          onConfirm={vi.fn()}
        />,
      )
      const email = byName('booker_email')
      fireEvent.change(email, { target: { value: 'ada@example.com' } })
      fireEvent.blur(email)
    }).not.toThrow()
    expect(spy).toHaveBeenCalledTimes(1)
    // The field still appears — the customer is never told anything failed.
    expect(screen.getByTestId('member-perk-otp-section')).toBeInTheDocument()
    expect(screen.queryByTestId('review-error')).not.toBeInTheDocument()
  })

  it('is dismissible/ignorable: Continue advances with the code left blank', () => {
    vi.spyOn(client, 'requestSubscriptionPerkOtp').mockResolvedValue({
      ok: true,
    })
    const onConfirm = vi.fn()
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        operatorToken="para42"
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />,
    )
    fillBooker()
    fireEvent.blur(byName('booker_email'))
    expect(screen.getByTestId('member-perk-otp-section')).toBeInTheDocument()
    // Deliberately leave the code blank.
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('sanitises the code input to digits only, capped at 6, and lifts it via onMemberPerkOtpChange', () => {
    vi.spyOn(client, 'requestSubscriptionPerkOtp').mockResolvedValue({
      ok: true,
    })
    const onChange = vi.fn()
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        operatorToken="para42"
        onBack={vi.fn()}
        onConfirm={vi.fn()}
        onMemberPerkOtpChange={onChange}
      />,
    )
    fireEvent.blur(byName('booker_email')) // no email yet — field stays hidden
    fireEvent.change(byName('booker_email'), {
      target: { value: 'ada@example.com' },
    })
    fireEvent.blur(byName('booker_email'))
    const code = screen.getByTestId('member-perk-otp-input')
    fireEvent.change(code, { target: { value: '12a3-45 6789' } })
    expect(code).toHaveValue('123456')
    expect(onChange).toHaveBeenLastCalledWith('123456')
  })

  it('restores a prior code + shows the field immediately via initialMemberPerkOtp/initialBooker (Back-restore), without re-firing the request', () => {
    const spy = vi
      .spyOn(client, 'requestSubscriptionPerkOtp')
      .mockResolvedValue({ ok: true })
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        operatorToken="para42"
        initialBooker={{
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
          phone: '+34 600 000 000',
        }}
        initialMemberPerkOtp="654321"
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    // Shown immediately, pre-filled — no blur needed on re-entry.
    const code = screen.getByTestId('member-perk-otp-input')
    expect(code).toHaveValue('654321')
    // A Back-restore remount must NOT burn another OTP request for an email
    // that was already blurred on the way forward.
    expect(spy).not.toHaveBeenCalled()
  })

  it('does not throw when onMemberPerkOtpChange is not provided (backward compat)', () => {
    vi.spyOn(client, 'requestSubscriptionPerkOtp').mockResolvedValue({
      ok: true,
    })
    expect(() => {
      render(
        <DetailsStep
          product={makeProduct()}
          selection={DAYS_SELECTION}
          operatorToken="para42"
          onBack={vi.fn()}
          onConfirm={vi.fn()}
        />,
      )
      fireEvent.change(byName('booker_email'), {
        target: { value: 'ada@example.com' },
      })
      fireEvent.blur(byName('booker_email'))
      fireEvent.change(screen.getByTestId('member-perk-otp-input'), {
        target: { value: '123456' },
      })
    }).not.toThrow()
  })
})
