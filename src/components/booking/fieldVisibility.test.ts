/**
 * landr-71kz.4 — CONTRACT-PARITY tests for isFieldVisible.
 *
 * These tests MUST remain in exact parity with the Python server tests in
 * `test_form_responses_validation.py::test_is_field_visible_*`. For each
 * op × (scalar/list) × type case in the VISIBILITY-RULE CONTRACT (pinned in
 * the landr-71kz.2 handoff §VISIBILITY-RULE CONTRACT), we assert isFieldVisible
 * returns the same boolean the server returns.
 *
 * Fixtures are kept self-contained (no divergent hand-mocks — landr-9ut4 lesson).
 *
 * Coverage:
 *   - null rule → always visible
 *   - eq: scalar string match / mismatch
 *   - eq: list answer → membership (not whole-list equality)
 *   - neq: scalar string
 *   - neq: list answer → NOT-member
 *   - in: scalar answer → value ∈ rule array
 *   - in: list answer → any intersection → visible
 *   - truthy: non-empty string (incl. whitespace-only) → visible
 *   - truthy: empty string → hidden
 *   - truthy: absent answer → hidden
 *   - truthy: empty list → hidden
 *   - truthy: non-empty list → visible
 *   - fail-open: missing field_key → visible
 *   - fail-open: unknown op → visible
 *   - fail-open: malformed in value (not an array) → visible
 *   - fail-open: null visibility_rule → visible
 *   - no-throw: malformed field defs (never throws)
 *   - neq: absent scalar → visible (absent ≠ anything)
 */
import { describe, expect, it } from 'vitest'
import { isFieldVisible, pruneHiddenAnswers } from './fieldVisibility'
import type { FlowFieldDef } from '@/api/flowTypes'

// ─── Fixture factory ──────────────────────────────────────────────────────────

function field(
  overrides: Partial<FlowFieldDef> & { key: string },
): FlowFieldDef {
  return {
    field_type: 'text',
    label: overrides.key,
    label_localized: null,
    help_text: null,
    help_text_localized: null,
    required: false,
    position: 0,
    options: null,
    validation: null,
    visibility_rule: null,
    ...overrides,
  }
}

// ─── Null / always-visible ────────────────────────────────────────────────────

describe('isFieldVisible — null rule', () => {
  it('returns true when visibility_rule is null', () => {
    expect(isFieldVisible(field({ key: 'f' }), {})).toBe(true)
  })
})

// ─── eq op ───────────────────────────────────────────────────────────────────

describe('isFieldVisible — op: eq, scalar answer', () => {
  const f = field({
    key: 'detail',
    visibility_rule: { field_key: 'kind', op: 'eq', value: 'other' },
  })

  it('visible when scalar answer matches rule value', () => {
    expect(isFieldVisible(f, { kind: 'other' })).toBe(true)
  })

  it('hidden when scalar answer does not match', () => {
    expect(isFieldVisible(f, { kind: 'standard' })).toBe(false)
  })

  it('hidden when referenced field is absent', () => {
    expect(isFieldVisible(f, {})).toBe(false)
  })

  it('string-coerces value (rule value: 3, answer: "3")', () => {
    const fNum = field({
      key: 'detail',
      visibility_rule: { field_key: 'count', op: 'eq', value: 3 },
    })
    expect(isFieldVisible(fNum, { count: '3' })).toBe(true)
    expect(isFieldVisible(fNum, { count: '4' })).toBe(false)
  })
})

describe('isFieldVisible — op: eq, list answer (checkbox/multiselect)', () => {
  const f = field({
    key: 'gated',
    visibility_rule: { field_key: 'consent', op: 'eq', value: 'agree' },
  })

  it('visible when list contains the rule value', () => {
    // CONTRACT: eq against a list uses MEMBERSHIP, not whole-list equality.
    expect(isFieldVisible(f, { consent: ['agree'] })).toBe(true)
    expect(isFieldVisible(f, { consent: ['agree', 'other'] })).toBe(true)
  })

  it('hidden when list does NOT contain the rule value', () => {
    expect(isFieldVisible(f, { consent: [] })).toBe(false)
    expect(isFieldVisible(f, { consent: ['other'] })).toBe(false)
  })
})

