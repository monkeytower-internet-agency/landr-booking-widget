/**
 * landr-71kz.4 — CustomFormStep
 *
 * Renders an operator-defined form fetched from the product flow RPC
 * (public_get_product_flow). Generalises DeclarationsStep.tsx:
 *
 *   - FieldRenderer switch over field_type
 *     (text / textarea / number / select / radio / checkbox / multiselect / language)
 *   - Pure isFieldVisible(field, answers) evaluator — matches the Python twin
 *     in app/services/form_responses.py EXACTLY (landr-71kz.2 contract).
 *   - Per-field validation: required-when-visible, min/max, min_length/max_length,
 *     pattern (full-match), options membership.
 *   - Localized labels/help via the widget's existing pickLocalized() + browserLocale().
 *   - Hidden-field answers pruned before submit.
 *   - Submits via form_responses (optional field on the booking submit body).
 *   - Wires into the step-machine's `custom-form` Step variant +
 *     customFormAnswers draft slot.
 *   - NEVER throws — malformed field defs degrade gracefully (bd memory landr-9ut4).
 *
 * VISIBILITY-RULE CONTRACT: see src/components/booking/fieldVisibility.ts and the
 * pinned spec in the landr-71kz.2 handoff §VISIBILITY-RULE CONTRACT.
 */
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { StepBackButton } from '@/components/booking/StepBackButton'
import { useVariant } from '@/lib/variant'
import { cn } from '@/lib/utils'
import { browserLocale, pickLocalized } from '@/lib/locale'
import { getProductFlow } from '@/api/client'
import type { FlowFieldDef, FlowFormDef, FormResponseEntry } from '@/api/flowTypes'
import { isFieldVisible, pruneHiddenAnswers, type AnswerMap } from './fieldVisibility'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CustomFormStepProps {
  /** Operator widget token — used to fetch the product flow. */
  operatorToken: string
  /** The product whose flow we're rendering. */
  productId: string
  /** The operator-form library key for this step (from the flow plan). */
  formKey: string
  /** Display name for the product (used in the card description). */
  productName: string
  /** Initial answers for back-nav restoration from draft.customFormAnswers[formKey]. */
  initialAnswers?: Record<string, unknown>
  onBack: () => void
  /** Called with the pruned answers + form metadata when the customer submits. */
  onConfirm: (entry: FormResponseEntry, rawAnswers: Record<string, unknown>) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validate a single field's answer. Returns an error string or null.
 * Fail-open: a bad validation blob never hard-errors (landr-71kz.2 §C1).
 */
function validateField(
  field: FlowFieldDef,
  answers: AnswerMap,
  locale: string,
): string | null {
  if (!isFieldVisible(field, answers)) return null
  const rawVal = answers[field.key]
  const label = pickLocalized(field.label, field.label_localized, locale) || field.key

  // Required check
  if (field.required) {
    if (rawVal === undefined || rawVal === null) {
      return `${label} is required.`
    }
    if (Array.isArray(rawVal) && rawVal.length === 0) {
      return `${label} is required.`
    }
    if (typeof rawVal === 'string' && rawVal.trim() === '') {
      return `${label} is required.`
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
        return `${label} must be at least ${v.min_length} characters.`
      }
      if (typeof v.max_length === 'number' && rawVal.length > v.max_length) {
        return `${label} must be at most ${v.max_length} characters.`
      }
    }

    // min / max (number fields)
    if (field.field_type === 'number') {
      const num = Number(rawVal)
      if (!Number.isNaN(num)) {
        if (typeof v.min === 'number' && num < v.min) {
          return `${label} must be at least ${v.min}.`
        }
        if (typeof v.max === 'number' && num > v.max) {
          return `${label} must be at most ${v.max}.`
        }
      }
    }

    // pattern (full-match regex, fail-open on uncompilable)
    if (typeof v.pattern === 'string' && v.pattern) {
      try {
        const re = new RegExp(`^(?:${v.pattern})$`)
        if (!re.test(strVal)) {
          return `${label} has an invalid format.`
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
          return `${label} contains an invalid option.`
        }
      }
    }
  } catch {
    // Validation blob is bad → skip (fail-open).
  }

  return null
}

/** Convert the initial answers (Record<string, unknown>) into a typed AnswerMap. */
function normaliseInitial(
  initial: Record<string, unknown> | undefined,
): AnswerMap {
  if (!initial) return {}
  const out: AnswerMap = {}
  for (const [k, v] of Object.entries(initial)) {
    if (Array.isArray(v)) {
      out[k] = v.map(String)
    } else if (v !== null && v !== undefined) {
      out[k] = String(v)
    }
  }
  return out
}

// ─── FieldRenderer ────────────────────────────────────────────────────────────

interface FieldRendererProps {
  field: FlowFieldDef
  answers: AnswerMap
  error: string | null
  locale: string
  onChange: (key: string, value: string | string[]) => void
}

