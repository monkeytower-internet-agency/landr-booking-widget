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
  /**
   * landr-7zc5.3: publish state. true = published (live), false = draft.
   * The live products RPC only returns rows where is_publicly_listed=true;
   * the preview path also returns false rows. Used by ProductList to render
   * the "Draft — preview" badge when the operator is reviewing unpublished
   * products. Absent on legacy API responses — treated as published.
   */
  is_publicly_listed?: boolean
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
  /**
   * landr-yp8x — operator branding surfaced for the embedded booking
   * widget. logo_url is the public URL of an image uploaded to the
   * operator-logos storage bucket (null when the operator hasn't
   * uploaded one yet). primary_color is a 7-char hex (#RRGGBB) used to
   * override the widget's --primary CSS variable; null = keep the
   * widget's default theme. name is the operator's display name
   * (rendered alongside / as a fallback for the logo header).
   */
  logo_url?: string | null
  primary_color?: string | null
  name?: string | null
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
  /**
   * Optional per-participant phone (landr-zaan). The booker's phone is
   * always sent as `customer_phone` on the body; this field carries
   * phones for additional participants (2..N) collected by DetailsStep.
   * The RPC persists it to the participant's contacts.phone using the
   * same upsert pattern as customer_phone.
   */
  phone?: string | null
  service_role_code: string
  pickup_location_id?: string | null
  /**
   * landr-gb2f.2: participant → room assignment. The hotel_room product
   * this participant is assigned to (package mode only). null / omitted
   * when the participant is unassigned, or in guiding-only / shared-double
   * modes (no room units). Paired with room_unit_index to disambiguate
   * which physical unit of a qty>1 room product they occupy.
   *
   * WIRE CONTRACT (PINNED — landr-gb2f.3/.4 on the API build to the same
   * shape): room_product_id is one of the products[] hotel_room line item
   * product_ids; products[] line items are NOT changed by this assignment.
   */
  room_product_id?: string | null
  /**
   * landr-gb2f.2: 0-based index of the physical unit WITHIN room_product_id
   * (0..quantity-1). Disambiguates a qty>1 room: a qty=2 double room has
   * unit 0 and unit 1, each sleeping capacity_per_unit people. null /
   * omitted when unassigned.
   */
  room_unit_index?: number | null
  /**
   * landr-doam.1: per-occupant age band for the hotel (informational only —
   * no discount is calculated by the widget). 'adult' (default/absent) or
   * 'child'. null / omitted = adult. Collected in the room-assignment UI
   * once the participant is assigned to a room unit.
   *
   * WIRE CONTRACT (PINNED — landr-doam.2 on the API builds the same shape):
   * absent/null → adult; 'child' → occupant_age must also be present.
   */
  occupant_age_band?: 'adult' | 'child' | null
  /**
   * landr-doam.1: the child's age in years (0-17). Present only when
   * occupant_age_band === 'child'. null / omitted otherwise. Purely
   * informational for the hotel — the widget never uses it in pricing.
   */
  occupant_age?: number | null
}

/**
 * landr-87n9.3: a NON-GUIDING companion — a partner/friend who joins the
 * party (and occupies a hotel bed) but does NOT take part in the guided
 * activity. Companions carry NO service_role, are NOT counted toward the
 * guiding-participants cap (6) NOR the per-participant guiding price, and
 * total headcount (participants + companions) CAN exceed 6.
 *
 * WIRE CONTRACT (PINNED — the API ticket landr-87n9.5 builds the SAME
 * shape): the submit body gains a top-level `companions: Companion[]`.
 * first_name is required; the rest are optional and normalised to null
 * when blank. room_product_id + room_unit_index mirror the guiding
 * Participant fields exactly — a companion is assigned to a hotel_room
 * unit the same way (whole-party assignment), so the assignment map
 * round-trips 1:1. Both are null/omitted when the companion is unassigned
 * (or in guiding-only / shared-double modes that have no room units).
 */
export interface Companion {
  first_name: string
  last_name?: string | null
  email?: string | null
  phone?: string | null
  room_product_id?: string | null
  room_unit_index?: number | null
  /**
   * landr-doam.1: per-occupant age band for the hotel (informational only).
   * Mirrors the Participant field exactly — 'adult' (default/absent) or
   * 'child'. null / omitted = adult. Populated from the room-assignment UI.
   *
   * WIRE CONTRACT (PINNED — landr-doam.2 on the API builds the same shape).
   */
  occupant_age_band?: 'adult' | 'child' | null
  /**
   * landr-doam.1: the child's age in years (0-17). Present only when
   * occupant_age_band === 'child'. null / omitted otherwise.
   */
  occupant_age?: number | null
  /**
   * landr-doam.1 scope-add: companion participation kind. Determines whether
   * the companion is a non-participating guest (partner/child/friend) or a
   * fellow pilot/activity-person who books and pays for their own guiding
   * separately (a separate booking).
   *
   * - 'guest' (default/absent): not doing the activity. Age band applies.
   * - 'separate_guiding': IS joining the activity but books/pays guiding
   *   separately. Fills a bed in the room holder's room and appears on the
   *   hotel rooming list, but is NOT counted in this booking's participants,
   *   guiding price, or the 6-participant cap.
   *
   * WIRE CONTRACT (PINNED — landr-doam.2 on the API builds the same shape).
   * Absent/null treated as 'guest' by the API.
   */
  companion_kind?: 'guest' | 'separate_guiding' | null
}