// ─── neq op ──────────────────────────────────────────────────────────────────

describe('isFieldVisible — op: neq, scalar answer', () => {
  const f = field({
    key: 'extra',
    visibility_rule: { field_key: 'mode', op: 'neq', value: 'basic' },
  })

  it('visible when scalar answer differs from rule value', () => {
    expect(isFieldVisible(f, { mode: 'advanced' })).toBe(true)
  })

  it('hidden when scalar answer equals rule value', () => {
    expect(isFieldVisible(f, { mode: 'basic' })).toBe(false)
  })

  it('visible when referenced field is absent (absent ≠ anything)', () => {
    // CONTRACT §5: neq of an absent answer → visible (absent ≠ value → show).
    expect(isFieldVisible(f, {})).toBe(true)
  })
})

describe('isFieldVisible — op: neq, list answer', () => {
  const f = field({
    key: 'extra',
    visibility_rule: { field_key: 'tags', op: 'neq', value: 'skip' },
  })

  it('visible when list does NOT contain the rule value', () => {
    expect(isFieldVisible(f, { tags: [] })).toBe(true)
    expect(isFieldVisible(f, { tags: ['other'] })).toBe(true)
  })

  it('hidden when list CONTAINS the rule value', () => {
    // CONTRACT: neq against a list: hidden when value IS a member.
    expect(isFieldVisible(f, { tags: ['skip'] })).toBe(false)
    expect(isFieldVisible(f, { tags: ['skip', 'other'] })).toBe(false)
  })
})

// ─── in op ────────────────────────────────────────────────────────────────────

describe('isFieldVisible — op: in, scalar answer', () => {
  const f = field({
    key: 'extra',
    visibility_rule: { field_key: 'kind', op: 'in', value: ['a', 'b', 'c'] },
  })

  it('visible when scalar answer is in the rule value array', () => {
    expect(isFieldVisible(f, { kind: 'a' })).toBe(true)
    expect(isFieldVisible(f, { kind: 'c' })).toBe(true)
  })

  it('hidden when scalar answer is NOT in the rule value array', () => {
    expect(isFieldVisible(f, { kind: 'd' })).toBe(false)
  })

  it('hidden when referenced field is absent', () => {
    expect(isFieldVisible(f, {})).toBe(false)
  })
})

describe('isFieldVisible — op: in, list answer', () => {
  const f = field({
    key: 'extra',
    visibility_rule: { field_key: 'tags', op: 'in', value: ['a', 'b'] },
  })

  it('visible when any list element is in the rule value array', () => {
    expect(isFieldVisible(f, { tags: ['a', 'z'] })).toBe(true)
    expect(isFieldVisible(f, { tags: ['b'] })).toBe(true)
  })

  it('hidden when NO list element is in the rule value array', () => {
    expect(isFieldVisible(f, { tags: [] })).toBe(false)
    expect(isFieldVisible(f, { tags: ['z'] })).toBe(false)
  })
})

// ─── truthy op ───────────────────────────────────────────────────────────────

describe('isFieldVisible — op: truthy', () => {
  const f = field({
    key: 'extra',
    visibility_rule: { field_key: 'name', op: 'truthy' },
  })

  it('visible when answer is a non-empty string', () => {
    expect(isFieldVisible(f, { name: 'Ada' })).toBe(true)
  })

  it('visible when answer is a whitespace-only string (CONTRACT: do NOT trim)', () => {
    // CONTRACT §4: whitespace-only string is truthy (Boolean("   ") === true).
    expect(isFieldVisible(f, { name: '   ' })).toBe(true)
  })

  it('hidden when answer is an empty string', () => {
    expect(isFieldVisible(f, { name: '' })).toBe(false)
  })

  it('hidden when referenced field is absent', () => {
    expect(isFieldVisible(f, {})).toBe(false)
  })

  it('visible when answer is a non-empty list', () => {
    expect(isFieldVisible(f, { name: ['a'] })).toBe(true)
  })

  it('hidden when answer is an empty list', () => {
    expect(isFieldVisible(f, { name: [] })).toBe(false)
  })
})

