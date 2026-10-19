/**
 * landr-kcxx5.10 — customer-language text for the API's per-field 422 errors
 * (`form_responses_invalid`, items of `{form_key, field_key, code, message}`).
 *
 * The server message is English and names the field by its machine key. Known
 * codes are mapped to the widget's localized validation wording (the same
 * strings CustomFormStep's own client-side validation uses) with the field's
 * label when the form definition is at hand. An unknown code, or a bound the
 * definition cannot supply, falls back to the server message — never to a
 * guess.
 */
import type { FlowFieldDef } from '@/api/flowTypes'
import { pickLocalized } from '@/lib/locale'
import { fmt, tr } from '@/lib/strings'

export interface FieldErrorLike {
  field_key: string
  code?: string | null
  message: string
}

/**
 * @param field  the field's definition when known (label, bounds); without it
 *               the machine key stands in for the label.
 * @param locale the customer's resolved widget locale.
 */
export function localizeFieldError(
  error: FieldErrorLike,
  field: FlowFieldDef | undefined,
  locale: string,
): string {
  const label =
    (field ? pickLocalized(field.label, field.label_localized, 'en') : '') || error.field_key
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
