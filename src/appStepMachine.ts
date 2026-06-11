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
import type { CustomerDeclarations } from '@/components/booking/DeclarationsStep'
import type { Product, ProductGroup, SubmitBookingResponse } from '@/api/types'

/**
 * landr-gb2f.5: the raw per-room add-on selection carried through the step
 * machine. Keyed by roomProductId → { addon_product_id → qty }. This is the
 * UNFLATTENED form from AccommodationStep's internal addonSelection state, so
 * the review screen can reconstruct which room unit has breakfast vs not.
 * Empty map for guiding-only / shared-double modes (no room add-ons).
 */
export type PerRoomAddons = Record<string, Record<string, number>>

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
  // landr-sbhz.3: declarations step — customer confirms eligibility
  // declarations + selects their spoken language before the review screen.
  // Only inserted by App.tsx when the operator requires declarations
  // (v1: para42). Optional initialDeclarations for back-nav restoration.
  // landr-sbhz.4: isSharedDouble threads through so it survives the
  // declarations → fill-form hop and back-nav restores the tick.
  | {
      name: 'declarations'
      product: Product
      selection: BookingSelection
      booker: BookerDetails
      participants: ParticipantDetails[]
      // landr-87n9.3: companions roster threads through.
      companions: CompanionDetails[]
      pickupLocationId: string | null
      accommodationRooms: RoomSelection[]
      addons: AddonSelection[]
      hotelLocationId?: string | null
      hadServiceAddons?: boolean
      includeHotel?: boolean
      isSharedDouble?: boolean
      accommodationMode?: AccommodationMode
      // landr-gb2f.2: carry the assignment through declarations so it
      // survives the declarations → fill-form hop and back-nav restores it.
      roomAssignment?: RoomAssignmentMap
      // landr-doam.1: carry the age map through declarations.
      occupantAgeMap?: OccupantAgeMap
      // landr-gb2f.5: carry the per-room add-on map through declarations.
      perRoomAddons?: PerRoomAddons
      // landr-gb2f.5: room product display names for the review labels.
      roomProductNames?: Record<string, string>
      // landr-a4fy: carry the breakfast map through declarations.
      breakfastMap?: BreakfastMap
      initialDeclarations?: CustomerDeclarations
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
  if (hotelLocationId !== null) {
    // landr-ffyg.2: hotel set → the hotel IS the pickup (landr-4r80). This
    // covers BOTH the package mode (rooms booked) AND the shared-double
    // mode (no rooms, but the shared hotel is still the collection point).
    // Either way we skip the free-pickup picker and go straight to
    // fill-form/declarations — the shared-double customer must NEVER reach
    // the free pickup picker.
    return {
      name: 'fill-form',
      product,
      selection,
      booker,
      participants,
      companions,
      pickupLocationId: hotelLocationId,
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
  if (product.needs_pickup) {
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
  return {
    name: 'fill-form',
    product,
    selection,
    booker,
    participants,
    companions,
    pickupLocationId: null,
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
}

export function stepBeforeReview(args: StepBeforeReviewArgs): Step {
  const offering = args.product.hotel_offering ?? 'none'
  const hasHotelOffering =
    args.product.product_kind === 'service' && offering !== 'none'

  // 1. A hotel was booked → pickup was skipped forward → return to the
  //    accommodation page (covers package + shared-double).
  // 3. A hotel offering exists but no hotel was booked (guiding-only
  //    opt-out) → the customer still passed THROUGH pick-accommodation, so
  //    Back returns there. Folded into the same branch as (1) because the
  //    forward path always inserts pick-accommodation when a hotel offering
  //    is present, regardless of the booked/opted-out outcome.
  if (args.hotelLocationId != null || hasHotelOffering) {
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
  }
  // 2. No hotel offering, product needs a pickup → pick-pickup showed
  //    forward → return to it with the prior radio choice restored.
  if (args.product.needs_pickup) {
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
  }
  // 4. No hotel, no pickup, but the customer went through the service-
  //    add-ons step → return there with the prior selections restored.
  if (args.hadServiceAddons) {
    return {
      name: 'pick-service-addons',
      product: args.product,
      selection: args.selection,
      booker: args.booker,
      participants: args.participants,
      companions: args.companions,
      addons: args.addons,
    }
  }
  // 5. Neither hotel, pickup, nor service add-ons → straight back to details.
  return {
    name: 'details',
    product: args.product,
    selection: args.selection,
    booker: args.booker,
    participants: args.participants,
    companions: args.companions,
  }
}

/**
 * Build the step that comes after all pre-review steps are done.
 * When requiresDeclarations is true (operator-specific), inserts the
 * declarations step between the last pre-review step and fill-form.
 * When false, goes directly to fill-form (backward-compatible).
 *
 * landr-sbhz.3: v1 hardcodes Para42 as the only requiring operator;
 * App.tsx passes requiresDeclarations based on the operatorSlug constant.
 */
export function fillFormOrDeclarations(
  args: {
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
    // landr-sbhz.4: thread the shared-double flag through so it survives
    // the declarations → fill-form hop.
    isSharedDouble?: boolean
    // landr-ffyg.2: thread the accommodation mode through too.
    accommodationMode?: AccommodationMode
    // landr-gb2f.2: thread the participant → room assignment through too.
    roomAssignment?: RoomAssignmentMap
    // landr-doam.1: thread the age map through too.
    occupantAgeMap?: OccupantAgeMap
    // landr-gb2f.5: thread the per-room add-on map through too.
    perRoomAddons?: PerRoomAddons
    // landr-gb2f.5: thread the room product names through too.
    roomProductNames?: Record<string, string>
    // landr-a4fy: thread the breakfast map through too.
    breakfastMap?: BreakfastMap
  },
  requiresDeclarations: boolean,
  initialDeclarations?: CustomerDeclarations,
): Step {
  if (requiresDeclarations) {
    return {
      ...args,
      name: 'declarations' as const,
      initialDeclarations,
    }
  }
  return {
    ...args,
    name: 'fill-form' as const,
  }
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
    case 'pick-pickup':
    case 'declarations':
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
  /** Operator requires the declarations step (inserted before review). */
  requiresDeclarations: boolean
  /** Display label for the product crumb (localized product name). */
  productLabel?: string
}

const BREADCRUMB_LABELS: Partial<Record<Step['name'], string>> = {
  'product-detail': 'Overview',
  'pick-selection': 'Dates',
  details: 'Your details',
  'pick-accommodation': 'Accommodation',
  'pick-service-addons': 'Add-ons',
  'pick-pickup': 'Pickup',
  declarations: 'Declarations',
  'fill-form': 'Review',
}

/** The funnel steps that render a breadcrumb (everything from dates onward). */
const BREADCRUMB_STEPS: ReadonlySet<Step['name']> = new Set([
  'pick-selection',
  'details',
  'pick-accommodation',
  'pick-service-addons',
  'pick-pickup',
  'declarations',
  'fill-form',
])

/**
 * The funnel step that preceded pick-pickup on the way forward, reconstructed
 * with its prior state. Mirrors the forward routing in App.tsx's pickup
 * back-nav handler: hotel offering → accommodation; else service add-ons →
 * that step; else straight back to details.
 */
function stepBeforePickup(step: Extract<Step, { name: 'pick-pickup' }>): Step {
  const offering = step.product.hotel_offering ?? 'none'
  if (step.product.product_kind === 'service' && offering !== 'none') {
    return {
      name: 'pick-accommodation',
      product: step.product,
      selection: step.selection,
      booker: step.booker,
      participants: step.participants,
      companions: step.companions,
      hotelLocationId: step.hotelLocationId,
      accommodationRooms: step.accommodationRooms,
      addons: step.addons,
      includeHotel: step.includeHotel,
      isSharedDouble: step.isSharedDouble,
      accommodationMode: step.accommodationMode,
      roomAssignment: step.roomAssignment,
      occupantAgeMap: step.occupantAgeMap,
      perRoomAddons: step.perRoomAddons,
      roomProductNames: step.roomProductNames,
    }
  }
  if (step.hadServiceAddons) {
    return {
      name: 'pick-service-addons',
      product: step.product,
      selection: step.selection,
      booker: step.booker,
      participants: step.participants,
      companions: step.companions,
      addons: step.addons,
    }
  }
  return {
    name: 'details',
    product: step.product,
    selection: step.selection,
    booker: step.booker,
    participants: step.participants,
    companions: step.companions,
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
    case 'declarations':
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
      })
    case 'fill-form':
      // Mirror App.tsx's fill-form back handler: with declarations enforced,
      // one step back is the declarations step (rebuilt from the confirmed
      // declarations); otherwise stepBeforeReview's hotel-aware routing.
      if (opts.requiresDeclarations) {
        return {
          name: 'declarations',
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
          initialDeclarations: step.customerDeclarations
            ? {
                declarations: step.customerDeclarations,
                languages: step.customerLanguages ?? [],
                otherLanguages: step.customerOtherLanguages ?? '',
              }
            : undefined,
        }
      }
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
