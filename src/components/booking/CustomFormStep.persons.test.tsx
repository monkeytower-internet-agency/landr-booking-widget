/**
 * landr-9d82r.4 — per-person form fields in CustomFormStep.
 *
 * participant-scope fields are asked once per activity participant,
 * guest-scope fields once per person (participants + companions), grouped
 * under each person's name; booking-scope fields render as before.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CustomFormStep } from './CustomFormStep'
import type {
  FlowFieldDef,
  FlowFieldScope,
  FormResponseEntry,
  ProductFlowResponse,
} from '@/api/flowTypes'

vi.mock('@/api/client', () => ({ getProductFlow: vi.fn() }))

function field(
  key: string,
  over: Partial<FlowFieldDef> & { scope?: FlowFieldScope } = {},
): FlowFieldDef {
  return {
    key,
    field_type: 'text',
    label: key,
    label_localized: null,
    help_text: null,
    help_text_localized: null,
    required: false,
    position: 0,
    options: null,
    validation: null,
    visibility_rule: null,
    scope: 'booking',
    ...over,
  }
}

function flowOf(fields: FlowFieldDef[]): ProductFlowResponse {
  return {
    modules: [
      {
        kind: 'custom_form',
        position: 0,
        form: {
          key: 'intake',
          version: 1,
          name: 'Intake',
          name_localized: null,
          fields: fields.map((f, i) => ({ ...f, position: i })),
        },
      },
    ],
  }
}

const ann = { id: 'pa', first_name: 'Ann', last_name: 'Pilot' }
const ben = { id: 'pb', first_name: 'Ben', last_name: 'Pilot' }
const cleo = { id: 'cc', first_name: 'Cleo', last_name: '' }

const fields: FlowFieldDef[] = [
  field('licence', { scope: 'booking' }),
  field('weight_kg', {
    scope: 'participant',
    field_type: 'number',
    required: true,
    validation: { unit: 'kg', min: 30, max: 200 },
  }),
  field('diet', {
    scope: 'guest',
    field_type: 'select',
    options: [
      { value: 'vegan', label: 'Vegan', label_localized: null },
      { value: 'none', label: 'None', label_localized: null },
    ],
  }),
]

function renderStep(
  over: Partial<Parameters<typeof CustomFormStep>[0]> = {},
  flowFields = fields,
) {
  const onConfirm = vi.fn<(e: FormResponseEntry, raw: Record<string, unknown>) => void>()
  const utils = render(
    <CustomFormStep
      operatorToken="tok"
      productId="p1"
      formKey="intake"
      productName="Tandem"
      flow={flowOf(flowFields)}
      participants={[ann, ben]}
      companions={[cleo]}
      onBack={vi.fn()}
      onConfirm={onConfirm}
      {...over}
    />,
  )
  return { onConfirm, ...utils }
}

const input = (id: string) => screen.getByTestId(id) as HTMLInputElement

describe('CustomFormStep — per-person rendering counts', () => {
  it('asks participant fields per participant and guest fields per person', () => {
    renderStep()
    // weight (participant scope): 2 participants, no companion.
    expect(screen.getByTestId('cf-participant-0-field-weight_kg')).toBeTruthy()
    expect(screen.getByTestId('cf-participant-1-field-weight_kg')).toBeTruthy()
    expect(screen.queryByTestId('cf-companion-0-field-weight_kg')).toBeNull()
    // diet (guest scope): 2 participants + 1 companion.
    expect(screen.getByTestId('cf-participant-0-field-diet')).toBeTruthy()
    expect(screen.getByTestId('cf-participant-1-field-diet')).toBeTruthy()
    expect(screen.getByTestId('cf-companion-0-field-diet')).toBeTruthy()
    // booking field once, with the unchanged test id.
    expect(screen.getAllByTestId('cf-field-licence')).toHaveLength(1)
  })

  it('groups the fields under each person name', () => {
    renderStep()
    expect(screen.getByTestId('cf-participant-0-name').textContent).toBe('Ann Pilot')
    expect(screen.getByTestId('cf-participant-1-name').textContent).toBe('Ben Pilot')
    expect(screen.getByTestId('cf-companion-0-name').textContent).toBe('Cleo')
    const annSection = screen.getByTestId('cf-participant-0')
    expect(annSection.querySelector('[data-testid="cf-participant-0-field-diet"]')).toBeTruthy()
  })

  it('renders the number unit suffix', () => {
    renderStep()
    expect(screen.getByTestId('cf-participant-0-unit-weight_kg').textContent).toBe('kg')
  })

  it('0 companions: guest fields are still asked for each participant', () => {
    renderStep({ companions: [] })
    expect(screen.getByTestId('cf-participant-0-field-diet')).toBeTruthy()
    expect(screen.getByTestId('cf-participant-1-field-diet')).toBeTruthy()
    expect(screen.queryByTestId('cf-companion-0')).toBeNull()
  })

  it('booking-only form: identical UI, no person sections, no person payload', async () => {
    const { onConfirm } = renderStep({}, [field('licence', { required: true })])
    expect(screen.queryByTestId('cf-person-hint')).toBeNull()
    expect(screen.queryByTestId('cf-participant-0')).toBeNull()
    fireEvent.change(input('cf-field-licence'), { target: { value: 'yes' } })
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    const entry = onConfirm.mock.calls[0]![0]
    expect(entry).toEqual({ form_key: 'intake', answers: { licence: 'yes' } })
    expect('participant_answers' in entry).toBe(false)
    expect('companion_answers' in entry).toBe(false)
  })

  it('an older API without scope behaves as booking scope', () => {
    const legacy = field('x')
    delete legacy.scope
    renderStep({}, [legacy])
    expect(screen.getByTestId('cf-field-x')).toBeTruthy()
    expect(screen.queryByTestId('cf-participant-0')).toBeNull()
  })

  it('renders the date input', () => {
    renderStep({}, [field('dob', { scope: 'participant', field_type: 'date' })])
    expect(input('cf-participant-0-field-dob').type).toBe('date')
    expect(input('cf-participant-1-field-dob').type).toBe('date')
  })
})

describe('CustomFormStep — required per person blocks Next', () => {
  it('stays disabled until every person has answered the required field', () => {
    renderStep()
    const submit = screen.getByTestId('cf-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.change(input('cf-participant-0-field-weight_kg'), { target: { value: '70' } })
    expect(submit.disabled).toBe(true)
    fireEvent.change(input('cf-participant-1-field-weight_kg'), { target: { value: '82' } })
    expect(submit.disabled).toBe(false)
  })

  it('a person added in Details (no answers yet) blocks Next again', () => {
    const { rerender } = renderStep()
    fireEvent.change(input('cf-participant-0-field-weight_kg'), { target: { value: '70' } })
    fireEvent.change(input('cf-participant-1-field-weight_kg'), { target: { value: '82' } })
    const submit = screen.getByTestId('cf-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(false)
    rerender(
      <CustomFormStep
        operatorToken="tok"
        productId="p1"
        formKey="intake"
        productName="Tandem"
        flow={flowOf(fields)}
        participants={[ann, ben, { id: 'pd', first_name: 'Dan', last_name: '' }]}
        companions={[cleo]}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect((screen.getByTestId('cf-submit') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('cf-participant-2-field-weight_kg')).toBeTruthy()
  })

  it('out-of-range numbers are rejected per person', async () => {
    renderStep()
    fireEvent.change(input('cf-participant-0-field-weight_kg'), { target: { value: '5' } })
    fireEvent.change(input('cf-participant-1-field-weight_kg'), { target: { value: '82' } })
    expect((screen.getByTestId('cf-submit') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('CustomFormStep — payload mapping by index', () => {
  it('participant_answers[i] ↔ participants[i], companion_answers[j] ↔ companions[j]', async () => {
    const { onConfirm } = renderStep()
    fireEvent.change(input('cf-field-licence'), { target: { value: 'yes' } })
    fireEvent.change(input('cf-participant-0-field-weight_kg'), { target: { value: '70' } })
    fireEvent.change(input('cf-participant-1-field-weight_kg'), { target: { value: '82' } })
    fireEvent.change(input('cf-participant-0-field-diet'), { target: { value: 'vegan' } })
    fireEvent.change(input('cf-participant-1-field-diet'), { target: { value: 'none' } })
    fireEvent.change(input('cf-companion-0-field-diet'), { target: { value: 'vegan' } })
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    const [entry, raw] = onConfirm.mock.calls[0]!
    expect(entry).toEqual({
      form_key: 'intake',
      answers: { licence: 'yes' },
      participant_answers: [
        { weight_kg: '70', diet: 'vegan' },
        { weight_kg: '82', diet: 'none' },
      ],
      companion_answers: [{ diet: 'vegan' }],
    })
    // The draft keeps the per-person answers keyed by stable member id.
    expect(raw.__person_answers).toEqual({
      pa: { weight_kg: '70', diet: 'vegan' },
      pb: { weight_kg: '82', diet: 'none' },
      cc: { diet: 'vegan' },
    })
  })

  it('companion_answers is omitted when the form has no guest-scope field', async () => {
    const { onConfirm } = renderStep({}, [
      field('weight_kg', { scope: 'participant', field_type: 'number' }),
    ])
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    const entry = onConfirm.mock.calls[0]![0]
    expect(entry.participant_answers).toEqual([{}, {}])
    expect('companion_answers' in entry).toBe(false)
  })

  it('guest-only field with 0 companions: participant_answers only', async () => {
    const { onConfirm } = renderStep({ companions: [] }, [field('diet', { scope: 'guest' })])
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    const entry = onConfirm.mock.calls[0]![0]
    expect(entry.participant_answers).toHaveLength(2)
    expect('companion_answers' in entry).toBe(false)
  })

  it('restores per-person answers from the draft by member id; a removed person is dropped', async () => {
    // Ben (pb) was removed in Details after answering; Cleo is now participant 1.
    const { onConfirm } = renderStep({
      participants: [ann, { id: 'pc', first_name: 'Cleo', last_name: '' }],
      companions: [],
      initialAnswers: {
        licence: 'yes',
        __person_answers: {
          pa: { weight_kg: '70' },
          pb: { weight_kg: '82' },
        },
      },
    })
    expect(input('cf-participant-0-field-weight_kg').value).toBe('70')
    expect(input('cf-participant-1-field-weight_kg').value).toBe('')
    fireEvent.change(input('cf-participant-1-field-weight_kg'), { target: { value: '60' } })
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    const [entry, raw] = onConfirm.mock.calls[0]!
    expect(entry.participant_answers).toEqual([{ weight_kg: '70' }, { weight_kg: '60' }])
    expect(Object.keys(raw.__person_answers as object).sort()).toEqual(['pa', 'pc'])
  })
})

describe('CustomFormStep — visibility per person', () => {
  const vis: FlowFieldDef[] = [
    field('mode', {
      scope: 'booking',
      field_type: 'select',
      options: [
        { value: 'a', label: 'A', label_localized: null },
        { value: 'b', label: 'B', label_localized: null },
      ],
    }),
    field('allergy', { scope: 'guest', field_type: 'select', options: [
      { value: 'nuts', label: 'Nuts', label_localized: null },
      { value: 'none', label: 'None', label_localized: null },
    ] }),
    field('allergy_note', {
      scope: 'guest',
      visibility_rule: { field_key: 'allergy', op: 'eq', value: 'nuts' },
    }),
    // A booking rule targeting a person key sees it absent (eq → hidden).
    field('booking_only', {
      scope: 'booking',
      visibility_rule: { field_key: 'allergy', op: 'eq', value: 'nuts' },
    }),
    // A person field may depend on a booking field.
    field('b_only', {
      scope: 'participant',
      visibility_rule: { field_key: 'mode', op: 'eq', value: 'b' },
    }),
  ]

  it('a rule on a person field is evaluated against that person only', () => {
    renderStep({}, vis)
    expect(screen.queryByTestId('cf-participant-0-field-allergy_note')).toBeNull()
    fireEvent.change(input('cf-participant-0-field-allergy'), { target: { value: 'nuts' } })
    expect(screen.getByTestId('cf-participant-0-field-allergy_note')).toBeTruthy()
    // Ben and Cleo are untouched.
    expect(screen.queryByTestId('cf-participant-1-field-allergy_note')).toBeNull()
    expect(screen.queryByTestId('cf-companion-0-field-allergy_note')).toBeNull()
    // A booking field never sees a person's answer.
    expect(screen.queryByTestId('cf-field-booking_only')).toBeNull()
  })

  it('a person field can depend on a booking field', () => {
    renderStep({}, vis)
    expect(screen.queryByTestId('cf-participant-0-field-b_only')).toBeNull()
    fireEvent.change(input('cf-field-mode'), { target: { value: 'b' } })
    expect(screen.getByTestId('cf-participant-0-field-b_only')).toBeTruthy()
    expect(screen.getByTestId('cf-participant-1-field-b_only')).toBeTruthy()
    // participant-scope: never asked of the companion.
    expect(screen.queryByTestId('cf-companion-0-field-b_only')).toBeNull()
  })

  it('a hidden person answer is pruned from that person\'s payload', async () => {
    const { onConfirm } = renderStep({}, vis)
    fireEvent.change(input('cf-participant-0-field-allergy'), { target: { value: 'nuts' } })
    fireEvent.change(input('cf-participant-0-field-allergy_note'), { target: { value: 'peanuts' } })
    fireEvent.change(input('cf-participant-0-field-allergy'), { target: { value: 'none' } })
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    const entry = onConfirm.mock.calls[0]![0]
    expect(entry.participant_answers![0]).toEqual({ allergy: 'none' })
  })

  it('a person with no visible field gets no section', () => {
    renderStep({}, [
      field('b_only', {
        scope: 'participant',
        visibility_rule: { field_key: 'mode', op: 'eq', value: 'b' },
      }),
    ])
    expect(screen.queryByTestId('cf-participant-0')).toBeNull()
    expect(screen.queryByTestId('cf-person-hint')).toBeNull()
  })
})

// landr-kcxx5.4: additive props used by the /details/{token} page.
describe('CustomFormStep — details-page props', () => {
  it('submitLabel replaces Continue, hideCustomerComment drops the comment field, no onBack = no back button', () => {
    renderStep({ submitLabel: 'Submit', hideCustomerComment: true, onBack: undefined })
    expect(screen.getByTestId('cf-submit')).toHaveTextContent('Submit')
    expect(screen.queryByText(/anything we should know/i)).toBeNull()
    expect(screen.queryByTestId('step-back-button')).toBeNull()
  })

  it('keeps the booking-flow defaults otherwise', () => {
    renderStep()
    expect(screen.getByTestId('cf-submit')).toHaveTextContent(/continue/i)
    expect(screen.getByTestId('step-back-button')).toBeTruthy()
  })
})