function FieldRenderer({ field, answers, error, locale, onChange }: FieldRendererProps) {
  const { tokens } = useVariant()
  const label = pickLocalized(field.label, field.label_localized, locale) || field.key
  const helpText = pickLocalized(field.help_text, field.help_text_localized, locale)

  const inputClassName =
    'border-input bg-surface-page shadow-well ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

  // Single-select clickable chips — shared by `radio` and `language` fields.
  // The whole chip is a click target (the container onClick); the radio input
  // sets the same value, so a click anywhere selects without double-firing.
  const renderSingleSelectChips = () => {
    const val = (answers[field.key] as string | undefined) ?? ''
    return (
      <div className="flex flex-col gap-2" data-testid={`cf-field-${field.key}`}>
        {(field.options ?? []).map((opt) => {
          const optLabel = pickLocalized(opt.label, opt.label_localized, locale)
          const checked = val === opt.value
          return (
            <div
              key={opt.value}
              data-testid={`cf-option-${field.key}-${opt.value}`}
              className={cn(
                'flex cursor-pointer items-center gap-3 border p-3 transition-[background-color,border-color]',
                tokens.optionCardRadius,
                checked
                  ? tokens.optionSelected
                  : 'border-border bg-surface-raised shadow-elev-1',
              )}
              onClick={() => onChange(field.key, opt.value)}
            >
              <input
                id={`cf-${field.key}-${opt.value}`}
                type="radio"
                name={`cf-${field.key}`}
                value={opt.value}
                checked={checked}
                onChange={() => onChange(field.key, opt.value)}
                data-testid={`cf-radio-${field.key}-${opt.value}`}
                className="accent-primary"
              />
              <Label
                htmlFor={`cf-${field.key}-${opt.value}`}
                className="text-sm leading-snug cursor-pointer"
              >
                {optLabel}
              </Label>
            </div>
          )
        })}
      </div>
    )
  }

  const renderInput = () => {
    switch (field.field_type) {
      case 'text': {
        const val = (answers[field.key] as string | undefined) ?? ''
        return (
          <input
            id={`cf-${field.key}`}
            type="text"
            value={val}
            onChange={(e) => onChange(field.key, e.target.value)}
            data-testid={`cf-field-${field.key}`}
            className={inputClassName}
          />
        )
      }

      case 'textarea': {
        const val = (answers[field.key] as string | undefined) ?? ''
        return (
          <textarea
            id={`cf-${field.key}`}
            value={val}
            rows={3}
            onChange={(e) => onChange(field.key, e.target.value)}
            data-testid={`cf-field-${field.key}`}
            className="border-input bg-surface-page shadow-well ring-offset-background focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        )
      }

      case 'number': {
        const val = (answers[field.key] as string | undefined) ?? ''
        const v = field.validation
        return (
          <input
            id={`cf-${field.key}`}
            type="number"
            value={val}
            min={typeof v?.min === 'number' ? v.min : undefined}
            max={typeof v?.max === 'number' ? v.max : undefined}
            onChange={(e) => onChange(field.key, e.target.value)}
            data-testid={`cf-field-${field.key}`}
            className={inputClassName}
          />
        )
      }

      case 'select': {
        const val = (answers[field.key] as string | undefined) ?? ''
        return (
          <select
            id={`cf-${field.key}`}
            value={val}
            onChange={(e) => onChange(field.key, e.target.value)}
            data-testid={`cf-field-${field.key}`}
            className={inputClassName}
          >
            <option value="">— select —</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {pickLocalized(opt.label, opt.label_localized, locale)}
              </option>
            ))}
          </select>
        )
      }

      case 'radio':
        return renderSingleSelectChips()

      // Dedicated language picker = single-select chips from the form's
      // options (NOT a free-text field — that was the regression). If the form
      // configures no options, degrade to a free-text input rather than render
      // an empty, unusable picker ("malformed config degrades, never throws").
      case 'language': {
        if (field.options && field.options.length > 0) {
          return renderSingleSelectChips()
        }
        const val = (answers[field.key] as string | undefined) ?? ''
        return (
          <input
            id={`cf-${field.key}`}
            type="text"
            value={val}
            onChange={(e) => onChange(field.key, e.target.value)}
            data-testid={`cf-field-${field.key}`}
            className={inputClassName}
          />
        )
      }

      case 'checkbox':
      case 'multiselect': {
        const selected = (answers[field.key] as string[] | undefined) ?? []
        const toggle = (value: string) => {
          const next = selected.includes(value)
            ? selected.filter((v) => v !== value)
            : [...selected, value]
          onChange(field.key, next)
        }
        return (
          <div className="flex flex-col gap-2" data-testid={`cf-field-${field.key}`}>
            {(field.options ?? []).map((opt) => {
              const optLabel = pickLocalized(opt.label, opt.label_localized, locale)
              const isChecked = selected.includes(opt.value)
              return (
                <div
                  key={opt.value}
                  data-testid={`cf-option-${field.key}-${opt.value}`}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 border p-3 transition-[background-color,border-color]',
                    tokens.optionCardRadius,
                    isChecked
                      ? tokens.optionSelected
                      : 'border-border bg-surface-raised shadow-elev-1',
                  )}
                  // landr — make the WHOLE chip a click target, not just the
                  // checkmark/label. Guard on target===currentTarget so a click
                  // that lands on the inner Checkbox or Label (which toggle
                  // themselves) doesn't fire this handler too and double-toggle.
                  onClick={(e) => {
                    if (e.currentTarget === e.target) toggle(opt.value)
                  }}
                >
                  <Checkbox
                    id={`cf-${field.key}-${opt.value}`}
                    checked={isChecked}
                    onCheckedChange={() => toggle(opt.value)}
                    data-testid={`cf-checkbox-${field.key}-${opt.value}`}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor={`cf-${field.key}-${opt.value}`}
                    className="text-sm leading-snug cursor-pointer"
                  >
                    {optLabel}
                  </Label>
                </div>
              )
            })}
          </div>
        )
      }

      default:
        return (
          <p className="text-xs text-muted-foreground" data-testid={`cf-field-${field.key}`}>
            (Unsupported field type: {field.field_type})
          </p>
        )
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`cf-${field.key}`} className="text-sm font-medium">
        {label}
        {field.required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {helpText ? (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      ) : null}
      {renderInput()}
      {error ? (
        <p className="text-xs text-destructive" data-testid={`cf-error-${field.key}`}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

// ─── CustomFormStep ───────────────────────────────────────────────────────────

/**
 * CustomFormStep — renders the operator-configured form for a `custom-form`
 * step in the booking funnel. Fetches the form definition from the flow RPC,
 * renders each visible field via FieldRenderer, validates on submit, and
 * calls onConfirm with the pruned answers and FormResponseEntry payload.
 *
 * Fail-safe: any error during fetch/parse falls back to an inline error
 * message + the onBack affordance (not a blank widget).
 */
export function CustomFormStep({
  operatorToken,
  productId,
  formKey,
  productName,
  initialAnswers,
  onBack,
  onConfirm,
}: CustomFormStepProps) {
  const locale = browserLocale()

  const [formDef, setFormDef] = useState<FlowFormDef | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Answers keyed by field key. Initialised from draft (back-nav restoration).
  const [answers, setAnswers] = useState<AnswerMap>(() =>
    normaliseInitial(initialAnswers),
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Fetch the flow and find our form by key.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const flow = await getProductFlow(operatorToken, productId)
        if (cancelled) return
        if (!flow || !flow.modules) {
          setFetchError('No form configuration found for this product.')
          setLoading(false)
          return
        }
        // Find the custom_form module whose form.key matches.
        let found: FlowFormDef | null = null
        for (const mod of flow.modules) {
          if (mod.kind === 'custom_form' && mod.form && mod.form.key === formKey) {
            found = mod.form
            break
          }
        }
        if (!found) {
          setFetchError('Form definition not found.')
          setLoading(false)
          return
        }
        // Sort fields by position.
        found = {
          ...found,
          fields: [...found.fields].sort((a, b) => a.position - b.position),
        }
        setFormDef(found)
        setLoading(false)
      } catch {
        if (!cancelled) {
          setFetchError('Could not load the form. Please go back and try again.')
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [operatorToken, productId, formKey])

  const handleChange = useCallback((key: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
    // Clear the field's error on change so the customer gets live feedback.
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const handleSubmit = () => {
    if (!formDef) return

    // Validate all visible fields.
    const errors: Record<string, string> = {}
    for (const field of formDef.fields) {
      const err = validateField(field, answers, locale)
      if (err) errors[field.key] = err
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    // Prune hidden fields then build the FormResponseEntry.
    const pruned = pruneHiddenAnswers(formDef.fields, answers)
    const entry: FormResponseEntry = {
      form_key: formDef.key,
      answers: pruned,
    }

    // Pass raw answers (includes hidden field state) for draft persistence.
    const rawForDraft: Record<string, unknown> = { ...answers }
    onConfirm(entry, rawForDraft)
  }

  // Note: live re-validation after submit is driven by handleChange clearing
  // per-field errors on each change. A full re-pass runs via handleSubmit only
  // (no useEffect with setState, which would cause cascading renders).

  const formTitle =
    formDef
      ? pickLocalized(formDef.name, formDef.name_localized, locale) || formDef.name
      : 'Additional information'

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>{formTitle}</CardTitle>
        <CardDescription>{productName} · please complete the form below</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {loading ? (
          <p className="text-sm text-muted-foreground" data-testid="cf-loading">
            Loading…
          </p>
        ) : fetchError ? (
          <p className="text-sm text-destructive" data-testid="cf-fetch-error">
            {fetchError}
          </p>
        ) : formDef ? (
          formDef.fields.map((field) => {
            if (!isFieldVisible(field, answers)) return null
            return (
              <FieldRenderer
                key={field.key}
                field={field}
                answers={answers}
                error={fieldErrors[field.key] ?? null}
                locale={locale}
                onChange={handleChange}
              />
            )
          })
        ) : null}

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !!fetchError}
            data-testid="cf-submit"
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
