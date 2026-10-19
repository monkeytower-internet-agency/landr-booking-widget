/**
 * landr-kcxx5.4 — pure helpers for the customer-completes-forms flow
 * (/details/{token} and the inline step on the offer page).
 *
 * The API ships the forms in the exact product-flow shape and the booking's
 * real roster; this maps both onto what CustomFormStep already takes
 * (flow + participants/companions) and maps its output back to the PUT body,
 * whose per-person answers travel keyed by booking_participant_id.
 *
 * Lives in its own .ts file so the components stay react-refresh clean.
 */
import type {
  CustomerDetails,
  DetailsFormResponse,
  DetailsPerson,
} from '@/api/customerDetailsTypes'
import type {
  FlowFormDef,
  FormResponseEntry,
  ProductFlowResponse,
} from '@/api/flowTypes'
import { PERSON_ANSWERS_DRAFT_KEY, type FormPersonSource } from './formScopes'

export interface DetailsFormStep {
  form: FlowFormDef
  productName: string
  /** Flow-shaped wrapper CustomFormStep resolves `form` from (no fetch). */
  flow: ProductFlowResponse
}

/**
 * Every distinct form of the booking, in product then module order. The same
 * form can sit under two products: it is asked once (deduped by form.key).
 */
export function collectForms(details: CustomerDetails): DetailsFormStep[] {
  const seen = new Set<string>()
  const out: DetailsFormStep[] = []
  for (const product of details.forms ?? []) {
    const modules = [...(product.modules ?? [])].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    )
    for (const mod of modules) {
      if (mod.kind !== 'custom_form' || !mod.form) continue
      if (seen.has(mod.form.key)) continue
      seen.add(mod.form.key)
      out.push({
        form: mod.form,
        productName: product.product_name,
        flow: { modules: [mod] },
      })
    }
  }
  return out
}

export interface DetailsRoster {
  participants: FormPersonSource[]
  /** The API's `guest` people (CustomFormStep calls them companions). */
  companions: FormPersonSource[]
}

/** The API roster as CustomFormStep sources; the person key is the id. */
export function rosterSources(people: readonly DetailsPerson[]): DetailsRoster {
  const source = (p: DetailsPerson): FormPersonSource => ({
    id: p.booking_participant_id,
    first_name: p.display_name,
    last_name: '',
  })
  return {
    participants: people.filter((p) => p.kind === 'participant').map(source),
    companions: people.filter((p) => p.kind === 'guest').map(source),
  }
}

/** Stored answers (staff pre-fill / earlier answers) as a CustomFormStep draft. */
export function initialAnswersFor(
  details: CustomerDetails,
  formKey: string,
): Record<string, unknown> | undefined {
  const stored = (details.answers ?? []).find((a) => a.form_key === formKey)
  if (!stored) return undefined
  const out: Record<string, unknown> = { ...(stored.answers ?? {}) }
  if (stored.people && Object.keys(stored.people).length > 0) {
    out[PERSON_ANSWERS_DRAFT_KEY] = stored.people
  }
  return out
}

/** CustomFormStep's entry (index-aligned person arrays) as a PUT entry. */
export function entryToDetailsResponse(
  entry: FormResponseEntry,
  roster: DetailsRoster,
): DetailsFormResponse {
  const people: DetailsFormResponse['people'] = {}
  const add = (
    list: FormResponseEntry['participant_answers'],
    sources: FormPersonSource[],
  ) => {
    list?.forEach((answers, i) => {
      const id = sources[i]?.id
      if (id && Object.keys(answers).length > 0) people[id] = answers
    })
  }
  add(entry.participant_answers, roster.participants)
  add(entry.companion_answers, roster.companions)
  return { form_key: entry.form_key, answers: entry.answers, people }
}
