import { describe, expect, it } from 'vitest'
import type { FlowFieldDef, ProductFlowResponse } from '@/api/flowTypes'
import {
  findOtherLanguagesField,
  otherLanguagesFromDraft,
  withOtherLanguages,
} from './otherLanguages'

function field(overrides: Partial<FlowFieldDef> = {}): FlowFieldDef {
  return {
    key: 'other_languages',
    field_type: 'text',
    label: 'Other languages spoken',
    label_localized: null,
    help_text: null,
    help_text_localized: null,
    required: false,
    position: 5,
    options: null,
    validation: { max_length: 200 },
    visibility_rule: null,
    ...overrides,
  }
}

function flow(f: FlowFieldDef): ProductFlowResponse {
  return {
    modules: [
      { kind: 'pickup', position: 0, form: null },
      {
        kind: 'custom_form',
        position: 1,
        form: { key: 'customer_declarations', version: 1, name: 'D', name_localized: null, fields: [f] },
      },
    ],
  }
}

describe('findOtherLanguagesField', () => {
  it('finds the optional text field and its form', () => {
    expect(findOtherLanguagesField(flow(field()))?.formKey).toBe('customer_declarations')
  })
  it('leaves required or conditionally visible fields on the form', () => {
    expect(findOtherLanguagesField(flow(field({ required: true })))).toBeNull()
    expect(
      findOtherLanguagesField(
        flow(field({ visibility_rule: { field: 'x', op: 'eq', value: 'y' } as never })),
      ),
    ).toBeNull()
  })
  it('tolerates a missing flow', () => {
    expect(findOtherLanguagesField(null)).toBeNull()
    expect(findOtherLanguagesField(undefined)).toBeNull()
  })
})

describe('draft slot', () => {
  it('writes without touching the form\'s other answers', () => {
    const next = withOtherLanguages({ f: { a: true }, g: { b: 1 } }, 'f', 'Italian')
    expect(next).toEqual({ f: { a: true, other_languages: 'Italian' }, g: { b: 1 } })
    expect(otherLanguagesFromDraft(next, 'f')).toBe('Italian')
    expect(otherLanguagesFromDraft(undefined, 'f')).toBe('')
  })
})
