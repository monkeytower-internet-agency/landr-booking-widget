/**
 * Pure step-machine helpers for App.tsx. Kept in a sibling .ts file so
 * the react-refresh/only-export-components ESLint rule stays happy
 * (App.tsx exports a React component as default — adding non-component
 * exports there would trigger the rule and block CI).
 */
import type { AccommodationMode } from '@/components/booking/AccommodationStep'
import type {
  BreakfastMap,
  OccupantAgeMap,
  RoomAssignmentMap,
  RoomSelection,
} from '@/components/booking/accommodationCalc'
import type { AddonSelection } from '@/components/booking/addonsState'
import type { BookingSelection } from '@/components/booking/BookingForm'

import type {
  BookerDetails,
  CompanionDetails,
  ParticipantDetails,
} from '@/components/booking/detailsTypes'
import type { Product, ProductGroup, SubmitBookingResponse } from '@/api/types'
import {
  buildFlowPlan,
  productHasHotelOffering,
  type FlowModule,
  type FlowModuleKind,
  type RemoteFlow,
} from './flowPlan'

/**
 * landr-gb2f.5: the raw per-room add-on selection carried through the step
 * machine. Keyed by roomProductId → { addon_product_id → qty }. This is the
 * UNFLATTENED form from AccommodationStep's internal addonSelection state, so
 * the review screen can reconstruct which room unit has breakfast vs not.
 * Empty map for guiding-only / shared-double modes (no room add-ons).
 */
export type PerRoomAddons = Record<string, Record<string, number>>

/**
 * landr-nmed: the persistent booking-draft of all downstream data the
 * customer has already entered. App.tsx holds ONE of these in state for the
 * whole flow; it survives ALL step navigation (breadcrumb jumps included) and
 * re-seeds the downstream steps on the way forward.
 *
 * Without this, jumping back to Dates (or the product crumb) and clicking
 * Continue rebuilt the details step from scratch and wiped the booker +
 * participants + companions + accommodation + declarations the customer had
 * already typed. This generalises the landr-b3g5 "Back from downstream"
 * restore (which only covered ADJACENT back-steps) to arbitrary breadcrumb
 * jumps to the two earliest steps.
 *
 * Every field is optional — the draft only carries what the customer has
 * actually reached/entered so far. Re-validation / re-clamping (e.g. room
 * assignment when a date change alters the day count) happens where the
 * downstream step re-seeds (AccommodationStep already re-clamps room add-ons
 * against capacity — landr-u4fl); the identities (names) are always kept.
 */
export interface BookingDraft {
  booker?: BookerDetails
  participants?: ParticipantDetails[]
  companions?: CompanionDetails[]
  // Accommodation slice — re-seeds AccommodationStep on the way forward.
  hotelLocationId?: string | null
  accommodationRooms?: RoomSelection[]
  addons?: AddonSelection[]
  includeHotel?: boolean
  isSharedDouble?: boolean
  accommodationMode?: AccommodationMode
  roomAssignment?: RoomAssignmentMap
  occupantAgeMap?: OccupantAgeMap
  perRoomAddons?: PerRoomAddons
  roomProductNames?: Record<string, string>
  breakfastMap?: BreakfastMap
  // Intermediate-step provenance + their entered values.
  pickupLocationId?: string | null
  hadServiceAddons?: boolean
  // Declarations slice — re-seeds DeclarationsStep on the way forward.
  customerDeclarations?: Record<string, true> | null
  customerLanguages?: string[] | null
  customerOtherLanguages?: string | null
  // landr-71kz.3: per-custom-form answers, keyed by form key → (field key →
  // value). PLUMBING ONLY for this child — the BookingDraft carries the slot
  // and the persistence layer round-trips it, but the CustomFormStep that reads
  // /writes it lands in landr-71kz.4. Survives breadcrumb jumps + reloads exactly
  // like every other draft slice. Empty/undefined until the customer answers a
  // custom form.
  customFormAnswers?: Record<string, Record<string, unknown>>
}

/**
 * Inputs for the persistent PriceSidebar (landr-qez0). Returns null
 * when the current step is BEFORE pick-selection (i.e. pick-product) or
 * AFTER fill-form (confirmed). For pick-selection where the customer
 * hasn't yet committed dates/slots we still show the sidebar — the
 * pricing engine handles 0 selected_days by emitting a base/fixed total
 * (or 0) so the customer sees a placeholder until they pick.
 *
 * For non-service product kinds (digital_good, gift_card, …) we
 * suppress the sidebar — those flows render the ShopComingSoonStub and
 * don't take a booking, so quoting a price would be misleading.
 *
 * participantNames (landr-8c03): once DetailsStep has been completed we
 * pass the list of first names down so the sidebar can label the line
 * items with "Ada, Grace + 1 other" instead of just "1×". Empty before
 * DetailsStep so the sidebar falls back to the count-only labels.
 */
export interface SidebarInputs {
  product: Product
  selectedDays: string[]
  /** Defaults to 1 before DetailsStep confirms. */
  participantCount: number
  participantNames: string[]
  accommodationRooms: RoomSelection[]
  addons: AddonSelection[]
}

