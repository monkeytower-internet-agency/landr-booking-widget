/**
 * landr-8sk6l — "Other languages spoken" lives on the LanguageStep.
 *
 * The field itself is operator data: a plain `text` field keyed
 * `other_languages` inside a custom form (para42's `customer_declarations`,
 * seeded in 20260614012000_para42_declarations_multilang.sql). The API reads
 * it out of that form's answers into `bookings.customer_other_languages`
 * (booking_submit_payload.py), so the answer must keep travelling as that
 * form's answer.
 *
 * What moves is only where the customer TYPES it: the language step renders
 * the input and writes straight into the draft's
 * `customFormAnswers[formKey].other_languages` slot, and the custom form then
 * hides the field and reports the upstream value — the same mirror pattern
 * the `language` field already uses (landr-r6e5x.4). A field with a
 * visibility rule is left where it is: its visibility depends on sibling
 * answers the language step never sees, and so is a required one: the
 * language step has no way to gate on it.
 */
import type { FlowFieldDef, ProductFlowResponse } from '@/api/flowTypes'

export const OTHER_LANGUAGES_FIELD_KEY = 'other_languages'

export interface OtherLanguagesField {
  formKey: string
  field: FlowFieldDef
}

/** The first liftable `other_languages` text field in the flow, else null. */
export function findOtherLanguagesField(
  flow: ProductFlowResponse | null | undefined,
): OtherLanguagesField | null {
  for (const mod of flow?.modules ?? []) {
    if (mod.kind !== 'custom_form' || !mod.form) continue
    const field = mod.form.fields.find(
      (f) =>
        f.key === OTHER_LANGUAGES_FIELD_KEY &&
        (f.field_type === 'text' || f.field_type === 'textarea') &&
        f.visibility_rule == null &&
        !f.required,
    )
    if (field) return { formKey: mod.form.key, field }
  }
  return null
}

/** Read the draft slot the language step writes. */
export function otherLanguagesFromDraft(
  customFormAnswers: Record<string, Record<string, unknown>> | undefined,
  formKey: string,
): string {
  const v = customFormAnswers?.[formKey]?.[OTHER_LANGUAGES_FIELD_KEY]
  return typeof v === 'string' ? v : ''
}

/** Write the draft slot, leaving the form's other answers untouched. */
export function withOtherLanguages(
  customFormAnswers: Record<string, Record<string, unknown>> | undefined,
  formKey: string,
  value: string,
): Record<string, Record<string, unknown>> {
  return {
    ...customFormAnswers,
    [formKey]: {
      ...customFormAnswers?.[formKey],
      [OTHER_LANGUAGES_FIELD_KEY]: value,
    },
  }
}
