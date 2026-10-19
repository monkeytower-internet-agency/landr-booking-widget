import type { CustomerDetails } from '@/api/customerDetailsTypes'
import type { FlowFieldDef, FlowFieldScope } from '@/api/flowTypes'

export function field(
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

export const DECLARATIONS_FIELDS: FlowFieldDef[] = [
  field('licence', { scope: 'booking', label: 'Licence number', position: 0 }),
  field('weight_kg', {
    scope: 'participant',
    field_type: 'number',
    required: true,
    label: 'Weight',
    position: 1,
    validation: { unit: 'kg', min: 30, max: 200 },
  }),
  field('diet', {
    scope: 'guest',
    field_type: 'select',
    label: 'Diet',
    position: 2,
    options: [
      { value: 'vegan', label: 'Vegan', label_localized: null },
      { value: 'none', label: 'None', label_localized: null },
    ],
  }),
]

export function declarationsModule(position = 0) {
  return {
    kind: 'custom_form',
    position,
    form: {
      key: 'declarations',
      version: 1,
      name: 'Declarations',
      name_localized: null,
      fields: DECLARATIONS_FIELDS,
    },
  }
}

export function insuranceModule(position = 1) {
  return {
    kind: 'custom_form',
    position,
    form: {
      key: 'insurance',
      version: 1,
      name: 'Insurance',
      name_localized: null,
      fields: [field('insurer', { required: true, label: 'Insurer' })],
    },
  }
}

export const PEOPLE: NonNullable<CustomerDetails['people']> = [
  { booking_participant_id: 'pa', kind: 'participant', display_name: 'Ann Pilot' },
  { booking_participant_id: 'pb', kind: 'participant', display_name: 'Ben Pilot' },
  { booking_participant_id: 'gc', kind: 'guest', display_name: 'Cleo Guest' },
]

/** One product, one form (declarations), three people. */
export const PENDING_DETAILS: CustomerDetails = {
  pending: true,
  requested_at: '2026-10-19T08:00:00Z',
  completed_at: null,
  forms: [
    {
      product_id: 'p1',
      product_name: 'Tandem Flight',
      modules: [declarationsModule()],
    },
  ],
  people: PEOPLE,
  answers: [],
}