export type Step =
  | { name: 'pick-product' }
  /**
   * landr-d8rg.4: category entrance — shown when the operator has more than
   * one non-empty product group AND no ?group= / ?product= deep link is set.
   * The groups array comes from listProductGroups (landr-d8rg.1) fetched at
   * boot. Selecting a group transitions to pick-product scoped to that group.
   * sidebarInputsForStep returns null (no product chosen yet, no price).
   */
  | { name: 'pick-category'; groups: ProductGroup[] }
  /**
   * landr-d8rg.4: product detail page — shown when a card is selected from
   * pick-product (or via a ?product= deep link). The customer can review the
   * product and hit the "Book" CTA to enter the existing afterSelection flow.
   * sidebarInputsForStep returns null (no date/selection yet — landr-hpyn
   * convention: price only after dates are committed).
   * groups is optional (set when the user came from a category, so Back can
   * return to the scoped pick-product with the same group filter).
   */
  | { name: 'product-detail'; product: Product; groups?: ProductGroup[] }
  // landr (breadcrumb): `selection` carries the previously-committed dates/slot
  // when the customer navigates BACK to this step (via the breadcrumb or the
  // back affordance). The date pickers re-seed from it so the customer sees and
  // can edit their prior choice instead of starting from scratch. Undefined on
  // the initial forward visit (no prior selection to restore).
  | { name: 'pick-selection'; product: Product; selection?: BookingSelection }
  // landr-7jgo: a single-product deep link (?product=<slug>) that resolved to
  // a SOLD-OUT product. The product is always rendered (informational "Fully
  // booked" state), but with NO date picker and NO Select CTA — there is
  // nothing to book. Only reachable via a deep link; the catalogue overview
  // hides sold-out products (or shows them as inline cards when the embed
  // opts in via show_sold_out), never as this standalone step.
  | { name: 'fully-booked'; product: Product }
  // landr-8c03 (was 'participants' / landr-mbge): collects full booker
  // + participant details right after dates. The booker fields and the
  // participants array thread through every downstream step + the
  // submit payload. Replaces the count-only ParticipantsStep.
  //
  // landr-b3g5: optional booker + participants carry over when the
  // customer hits Back from a downstream step. They seed the form so
  // previously entered data isn't wiped on re-mount. Undefined on the
  // initial forward visit (no prior data to restore).
  | {
      name: 'details'
      product: Product
      selection: BookingSelection
      booker?: BookerDetails
      participants?: ParticipantDetails[]
      // landr-87n9.3: non-guiding companions carry over on Back-restore.
      companions?: CompanionDetails[]
    }
  // landr-yf0n: optional initialHotelLocationId / accommodationRooms /
  // addons / includeHotel let AccommodationStep re-seed its internal
  // state when the customer hits Back from a downstream step. Undefined
  // on the initial forward visit (no prior data to restore).
  // landr-ffyg.2: isSharedDouble + accommodationMode carry the top-level
  // accommodation mode so back-nav restores the chosen mode (guiding-only
  // / package / shared-double). isSharedDouble is the persisted submit
  // flag (true only for the shared-double mode).
  | {
      name: 'pick-accommodation'
      product: Product
      selection: BookingSelection
      booker: BookerDetails
      participants: ParticipantDetails[]
      // landr-87n9.3: non-guiding companions thread through so the
      // whole-party room assignment + occupancy gating has them.
      companions: CompanionDetails[]
      hotelLocationId?: string | null
      accommodationRooms?: RoomSelection[]
      addons?: AddonSelection[]
      includeHotel?: boolean
      isSharedDouble?: boolean
      accommodationMode?: AccommodationMode
      // landr-gb2f.2 / landr-87n9.3: persisted WHOLE-PARTY → room assignment
      // (unified index space: participants 0..P-1, companions P..P+C-1) for
      // back-nav restoration of the chips/units layout.
      roomAssignment?: RoomAssignmentMap
      // landr-doam.1: per-occupant age band + age for back-nav restoration.
      occupantAgeMap?: OccupantAgeMap
      // landr-gb2f.5: raw per-room add-on selection for back-nav restoration.
      perRoomAddons?: PerRoomAddons
      // landr-gb2f.5: room product display names for the review labels.
      roomProductNames?: Record<string, string>
      // landr-a4fy: per-occupant breakfast flag map for back-nav restoration.
      breakfastMap?: BreakfastMap
    }
  // landr-yf0n: optional addons lets ServiceAddonsStep re-seed its
  // selection map on back-nav re-entry.
  | {
      name: 'pick-service-addons'
      product: Product
      selection: BookingSelection
      booker: BookerDetails
      participants: ParticipantDetails[]
      // landr-87n9.3: carry companions through the service-addons branch
      // (no room units here, but the roster must survive to fill-form).
      companions: CompanionDetails[]
      addons?: AddonSelection[]
    }
  // landr-yf0n: optional pickupLocationId lets PickupLocationPicker re-
  // seed its radio selection on back-nav re-entry. hadServiceAddons +
  // hotelLocationId remember which upstream step the customer originally
  // confirmed through so the back-nav routing can hop back through the
  // same intermediate steps instead of jumping straight to DetailsStep.
  // landr-sbhz.4: isSharedDouble threads through for back-nav restoration.
  | {
      name: 'pick-pickup'
      product: Product
      selection: BookingSelection
      booker: BookerDetails
      participants: ParticipantDetails[]
      // landr-87n9.3: companions roster threads through.
      companions: CompanionDetails[]
      accommodationRooms: RoomSelection[]
      addons: AddonSelection[]
      pickupLocationId?: string | null
      hotelLocationId?: string | null
      hadServiceAddons?: boolean
      includeHotel?: boolean
      isSharedDouble?: boolean
      accommodationMode?: AccommodationMode
      // landr-gb2f.2: carry the assignment through the pickup step so the
      // back-nav into pick-accommodation restores it.
      roomAssignment?: RoomAssignmentMap
      // landr-doam.1: carry the age map through the pickup step.
      occupantAgeMap?: OccupantAgeMap
      // landr-gb2f.5: carry the per-room add-on map through the pickup step.
      perRoomAddons?: PerRoomAddons
      // landr-gb2f.5: room product display names for the review labels.
      roomProductNames?: Record<string, string>
      // landr-a4fy: carry the breakfast map through the pickup step.
      breakfastMap?: BreakfastMap
    }
  // landr-71kz.10: the legacy hardcoded `declarations` Step variant has been
  // retired. Para42's eligibility declarations are now an operator-configured
  // `custom_form` module (form_key `customer_declarations`), rendered by the
  // `custom-form` Step variant below and submitted as `form_responses` — the
  // server mirrors that form into bookings.customer_declarations +
  // customer_language. The data path replaces the constant-driven branch.
  //
  // landr-71kz.3: a single operator-defined custom form, carrying its library
  // `formKey`. PLUMBING ONLY here — the field renderer + submit wiring land in
  // landr-71kz.4; for now this variant exists so the Step union, the plan walk,
  // and the persisted-draft schema all carry it. Threads the same provenance bag
  // every other downstream step does, so back-nav restores the upstream state.
  // `initialAnswers` re-seeds the (future) renderer on back-nav from the draft's
  // customFormAnswers[formKey] slice.
  | {
      name: 'custom-form'
      product: Product
      selection: BookingSelection
      booker: BookerDetails
      participants: ParticipantDetails[]
      companions: CompanionDetails[]
      pickupLocationId: string | null
      accommodationRooms: RoomSelection[]
      addons: AddonSelection[]
      hotelLocationId?: string | null
      hadServiceAddons?: boolean
      includeHotel?: boolean
      isSharedDouble?: boolean
      accommodationMode?: AccommodationMode
      roomAssignment?: RoomAssignmentMap
      occupantAgeMap?: OccupantAgeMap
      perRoomAddons?: PerRoomAddons
      roomProductNames?: Record<string, string>
      breakfastMap?: BreakfastMap
      // landr-71kz.3: which operator form this step renders.
      formKey: string
      // landr-71kz.4 (forward-compat): prior answers for back-nav restoration.
      initialAnswers?: Record<string, unknown>
    }
  // landr-yf0n: hotelLocationId / hadServiceAddons / includeHotel remember
  // the upstream path so the BookingForm back button can restore the
  // intermediate steps with their previously confirmed state.
  // landr-sbhz.4: isSharedDouble threads through so the back button
  // from fill-form restores the shared-double tick on re-entry.
  | {
      name: 'fill-form'
      product: Product
      selection: BookingSelection
      booker: BookerDetails
      participants: ParticipantDetails[]
      // landr-87n9.3: companions roster — BookingForm sends it as the
      // top-level companions[] and maps the assignment-map tail
      // (indices >= participants.length) onto each companion's
      // room_product_id + room_unit_index on submit.
      companions: CompanionDetails[]
      pickupLocationId: string | null
      accommodationRooms: RoomSelection[]
      addons: AddonSelection[]
      hotelLocationId?: string | null
      hadServiceAddons?: boolean
      includeHotel?: boolean
      isSharedDouble?: boolean
      accommodationMode?: AccommodationMode
      // landr-gb2f.2 / landr-87n9.3: WHOLE-PARTY assignment BookingForm maps
      // onto each participant + companion's room_product_id + room_unit_index
      // on submit (unified index: participants first, companions after).
      roomAssignment?: RoomAssignmentMap
      // landr-doam.1: per-occupant age band + age threaded to BookingForm
      // for populating occupant_age_band + occupant_age on submit.
      occupantAgeMap?: OccupantAgeMap
      // landr-gb2f.5: raw per-room add-on map threaded to BookingForm so
      // the review can show which room unit has breakfast vs not.
      perRoomAddons?: PerRoomAddons
      // landr-gb2f.5: room product display names for the review labels.
      roomProductNames?: Record<string, string>
      // landr-a4fy: per-occupant breakfast flag map threaded to BookingForm
      // for has_breakfast on each Participant / Companion in the submit body.
      breakfastMap?: BreakfastMap
      // landr-sbhz.3: declarations confirmed upstream by DeclarationsStep.
      // Only present when the operator requires declarations.
      customerDeclarations?: Record<string, true> | null
      // landr-87n9.4: replaces customerLanguage (single) with the multi-select
      // BCP-47 list and the free-text "other languages" field.
      customerLanguages?: string[] | null
      customerOtherLanguages?: string | null
    }
  | { name: 'confirmed'; response: SubmitBookingResponse; email: string }

