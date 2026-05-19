/**
 * Wire types — keep aligned with FastAPI `app/routers/public_bookings.py`
 * and the DB RPCs in `supabase/migrations/20260512190528_public_rpcs.sql`
 * (last refactored by `20260519210000_product_kinds_refactor.sql`, landr-glx).
 */

/**
 * What the operator sells. Drives the booking flow shape and the dashboard
 * ProductForm. Mirrors public.product_kind. For everything that is not a
 * 'service' the widget renders a "sold in Shop — coming soon" stub.
 */
export type ProductKind = 'service' | 'digital_good' | 'physical_good' | 'gift_card'

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
