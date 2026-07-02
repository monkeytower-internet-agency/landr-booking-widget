/**
 * landr-71kz.3 — data-driven booking step sequence.
 *
 * EPIC A makes the widget's step order operator-configurable. Today the
 * sequence is hardcoded in `appStepMachine.ts` (and Para42's declarations are
 * literal constants in `App.tsx`). This module turns that into DATA: a
 * `buildFlowPlan(product, settings, remoteFlow)` builder that returns the
 * ordered list of `FlowModule`s the funnel walks.
 *
 * THE REGRESSION SAFETY NET: with `remoteFlow === null` (the only path live
 * today — the `public_get_product_flow` RPC and its dashboard editor land in
 * later children) the builder reproduces TODAY's routing BIT-FOR-BIT. The
 * `appStepMachine.ts` helpers consult this legacy plan instead of their old
 * hardcoded `if`s, and the ported equivalence suite proves the two are
 * identical across every hotel_offering × needs_pickup × declarations
 * permutation. Once a remote flow exists it overrides the order — but the
 * product gates (accommodation only if a hotel is offered, etc.) stay
 * authoritative, exactly as the data-model spec requires.
 *
 * TOLERANT PARSE — the widget has NO error boundary (bd memory landr-9ut4: a
 * single thrown error during render BLANKS the whole widget). So every
 * remote-config code path here is wrapped to degrade to `null` (→ legacy
 * plan) on ANY malformation. This module NEVER throws.
 */
import type { HotelOffering, ProductKind } from '@/api/types'

/**
 * The module kinds a flow can be composed of. Mirrors
 * `public.product_flow_modules.module_kind` CHECK
 * (`selection, participants, accommodation, service_addons, pickup,
 * custom_form`) plus `review`, a widget-internal frame module the DB does not
 * store as a row:
 *
 *   - `selection` — date / slot picker (pinned first, always present)
 *   - `participants` — booker + participant details (always present)
 *   - `accommodation` — hotel rooms (gated: service + hotel_offering != none)
 *   - `service_addons` — per-product add-ons (gated: probed at runtime)
 *   - `pickup` — free pickup-location picker (gated: needs_pickup, no hotel)
 *   - `custom_form` — operator-defined form (carries formKey)
 *   - `review` — the fill-form submit screen (pinned last, always present)
 *
 * landr-71kz.10: the legacy widget-internal `declarations` kind has been retired
 * — Para42's eligibility declarations are now a `custom_form` module delivered
 * via the remote flow.
 */
export type FlowModuleKind =
  | 'selection'
  | 'participants'
  | 'accommodation'
  | 'service_addons'
  | 'pickup'
  | 'custom_form'
  | 'review'

/**
 * One entry in the ordered flow plan. `kind` discriminates; `formKey` is set
 * ONLY for `custom_form` modules (the operator-form library key the renderer
 * — landr-71kz.4 — resolves to a field set).
 */
export interface FlowModule {
  kind: FlowModuleKind
  /** Present only on `custom_form` modules. The operator form library key. */
  formKey?: string
}

/**
 * The operator-settings slice the flow builder needs. Kept structural (not the
 * full `OperatorSettings`) so the builder + its tests don't depend on every
 * settings field. Today only `slug` matters — it drives the legacy hardcoded
 * declarations gate (Para42). Optional so callers can pass `null`/`{}` when the
 * slug is irrelevant (non-declaration operators).
 */
export interface FlowSettings {
  slug?: string
}

/**
 * The remote flow contract, mirroring the anon RPC `public_get_product_flow`
 * (`{modules: [{kind, position, form?}], ...}` — landr-71kz.2). Carried as a
 * permissive shape because it arrives off the wire and is parsed defensively:
 * `null` (or `{modules: null}`) is the legacy sentinel; anything malformed is
 * coerced to `null` and falls back to the legacy plan.
 */
export interface RemoteFlowModule {
  kind?: unknown
  position?: unknown
  form?: { key?: unknown } | null
  form_key?: unknown
}