/**
 * landr-ffyg.2: derive the top-level accommodation mode from an
 * AccommodationStep onConfirm payload, for back-nav restoration. The
 * three arguments AccommodationStep reports fully determine the mode:
 *
 *   - isSharedDouble === true            → 'shared-double' (hotel set, no rooms)
 *   - hotelLocationId === null           → 'guiding-only'  (opt-out, no hotel)
 *   - otherwise (hotel set, rooms picked)→ 'package'
 *
 * Kept here (not in App.tsx) so App.tsx stays component-only for the
 * react-refresh/only-export-components rule.
 */
export function deriveAccommodationMode(
  hotelLocationId: string | null,
  isSharedDouble: boolean | undefined,
): AccommodationMode {
  if (isSharedDouble) return 'shared-double'
  if (hotelLocationId === null) return 'guiding-only'
  return 'package'
}

// ─── Plan walks (landr-71kz.3, remote flow activated in landr-71kz.10) ────────
//
// The routing helpers below are thin plan-index WALKS over the FlowModule[] the
// funnel is configured with, instead of hardcoded `if (hotel) … else if (pickup)
// …` ladders. With a null/absent remoteFlow `buildFlowPlan` yields the LEGACY
// plan, so the walk reproduces today's routing bit-for-bit — proven by the
// equivalence suite in flowPlan.equivalence.test.ts.
//
// landr-71kz.10: the helpers now take an OPTIONAL `remoteFlow`. When App.tsx has
// fetched a product's operator-configured flow, it threads it here so the plan
// includes `custom_form` modules in their configured positions. The forward
// routing into a custom-form step is driven by `customFormKeysBeforeReview`
// (which reads the formKeys off the plan); the BACKWARD walks treat `custom_form`
// like any other middle module (always live; reconstructed via the `custom-form`
// Step variant). When `remoteFlow` is undefined/null every helper falls back to
// the legacy plan — identical to before this change.
//
// Two gates stay RUNTIME decisions applied during the walk, exactly as today —
// they are NOT pruned from the plan, because the plan is the declared order, not
// the per-booking realised path:
//
//   - `pickup` is SKIPPED when a hotel was booked (hotelLocationId != null): the
//     hotel becomes the pickup point (landr-4r80). On the back-nav walk the same
//     gate means a booked hotel hops back PAST pickup to accommodation.
//   - `accommodation` is present in the plan iff the product offers a hotel; the
//     back-nav walk treats a hotel-offering product as having passed THROUGH
//     accommodation even on the guiding-only opt-out (matching today's
//     stepBeforeReview, which routes guiding-only opt-outs back to accommodation).
//
// `service_addons` is listed in every legacy plan but its visibility is a
// runtime add-on probe in App.tsx; the back-nav walk consults the
// `hadServiceAddons` provenance flag (set true only when the step actually
// showed), so a product with no add-ons never routes Back to it — identical to
// today.

/**
 * The middle module kinds (everything strictly between participants and review)
 * of the plan for a product + (optional) remote flow. The pinned frame
 * (selection, participants, review) is dropped because the routing helpers only
 * ever choose among the middle steps + the review terminus. With `remoteFlow`
 * absent this is the legacy plan; with it present, `custom_form` modules appear
 * in their configured order.
 */
function planMiddleKinds(
  product: Product,
  remoteFlow?: RemoteFlow | null,
): FlowModuleKind[] {
  const plan: FlowModule[] = buildFlowPlan(product, {}, remoteFlow ?? null)
  return plan
    .map((m) => m.kind)
    .filter((k) => k !== 'selection' && k !== 'participants' && k !== 'review')
}

/**
 * landr-71kz.10: the ordered library keys of the `custom_form` modules in the
 * plan, in their configured positions. Empty when there is no remote flow (the
 * legacy plan never contains a custom_form). Drives the FORWARD routing into the
 * custom-form step chain before review.
 */
function customFormKeysBeforeReview(
  product: Product,
  remoteFlow?: RemoteFlow | null,
): string[] {
  const plan: FlowModule[] = buildFlowPlan(product, {}, remoteFlow ?? null)
  return plan
    .filter((m): m is FlowModule & { formKey: string } =>
      m.kind === 'custom_form' && typeof m.formKey === 'string',
    )
    .map((m) => m.formKey)
}

/**
 * Runtime predicate: is this potential middle module actually LIVE for the
 * current booking state? Encodes the two runtime gates (hotel-skips-pickup;
 * service-addons provenance) so the plan walk yields the realised path.
 *
 * `accommodation` is always live when present (the product offers a hotel, and
 * the customer always passes through the step — booking, opting out, or
 * shared-double). `custom_form` is always live when present (no runtime skip in
 * v1).
 */
function isModuleLive(
  kind: FlowModuleKind,
  ctx: {
    hotelLocationId?: string | null
    hadServiceAddons?: boolean
  },
): boolean {
  switch (kind) {
    case 'pickup':
      // Hotel booked → the hotel IS the pickup; the free picker is skipped.
      return ctx.hotelLocationId == null
    case 'service_addons':
      // Only live when the customer actually saw the add-ons step.
      return ctx.hadServiceAddons === true
    default:
      return true
  }
}

/**
 * Walk BACKWARD from `review` (or from a given module) to find the LIVE module
 * that immediately precedes it. Returns null when nothing live precedes it (the
 * walk has reached the implicit participants/details frame). `fromKind`
 * undefined means "the step before review".
 */