/**
 * Operator-scoped participant role surfaced by
 * GET /api/public/operators/{slug}/service-roles (landr-mg0a). The widget
 * fetches this list once on App mount and:
 *
 *   - Uses the first row's `code` as the default service_role_code for
 *     every participant on submit. Without a server-configured row the
 *     widget can't submit (the RPC validates the code), so a missing
 *     list bubbles up as a booking error. The API trigger seeded in
 *     migration 20260521080000 guarantees every operator has at least
 *     one row, so an empty list only happens for genuinely-missing
 *     operators.
 *
 *   - When the list has >1 entry the DetailsStep renders a dropdown per
 *     participant so customers can pick (e.g. 'pilot' vs 'passenger'
 *     for a tandem flight). With exactly one row the dropdown is
 *     hidden — the auto-default flow stays identical to the pre-mg0a
 *     hardcoded path.
 *
 * `label_localized` is reserved for a future i18n pass (the dashboard
 * already round-trips it); the current DetailsStep falls back to
 * `label` regardless.
 */
export interface ServiceRole {
  id: string
  code: string
  label: string
  label_localized: Record<string, string> | null
  sort_order: number
}

export interface ProductLine {
  product_id: string
  quantity?: number
  date_range_start?: string | null
  date_range_end?: string | null
  selected_days?: string[] | null
}

export interface SubmitBookingBody {
  widget_token: string
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
  /**
   * landr-87n9.3: non-guiding companions (partners/friends who join the
   * party + occupy a hotel bed but do NOT take part in the activity).
   * Empty / omitted when nobody extra joins. Companions are NOT in
   * participants[] (no service_role, not in the guiding price); they only
   * count toward whole-party room assignment + occupancy. PINNED wire
   * contract — landr-87n9.5 on the API builds the same shape.
   */
  companions?: Companion[]
  /**
   * landr-sbhz.3: customer eligibility declarations. Dict of key→true
   * for each confirmed declaration. Only sent when the operator requires
   * pre-booking declarations (e.g. Para42). Omitted for operators that
   * have not adopted the feature.
   */
  customer_declarations?: Record<string, true> | null
  /**
   * landr-87n9.4: BCP-47 codes for all languages the customer selected from
   * the operator's offered list. Replaces the legacy single customer_language
   * field (kept optional on the API for back-compat but no longer sent by
   * the widget). Empty array / omitted when no offered language was picked
   * (must be accompanied by a non-empty customer_other_languages in that case).
   */
  customer_languages?: string[] | null
  /**
   * landr-87n9.4: free-text languages spoken not covered by the offered list
   * (e.g. "Zulu, Russian"). Null / omitted when the free-text was not filled.
   */
  customer_other_languages?: string | null
  /**
   * landr-ffyg.1 / landr-ffyg.2: "second pilot in a shared double room"
   * marker. When true the booker shares another pilot's double room and
   * the submit MUST NOT include any hotel_room product line (the room is
   * covered by the first pilot's booking) AND MUST carry a
   * pickup_location_id on at least one participant (the shared hotel is
   * the collection point). The API persists this on
   * bookings.is_shared_double and 422s on either violation. Defaults
   * false (omitting it is a regular booking).
   */
  is_shared_double?: boolean
  /**
   * landr-7zc5.3: operator preview token — allows the API to accept
   * bookings against draft products during operator preview. Omitted in
   * all normal customer-facing submits; only present when the widget was
   * opened via a preview link (?preview_token=…). The API validates that
   * the token matches the operator and silently rejects inactive/deleted/
   * foreign products regardless.
   */
  preview_token?: string | null
}

export interface SubmitBookingResponse {
  booking_id: string
  /**
   * Booking lifecycle state, e.g. 'pending'. This is the API's
   * `semantic_state` field — the previous `state` name never existed on
   * the wire (only the mock supplied it), so the success page rendered a
   * blank. Mirrors public_submit_booking's jsonb response.
   */
  semantic_state: string
  /** Pipeline stage code, e.g. 'awaiting_payment'. */
  stage_code?: string
  /** Human-readable next-steps hint, e.g. 'Awaiting operator approval'. */
  next_steps?: string
  /** Approval-engine outcome, e.g. 'auto_approved'. */
  approval_outcome?: string
  token?: string
  /**
   * Absolute URL to the per-booking iCal/.ics download (landr-3vr5).
   * Exposed by the API so the success page can render an
   * "Add to calendar" button without knowing the API base URL.
   * Optional because older API deploys (pre-landr-3vr5) omit the field.
   */
  ical_url?: string
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
