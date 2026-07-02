/**
 * landr-71kz.4 — pure visibility-rule evaluator.
 *
 * isFieldVisible(field, answers) MUST produce the identical boolean as the
 * Python twin `is_field_visible` in `app/services/form_responses.py`. Any
 * divergence causes hidden-required fields to be enforced on one side and
 * pruned on the other (landr-9ut4 class bug).
 *
 * VISIBILITY-RULE CONTRACT (pinned in landr-71kz.2 handoff):
 *
 * 1. A null / missing rule → always visible (fail-open).
 * 2. `eq` / `neq` / `in` against a LIST answer (checkbox/multiselect):
 *    membership check (JS answer.includes(value)).
 *    `eq`/`in` → value ∈ list; `neq` → value ∉ list.
 * 3. `eq` / `neq` / `in` against a SCALAR answer: string-coerced equality.
 * 4. `truthy`: JS Boolean(answer). Non-empty string (including whitespace-only)
 *    is truthy. Empty string / false / 0 / null / absent / [] → hidden.
 *    Do NOT trim the string before checking.
 * 5. Missing field_key, unknown op, malformed `in` value → fail-open (always visible).
 * 6. A missing/undefined field_key reference → treat the answer as absent → not visible.
 *    (Exception: fail-open for any bad RULE, not a missing answer.)
 *
 * Rule 6 note: "a rule referencing a missing field → treat as not-visible" is the
 * authoritative spec from the handoff (§5). A field whose referenced answer is simply
 * absent from the answers map is treated as falsy for `truthy` and as "not equal" for
 * eq/neq/in — effectively hiding the field until the referee is answered.
 *
 * NEVER throws — malformed field defs degrade gracefully, never blank the widget.
 */

import type { FlowFieldDef, VisibilityRule } from '@/api/flowTypes'

/**
 * The answer map type: scalar fields send strings, multivalue fields send
 * string arrays. The customer never types an actual number — number inputs
 * send string "42".
 */
export type AnswerMap = Record<string, string | string[] | null | undefined>

/**
 * Evaluate a single visibility rule against the current answers map.
 * Returns true when the field SHOULD be visible. Fail-open on any
 * malformed rule or unknown op.
 */
function evalRule(rule: VisibilityRule, answers: AnswerMap): boolean {
  // Guard: must have a string field_key and a known op.
  if (typeof rule.field_key !== 'string' || !rule.field_key) return true
  if (typeof rule.op !== 'string') return true

  const rawAnswer = answers[rule.field_key]

  switch (rule.op) {
    case 'truthy': {
      // JS Boolean() semantics: non-empty string (incl. whitespace) is truthy;
      // empty string / 0 / false / null / undefined / [] → falsy.
      if (rawAnswer === undefined || rawAnswer === null) return false
      if (Array.isArray(rawAnswer)) return rawAnswer.length > 0
      if (typeof rawAnswer === 'string') return Boolean(rawAnswer)
      // Numeric-like (shouldn't happen in practice but match Boolean()):
      return Boolean(rawAnswer)
    }

    case 'eq': {
      const ruleVal = rule.value
      // NULL-VALUE CONTRACT (landr-noyq): a null/undefined rule value matches
      // NOTHING → eq hidden. Mirrors the server (_scalar_eq returns False when
      // the rule value is None) and keeps the null contract identical across
      // all three impls regardless of whether the answer is present.
      if (ruleVal == null) return false
      if (Array.isArray(rawAnswer)) {
        // List answer → membership check.
        // NOTE whole-number floats: a JSON rule value of 3.0 parses to the JS
        // number 3, and String(3.0) === "3", so the membership check against a
        // string answer "3" already canonicalises natively (the Python twin
        // does this explicitly in _canon — JS gets it for free).
        return rawAnswer.includes(String(ruleVal))
      }
      // Scalar answer → string-coerced equality. landr-f4dm: a `null` answer
      // must be treated identically to `undefined` (absent) — otherwise
      // String(null) === "null" could wrongly match a rule value of the
      // literal string "null", diverging from the Python twin's
      // `_scalar_eq` (a is None → False regardless of b).
      if (rawAnswer == null) return false
      return String(rawAnswer) === String(ruleVal)
    }

    case 'neq': {
      const ruleVal = rule.value
      // NULL-VALUE CONTRACT (landr-noyq): a null rule value is not-equal to
      // everything → neq visible (the inverse of eq above).
      if (ruleVal == null) return true
      if (Array.isArray(rawAnswer)) {
        // List answer → NOT-member check.
        return !rawAnswer.includes(String(ruleVal))
      }
      // Scalar answer → string-coerced inequality. landr-f4dm: `null` mirrors
      // `undefined` (absent) here too — see the `eq` branch above.
      if (rawAnswer == null) return true // absent ≠ anything → visible
      return String(rawAnswer) !== String(ruleVal)
    }

    case 'in': {
      // `value` must be an array for `in`; fail-open if not.
      const ruleVals = rule.value
      if (!Array.isArray(ruleVals)) return true
      if (Array.isArray(rawAnswer)) {
        // List answer → any intersection → visible.
        const strs = ruleVals.map(String)
        return rawAnswer.some((a) => strs.includes(a))
      }
      // Scalar answer → value ∈ rule array. landr-f4dm: `null` mirrors
      // `undefined` (absent) here too — see the `eq` branch above.
      if (rawAnswer == null) return false
      return ruleVals.map(String).includes(String(rawAnswer))
    }

    default:
      // Unknown op → fail-open (always visible).
      return true
  }
}

/**
 * Pure function: is `field` visible given the current `answers`?
 *
 * Fail-open contract: any error, missing rule, or unknown op → true.
 * NEVER throws — the widget has no error boundary.
 */
export function isFieldVisible(field: FlowFieldDef, answers: AnswerMap): boolean {
  try {
    const rule = field.visibility_rule
    if (rule == null) return true
    // Defensive: rule must be an object with a field_key.
    if (typeof rule !== 'object') return true
    return evalRule(rule as VisibilityRule, answers)
  } catch {
    // Any unexpected shape → fail-open.
    return true
  }
}

/**
 * Prune the answers map to only include answers for VISIBLE fields.
 * Hidden fields' answers are dropped before submit — keeps the widget and
 * server in lock-step (landr-9ut4 lesson: divergence causes lost bookings).
 */
export function pruneHiddenAnswers(
  fields: FlowFieldDef[],
  answers: AnswerMap,
): Record<string, string | string[]> {
  const pruned: Record<string, string | string[]> = {}
  for (const field of fields) {
    if (isFieldVisible(field, answers)) {
      const val = answers[field.key]
      if (val != null) pruned[field.key] = val
    }
  }
  return pruned
}