function liveModuleBefore(
  product: Product,
  remoteFlow: RemoteFlow | null | undefined,
  ctx: { hotelLocationId?: string | null; hadServiceAddons?: boolean },
  fromKind?: FlowModuleKind,
): FlowModuleKind | null {
  const kinds = planMiddleKinds(product, remoteFlow)
  const start = fromKind ? kinds.indexOf(fromKind) : kinds.length
  for (let i = start - 1; i >= 0; i -= 1) {
    const kind = kinds[i]!
    if (isModuleLive(kind, ctx)) return kind
  }
  return null
}

/**
 * Pick the next step after the AccommodationStep returns (or after
 * pick-selection when the product has no hotel offering and we short-
 * circuit straight through).
 *
 * landr-4r80: when the customer booked a hotel (hotelLocationId !==
 * null), the hotel IS the pickup point — Martin's bus picks up AT the
 * hotel — so we skip the pick-pickup step entirely and pre-set
 * pickup_location_id to the hotel's locations.id row. The locations FK
 * on bookings is unconstrained on role_type, so any location row is a
 * valid pickup_location_id (no schema change needed).
 *
 * When hotelLocationId is null (no hotel offering on the product, or
 * the customer answered "No" to an optional hotel), fall back to the
 * pre-existing branch: pick-pickup if needs_pickup, else fill-form
 * with pickupLocationId=null.
 *
 * landr-8c03: booker + participants now thread through every branch so
 * the final fill-form (review screen) can show the whole party.
 */
export function stepAfterAccommodation(
  product: Product,
  selection: BookingSelection,
  booker: BookerDetails,
  participants: ParticipantDetails[],
  // landr-87n9.3: companions roster threaded to the submit step.
  companions: CompanionDetails[],
  accommodationRooms: RoomSelection[],
  hotelLocationId: string | null,
  addons: AddonSelection[] = [],
  // landr-yf0n: optional provenance flags so downstream steps can hand
  // them back when the customer hits Back. hadServiceAddons distinguishes
  // a customer who confirmed an empty ServiceAddonsStep from one who
  // never saw it; includeHotel preserves the optional-mode Yes/No state.
  hadServiceAddons: boolean = false,
  includeHotel: boolean | undefined = undefined,
  // landr-sbhz.4: shared-double flag for back-nav restoration.
  isSharedDouble: boolean | undefined = undefined,
  // landr-ffyg.2: top-level accommodation mode for back-nav restoration.
  accommodationMode: AccommodationMode | undefined = undefined,
  // landr-gb2f.2: participant → room assignment, threaded to the submit step.
  roomAssignment: RoomAssignmentMap | undefined = undefined,
  // landr-doam.1: per-occupant age band + age, threaded to the submit step.
  occupantAgeMap: OccupantAgeMap | undefined = undefined,
  // landr-gb2f.5: raw per-room add-on map, threaded to the review screen.
  perRoomAddons: PerRoomAddons | undefined = undefined,
  // landr-gb2f.5: room product display names for the review labels.
  roomProductNames: Record<string, string> | undefined = undefined,
  // landr-a4fy: per-occupant breakfast flag map, threaded to the review screen.
  breakfastMap: BreakfastMap | undefined = undefined,
): Step {
  // landr-71kz.3: plan walk for the post-accommodation forward target. The
  // legacy forward contract out of this call is EXACTLY three branches, and
  // add-ons ALWAYS precede this call (App.tsx runs the add-ons probe before
  // afterAccommodation), so `service_addons` must NEVER be a forward target
  // here:
  //   1. hotel booked (hotelLocationId != null) → fill-form (hotel is pickup);
  //   2. else needs_pickup → pick-pickup;
  //   3. else fill-form (pickup null).
  // The ONLY middle module that can terminate the post-accommodation search is
  // `pickup`. It is "live forward" iff it is in the plan (needs_pickup) AND no
  // hotel was booked (landr-4r80: a booked hotel becomes the pickup point, so
  // the free picker is skipped). Any other module (service_addons, custom_form,
  // declarations) is upstream-of or layered-on and must not divert this branch.
  //
  // REGRESSION FIX (PR #119 review): the previous walk let ANY live module
  // terminate the search and, for a no-hotel product, started at index 0 (no
  // accommodation module ⇒ indexOf === -1 ⇒ start at the first middle), so a
  // product with service add-ons + needs_pickup wrongly terminated on
  // service_addons → fill-form, skipping the pickup picker. Now we look up the
  // `pickup` module directly and apply only its forward gate.
  // The pickup gate is purely product-driven (needs_pickup), identical in the
  // legacy and remote plans, and the custom-form chain is layered on AFTER this
  // call by App's pre-review router — so this lookup stays on the legacy plan.
  const kinds = planMiddleKinds(product)
  const pickupLive =
    kinds.includes('pickup') && isModuleLive('pickup', { hotelLocationId })
  if (pickupLive) {
    return {
      name: 'pick-pickup',
      product,
      selection,
      booker,
      participants,
      companions,
      accommodationRooms,
      addons,
      hotelLocationId: null,
      hadServiceAddons,
      includeHotel,
      isSharedDouble,
      accommodationMode,
      roomAssignment,
      occupantAgeMap,
      perRoomAddons,
      roomProductNames,
      breakfastMap,
    }
  }
  // No live pickup ahead → straight to the review terminus. When a hotel was
  // booked the hotel IS the pickup (landr-4r80 / landr-ffyg.2: package +
  // shared-double); otherwise pickup_location_id is null.
  return {
    name: 'fill-form',
    product,
    selection,
    booker,
    participants,
    companions,
    pickupLocationId: hotelLocationId !== null ? hotelLocationId : null,
    accommodationRooms,
    addons,
    hotelLocationId,
    hadServiceAddons,
    includeHotel,
    isSharedDouble,
    accommodationMode,
    roomAssignment,
    occupantAgeMap,
    perRoomAddons,
    roomProductNames,
    breakfastMap,
  }
}

/**
 * landr-87n9.1: pick the step to return to when the customer hits Back
 * from the review screen (declarations / fill-form). This MIRRORS the
 * forward stepAfterAccommodation routing so Back retraces exactly the
 * steps that were shown on the way forward — it must NOT route to a step
 * that was skipped.
 *
 * The bug this fixes: the previous handlers tested `product.needs_pickup`
 * FIRST and routed to pick-pickup. But when a hotel is booked the pickup
 * step is SKIPPED on the way forward (stepAfterAccommodation: a non-null
 * hotelLocationId makes the hotel the pickup and bypasses pick-pickup), so
 * Back wrongly landed on the free-pickup picker the customer never saw.
 *
 * Routing rule (mirrors stepAfterAccommodation, in reverse):
 *   1. hotelLocationId != null → pickup was SKIPPED forward → Back goes to
 *      pick-accommodation (the hotel/room page). Covers package AND
 *      shared-double modes (both set a hotel).
 *   2. else if product.needs_pickup → pick-pickup actually showed forward
 *      → Back goes to pick-pickup.
 *   3. else if a hotel offering exists (service + hotel_offering != 'none')
 *      → the customer passed through pick-accommodation (guiding-only
 *      opt-out) → Back goes to pick-accommodation.
 *   4. else if hadServiceAddons → Back goes to pick-service-addons.
 *   5. else → details.
 *
 * `args` carries every field the upstream steps need to be reconstructed
 * with their previously-confirmed state restored (the same provenance
 * bag fill-form / declarations already thread through).
 */
