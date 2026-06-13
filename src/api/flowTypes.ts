/**
 * landr-71kz.4 — wire types for the public_get_product_flow RPC response.
 *
 * These mirror `app/routers/public_bookings.py` FormResponseIn and the
 * `public_get_product_flow` RPC jsonb shape (landr-71kz.2 handoff, §EXACT
 * WIRE SHAPE). Kept in a separate file so types.ts stays in scope.
 *
 * VISIBILITY-RULE CONTRACT — see landr-71kz.2 handoff §VISIBILITY-RULE
 * CONTRACT. `isFieldVisible` in CustomFormStep.tsx MUST match the Python
 * twin `is_field_visible` in `app/services/form_responses.py` exactly.
 */

/** A single option in a select/radio/checkbox/multiselect field. */
export interface FlowFieldOption {
  value: string
  label: string
  label_localized: Record<string, string> | null
}

/** Numeric/length/pattern validation blob (all optional; fail-open on bad values). */
export interface FlowFieldValidation {
  min?: number | null
  max?: number | null
  min_length?: number | null
  max_length?: number | null
  /** Full-match regex (fail-open when uncompilable). */
  pattern?: string | null
}

/** op enum for a visibility rule (contract-pinned). */
export type VisibilityOp = 'eq' | 'neq' | 'in' | 'truthy'

/**
 * Single-rule v1 visibility rule. A `null` rule means always-visible.
 * `value` is ignored for `truthy`; must be an array for `in`.
 */
export interface VisibilityRule {
  field_key: string
  op: VisibilityOp
  value?: unknown
}

/** The field_type enum (contract-pinned). */
export type FlowFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'multiselect'
  | 'language'

/** One field definition from the form RPC (verbatim wire keys). */
export interface FlowFieldDef {
  key: string
  field_type: FlowFieldType
  label: string
  label_localized: Record<string, string> | null
  help_text: string | null
  help_text_localized: Record<string, string> | null
  required: boolean
  position: number
  options: FlowFieldOption[] | null
  validation: FlowFieldValidation | null
  visibility_rule: VisibilityRule | null
}

/** One form embedded in a custom_form flow module. */
export interface FlowFormDef {
  key: string
  version: number
  name: string
  name_localized: Record<string, string> | null
  fields: FlowFieldDef[]
}

/** One module from the public_get_product_flow RPC. */
export interface FlowModuleDef {
  kind: string
  position: number
  form: FlowFormDef | null
}

/** Top-level response of GET …/products/{id}/flow. */
export interface ProductFlowResponse {
  modules: FlowModuleDef[] | null
}

/**
 * One form_responses entry in the booking submit body (landr-71kz.2).
 * Hidden-field answers must be PRUNED before building this (server prunes too,
 * but keeps them in lock-step per the landr-9ut4 lesson).
 */
export interface FormResponseEntry {
  form_key: string
  /** Answers keyed by field_key. Scalar fields → string; multivalue → string[]. */
  answers: Record<string, string | string[]>
}
