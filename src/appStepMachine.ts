/**
 * Pure step-machine helpers for App.tsx. Kept in a sibling .ts file so
 * the react-refresh/only-export-components ESLint rule stays happy
 * (App.tsx exports a React component as default — adding non-component
 * exports there would trigger the rule and block CI).
 */
import type { RoomSelection } from '@/components/booking/accommodationCalc'
import type { BookingSelection } from '@/components/booking/BookingForm'
import type { Product, SubmitBookingResponse } from '@/api/types'

export type Step =
  | { name: 'pick-product' }
  | { name: 'pick-selection'; product: Product }
  | { name: 'pick-accommodation'; product: Product; selection: BookingSelection }
  | {
      name: 'pick-pickup'
      product: Product
      selection: BookingSelection
      accommodationRooms: RoomSelection[]
    }
  | {
      name: 'fill-form'
      product: Product
      selection: BookingSelection
      pickupLocationId: string | null
      accommodationRooms: RoomSelection[]
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
  accommodationRooms: RoomSelection[],
  hotelLocationId: string | null,
): Step {
  if (hotelLocationId !== null) {
    return {
      name: 'fill-form',
      product,
      selection,
      pickupLocationId: hotelLocationId,
      accommodationRooms,
    }
  }
  if (product.needs_pickup) {
    return {
      name: 'pick-pickup',
      product,
      selection,
      accommodationRooms,
    }
  }
  return {
    name: 'fill-form',
    product,
    selection,
    pickupLocationId: null,
    accommodationRooms,
  }
}