export interface StepBeforeReviewArgs {
  product: Product
  selection: BookingSelection
  booker: BookerDetails
  participants: ParticipantDetails[]
  // landr-87n9.3: companions roster restored on back-nav.
  companions: CompanionDetails[]
  pickupLocationId: string | null
  accommodationRooms: RoomSelection[]
  addons: AddonSelection[]
  hotelLocationId?: string | null
  hadServiceAddons?: boolean
  includeHotel?: boolean
  isSharedDouble?: boolean
  accommodationMode?: AccommodationMode
  roomAssignment?: RoomAssignmentMap
  // landr-doam.1: carry the age map back for pick-accommodation restoration.
  occupantAgeMap?: OccupantAgeMap
  // landr-gb2f.5: carry the per-room add-on map back for review restoration.
  perRoomAddons?: PerRoomAddons
  // landr-gb2f.5: room product display names for the review labels.
  roomProductNames?: Record<string, string>
  // landr-a4fy: carry the breakfast map back for pick-accommodation restoration.
  breakfastMap?: BreakfastMap
  // landr-71kz.10: the operator-configured remote flow (when fetched) so the
  // backward walk sees the custom_form modules in their configured positions.
  // Absent → legacy plan (no custom forms), identical to before.
  remoteFlow?: RemoteFlow | null
  // landr-71kz.10: prior custom-form answers keyed by form_key, so a back hop
  // into a custom-form step re-seeds the renderer from the draft.
  customFormAnswers?: Record<string, Record<string, unknown>>
}

/**
 * landr-71kz.10: reconstruct the `custom-form` Step for a given form key from the
 * provenance bag, re-seeding the renderer from the draft's prior answers. Threads
 * the same downstream context every pre-review step carries so back-nav restores
 * upstream state.
 */
function reconstructCustomFormStep(
  formKey: string,
  args: StepBeforeReviewArgs,
): Step {
  return {
    name: 'custom-form',
    product: args.product,
    selection: args.selection,
    booker: args.booker,
    participants: args.participants,
    companions: args.companions,
    pickupLocationId: args.pickupLocationId,
    accommodationRooms: args.accommodationRooms,
    addons: args.addons,
    hotelLocationId: args.hotelLocationId,
    hadServiceAddons: args.hadServiceAddons,
    includeHotel: args.includeHotel,
    isSharedDouble: args.isSharedDouble,
    accommodationMode: args.accommodationMode,
    roomAssignment: args.roomAssignment,
    occupantAgeMap: args.occupantAgeMap,
    perRoomAddons: args.perRoomAddons,
    roomProductNames: args.roomProductNames,
    breakfastMap: args.breakfastMap,
    formKey,
    initialAnswers: args.customFormAnswers?.[formKey],
  }
}

/**
 * Reconstruct the upstream Step for a given middle module kind from the
 * provenance bag, with its previously-confirmed state restored. The single
 * place that maps a plan module → a concrete back-nav Step, so the routing
 * helpers stay declarative walks. `accommodation` covers package + shared-double
 * + guiding-only opt-out (the forward path always inserts it when the product
 * offers a hotel); `null` is the implicit details frame.
 */
function reconstructStepForModule(
  kind: FlowModuleKind | null,
  args: StepBeforeReviewArgs,
): Step {
  switch (kind) {
    case 'accommodation':
      return {
        name: 'pick-accommodation',
        product: args.product,
        selection: args.selection,
        booker: args.booker,
        participants: args.participants,
        companions: args.companions,
        hotelLocationId: args.hotelLocationId,
        accommodationRooms: args.accommodationRooms,
        addons: args.addons,
        includeHotel: args.includeHotel,
        isSharedDouble: args.isSharedDouble,
        accommodationMode: args.accommodationMode,
        roomAssignment: args.roomAssignment,
        occupantAgeMap: args.occupantAgeMap,
        perRoomAddons: args.perRoomAddons,
        roomProductNames: args.roomProductNames,
        breakfastMap: args.breakfastMap,
      }
    case 'pickup':
      return {
        name: 'pick-pickup',
        product: args.product,
        selection: args.selection,
        booker: args.booker,
        participants: args.participants,
        companions: args.companions,
        accommodationRooms: args.accommodationRooms,
        addons: args.addons,
        pickupLocationId: args.pickupLocationId,
        hotelLocationId: args.hotelLocationId,
        hadServiceAddons: args.hadServiceAddons,
        includeHotel: args.includeHotel,
        isSharedDouble: args.isSharedDouble,
        accommodationMode: args.accommodationMode,
        roomAssignment: args.roomAssignment,
        occupantAgeMap: args.occupantAgeMap,
        perRoomAddons: args.perRoomAddons,
        roomProductNames: args.roomProductNames,
        breakfastMap: args.breakfastMap,
      }
    case 'service_addons':
      return {
        name: 'pick-service-addons',
        product: args.product,
        selection: args.selection,
        booker: args.booker,
        participants: args.participants,
        companions: args.companions,
        addons: args.addons,
      }
    default:
      // null (or any non-back-nav kind) → the implicit details frame.
      return {
        name: 'details',
        product: args.product,
        selection: args.selection,
        booker: args.booker,
        participants: args.participants,
        companions: args.companions,
      }
  }
}

/**
 * Backward walk for the REVIEW back-target. Resolves which middle module the
 * review/declarations step returns to. This is NOT a pure mirror of the forward
 * walk: on a hotel-offering product the customer always returns to
 * `accommodation` (never the pickup picker), EVEN on the guiding-only opt-out
 * that forward routed through pickup. This asymmetry is the long-standing
 * landr-87n9.1 contract (back-from-review collapses the accommodation+pickup
 * branch onto the accommodation page so the customer re-confirms their hotel
 * choice, which drives whether pickup shows again). The walk reproduces it
 * exactly by treating a hotel-offering product as "accommodation absorbs the
 * pickup back-target":
 *
 *   - hotel offering present (accommodation in the plan) → accommodation.
 *   - else pickup live (needs_pickup, no hotel) → pickup.
 *   - else service_addons shown → service_addons.
 *   - else details.
 */
function reviewBackModule(args: StepBeforeReviewArgs): FlowModuleKind | null {
  // The custom_form chain is walked separately (stepBeforeReview); this resolves
  // only the NON-custom-form middles, so it stays on the legacy plan.
  const kinds = planMiddleKinds(args.product)
  // A hotel-offering product always routes Back to accommodation (it is in the
  // plan iff the product offers a hotel — productHasHotelOffering).
  if (kinds.includes('accommodation') || args.hotelLocationId != null) {
    return 'accommodation'
  }
  // No hotel offering: the standard mirror over the remaining live middles.
  return liveModuleBefore(args.product, null, {
    hotelLocationId: args.hotelLocationId,
    hadServiceAddons: args.hadServiceAddons,
  })
}

