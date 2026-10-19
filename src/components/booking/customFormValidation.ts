/**
 * Client-side validation of one custom-form field (landr-71kz.2), split out of
 * CustomFormStep so the per-locale wording is unit-testable (landr-kcxx5.10).
 */
import type { FlowFieldDef } from '@/api/flowTypes'
import { pickLocalized } from '@/lib/locale'
import { fmt, tr } from '@/lib/strings'
import { isFieldVisible, type AnswerMap } from './fieldVisibility'

/**
 * Validate a single field's answer. Returns an error string or null.
 * Fail-open: a bad validation blob never hard-errors (landr-71kz.2 §C1).
 */
export function validateField(
  field: FlowFieldDef,
  answers: AnswerMap,
  locale: string,
  uiLocale: string,
): string | null {
  if (!isFieldVisible(field, answers)) return null
  const rawVal = answers[field.key]
  const label = pickLocalized(field.label, field.label_localized, locale) || field.key
  // landr-kcxx5.10: `locale` is the operator-content locale (pinned English);
  // the validation wording is widget chrome and follows `uiLocale`.
  const say = (key: Parameters<typeof tr>[0], n?: number): string =>
    fmt(tr(key, uiLocale), n === undefined ? { label } : { label, n })

  // Required check
  if (field.required) {
    if (rawVal === undefined || rawVal === null) {
      return say('fieldRequiredTemplate')
    }
    if (Array.isArray(rawVal) && rawVal.length === 0) {
      return say('fieldRequiredTemplate')
    }
    if (typeof rawVal === 'string' && rawVal.trim() === '') {
      return say('fieldRequiredTemplate')
    }
  }

  // Skip validation rules for empty optional fields.
  if (rawVal === undefined || rawVal === null) return null
  if (Array.isArray(rawVal) && rawVal.length === 0) return null
  if (typeof rawVal === 'string' && rawVal.trim() === '' && !field.required) return null

  const v = field.validation
  if (!v) return null

  try {
    const strVal = Array.isArray(rawVal) ? rawVal.join(',') : String(rawVal)

    // min_length / max_length (string fields)
    if (
      typeof rawVal === 'string' &&
      (field.field_type === 'text' || field.field_type === 'textarea')
    ) {
      if (typeof v.min_length === 'number' && rawVal.length < v.min_length) {
        return say('fieldMinLengthTemplate', v.min_length)
      }
      if (typeof v.max_length === 'number' && rawVal.length > v.max_length) {
        return say('fieldMaxLengthTemplate', v.max_length)
      }
    }

    // landr-9d82r.4: date fields carry "YYYY-MM-DD" (the native control's value).
    if (field.field_type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
      return say('fieldInvalidDateTemplate')
    }

    // min / max (number fields)
    if (field.field_type === 'number') {
      const num = Number(rawVal)
      if (!Number.isNaN(num)) {
        if (typeof v.min === 'number' && num < v.min) {
          return say('fieldMinTemplate', v.min)
        }
        if (typeof v.max === 'number' && num > v.max) {
          return say('fieldMaxTemplate', v.max)
        }
      }
    }

    // pattern (full-match regex, fail-open on uncompilable)
    if (typeof v.pattern === 'string' && v.pattern) {
      try {
        const re = new RegExp(`^(?:${v.pattern})$`)
        if (!re.test(strVal)) {
          return say('fieldInvalidFormatTemplate')
        }
      } catch {
        // Uncompilable pattern → skip (landr-71kz.2 §C1 fail-open).
      }
    }

    // options membership (select / radio / checkbox / multiselect)
    if (
      field.options &&
      field.options.length > 0 &&
      (field.field_type === 'select' ||
        field.field_type === 'radio' ||
        field.field_type === 'language' ||
        field.field_type === 'checkbox' ||
        field.field_type === 'multiselect')
    ) {
      const validValues = field.options.map((o) => o.value)
      const vals = Array.isArray(rawVal) ? rawVal : [String(rawVal)]
      for (const v of vals) {
        if (!validValues.includes(v)) {
          return say('fieldInvalidOptionTemplate')
        }
      }
    }
  } catch {
    // Validation blob is bad → skip (fail-open).
  }

  return null
}
