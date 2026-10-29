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
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { useStaffMode } from '@/lib/staffMode'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { pickLocalized, browserLocale } from '@/lib/locale'
import { productFormSubtitle, tr, unsupportedFieldTypeLabel } from '@/lib/strings'
import { getProductFlow } from '@/api/client'
import type {
  FlowFieldDef,
  FlowFormDef,
  FormResponseEntry,
  ProductFlowResponse,
} from '@/api/flowTypes'
import { ContinueAction } from './ContinueAction'
import { validateField } from './customFormValidation'
import { CustomerCommentField } from './CustomerCommentField'
import { isFieldVisible, pruneHiddenAnswers, type AnswerMap } from './fieldVisibility'
import {
  PERSON_ANSWERS_DRAFT_KEY,
  bookingFields as selectBookingFields,
  buildFormPeople,
  buildPersonPayload,
  fieldsForKind,
  personVisibilityAnswers,
  pruneToPeople,
  readPersonAnswers,
  type FormPerson,
  type FormPersonSource,
} from './formScopes'
import { RankedLanguagePicker } from './RankedLanguagePicker'
import type { CustomerCompletesForm } from './staffSubmitAdapter'

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
  /**
   * landr-db45: the already-resolved product flow, threaded down from the
   * parent (App's `ensureProductFlow`/`withResolvedFlow` cache — the same
   * flow that routed the funnel INTO this custom-form step in the first
   * place) so this component reuses it instead of firing its own,
   * independent `getProductFlow` request.
   *
   * Before this prop existed, App and CustomFormStep each fetched the flow
   * separately with no shared cache: if App's fetch produced the custom-form
   * step but CustomFormStep's own later fetch transiently failed (or somehow
   * returned a flow missing this form's key), CustomFormStep set its
   * `fetchError` and permanently disabled Continue — a forward dead-end
   * under flaky networks (Back still worked; Continue never would). Since
   * the flow that put the customer on this exact step already contains the
   * matching `custom_form` module, deriving the form def from it here is
   * synchronous and can never race a second, flaky request.
   *
   * `undefined` = the prop was genuinely not supplied (older/standalone
   * callers, e.g. tests that render this component directly) → falls back to
   * the original self-fetch behaviour, unchanged. `null` = the parent
   * resolved the flow and it settled to `null` (its own fetch failed, or the
   * product has no remote flow) — treated as "form not found" WITHOUT a
   * further fetch here, since re-fetching couldn't recover data the parent's
   * fetch didn't have; only a genuinely absent prop triggers the fallback.
   */
  flow?: ProductFlowResponse | null
  /**
   * landr-9d82r.4: the people on the booking, from DetailsStep (the same
   * lists the submit body's `participants[]` / `companions[]` are built from,
   * in the same order). Participant- and guest-scope fields are asked once per
   * person, grouped under each person's name. Optional: absent / empty →
   * booking-scope fields only, identical to the pre-9d82r.4 step.
   */
  participants?: readonly FormPersonSource[]
  companions?: readonly FormPersonSource[]
  /**
   * landr-n6ii3: current value of the "Anything we should know?" comment,
   * read straight off App.tsx's bookingDraft.customerComment. Optional
   * (defaults to '' / a no-op) so existing tests need no change.
   */
  customerComment?: string
  onCustomerCommentChange?: (comment: string) => void
  /** Absent → no back button (landr-kcxx5.4: the first form of /details). */
  onBack?: () => void
  /**
   * landr-kcxx5.4: the /details/{token} page reuses this step for the
   * customer-completes-forms flow. `submitLabel` replaces "Continue" on the
   * final form ("Submit"); `hideCustomerComment` drops the booking-flow-only
   * "Anything we should know?" field. Both default to the booking-flow look.
   */
  submitLabel?: string
  hideCustomerComment?: boolean
  /**
   * Staff mode only. When supplied AND a staff session is active, the step
   * defaults to a compact "Customer completes this via their booking link"
   * card; Continue then calls this instead of onConfirm. The operator can
   * expand the normal form with "Fill in now instead" (onConfirm as usual),
   * and from the expanded form hand the form back to the customer. Without a
   * staff session this prop is ignored and the step is byte-identical.
   */
  onCustomerCompletes?: (form: CustomerCompletesForm) => void
  /**
   * Called with the pruned answers + form metadata when the customer submits.
   */
  onConfirm: (entry: FormResponseEntry, rawAnswers: Record<string, unknown>) => void
}