/**
 * Resolve the back-target from a step that sits AT or AFTER the custom-form
 * chain (the review screen, or a custom-form step identified by `fromFormKey`).
 *
 * landr-71kz.10: when the operator configured custom forms, the chain
 * custom-form[0] → … → custom-form[n] → review sits just before review. Back
 * from review lands on the LAST custom form; Back from custom-form[k] lands on
 * custom-form[k-1]; Back from custom-form[0] falls through to the non-custom
 * middle walk (reviewBackModule). With no custom forms this is a no-op and the
 * non-custom walk runs directly — identical to the pre-71kz.10 behaviour.
 */
export function stepBeforeReview(
  args: StepBeforeReviewArgs,
  fromFormKey?: string,
): Step {
  const formKeys = customFormKeysBeforeReview(args.product, args.remoteFlow)
  if (formKeys.length > 0) {
    // Index of the step we're walking back FROM within the custom-form chain.
    // undefined fromFormKey → coming from review (one past the last form).
    const fromIdx =
      fromFormKey === undefined ? formKeys.length : formKeys.indexOf(fromFormKey)
    if (fromIdx > 0) {
      // There is a preceding custom form → hop back to it.
      return reconstructCustomFormStep(formKeys[fromIdx - 1]!, args)
    }
    // fromIdx === 0 (or an unknown formKey treated as the chain head) → fall
    // through to the non-custom middle walk below.
  }
  // landr-71kz.3: backward plan walk for the review back-target (see
  // reviewBackModule for the hotel-absorbs-pickup asymmetry it preserves).
  return reconstructStepForModule(reviewBackModule(args), args)
}

/**
 * The provenance bag every pre-review step threads through (booker /
 * participants / accommodation / pickup context). Shared by the forward
 * custom-form router + the review terminus so the chain carries identical state.
 */
export interface PreReviewArgs {
  product: Product
  selection: BookingSelection
  booker: BookerDetails
  participants: ParticipantDetails[]
  // landr-87n9.3: companions roster threads through to the submit step.
  companions: CompanionDetails[]
  pickupLocationId: string | null
  accommodationRooms: RoomSelection[]
  addons: AddonSelection[]
  hotelLocationId?: string | null
  hadServiceAddons?: boolean
  includeHotel?: boolean
  isSharedDouble?: boolean
  accommodationMode?: AccommodationMode
  roomAssignment?: RoomAssignmentMap
  occupantAgeMap?: OccupantAgeMap
  perRoomAddons?: PerRoomAddons
  roomProductNames?: Record<string, string>
  breakfastMap?: BreakfastMap
}

/** Build the terminal `fill-form` (review) step from the provenance bag. */
function fillFormStep(args: PreReviewArgs): Step {
  return { ...args, name: 'fill-form' as const }
}

/**
 * landr-71kz.10: the FORWARD entry into the pre-review tail. When the operator
 * configured custom forms (delivered via the remote flow), routes to the FIRST
 * custom form in the plan; otherwise straight to the review screen (fill-form),
 * byte-for-byte the legacy behaviour. Replaces the hardcoded
 * `fillFormOrDeclarations` declarations branch — Para42's declarations are now
 * the first (and only) custom form (form_key `customer_declarations`).
 *
 * `customFormAnswers` re-seeds the renderer on a forward pass after a breadcrumb
 * jump (the draft round-trips it).
 */
export function enterReviewOrCustomForm(
  args: PreReviewArgs,
  remoteFlow?: RemoteFlow | null,
  customFormAnswers?: Record<string, Record<string, unknown>>,
): Step {
  const formKeys = customFormKeysBeforeReview(args.product, remoteFlow)
  if (formKeys.length === 0) return fillFormStep(args)
  const firstKey = formKeys[0]!
  return reconstructCustomFormStep(firstKey, {
    ...args,
    customFormAnswers,
  })
}

/**
 * landr-71kz.10: advance the custom-form chain. Called when a custom-form step
 * (identified by `fromFormKey`) is confirmed — routes to the NEXT custom form in
 * the plan, or to the review screen (fill-form) when the chain is exhausted.
 */
export function stepAfterCustomForm(
  args: PreReviewArgs,
  fromFormKey: string,
  remoteFlow?: RemoteFlow | null,
  customFormAnswers?: Record<string, Record<string, unknown>>,
): Step {
  const formKeys = customFormKeysBeforeReview(args.product, remoteFlow)
  const idx = formKeys.indexOf(fromFormKey)
  const nextKey = idx >= 0 ? formKeys[idx + 1] : undefined
  if (nextKey === undefined) return fillFormStep(args)
  return reconstructCustomFormStep(nextKey, { ...args, customFormAnswers })
}

/**
 * Derive the PriceSidebar inputs for the current step (landr-qez0).
 * Returns null when the sidebar should NOT mount — pick-product (no
 * product chosen yet), confirmed (booking already done), or non-service
 * products on pick-selection (ShopComingSoonStub renders instead).
 */
function selectionToDays(selection: BookingSelection): string[] {
  if (selection.kind === 'slot') return [selection.slot.date]
  return selection.selectedDays
}

function namesFrom(participants: ParticipantDetails[]): string[] {
  return participants
    .map((p) => p.first_name.trim())
    .filter((s) => s.length > 0)
}

export function sidebarInputsForStep(step: Step): SidebarInputs | null {
  switch (step.name) {
    // landr-7jgo: 'fully-booked' has nothing to price (sold-out) — no sidebar.
    // landr-d8rg.4: pick-category and product-detail return null — no price
    // before a date/selection is committed (landr-hpyn convention).
    case 'pick-product':
    case 'pick-category':
    case 'product-detail':
    case 'confirmed':
    case 'fully-booked':
      return null
    case 'pick-selection':
      if (step.product.product_kind !== 'service') return null
      return {
        product: step.product,
        selectedDays: [],
        participantCount: 1,
        participantNames: [],
        accommodationRooms: [],
        addons: [],
      }
    case 'details':
      // landr-b3g5: when the customer re-enters DetailsStep via Back
      // from a downstream step, the prior booker + participants are
      // attached to the step state. Surface them so the sidebar keeps
      // the previously rendered names/count instead of resetting to the
      // forward-first-visit defaults (which would briefly flicker the
      // sidebar to "1×" while the customer just glances at the step).
      return {
        product: step.product,
        selectedDays: selectionToDays(step.selection),
        participantCount: step.participants?.length ?? 1,
        participantNames: step.participants ? namesFrom(step.participants) : [],
        accommodationRooms: [],
        addons: [],
      }
    case 'pick-accommodation':
      // landr-yf0n: on re-entry via back-nav the step carries the
      // previously confirmed accommodationRooms + addons so the sidebar
      // keeps the rooms/add-ons subtotal visible while the customer
      // re-edits. Falls back to empty on the initial forward visit.
      return {
        product: step.product,
        selectedDays: selectionToDays(step.selection),
        participantCount: step.participants.length,
        participantNames: namesFrom(step.participants),
        accommodationRooms: step.accommodationRooms ?? [],
        addons: step.addons ?? [],
      }
    case 'pick-service-addons':
      // landr-yf0n: same back-nav restoration for service-addons. No
      // accommodationRooms field — this step never has hotel context.
      return {
        product: step.product,
        selectedDays: selectionToDays(step.selection),
        participantCount: step.participants.length,
        participantNames: namesFrom(step.participants),
        accommodationRooms: [],
        addons: step.addons ?? [],
      }
    // landr-71kz.3/.10: pickup / custom-form / review share the price context
    // (rooms + add-ons already committed upstream).
    case 'pick-pickup':
    case 'custom-form':
    case 'fill-form':
      return {
        product: step.product,
        selectedDays: selectionToDays(step.selection),
        participantCount: step.participants.length,
        participantNames: namesFrom(step.participants),
        accommodationRooms: step.accommodationRooms,
        addons: step.addons,
      }
  }
}

