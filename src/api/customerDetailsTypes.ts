/**
 * Wire types for the customer-completes-forms page
 * (GET/PUT /api/public/bookings/{token}/details). Kept next to flowTypes
 * because the form definitions are exactly the public_get_product_flow shape.
 * customerDetailsTypes.contract.test.ts pins them to the generated schema.
 */
import type { FlowModuleDef } from './flowTypes'

export interface DetailsProductForms {
  product_id: string
  product_name: string
  modules: FlowModuleDef[]
}

/** One person of the booking; participants come first, then guests. */
export interface DetailsPerson {
  booking_participant_id: string
  kind: 'participant' | 'guest'
  display_name: string
}

/** Stored answers of one form, in the PUT shape. */
export interface DetailsFormAnswers {
  form_key: string
  answers?: Record<string, unknown>
  people?: Record<string, Record<string, unknown>>
}

export interface CustomerDetails {
  pending: boolean
  requested_at?: string | null
  completed_at?: string | null
  forms?: DetailsProductForms[]
  people?: DetailsPerson[]
  answers?: DetailsFormAnswers[]
}

export type DetailsAnswerValue = string | string[]

export interface DetailsFormResponse {
  form_key: string
  answers: Record<string, DetailsAnswerValue>
  /** Keyed by booking_participant_id. */
  people: Record<string, Record<string, DetailsAnswerValue>>
}

export interface CustomerDetailsPutBody {
  form_responses: DetailsFormResponse[]
}

/** One item of the PUT's 422 `form_responses_invalid` error list. */
export interface DetailsFieldError {
  form_key: string
  field_key: string
  code: string
  message: string
  booking_participant_id?: string | null
}