// ─── CROSS-REPO PARITY (landr-noyq) ────────────────────────────────────────────
// These EXACT cases are mirrored in the Python server suite
// (test_form_responses_validation.py::test_whole_number_float_value_canonicalizes,
// test_numeric_list_membership_with_float_value, test_null_value_with_absent_answer_contract,
// test_empty_array_truthy_is_hidden). They close the shared-oracle blind spot:
// both suites previously missed whole-number-float values, the null-value
// contract, and numeric-list membership. Each asserts the SAME boolean the
// server returns.

describe('isFieldVisible — parity: whole-number-float rule value (landr-noyq)', () => {
  it('value 3.0 matches answer "3" for eq/neq/in (JS String(3.0) === "3")', () => {
    const eq = field({
      key: 'd',
      visibility_rule: { field_key: 'n', op: 'eq', value: 3.0 },
    })
    expect(isFieldVisible(eq, { n: '3' })).toBe(true)
    expect(isFieldVisible(eq, { n: '4' })).toBe(false)

    const neq = field({
      key: 'd',
      visibility_rule: { field_key: 'n', op: 'neq', value: 3.0 },
    })
    expect(isFieldVisible(neq, { n: '3' })).toBe(false)
    expect(isFieldVisible(neq, { n: '4' })).toBe(true)

    const inOp = field({
      key: 'd',
      visibility_rule: { field_key: 'n', op: 'in', value: [3.0, 5.0] },
    })
    expect(isFieldVisible(inOp, { n: '3' })).toBe(true)
    expect(isFieldVisible(inOp, { n: '9' })).toBe(false)
  })

  it('a genuine fractional float (3.5) does NOT collapse', () => {
    const f = field({
      key: 'd',
      visibility_rule: { field_key: 'n', op: 'eq', value: 3.5 },
    })
    expect(isFieldVisible(f, { n: '3.5' })).toBe(true)
    expect(isFieldVisible(f, { n: '3' })).toBe(false)
  })

  it('numeric-list membership against a whole-number-float value', () => {
    const eq = field({
      key: 'd',
      visibility_rule: { field_key: 'picks', op: 'eq', value: 3.0 },
    })
    expect(isFieldVisible(eq, { picks: ['1', '3'] })).toBe(true)
    expect(isFieldVisible(eq, { picks: ['1', '2'] })).toBe(false)

    const inOp = field({
      key: 'd',
      visibility_rule: { field_key: 'picks', op: 'in', value: [3.0, 4.0] },
    })
    expect(isFieldVisible(inOp, { picks: ['3', '9'] })).toBe(true)
    expect(isFieldVisible(inOp, { picks: ['8', '9'] })).toBe(false)
  })
})

describe('isFieldVisible — parity: null-value contract (landr-noyq)', () => {
  it('eq with value null → hidden (null matches nothing; absent answer too)', () => {
    const f = field({
      key: 'd',
      visibility_rule: { field_key: 'ref', op: 'eq', value: null },
    })
    expect(isFieldVisible(f, {})).toBe(false) // absent answer → hidden
    expect(isFieldVisible(f, { ref: 'x' })).toBe(false) // null value matches nothing
  })

  it('neq with value null → visible (null ≠ anything; absent answer too)', () => {
    const f = field({
      key: 'd',
      visibility_rule: { field_key: 'ref', op: 'neq', value: null },
    })
    expect(isFieldVisible(f, {})).toBe(true) // absent answer → visible
    expect(isFieldVisible(f, { ref: 'x' })).toBe(true) // null ≠ anything → visible
  })
})

describe('isFieldVisible — parity: empty-array truthy is hidden (landr-noyq)', () => {
  it('empty list is NOT truthy → hidden; non-empty list → visible', () => {
    const f = field({
      key: 'd',
      visibility_rule: { field_key: 'boxes', op: 'truthy' },
    })
    expect(isFieldVisible(f, { boxes: [] })).toBe(false)
    expect(isFieldVisible(f, { boxes: ['a'] })).toBe(true)
  })
})

// ─── Fail-open contract ───────────────────────────────────────────────────────