export interface RemoteFlow {
  modules?: RemoteFlowModule[] | null
}

/**
 * Does this product offer hotel accommodation? Mirrors the gate used
 * everywhere in the step machine today: a SERVICE product whose
 * `hotel_offering` is not 'none'. Pure + reused so the gate lives in one place.
 */
export function productHasHotelOffering(product: {
  product_kind: ProductKind
  hotel_offering?: HotelOffering
}): boolean {
  const offering: HotelOffering = product.hotel_offering ?? 'none'
  return product.product_kind === 'service' && offering !== 'none'
}

/**
 * Build the LEGACY plan — the exact module sequence the widget walks TODAY,
 * derived purely from the product gates. This is the regression safety net; the
 * ported equivalence suite proves it ≡ the old hardcoded routing across every
 * permutation.
 *
 * landr-71kz.10: the legacy plan no longer injects a `declarations` module. The
 * old hardcoded Para42 declarations step has been retired — declarations are now
 * an operator-configured `custom_form` module that arrives via the REMOTE flow
 * (and only via it). A product with NO remote flow gets a pure product-gated
 * plan (no declarations), so `settings` no longer influences the legacy plan; it
 * is retained on the signature for API stability and forward-compat.
 *
 * Order (pinned frame + gated middles):
 *   selection → participants
 *     → accommodation   iff productHasHotelOffering(product)
 *     → service_addons  (always listed; the funnel probes for add-ons at
 *                        runtime and skips the step when there are none — the
 *                        plan models the POTENTIAL step, the runtime gate
 *                        decides visibility, identical to today)
 *     → pickup          iff needs_pickup (the hotel-skips-pickup rule from
 *                        landr-4r80 is a RUNTIME decision — when a hotel is
 *                        booked the hotel becomes the pickup and this step is
 *                        skipped — so the plan lists the potential step and the
 *                        walk applies the runtime hotel gate, exactly as today)
 *   → review
 *
 * NOTE: `service_addons` and `pickup` are listed as POTENTIAL modules; their
 * runtime gates (has-add-ons probe; hotel-is-pickup) are applied by the
 * step-machine walk, NOT by pruning them from the plan — this keeps the plan a
 * faithful description of the configured order while the dynamic skips stay
 * where they already live (and stay testable in isolation).
 */
function buildLegacyPlan(
  product: { product_kind: ProductKind; hotel_offering?: HotelOffering; needs_pickup?: boolean },
  settings: FlowSettings | null | undefined,
): FlowModule[] {
  void settings // retained for API stability; no longer influences the legacy plan (landr-71kz.10).
  const plan: FlowModule[] = [{ kind: 'selection' }, { kind: 'participants' }]
  if (productHasHotelOffering(product)) plan.push({ kind: 'accommodation' })
  // service_addons is always a potential module (runtime add-on probe gates it).
  plan.push({ kind: 'service_addons' })
  // pickup is a potential module whenever the product needs a pickup; the
  // hotel-is-pickup runtime skip (landr-4r80) is applied by the walk.
  if (product.needs_pickup) plan.push({ kind: 'pickup' })
  plan.push({ kind: 'review' })
  return plan
}

/**
 * The valid module kinds a remote flow may name for its MIDDLE modules. The
 * pinned frame (`selection`, `participants`, `review`) and the legacy-only
 * `declarations` are NOT operator-configurable via the remote flow — they are
 * supplied by the builder. Unknown kinds in a remote flow are skipped silently
 * (forward-compat: a future product kind slots in without breaking old widgets).
 */
const REMOTE_MIDDLE_KINDS: ReadonlySet<string> = new Set([
  'accommodation',
  'service_addons',
  'pickup',
  'custom_form',
])

/**
 * Parse a single remote module into a `FlowModule`, or `null` to skip it.
 * Defensive: returns `null` for unknown/missing kinds and for `custom_form`
 * modules missing a usable form key. Never throws.
 */
