/**
 * Pure step-machine helpers for App.tsx. Kept in a sibling .ts file so
 * the react-refresh/only-export-components ESLint rule stays happy
 * (App.tsx exports a React component as default — adding non-component
 * exports there would trigger the rule and block CI).
 */
import type { RoomSelection } from '@/components/booking/accommodationCalc'
import type { AddonSelection } from '@/components/booking/addonsState'
import type { BookingSelection } from '@/components/booking/BookingForm'
import type {
  BookerDetails,
  ParticipantDetails,
} from '@/components/booking/detailsTypes'
import type { Product, SubmitBookingResponse } from '@/api/types'

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
  | { name: 'pick-selection'; product: Product }
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
    }
  // landr-yf0n: optional initialHotelLocationId / accommodationRooms /
  // addons / includeHotel let AccommodationStep re-seed its internal
  // state when the customer hits Back from a downstream step. Undefined
  // on the initial forward visit (no prior data to restore).
  | {
      name: 'pick-accommodation'
      product: Product
      selection: BookingSelection
      booker: BookerDetails
      participants: ParticipantDetails[]
      hotelLocationId?: string | null
      accommodationRooms?: RoomSelection[]
      addons?: AddonSelection[]
      includeHotel?: boolean
    }
  // landr-yf0n: optional addons lets ServiceAddonsStep re-seed its
  // selection map on back-nav re-entry.
  | {
      name: 'pick-service-addons'
      product: Product
      selection: BookingSelection
      booker: BookerDetails
      participants: ParticipantDetails[]
      addons?: AddonSelection[]
    }
  // landr-yf0n: optional pickupLocationId lets PickupLocationPicker re-
  // seed its radio selection on back-nav re-entry. hadServiceAddons +
  // hotelLocationId remember which upstream step the customer originally
  // confirmed through so the back-nav routing can hop back through the
  // same intermediate steps instead of jumping straight to DetailsStep.
  | {
      name: 'pick-pickup'
      product: Product
      selection: BookingSelection
      booker: BookerDetails
      participants: ParticipantDetails[]
      accommodationRooms: RoomSelection[]
      addons: AddonSelection[]
      pickupLocationId?: string | null
      hotelLocationId?: string | null
      hadServiceAddons?: boolean
      includeHotel?: boolean
    }
  // landr-yf0n: hotelLocationId / hadServiceAddons / includeHotel remember
  // the upstream path so the BookingForm back button can restore the
  // intermediate steps with their previously confirmed state.
  | {
      name: 'fill-form'
      product: Product
      selection: BookingSelection
      booker: BookerDetails
      participants: ParticipantDetails[]
      pickupLocationId: string | null
      accommodationRooms: RoomSelection[]
      addons: AddonSelection[]
      hotelLocationId?: string | null
      hadServiceAddons?: boolean
      includeHotel?: boolean
    }
  | { name: 'confirmed'; response: SubmitBookingResponse; email: string }

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
  accommodationRooms: RoomSelection[],
  hotelLocationId: string | null,
  addons: AddonSelection[] = [],
  // landr-yf0n: optional provenance flags so downstream steps can hand
  // them back when the customer hits Back. hadServiceAddons distinguishes
  // a customer who confirmed an empty ServiceAddonsStep from one who
  // never saw it; includeHotel preserves the optional-mode Yes/No state.
  hadServiceAddons: boolean = false,
  includeHotel: boolean | undefined = undefined,
): Step {
  if (hotelLocationId !== null) {
    return {
      name: 'fill-form',
      product,
      selection,
      booker,
      participants,
      pickupLocationId: hotelLocationId,
      accommodationRooms,
      addons,
      hotelLocationId,
      hadServiceAddons,
      includeHotel,
    }
  }
  if (product.needs_pickup) {
    return {
      name: 'pick-pickup',
      product,
      selection,
      booker,
      participants,
      accommodationRooms,
      addons,
      hotelLocationId: null,
      hadServiceAddons,
      includeHotel,
    }
  }
  return {
    name: 'fill-form',
    product,
    selection,
    booker,
    participants,
    pickupLocationId: null,
    accommodationRooms,
    addons,
    hotelLocationId: null,
    hadServiceAddons,
    includeHotel,
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
    case 'pick-product':
    case 'confirmed':
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