describe('isFieldVisible — fail-open (always visible on bad config)', () => {
  it('visible when visibility_rule has no field_key', () => {
    const f = field({
      key: 'f',
      visibility_rule: { field_key: '', op: 'eq', value: 'x' } as never,
    })
    expect(isFieldVisible(f, {})).toBe(true)
  })

  it('visible when op is unknown', () => {
    const f = field({
      key: 'f',
      visibility_rule: { field_key: 'x', op: 'unknown_op' as never, value: 'y' },
    })
    expect(isFieldVisible(f, { x: 'y' })).toBe(true)
  })

  it('visible when in value is not an array (malformed rule)', () => {
    const f = field({
      key: 'f',
      visibility_rule: { field_key: 'x', op: 'in', value: 'not-an-array' },
    })
    expect(isFieldVisible(f, { x: 'v' })).toBe(true)
  })

  it('visible when visibility_rule is null', () => {
    const f = field({ key: 'f', visibility_rule: null })
    expect(isFieldVisible(f, {})).toBe(true)
  })

  it('never throws on a completely malformed field def', () => {
    const bad = {} as FlowFieldDef
    expect(() => isFieldVisible(bad, {})).not.toThrow()
    expect(isFieldVisible(bad, {})).toBe(true)
  })

  it('never throws when visibility_rule is a non-object primitive', () => {
    const f = field({ key: 'f' })
    // Simulate a completely wrong wire shape.
    const malformed = { ...f, visibility_rule: 'wrong' as never }
    expect(() => isFieldVisible(malformed, {})).not.toThrow()
    expect(isFieldVisible(malformed, {})).toBe(true)
  })

  it('never throws when field_key in rule is not a string', () => {
    const f = field({
      key: 'f',
      visibility_rule: { field_key: 42 as never, op: 'eq', value: 'x' },
    })
    expect(() => isFieldVisible(f, {})).not.toThrow()
    expect(isFieldVisible(f, {})).toBe(true)
  })
})

// ─── pruneHiddenAnswers ───────────────────────────────────────────────────────

describe('pruneHiddenAnswers', () => {
  it('drops answers for hidden fields and keeps visible ones', () => {
    const fields: FlowFieldDef[] = [
      field({ key: 'name' }), // always visible (no rule)
      field({
        key: 'detail',
        visibility_rule: { field_key: 'kind', op: 'eq', value: 'other' },
      }),
    ]
    const answers = { name: 'Ada', detail: 'something', kind: 'standard' }
    const pruned = pruneHiddenAnswers(fields, answers)
    expect(pruned).toHaveProperty('name', 'Ada')
    expect(pruned).not.toHaveProperty('detail')
    // 'kind' is not in fields so it's not in pruned either (only field keys are kept).
    expect(pruned).not.toHaveProperty('kind')
  })

  it('keeps an answer when the visibility rule is satisfied', () => {
    const fields: FlowFieldDef[] = [
      field({
        key: 'detail',
        visibility_rule: { field_key: 'kind', op: 'eq', value: 'other' },
      }),
    ]
    const pruned = pruneHiddenAnswers(fields, { detail: 'my detail', kind: 'other' })
    expect(pruned).toHaveProperty('detail', 'my detail')
  })

  it('drops an answer when its field is not visible', () => {
    const fields: FlowFieldDef[] = [
      field({
        key: 'detail',
        visibility_rule: { field_key: 'kind', op: 'eq', value: 'other' },
      }),
    ]
    const pruned = pruneHiddenAnswers(fields, { detail: 'leaking', kind: 'normal' })
    expect(pruned).not.toHaveProperty('detail')
  })

  it('handles an empty fields array without throwing', () => {
    expect(() => pruneHiddenAnswers([], { a: 'b' })).not.toThrow()
    expect(pruneHiddenAnswers([], { a: 'b' })).toEqual({})
  })

  it('handles undefined answers without throwing', () => {
    const fields: FlowFieldDef[] = [field({ key: 'name' })]
    expect(() => pruneHiddenAnswers(fields, {})).not.toThrow()
    expect(pruneHiddenAnswers(fields, {})).toEqual({})
  })
})