// ─── Breadcrumb navigation (landr) ───────────────────────────────────────────

/**
 * One crumb in the step breadcrumb. `target` is the fully-reconstructed step to
 * navigate to when the crumb is clicked (with all previously-entered state
 * restored); null for the active (current) crumb, which is not clickable.
 */
export interface BreadcrumbItem {
  name: Step['name']
  label: string
  current: boolean
  target: Step | null
}

export interface BreadcrumbOptions {
  /**
   * landr-71kz.10: the operator-configured remote flow (when fetched). Drives the
   * custom-form crumbs in the trail. Absent/null → legacy plan (no custom forms),
   * identical to the pre-71kz.10 breadcrumb.
   */
  remoteFlow?: RemoteFlow | null
  /**
   * landr-71kz.10: prior custom-form answers keyed by form_key, so a crumb back
   * into a custom-form step re-seeds the renderer from the draft.
   */
  customFormAnswers?: Record<string, Record<string, unknown>>
  /** Display label for the product crumb (localized product name). */
  productLabel?: string
}

const BREADCRUMB_LABELS: Partial<Record<Step['name'], string>> = {
  'product-detail': 'Overview',
  'pick-selection': 'Dates',
  // The step collects the booker AND any additional participants (the booker
  // is participant 1), so "Participants" reads truer than "Your details".
  details: 'Participants',
  'pick-accommodation': 'Accommodation',
  'pick-service-addons': 'Add-ons',
  'pick-pickup': 'Pickup',
  // landr-71kz.3: generic fallback label for a custom form. The CustomFormStep
  // renderer surfaces the operator's localized form name in the step itself;
  // the crumb shows a neutral default.
  'custom-form': 'Details',
  'fill-form': 'Review',
}

/** The funnel steps that render a breadcrumb (everything from dates onward). */
const BREADCRUMB_STEPS: ReadonlySet<Step['name']> = new Set([
  'pick-selection',
  'details',
  'pick-accommodation',
  'pick-service-addons',
  'pick-pickup',
  'custom-form',
  'fill-form',
])

/**
 * The funnel step that preceded pick-pickup on the way forward, reconstructed
 * with its prior state. landr-71kz.3: a backward plan walk from the `pickup`
 * module over the preceding live middles — hotel offering → accommodation (the
 * `accommodation` module is always present + live when the product offers a
 * hotel); else service add-ons → that step (live iff hadServiceAddons); else
 * details. Reuses reconstructStepForModule so the back-nav Step shapes live in
 * one place.
 */
function stepBeforePickup(step: Extract<Step, { name: 'pick-pickup' }>): Step {
  // Hotel-offering products always route Back to accommodation (the original
  // hotel-first priority); else the standard backward walk over the live
  // middles preceding pickup.
  const kind = productHasHotelOffering(step.product)
    ? 'accommodation'
    : liveModuleBefore(
        step.product,
        null,
        {
          hotelLocationId: step.hotelLocationId,
          hadServiceAddons: step.hadServiceAddons,
        },
        'pickup',
      )
  return reconstructStepForModule(kind, {
    product: step.product,
    selection: step.selection,
    booker: step.booker,
    participants: step.participants,
    companions: step.companions,
    // pick-pickup's pickupLocationId is optional (string|null|undefined);
    // StepBeforeReviewArgs wants string|null — coalesce undefined to null.
    pickupLocationId: step.pickupLocationId ?? null,
    accommodationRooms: step.accommodationRooms,
    addons: step.addons,
    hotelLocationId: step.hotelLocationId,
    hadServiceAddons: step.hadServiceAddons,
    includeHotel: step.includeHotel,
    isSharedDouble: step.isSharedDouble,
    accommodationMode: step.accommodationMode,
    roomAssignment: step.roomAssignment,
    occupantAgeMap: step.occupantAgeMap,
    perRoomAddons: step.perRoomAddons,
    roomProductNames: step.roomProductNames,
    breakfastMap: step.breakfastMap,
  })
}

/**
 * landr-nmed: collect every downstream slice the customer has entered so far
 * into a single BookingDraft, regardless of how deep into the funnel `step`
 * is. This is the single source the early crumbs (product-detail /
 * pick-selection) carry so a breadcrumb JUMP back to them — then forward —
 * re-seeds the funnel instead of wiping it.
 *
 * Returns undefined for steps before any downstream data exists (pick-product,
 * pick-category, product-detail, pick-selection, fully-booked, confirmed) and
 * for an empty-but-present draft, so callers attach `draft` only when there is
 * something to restore.
 */
export function draftFromStep(step: Step): BookingDraft | undefined {
  const d: BookingDraft = {}
  if ('booker' in step && step.booker) d.booker = step.booker
  if ('participants' in step && step.participants)
    d.participants = step.participants
  if ('companions' in step && step.companions) d.companions = step.companions
  if ('hotelLocationId' in step) d.hotelLocationId = step.hotelLocationId
  if ('accommodationRooms' in step) d.accommodationRooms = step.accommodationRooms
  if ('addons' in step) d.addons = step.addons
  if ('includeHotel' in step) d.includeHotel = step.includeHotel
  if ('isSharedDouble' in step) d.isSharedDouble = step.isSharedDouble
  if ('accommodationMode' in step) d.accommodationMode = step.accommodationMode
  if ('roomAssignment' in step) d.roomAssignment = step.roomAssignment
  if ('occupantAgeMap' in step) d.occupantAgeMap = step.occupantAgeMap
  if ('perRoomAddons' in step) d.perRoomAddons = step.perRoomAddons
  if ('roomProductNames' in step) d.roomProductNames = step.roomProductNames
  if ('breakfastMap' in step) d.breakfastMap = step.breakfastMap
  if ('pickupLocationId' in step) d.pickupLocationId = step.pickupLocationId
  if ('hadServiceAddons' in step) d.hadServiceAddons = step.hadServiceAddons
  if ('customerDeclarations' in step)
    d.customerDeclarations = step.customerDeclarations
  if ('customerLanguages' in step) d.customerLanguages = step.customerLanguages
  if ('customerOtherLanguages' in step)
    d.customerOtherLanguages = step.customerOtherLanguages
  // landr-71kz.3: capture a custom-form step's answers into the keyed slot so a
  // breadcrumb JUMP preserves them (renderer lands in landr-71kz.4; the draft
  // plumbing is wired now). Keyed by formKey so multiple forms coexist.
  if (step.name === 'custom-form' && step.initialAnswers) {
    d.customFormAnswers = { [step.formKey]: step.initialAnswers }
  }
  // A draft is only meaningful once the customer has at least entered details.
  return d.booker || d.participants ? d : undefined
}

