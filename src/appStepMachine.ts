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
