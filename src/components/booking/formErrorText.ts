/**
 * landr-kcxx5.10 — customer-language text for the API's per-field 422 errors
 * (`form_responses_invalid`, items of `{form_key, field_key, code, message}`).
 *
 * The server message is English and names the field by its machine key. Known
 * codes are mapped to the widget's localized validation wording (the same
 * strings CustomFormStep's own client-side validation uses) with the field's
 * label when the form definition is at hand. An unknown code, or a bound the
 * definition cannot supply, falls back to the server message — never to a
 * guess. Without the field's definition there is no customer-facing label (the
 * server names the field by its machine key), so the server message is shown
 * verbatim — a raw field key is never put in the translated wording.
 */
import type { FlowFieldDef, ProductFlowResponse } from '@/api/flowTypes'
import { pickLocalized } from '@/lib/locale'
import { fmt, tr } from '@/lib/strings'

export interface FieldErrorLike {
  field_key: string
  code?: string | null
  message: string
}

/** The definition of `fieldKey` in the form `formKey` of a product flow, if resolvable. */
export function findFlowField(
  flow: ProductFlowResponse | null | undefined,
  formKey: string,
  fieldKey: string,
): FlowFieldDef | undefined {
  for (const mod of flow?.modules ?? []) {
    if (mod.kind !== 'custom_form' || mod.form?.key !== formKey) continue
    const hit = mod.form.fields.find((f) => f.key === fieldKey)
    if (hit) return hit
  }
  return undefined
}

/**
 * @param field  the field's definition (label, bounds); undefined when it
 *               cannot be resolved, which keeps the server message.
 * @param locale the customer's resolved widget locale.
 */
export function localizeFieldError(
  error: FieldErrorLike,
  field: FlowFieldDef | undefined,
  locale: string,
): string {
  if (!field) return error.message
  const label = pickLocalized(field.label, field.label_localized, 'en') || field.key
  const rule = field?.validation ?? null
  const withBound = (key: Parameters<typeof tr>[0], bound: unknown): string =>
    typeof bound === 'number'
      ? fmt(tr(key, locale), { label, n: bound })
      : error.message

  switch (error.code) {
    case 'required':
      return fmt(tr('fieldRequiredTemplate', locale), { label })
    case 'type':
      return fmt(
        tr(field?.field_type === 'date' ? 'fieldInvalidDateTemplate' : 'fieldInvalidValueTemplate', locale),
        { label },
      )
    case 'option':
      return fmt(tr('fieldInvalidOptionTemplate', locale), { label })
    case 'pattern':
      return fmt(tr('fieldInvalidFormatTemplate', locale), { label })
    case 'min_length':
      return withBound('fieldMinLengthTemplate', rule?.min_length)
    case 'max_length':
      return withBound('fieldMaxLengthTemplate', rule?.max_length)
    case 'min':
      return withBound('fieldMinTemplate', rule?.min)
    case 'max':
      return withBound('fieldMaxTemplate', rule?.max)
    default:
      return error.message
  }
}