/**
 * landr-iyyf: fold a freshly `draftFromStep`-captured slice into the
 * persistent draft, correctly for `customFormAnswers`.
 *
 * A `custom-form` Step variant only ever carries ONE form's answers (its own
 * `formKey` + `initialAnswers`) — it has no visibility into any OTHER form's
 * answers the customer already confirmed earlier in the flow. So
 * `captured.customFormAnswers` (when present) is always a single-key slice.
 * A naive `{...prev, ...captured}` spread would REPLACE the whole
 * `customFormAnswers` map with that one entry, silently dropping every other
 * form's already-confirmed answers on a breadcrumb jump (the landr-iyyf
 * finding). Deep-merge the keyed slot instead — same pattern the custom-form
 * `onConfirm` handler already uses when it first writes an entry in.
 *
 * When `captured` carries no `customFormAnswers` slice at all (the step being
 * left isn't a custom-form step, or it has no `initialAnswers` yet), `prev`'s
 * map is passed through untouched.
 */
export function mergeCapturedDraft(
  prev: BookingDraft,
  captured: BookingDraft,
): BookingDraft {
  return {
    ...prev,
    ...captured,
    customFormAnswers: captured.customFormAnswers
      ? { ...prev.customFormAnswers, ...captured.customFormAnswers }
      : prev.customFormAnswers,
  }
}

/**
 * landr-nmed: rebuild the `details` step from a BookingDraft + the (possibly
 * just-edited) product/selection. Threads the booker / participants /
 * companions forward so DetailsStep re-mounts pre-filled after a breadcrumb
 * jump back to Dates (or the product crumb) followed by Continue. The
 * accommodation / declarations slices live in App.tsx's persistent draft
 * state and are re-applied as the customer steps forward through each
 * downstream step (afterDetails seeds them from the same draft); this helper
 * only carries the three fields the `details` Step variant natively holds.
 */
export function detailsFromDraft(
  product: Product,
  selection: BookingSelection,
  draft: BookingDraft | undefined,
): Extract<Step, { name: 'details' }> {
  return {
    name: 'details',
    product,
    selection,
    booker: draft?.booker,
    participants: draft?.participants,
    companions: draft?.companions,
  }
}

/**
 * The funnel step immediately PRECEDING `step` (one "back"), reconstructed with
 * its previously-confirmed state restored, or null when `step` is the first
 * funnel step (or not a funnel step at all). Mirrors the forward routing so it
 * only ever returns a step that was actually shown on the way forward, and
 * reuses stepBeforeReview for the review steps so the hotel-skips-pickup
 * routing lives in one place.
 */
export function stepBefore(step: Step, opts: BreadcrumbOptions): Step | null {
  switch (step.name) {
    case 'pick-selection':
      return { name: 'product-detail', product: step.product }
    case 'details':
      return {
        name: 'pick-selection',
        product: step.product,
        selection: step.selection,
      }
    case 'pick-accommodation':
    case 'pick-service-addons':
      return {
        name: 'details',
        product: step.product,
        selection: step.selection,
        booker: step.booker,
        participants: step.participants,
        companions: step.companions,
      }
    case 'pick-pickup':
      return stepBeforePickup(step)
    // landr-71kz.3/.10: a custom-form crumb routes Back through the custom-form
    // chain (stepBeforeReview with the step's formKey + the remote flow) — the
    // prior custom form, else the hotel-aware non-custom walk. With no remote
    // flow this never fires (the legacy plan produces no custom-form steps).
    case 'custom-form':
      return stepBeforeReview(
        {
          product: step.product,
          selection: step.selection,
          booker: step.booker,
          participants: step.participants,
          companions: step.companions,
          pickupLocationId: step.pickupLocationId,
          accommodationRooms: step.accommodationRooms,
          addons: step.addons,
          hotelLocationId: step.hotelLocationId,
          hadServiceAddons: step.hadServiceAddons,
          includeHotel: step.includeHotel,
          isSharedDouble: step.isSharedDouble,
          accommodationMode: step.accommodationMode,
          roomAssignment: step.roomAssignment,
          occupantAgeMap: step.occupantAgeMap,
          perRoomAddons: step.perRoomAddons,
          roomProductNames: step.roomProductNames,
          breakfastMap: step.breakfastMap,
          remoteFlow: opts.remoteFlow,
          customFormAnswers: opts.customFormAnswers,
        },
        step.formKey,
      )
    case 'fill-form':
      // landr-71kz.10: Back from review lands on the LAST custom form when the
      // operator configured any (stepBeforeReview walks the chain head-first);
      // otherwise the hotel-aware non-custom walk — byte-for-byte the legacy
      // routing for zero-config products.
      return stepBeforeReview({
        product: step.product,
        selection: step.selection,
        booker: step.booker,
        participants: step.participants,
        companions: step.companions,
        pickupLocationId: step.pickupLocationId,
        accommodationRooms: step.accommodationRooms,
        addons: step.addons,
        hotelLocationId: step.hotelLocationId,
        hadServiceAddons: step.hadServiceAddons,
        includeHotel: step.includeHotel,
        isSharedDouble: step.isSharedDouble,
        accommodationMode: step.accommodationMode,
        roomAssignment: step.roomAssignment,
        occupantAgeMap: step.occupantAgeMap,
        perRoomAddons: step.perRoomAddons,
        roomProductNames: step.roomProductNames,
        remoteFlow: opts.remoteFlow,
        customFormAnswers: opts.customFormAnswers,
      })
    default:
      return null
  }
}

/**
 * Build the ordered breadcrumb trail for the current step: the chain of steps
 * actually shown on the way here, each (except the current) clickable to jump
 * back with its prior state restored. Returns [] for non-funnel steps (catalog,
 * confirmation, etc.) so the caller falls back to a plain back affordance.
 *
 * The trail is derived by walking stepBefore() backwards from the current step,
 * so it stays consistent with the real forward routing (skipped steps — e.g.
 * the pickup picker when a hotel is booked — never appear).
 */
export function buildBreadcrumb(
  step: Step,
  opts: BreadcrumbOptions,
): BreadcrumbItem[] {
  if (!BREADCRUMB_STEPS.has(step.name)) return []
  const chain: Step[] = [step]
  let cursor: Step = step
  // Guard against an accidental cycle — the funnel is at most ~8 deep.
  for (let guard = 0; guard < 16; guard += 1) {
    const prev = stepBefore(cursor, opts)
    if (!prev) break
    chain.unshift(prev)
    cursor = prev
  }
  const lastIndex = chain.length - 1
  return chain.map((s, i) => {
    const current = i === lastIndex
    const label =
      s.name === 'product-detail'
        ? (opts.productLabel ?? BREADCRUMB_LABELS['product-detail']!)
        : (BREADCRUMB_LABELS[s.name] ?? s.name)
    return { name: s.name, label, current, target: current ? null : s }
  })
}
