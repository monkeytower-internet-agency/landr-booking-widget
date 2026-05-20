/**
 * Wire types — keep aligned with FastAPI `app/routers/public_bookings.py`
 * and the DB RPCs in `supabase/migrations/20260512190528_public_rpcs.sql`
 * (last refactored by `20260519210000_product_kinds_refactor.sql`, landr-glx).
 */

/**
 * What the operator sells. Drives the booking flow shape and the dashboard
 * ProductForm. Mirrors public.product_kind. For everything that is not a
 * 'service' or 'hotel_room' the widget renders a "sold in Shop — coming
 * soon" stub. hotel_room products are not exposed in the main catalogue
 * — they're listed only inside the AccommodationStep after the customer
 * picked a service product with hotel_offering != 'none' (landr-vyaz).
 */
export type ProductKind =
  | 'service'
  | 'hotel_room'
  | 'subscription'
  | 'digital_good'
  | 'physical_good'
  | 'gift_card'

/**
 * How a service product offers hotel accommodation alongside the booking
 * (landr-nzak). 'none' = no accommodation step; 'optional' = step shown
 * with a Yes/No toggle; 'mandatory' = step shown and at least one room
 * required. Only meaningful when product_kind = 'service'; a DB CHECK
 * forces 'none' for all other kinds.
 */
export type HotelOffering = 'none' | 'optional' | 'mandatory'

/**
 * Only meaningful when product_kind = 'service'. Mirrors
 * public.service_time_shape. The widget branches on this to pick the right
 * picker component:
 *   - 'time_slot'    → AvailabilityPicker
 *   - 'days_range'   → MultiDayPicker (pass is_contiguous prop)
 *   - 'fixed_window' → FixedDateWindowPicker
 *   - 'single_date'  → SingleDatePicker
 */
export type ServiceTimeShape =
  | 'single_date'
  | 'days_range'
  | 'fixed_window'
  | 'time_slot'

export interface FixedDateWindow {
  id: string
  start_date: string
  end_date: string
  capacity: number
  capacity_reserved: number
}

export interface Product {
  product_id: string
  slug: string
  name: string
  name_localized: Record<string, string> | null
  short_description: string | null
  short_description_localized: Record<string, string> | null
  description: string | null
  /**
   * What the operator sells (landr-glx). The booking flow renders a shop-stub
   * for any kind other than 'service'.
   */
  product_kind: ProductKind
  /**
   * Only set when product_kind = 'service'; null for non-service kinds.
   * DB CHECK: (product_kind='service') = (service_time_shape IS NOT NULL).
   */
  service_time_shape: ServiceTimeShape | null
  /**
   * Only meaningful when service_time_shape = 'days_range'. When true the
   * picker enforces consecutive-day selection (whole-week semantics).
   */
  is_contiguous: boolean
  duration_minutes: number | null
  fixed_start_date: string | null
  fixed_end_date: string | null
  product_group_id: string | null
  group_slug: string | null
  group_name: string | null
  sort_order: number
  sport_subcategory_codes: string[]
  location_ids: string[]
  /** Backend field: products.needs_pickup. Included once landr-e10.8 lands. */
  needs_pickup?: boolean
  /**
   * Whether/how this product offers hotel accommodation (landr-vyaz).
   * Service products with 'optional' or 'mandatory' trigger the
   * AccommodationStep after pick-selection. Defaults to 'none' for
   * backwards compatibility with operators that have not adopted the
   * hotel-rooms feature yet.
   */
  hotel_offering?: HotelOffering
  /**
   * For product_kind='hotel_room' only: the locations.id row representing
   * the hotel that owns this room. Always non-null on hotel_room rows
   * (DB CHECK products_hotel_room_requires_hotel_location). Null on all
   * other kinds. The widget groups rooms by this id inside the
   * AccommodationStep.
   */
  hotel_location_id?: string | null
  /**
   * Display per-unit price extracted from the first active per_day_base
   * pricing rule on the product's default scheme (landr-vyaz). The widget
   * uses this for the per-night room price chip — the canonical total
   * is always computed server-side by the pricing engine at submit.
   * Null when the scheme uses tier/fixed pricing without a per-day base.
   */
  price_per_unit?: number | null
  /** ISO-4217 currency from the product's pricing scheme. */
  currency?: string | null
  /**
   * Capacity per booked unit of this product (landr-fi68). Meaningful
   * for kind='hotel_room' (max sleepers per room); NULL elsewhere by
   * convention. The widget AccommodationStep cross-references
   * sum(qty × capacity_per_unit) against participantCount to surface
   * an overbook warning (landr-qpab). NULL is treated as 1 by callers
   * — the lenient default until landr-knm0 backfills the seeds.
   */
  capacity_per_unit?: number | null
}

/**
 * Operator-level rendering/behaviour flags surfaced by
 * GET /api/public/operators/{slug}/settings (landr-e10.9). The widget
 * fetches this once on mount and caches it in OperatorContext. Future
 * operator-level flags slot in here as additional fields.
 */