/**
 * Locate the `custom_form` module matching `formKey` inside an already-
 * resolved flow and sort its fields by position. Pure + shared by both the
 * prop path (the common case since landr-db45) and the fallback self-fetch
 * path (prop genuinely absent) — the exact same lookup either way. Never
 * throws — a malformed/missing flow degrades to a "form not found" message
 * rather than blanking the widget (bd memory landr-9ut4).
 */
function findFormInFlow(
  flow: ProductFlowResponse | null,
  formKey: string,
  uiLocale?: string,
): { form: FlowFormDef | null; error: string | null } {
  if (!flow || !flow.modules) {
    return { form: null, error: tr('noFormConfigForProduct', uiLocale) }
  }
  let found: FlowFormDef | null = null
  for (const mod of flow.modules) {
    if (mod.kind === 'custom_form' && mod.form && mod.form.key === formKey) {
      found = mod.form
      break
    }
  }
  if (!found) {
    return { form: null, error: tr('formDefinitionNotFound', uiLocale) }
  }
  return {
    form: {
      ...found,
      fields: [...found.fields].sort((a, b) => a.position - b.position),
    },
    error: null,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert the initial answers (Record<string, unknown>) into a typed AnswerMap. */
function normaliseInitial(
  initial: Record<string, unknown> | undefined,
): AnswerMap {
  if (!initial) return {}
  const out: AnswerMap = {}
  for (const [k, v] of Object.entries(initial)) {
    // landr-9d82r.4: the per-person answers ride in this slot under a reserved
    // key (see readPersonAnswers) — they are not a booking-level field.
    if (k === PERSON_ANSWERS_DRAFT_KEY) continue
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
  /** landr-5aih0.17: widget-chrome locale (the "unsupported field type" fallback is a dev/config diagnostic, not operator content — it follows the customer's resolved locale like every other chrome string, not the English-pinned `locale` above). */
  uiLocale?: string
  /**
   * landr-9d82r.4: DOM id / data-testid / radio-group prefix. `cf` for the
   * booking-level form (byte-identical to before); `cf-participant-0` etc.
   * for a per-person copy, so the same field rendered once per person never
   * collides on ids, labels or radio `name`s.
   */
  idPrefix?: string
  onChange: (key: string, value: string | string[]) => void
}

function FieldRenderer({
  field,
  answers,
  error,
  locale,
  uiLocale,
  idPrefix = 'cf',
  onChange,
}: FieldRendererProps) {
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
      <div className="flex flex-col gap-2" data-testid={`${idPrefix}-field-${field.key}`}>
        {(field.options ?? []).map((opt) => {
          const optLabel = pickLocalized(opt.label, opt.label_localized, locale)
          const checked = val === opt.value
          return (
            <div
              key={opt.value}
              data-testid={`${idPrefix}-option-${field.key}-${opt.value}`}
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
                id={`${idPrefix}-${field.key}-${opt.value}`}
                type="radio"
                name={`${idPrefix}-${field.key}`}
                value={opt.value}
                checked={checked}
                onChange={() => onChange(field.key, opt.value)}
                data-testid={`${idPrefix}-radio-${field.key}-${opt.value}`}
                className="accent-primary"
              />
              <Label
                htmlFor={`${idPrefix}-${field.key}-${opt.value}`}
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
            id={`${idPrefix}-${field.key}`}
            type="text"
            value={val}
            onChange={(e) => onChange(field.key, e.target.value)}
            data-testid={`${idPrefix}-field-${field.key}`}
            className={inputClassName}
          />
        )
      }

      case 'textarea': {
        const val = (answers[field.key] as string | undefined) ?? ''
        return (
          <textarea
            id={`${idPrefix}-${field.key}`}
            value={val}
            rows={3}
            onChange={(e) => onChange(field.key, e.target.value)}
            data-testid={`${idPrefix}-field-${field.key}`}
            className="border-input bg-surface-page shadow-well ring-offset-background focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        )
      }

      case 'number': {
        const val = (answers[field.key] as string | undefined) ?? ''
        const v = field.validation
        // landr-9d82r.4: optional unit suffix ("kg") — presentation only, the
        // answer stays the bare number string.
        const unit =
          typeof v?.unit === 'string' && v.unit.trim() ? v.unit.trim() : null
        const input = (
          <input
            id={`${idPrefix}-${field.key}`}
            type="number"
            value={val}
            min={typeof v?.min === 'number' ? v.min : undefined}
            max={typeof v?.max === 'number' ? v.max : undefined}
            onChange={(e) => onChange(field.key, e.target.value)}
            data-testid={`${idPrefix}-field-${field.key}`}
            className={unit ? cn(inputClassName, 'flex-1') : inputClassName}
          />
        )
        if (!unit) return input
        return (
          <div className="flex items-center gap-2">
            {input}
            <span
              className="text-sm text-muted-foreground"
              data-testid={`${idPrefix}-unit-${field.key}`}
            >
              {unit}
            </span>
          </div>
        )
      }

      // landr-9d82r.4: calendar date. The native control emits "YYYY-MM-DD"
      // (or "" when cleared), which is exactly the wire format.
      case 'date': {
        const val = (answers[field.key] as string | undefined) ?? ''
        return (
          <input
            id={`${idPrefix}-${field.key}`}
            type="date"
            value={val}
            onChange={(e) => onChange(field.key, e.target.value)}
            data-testid={`${idPrefix}-field-${field.key}`}
            className={inputClassName}
          />
        )
      }

      case 'select': {
        const val = (answers[field.key] as string | undefined) ?? ''
        return (
          <select
            id={`${idPrefix}-${field.key}`}
            value={val}
            onChange={(e) => onChange(field.key, e.target.value)}
            data-testid={`${idPrefix}-field-${field.key}`}
            className={inputClassName}
          >
            <option value="">{tr('selectPlaceholder', browserLocale())}</option>
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

      // Dedicated language picker = a RANKED, draggable, MULTI-SELECT picker
      // from the form's options: the customer ticks every language they speak
      // and drags them into preference order (favourite on top). The submitted
      // value is the ARRAY of selected codes in top-down order — the first
      // entry is the customer's preferred language (the backend uses it for the
      // email locale). If the form configures no options, degrade to a
      // free-text input rather than render an empty, unusable picker
      // ("malformed config degrades, never throws").
      case 'language': {
        // landr-r6e5x.4 / epic decision D3, landr-cgq5g: languages are
        // assigned PER PERSON on the LanguageStep, which runs before this
        // form. When the operator's form also declares a language field, the
        // render loop above skips it entirely (answers still mirrors
        // the assignment into the submitted answer) — one source of truth, no
        // redundant re-display, no way for two controls to disagree.
        if (field.options && field.options.length > 0) {
          const ordered = (answers[field.key] as string[] | undefined) ?? []
          return (
            <RankedLanguagePicker
              field={field}
              value={ordered}
              locale={locale}
              onChange={onChange}
            />
          )
        }
        const val = (answers[field.key] as string | undefined) ?? ''
        return (
          <input
            id={`${idPrefix}-${field.key}`}
            type="text"
            value={val}
            onChange={(e) => onChange(field.key, e.target.value)}
            data-testid={`${idPrefix}-field-${field.key}`}
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
          <div className="flex flex-col gap-2" data-testid={`${idPrefix}-field-${field.key}`}>
            {(field.options ?? []).map((opt) => {
              const optLabel = pickLocalized(opt.label, opt.label_localized, locale)
              const isChecked = selected.includes(opt.value)
              return (
                <div
                  key={opt.value}
                  data-testid={`${idPrefix}-option-${field.key}-${opt.value}`}
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
                    id={`${idPrefix}-${field.key}-${opt.value}`}
                    checked={isChecked}
                    onCheckedChange={() => toggle(opt.value)}
                    data-testid={`${idPrefix}-checkbox-${field.key}-${opt.value}`}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor={`${idPrefix}-${field.key}-${opt.value}`}
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
          <p className="text-xs text-muted-foreground" data-testid={`${idPrefix}-field-${field.key}`}>
            {unsupportedFieldTypeLabel(field.field_type, uiLocale)}
          </p>
        )
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${idPrefix}-${field.key}`} className="text-sm font-medium">
        {label}
        {field.required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {helpText ? (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      ) : null}
      {renderInput()}
      {error ? (
        <p className="text-xs text-destructive" data-testid={`${idPrefix}-error-${field.key}`}>
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
  flow,
  participants,
  companions,
  customerComment = '',
  onCustomerCommentChange = () => {},
  onBack,
  submitLabel,
  hideCustomerComment = false,
  onCustomerCompletes,
  onConfirm,
}: CustomFormStepProps) {
  // Staff mode: the form defaults to "customer completes this". A restored
  // draft that already holds answers means the operator filled it in earlier,
  // so it re-opens expanded. Without a staff session none of this is used.
  const staff = useStaffMode()
  const staffDeferrable =
    staff.active && staff.mode !== 'agent' && onCustomerCompletes !== undefined
  const [fillNow, setFillNow] = useState(
    () => !!initialAnswers && Object.keys(initialAnswers).length > 0,
  )
  // landr — English-first: render custom forms in English rather than the
  // customer's browser locale (which made para42's "Customer Declarations"
  // show as German "Erklärungen" to German browsers). pickLocalized falls back
  // to the field's base/default label when 'en' isn't in *_localized, so a
  // genuinely-localized operator still shows their authored default. (Per-
  // operator default_locale + localize-on-language-pick is a follow-up: the
  // public operator-settings RPC doesn't expose default_locale yet.)
  const locale = 'en'
  // landr-5aih0.9: separate from the pinned English-only `locale` above — that
  // one is for OPERATOR-authored form content (deliberately English-only, see
  // the comment on it) whereas this widget CHROME follows the resolved
  // customer locale like every other step.
  const uiLocale = browserLocale()

  // landr-db45: `flow !== undefined` means the parent supplied the
  // already-resolved flow — derive the form def SYNCHRONOUSLY from it on
  // every render (no fetch, no loading state, and no possibility of a second
  // independently-flaky request producing a forward dead-end). Recomputed
  // whenever `flow` or `formKey` change, which also covers a chained series
  // of custom-form steps for the same product re-using one mounted instance
  // (App doesn't remount CustomFormStep between them — only its props
  // change) — each step's form is picked out of the SAME already-fetched
  // flow object.
  const resolvedFromProp =
    flow !== undefined ? findFormInFlow(flow, formKey, uiLocale) : null

  // Fallback self-fetch path — used ONLY when the prop is genuinely absent
  // (older/standalone callers). Kept byte-for-bit equivalent to the
  // pre-landr-db45 behaviour via the shared findFormInFlow helper.
  const [fetchedFormDef, setFetchedFormDef] = useState<FlowFormDef | null>(null)
  const [fetchedError, setFetchedError] = useState<string | null>(null)
  const [fetchLoading, setFetchLoading] = useState(flow === undefined)

  useEffect(() => {
    // Prop path — nothing to fetch. `loading` below ignores `fetchLoading`
    // whenever `resolvedFromProp` is set, so there is nothing to reset here.
    if (flow !== undefined) return
    let cancelled = false
    void (async () => {
      try {
        const fetchedFlow = await getProductFlow(operatorToken, productId)
        if (cancelled) return
        const resolved = findFormInFlow(fetchedFlow, formKey, uiLocale)
        setFetchedFormDef(resolved.form)
        setFetchedError(resolved.error)
        setFetchLoading(false)
      } catch {
        if (!cancelled) {
          setFetchedError(tr('couldNotLoadFormRetry', uiLocale))
          setFetchLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [flow, operatorToken, productId, formKey, uiLocale])

  const formDef = resolvedFromProp ? resolvedFromProp.form : fetchedFormDef
  const fetchError = resolvedFromProp ? resolvedFromProp.error : fetchedError
  const loading = resolvedFromProp ? false : fetchLoading

  // Answers keyed by field key — BOOKING-scope fields only. Initialised from
  // draft (back-nav restoration).
  const [answers, setAnswers] = useState<AnswerMap>(() =>
    normaliseInitial(initialAnswers),
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // landr-9d82r.4: per-person answers (participant- and guest-scope fields),
  // keyed by the person's stable identity (FormPerson.key), so a roster edit
  // in Details can't hand one person another person's answers.
  const [personAnswers, setPersonAnswers] = useState<Record<string, AnswerMap>>(
    () => readPersonAnswers(initialAnswers),
  )
  const [personErrors, setPersonErrors] = useState<
    Record<string, Record<string, string>>
  >({})

  const people: FormPerson[] = useMemo(
    () =>
      buildFormPeople(
        participants ?? [],
        companions ?? [],
        tr('formPersonFallbackName', uiLocale),
      ),
    [participants, companions, uiLocale],
  )
  const allFields = useMemo(() => formDef?.fields ?? [], [formDef])
  const bookingScopeFields = useMemo(() => selectBookingFields(allFields), [allFields])
  // Booking answers as the server will see them: hidden booking fields pruned.
  const prunedBooking = useMemo(
    () => pruneHiddenAnswers(bookingScopeFields, answers),
    [bookingScopeFields, answers],
  )
  // The fields each person answers, with that person's visibility answers.
  const personFields = useCallback(
    (person: FormPerson) => fieldsForKind(allFields, person.kind),
    [allFields],
  )
  const personEvalAnswers = useCallback(
    (person: FormPerson): AnswerMap =>
      personVisibilityAnswers(prunedBooking, personAnswers[person.key]),
    [prunedBooking, personAnswers],
  )

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

  const handlePersonChange = useCallback(
    (personKey: string, key: string, value: string | string[]) => {
      setPersonAnswers((prev) => ({
        ...prev,
        [personKey]: { ...(prev[personKey] ?? {}), [key]: value },
      }))
      setPersonErrors((prev) => {
        if (!prev[personKey]?.[key]) return prev
        const forPerson = { ...prev[personKey] }
        delete forPerson[key]
        return { ...prev, [personKey]: forPerson }
      })
    },
    [],
  )

  const handleSubmit = () => {
    if (!formDef) return

    // Validate all visible booking-level fields.
    const errors: Record<string, string> = {}
    for (const field of bookingScopeFields) {
      const err = validateField(field, answers, locale, uiLocale)
      if (err) errors[field.key] = err
    }
    // landr-9d82r.4: and every visible field of every person.
    const nextPersonErrors: Record<string, Record<string, string>> = {}
    for (const person of people) {
      const evalAnswers = personEvalAnswers(person)
      for (const field of personFields(person)) {
        const err = validateField(field, evalAnswers, locale, uiLocale)
        if (err) {
          nextPersonErrors[person.key] = {
            ...(nextPersonErrors[person.key] ?? {}),
            [field.key]: err,
          }
        }
      }
    }
    setFieldErrors(errors)
    setPersonErrors(nextPersonErrors)
    if (
      Object.keys(errors).length > 0 ||
      Object.keys(nextPersonErrors).length > 0
    ) {
      return
    }

    // Prune hidden fields then build the FormResponseEntry. Person-level keys
    // are only added when the form has person-scope fields (a booking-only
    // form submits exactly what it always did).
    const livePersonAnswers = pruneToPeople(personAnswers, people)
    const entry: FormResponseEntry = {
      form_key: formDef.key,
      answers: prunedBooking,
      ...buildPersonPayload(allFields, prunedBooking, people, livePersonAnswers),
    }

    // Pass raw answers (includes hidden field state) for draft persistence.
    const rawForDraft: Record<string, unknown> = { ...answers }
    if (Object.keys(livePersonAnswers).length > 0) {
      rawForDraft[PERSON_ANSWERS_DRAFT_KEY] = livePersonAnswers
    }
    onConfirm(entry, rawForDraft)
  }

  // landr — the Continue button stays disabled until every VISIBLE field passes
  // validation: required-when-visible (e.g. all declaration checkboxes ticked,
  // ≥1 language picked) plus type/option/format rules. Optional fields left
  // blank produce no error, so they don't block. Derived (no setState) so it
  // updates live as the customer fills the form. landr-9d82r.4: includes every
  // person's fields, so a newly added person with a required answer missing
  // blocks Next.
  const isFormComplete = useMemo(() => {
    if (!formDef) return false
    const bookingOk = bookingScopeFields.every(
      (field) =>
        !isFieldVisible(field, answers) ||
        validateField(field, answers, locale, uiLocale) === null,
    )
    if (!bookingOk) return false
    return people.every((person) => {
      const evalAnswers = personVisibilityAnswers(
        prunedBooking,
        personAnswers[person.key],
      )
      return fieldsForKind(allFields, person.kind).every(
        (field) => validateField(field, evalAnswers, locale, uiLocale) === null,
      )
    })
  }, [
    formDef,
    bookingScopeFields,
    allFields,
    answers,
    locale,
    uiLocale,
    people,
    prunedBooking,
    personAnswers,
  ])

  // Note: live re-validation after submit is driven by handleChange clearing
  // per-field errors on each change. A full re-pass runs via handleSubmit only
  // (no useEffect with setState, which would cause cascading renders).

  // landr-9d82r.4: only people with at least one visible field get a section.
  const personSections = people
    .map((person) => {
      const evalAnswers = personEvalAnswers(person)
      return {
        person,
        evalAnswers,
        visible: personFields(person).filter((f) => isFieldVisible(f, evalAnswers)),
      }
    })
    .filter((sec) => sec.visible.length > 0)

  const formTitle =
    formDef
      ? pickLocalized(formDef.name, formDef.name_localized, locale) || formDef.name
      : tr('additionalInformationTitle', uiLocale)

  const showCustomerCard =
    staffDeferrable && !fillNow && !loading && !fetchError && !!formDef

  return (
    <Card>
      <StepBackButton onBack={onBack} />
      <CardHeader>
        <CardTitle>{formTitle}</CardTitle>
        <CardDescription>{productFormSubtitle(productName, uiLocale)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {showCustomerCard ? (
          <div
            className="flex flex-col gap-3 rounded-md border border-border bg-surface-raised p-4"
            data-testid="cf-customer-completes"
          >
            <p className="text-sm font-medium">
              {tr('staffFormCustomerCompletes', uiLocale)}
            </p>
            <p className="text-xs text-muted-foreground">
              {tr('staffFormCustomerCompletesHint', uiLocale)}
            </p>
            <div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setFillNow(true)}
                data-testid="cf-fill-in-now"
              >
                {tr('staffFormFillInNow', uiLocale)}
              </Button>
            </div>
          </div>
        ) : loading ? (
          <p className="text-sm text-muted-foreground" data-testid="cf-loading">
            {tr('loadingEllipsis', uiLocale)}
          </p>
        ) : fetchError ? (
          <p className="text-sm text-destructive" data-testid="cf-fetch-error">
            {fetchError}
          </p>
        ) : formDef ? (
          <>
            {bookingScopeFields.map((field) => {
              if (!isFieldVisible(field, answers)) return null
              // landr-80ubl.3: every OTHER operator-authored field (required or
              // not) stays visible — unlike the widget's own optional extras,
              // each one was deliberately added to the flow by the operator, so
              // collapsing it behind "+ Add …" would hide a configured question
              // rather than tidy up an incidental one.
              return (
                <FieldRenderer
                  key={field.key}
                  field={field}
                  answers={answers}
                  error={fieldErrors[field.key] ?? null}
                  locale={locale}
                  uiLocale={uiLocale}
                  onChange={handleChange}
                />
              )
            })}
            {/* landr-9d82r.4: participant-/guest-scope fields, once per
                person, grouped under that person's name. A person with no
                visible field gets no section. */}
            {personSections.length > 0 ? (
              <p
                className="text-xs text-muted-foreground"
                data-testid="cf-person-hint"
              >
                {tr('formPersonSectionHint', uiLocale)}
              </p>
            ) : null}
            {personSections.map(({ person, evalAnswers, visible }) => {
              const prefix = `cf-${person.kind}-${person.index}`
              return (
                <section
                  key={person.key}
                  data-testid={prefix}
                  aria-labelledby={`${prefix}-name`}
                  className="flex flex-col gap-4 rounded-md border border-border bg-surface-raised p-4"
                >
                  <header className="flex flex-col gap-0.5">
                    <h3
                      id={`${prefix}-name`}
                      className="text-sm font-semibold"
                      data-testid={`${prefix}-name`}
                    >
                      {person.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {tr(
                        person.kind === 'participant'
                          ? 'formPersonParticipantTag'
                          : 'formPersonGuestTag',
                        uiLocale,
                      )}
                    </p>
                  </header>
                  {visible.map((field) => (
                    <FieldRenderer
                      key={field.key}
                      field={field}
                      answers={evalAnswers}
                      error={personErrors[person.key]?.[field.key] ?? null}
                      locale={locale}
                      uiLocale={uiLocale}
                      idPrefix={prefix}
                      onChange={(key, value) =>
                        handlePersonChange(person.key, key, value)
                      }
                    />
                  ))}
                </section>
              )
            })}
          </>
        ) : null}

        {staffDeferrable && fillNow && formDef ? (
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onCustomerCompletes?.({ form_key: formDef.key, name: formTitle })
              }
              data-testid="cf-let-customer-complete"
            >
              {tr('staffFormLetCustomerComplete', uiLocale)}
            </Button>
          </div>
        ) : null}

        {/* landr-n6ii3: same field DetailsStep collects, editable here too —
            last field before Continue. */}
        {hideCustomerComment ? null : (
          <CustomerCommentField
            value={customerComment}
            onChange={onCustomerCommentChange}
            collapsible
          />
        )}

        {showCustomerCard && formDef ? (
          <ContinueAction
            ready
            reason={tr('readyToContinue', uiLocale)}
            reasonId="cf-step-gate"
            onContinue={() =>
              onCustomerCompletes?.({ form_key: formDef.key, name: formTitle })
            }
            data-testid="cf-submit"
          />
        ) : (
          <ContinueAction
            ready={!loading && !fetchError && isFormComplete}
            reason={
              isFormComplete
                ? tr('readyToContinue', uiLocale)
                : tr('completeEveryRequiredField', uiLocale)
            }
            reasonId="cf-step-gate"
            onContinue={handleSubmit}
            {...(submitLabel ? { label: submitLabel } : {})}
            data-testid="cf-submit"
          />
        )}
      </CardContent>
    </Card>
  )
}