function parseRemoteModule(raw: RemoteFlowModule): FlowModule | null {
  const kind = typeof raw?.kind === 'string' ? raw.kind : null
  if (kind == null || !REMOTE_MIDDLE_KINDS.has(kind)) return null
  if (kind === 'custom_form') {
    // form key may arrive nested ({form: {key}}) or flat (form_key).
    const nested =
      raw.form && typeof raw.form === 'object' && typeof raw.form.key === 'string'
        ? raw.form.key
        : null
    const flat = typeof raw.form_key === 'string' ? raw.form_key : null
    const formKey = nested ?? flat
    if (!formKey) return null // a custom_form with no form is meaningless — skip it.
    return { kind: 'custom_form', formKey }
  }
  return { kind: kind as FlowModuleKind }
}

/**
 * Build the ordered flow plan for a product.
 *
 *   - `remoteFlow === null` → the LEGACY plan (today's routing, bit-for-bit).
 *   - a well-formed `remoteFlow` → `selection` + `participants` (pinned frame),
 *     then the remote middle modules in their given order (each still subject to
 *     the product gates: accommodation is dropped when the product offers no
 *     hotel; unknown kinds are skipped), then `review` (pinned frame). The
 *     legacy `declarations` step is NOT injected on the remote path — operators
 *     configuring a flow express declarations as a `custom_form` instead.
 *   - ANY malformation (not an object, `modules` not an array, every module
 *     unparseable, or a thrown error) → falls back to the LEGACY plan. NEVER
 *     throws (the widget has no error boundary — landr-9ut4).
 */
export function buildFlowPlan(
  product: { product_kind: ProductKind; hotel_offering?: HotelOffering; needs_pickup?: boolean },
  settings: FlowSettings | null | undefined,
  remoteFlow: RemoteFlow | null | undefined,
): FlowModule[] {
  // The legacy sentinel: explicit null/undefined remote flow.
  if (remoteFlow == null) return buildLegacyPlan(product, settings)
  try {
    const modules = remoteFlow.modules
    // {modules: null} is the RPC's own legacy sentinel; anything that isn't an
    // array is malformed → legacy.
    if (modules == null) return buildLegacyPlan(product, settings)
    if (!Array.isArray(modules)) return buildLegacyPlan(product, settings)

    const middle: FlowModule[] = []
    // landr-f4dm: track how many entries parsed successfully SEPARATELY from
    // how many survived the product gate below. This distinguishes "every
    // entry was unparseable garbage" (→ fall back to legacy) from "entries
    // parsed fine but the product gate dropped all of them" (→ honour the
    // minimal selection→participants→review flow the operator configured).
    let parsedCount = 0
    for (const raw of modules) {
      const parsed = parseRemoteModule(raw)
      if (!parsed) continue // unknown / malformed module → skip silently.
      parsedCount += 1
      // Product gate: accommodation only when the product actually offers a
      // hotel. Other gated modules (service_addons probe, pickup hotel-skip)
      // remain runtime decisions in the walk, identical to the legacy path.
      if (parsed.kind === 'accommodation' && !productHasHotelOffering(product)) {
        continue
      }
      middle.push(parsed)
    }

    // Zero modules parsed out of a non-empty array means the payload was
    // garbage (not a deliberate operator choice) → fall back to legacy. When
    // at least one module parsed — even if the product gate then dropped all
    // of them (e.g. an accommodation-only remote flow on a no-hotel product)
    // — that is a VALID minimal flow, not a parse failure.
    if (parsedCount === 0 && modules.length > 0) {
      return buildLegacyPlan(product, settings)
    }

    return [
      { kind: 'selection' },
      { kind: 'participants' },
      ...middle,
      { kind: 'review' },
    ]
  } catch {
    // Any unexpected shape that slips past the guards above must NOT blank the
    // widget — degrade to the legacy plan.
    return buildLegacyPlan(product, settings)
  }
}