export interface OperatorSettings {
  slug: string
  /**
   * When false (default): widget hides numeric remaining-seat counts on
   * availability cells. When true: widget shows "{N} seats" as an
   * urgency lever. Para42 (Martin) stays on false.
   */
  expose_seats_to_customer: boolean
}

/** Public location shape returned by GET /api/public/operators/{slug}/locations (landr-e10.8). */
export interface Location {
  location_id: string
  name: string
  name_localized: Record<string, string> | null
  parent_id: string | null
  role_type: { code: string; label: string } | null
}

/**
 * Narrowed Location alias for the AccommodationStep hotel picker
 * (landr-vyaz). A Hotel is just a Location whose role_type.code === 'hotel'.
 * Kept as a structural alias rather than a separate type so the filter
 * is a single client-side `.filter` on the public locations RPC.
 */
export type Hotel = Location

/**
 * Add-on row returned by GET /api/public/products/{id}/addons (landr-cip6,
 * epic landr-ie8g). Each entry is one linked add-on product that the
 * widget surfaces under the parent product (qty stepper, overbook warning,
 * required-min gating). On submit each selected add-on becomes its own
 * booking_products line item — the existing public_submit_booking RPC
 * already iterates products[] so no API change is needed for submit.
 */
export interface ProductAddon {
  product_addon_id: string
  addon_product_id: string
  name: string
  name_localized: Record<string, string> | null
  is_required: boolean
  min_qty: number
  /** NULL = unlimited (widget shows orange warning above parent qty but allows submit). */
  max_qty: number | null
  sort_order: number
  /**
   * Display per-unit price (per night for hotel_room kind, per slot/line
   * for service kind). NULL when the add-on's scheme uses tiers/fixed_total
   * without a per_day_base rule — widget falls back to "Included on request".
   */
  price_per_unit: number | null
  currency: string | null
}

export interface AvailabilitySlot {
  availability_id: string
  date: string
  start_time: string | null
  end_time: string | null
  capacity: number
  capacity_reserved: number
  available_seats: number
  status: string
}

export interface Participant {
  first_name: string
  last_name?: string | null
  email?: string | null
  service_role_code: string
  pickup_location_id?: string | null
}

export interface ProductLine {
  product_id: string
  quantity?: number
  date_range_start?: string | null
  date_range_end?: string | null
  selected_days?: string[] | null
}

export interface SubmitBookingBody {
  operator_slug: string
  customer_first_name: string
  customer_last_name?: string | null
  customer_email: string
  customer_phone?: string | null
  customer_preferred_locale?: string | null
  cancellation_deadline: string
  voucher_code?: string | null
  campaign_id?: string | null
  booking_channel?: string
  products: ProductLine[]
  participants: Participant[]
}

export interface SubmitBookingResponse {
  booking_id: string
  reference: string
  state: string
  token?: string
}

/**
 * One row in the PriceSidebar breakdown (landr-qez0). Returned by
 * POST /api/public/operators/{slug}/products/{id}/estimate (landr-xbqh).
 * `paid_to` mirrors revenue_flows_through_operator: 'operator' means the
 * customer pays the operator at checkout; 'hotel' means the customer
 * settles directly with the hotel on arrival.
 */
export interface EstimateLineItem {
  product_id: string
  label: string
  qty: number
  /** Units underlying the line (e.g. days, nights). 0 for flat-priced lines. */
  units: number
  /** Per-unit gross as a decimal string ("60.00"). */
  unit_price: string
  /** Total gross for the line (qty × unit pricing) as a decimal string. */
  line_total: string
  paid_to: 'operator' | 'hotel'
}

/**
 * One entry in the applied_rules trace. The widget surfaces tier matches
 * (per_total_days_tier, per_streak_tier, etc.) as small "discount" tags
 * in the sidebar. Other rule kinds (per_day_base, …) are included for
 * transparency but only the tier/discount kinds get a tag. The detail
 * payload is an opaque object — its shape depends on `kind`.
 */
export interface EstimateAppliedRule {
  kind: string
  detail?: Record<string, unknown>
}

/**
 * One add-on line in the request body. `product_id` is the add-on
 * product (not the parent service); the FastAPI route validates the
 * parent ↔ add-on link via product_addons before computing the price.
 */
export interface EstimateAddonLine {
  product_id: string
  qty: number
}

export interface EstimateRequestBody {
  selected_days: string[]
  participants_count: number
  addon_lines: EstimateAddonLine[]
}

export interface EstimateResponse {
  line_items: EstimateLineItem[]
  /** Decimal string. Sum of line_items where paid_to='operator'. */
  operator_total: string
  /** Decimal string. Sum of line_items where paid_to='hotel'. */
  hotel_total: string
  /** Decimal string. operator_total + hotel_total. */
  grand_total: string
  currency: string
  applied_rules: EstimateAppliedRule[]
}
