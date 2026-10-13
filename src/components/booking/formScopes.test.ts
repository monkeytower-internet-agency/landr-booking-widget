import { describe, expect, it } from 'vitest'
import {
  alignFormResponses,
  buildFormPeople,
  fieldsForKind,
  parseFormResponseErrors,
} from './formScopes'
import type { FlowFieldDef, FormResponseEntry } from '@/api/flowTypes'

const f = (key: string, scope?: FlowFieldDef['scope']): FlowFieldDef => ({
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
  scope,
})

describe('fieldsForKind', () => {
  const all = [f('b', 'booking'), f('p', 'participant'), f('g', 'guest'), f('legacy')]
  it('participants answer participant + guest scope', () => {
    expect(fieldsForKind(all, 'participant').map((x) => x.key)).toEqual(['p', 'g'])
  })
  it('companions answer guest scope only', () => {
    expect(fieldsForKind(all, 'companion').map((x) => x.key)).toEqual(['g'])
  })
})

describe('buildFormPeople', () => {
  it('keys by member id, else by unified party index; falls back to a numbered name', () => {
    const people = buildFormPeople(
      [{ id: 'a', first_name: 'Ann', last_name: 'X' }, { first_name: '' }],
      [{ first_name: 'Cleo' }],
      'Person',
    )
    expect(people.map((p) => [p.key, p.kind, p.index, p.name])).toEqual([
      ['a', 'participant', 0, 'Ann X'],
      ['1', 'participant', 1, 'Person 2'],
      ['2', 'companion', 0, 'Cleo'],
    ])
  })
})

describe('alignFormResponses', () => {
  const base: FormResponseEntry = { form_key: 'k', answers: {} }
  it('leaves person-less entries untouched', () => {
    const entries = [base]
    expect(alignFormResponses(entries, 2, 1)[0]).toBe(base)
  })
  it('clamps extra and pads missing entries to the current headcount', () => {
    const e: FormResponseEntry = {
      ...base,
      participant_answers: [{ a: '1' }, { a: '2' }, { a: '3' }],
      companion_answers: [{ d: 'x' }],
    }
    const out = alignFormResponses([e], 2, 2)[0]!
    expect(out.participant_answers).toEqual([{ a: '1' }, { a: '2' }])
    expect(out.companion_answers).toEqual([{ d: 'x' }, {}])
  })
  it('drops companion_answers when nobody is left', () => {
    const e: FormResponseEntry = { ...base, companion_answers: [{ d: 'x' }] }
    expect('companion_answers' in alignFormResponses([e], 1, 0)[0]!).toBe(false)
  })
})

describe('parseFormResponseErrors', () => {
  it('maps per-person errors onto the unified party index', () => {
    const items = parseFormResponseErrors(
      {
        error: 'form_responses_invalid',
        errors: [
          { field_key: 'weight_kg', code: 'required', message: 'weight_kg is required', person: { kind: 'participant', index: 1 } },
          { field_key: 'diet', code: 'option', message: 'bad option', person: { kind: 'companion', index: 0 } },
          { field_key: 'licence', code: 'required' },
        ],
      },
      2,
    )
    expect(items).toEqual([
      { fieldKey: 'weight_kg', message: 'weight_kg is required', partyIndex: 1 },
      { fieldKey: 'diet', message: 'bad option', partyIndex: 2 },
      { fieldKey: 'licence', message: 'licence: required', partyIndex: null },
    ])
  })
  it('returns null for any other detail', () => {
    expect(parseFormResponseErrors({ error: 'nope' }, 1)).toBeNull()
    expect(parseFormResponseErrors('x', 1)).toBeNull()
    expect(parseFormResponseErrors(null, 1)).toBeNull()
  })
})
