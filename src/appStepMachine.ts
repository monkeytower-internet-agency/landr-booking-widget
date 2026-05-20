/**
 * Pure step-machine helpers for App.tsx. Kept in a sibling .ts file so
 * the react-refresh/only-export-components ESLint rule stays happy
 * (App.tsx exports a React component as default — adding non-component
 * exports there would trigger the rule and block CI).
 */
import type { RoomSelection } from '@/components/booking/accommodationCalc'
import type { AddonSelection } from '@/components/booking/addonsState'
import type { BookingSelection } from '@/components/booking/BookingForm'
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
 */
export interface SidebarInputs {
  product: Product
  selectedDays: string[]
  /** Defaults to 1 before ParticipantsStep confirms. */
  participantCount: number
  accommodationRooms: RoomSelection[]
  addons: AddonSelection[]
}

export type Step =
  | { name: 'pick-product' }
  | { name: 'pick-selection'; product: Product }
  // landr-mbge: collects how many participants (1-6). Inserted between
  // pick-selection and accommodation/pickup/fill-form so the count
  // threads through into every downstream step + the submit payload.
  | {
      name: 'participants'
      product: Product
      selection: BookingSelection
    }
  | {
      name: 'pick-accommodation'
      product: Product
      selection: BookingSelection
      participantCount: number
    }
  | {
      name: 'pick-service-addons'
      product: Product
      selection: BookingSelection
      participantCount: number
    }
  | {
      name: 'pick-pickup'
      product: Product
      selection: BookingSelection
      participantCount: number
      accommodationRooms: RoomSelection[]
      addons: AddonSelection[]
    }
  | {
      name: 'fill-form'
      product: Product
      selection: BookingSelection
      participantCount: number
      pickupLocationId: string | null
      accommodationRooms: RoomSelection[]
      addons: AddonSelection[]
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
 */
export function stepAfterAccommodation(
  product: Product,
  selection: BookingSelection,
  participantCount: number,
  accommodationRooms: RoomSelection[],
  hotelLocationId: string | null,
  addons: AddonSelection[] = [],
): Step {
  if (hotelLocationId !== null) {
    return {
      name: 'fill-form',
      product,
      selection,
      participantCount,
      pickupLocationId: hotelLocationId,
      accommodationRooms,
      addons,
    }
  }
  if (product.needs_pickup) {
    return {
      name: 'pick-pickup',
      product,
      selection,
      participantCount,
      accommodationRooms,
      addons,
    }
  }
  return {
    name: 'fill-form',
    product,
    selection,
    participantCount,
    pickupLocationId: null,
    accommodationRooms,
    addons,
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
        accommodationRooms: [],
        addons: [],
      }
    case 'participants':
      return {
        product: step.product,
        selectedDays: selectionToDays(step.selection),
        participantCount: 1,
        accommodationRooms: [],
        addons: [],
      }
    case 'pick-accommodation':
    case 'pick-service-addons':
      return {
        product: step.product,
        selectedDays: selectionToDays(step.selection),
        participantCount: step.participantCount,
        accommodationRooms: [],
        addons: [],
      }
    case 'pick-pickup':
    case 'fill-form':
      return {
        product: step.product,
        selectedDays: selectionToDays(step.selection),
        participantCount: step.participantCount,
        accommodationRooms: step.accommodationRooms,
        addons: step.addons,
      }
  }
}
