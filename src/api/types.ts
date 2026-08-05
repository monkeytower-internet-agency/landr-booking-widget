/**
 * Wire types — keep aligned with FastAPI `app/routers/public_bookings.py`
 * and the DB RPCs in `supabase/migrations/20260512190528_public_rpcs.sql`
 * (last refactored by `20260519210000_product_kinds_refactor.sql`, landr-glx).
 */

import type { Enums } from '@/types/database.gen'
import type { FormResponseEntry } from '@/api/flowTypes'

/**
 * What the operator sells. Drives the booking flow shape and the dashboard
 * ProductForm. Mirrors public.product_kind. For everything that is not a
 * 'service' or 'hotel_room' the widget renders a "sold in Shop — coming
 * soon" stub. hotel_room products are not exposed in the main catalogue
 * — they're listed only inside the AccommodationStep after the customer
 * picked a service product with hotel_offering != 'none' (landr-vyaz).
 *
 * landr-52ik.5 — native Postgres enum; derived from the generated schema
 * (database.gen.ts, a compile-time-only anchor — this widget never talks to
 * Supabase directly) instead of hand-declared, so drift between the DB enum
 * and this wire type is caught by tsc.
 */
export type ProductKind = Enums<'product_kind'>

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

/**
 * One rendition pair for a product image (landr-d8rg, epic contract D).
 * thumb_url is a public URL to the WebP thumbnail (≤800 px wide, ≤250 KB);
 * hero_url is the full-width hero rendition (≤1600 px, ≤250 KB). Both
 * stored in the 'product-images' bucket under
 * {operator_id}/products/{product_id}/{uuid}-{thumb|hero}.webp.
 * alt is operator-supplied alt text; null means use the product name.
 */
export interface ProductImage {
  thumb_url: string
  hero_url: string
  alt: string | null
}

/**
 * Product group (category) returned by
 * GET /api/public/operators/{token}/product-groups (landr-d8rg, epic contract E).
 * Active + non-deleted only. product_count is the count of bookable products
 * in the group subtree (including children via parent_id). image_url is the
 * public URL of the group's cover image (null when none has been uploaded).
 * Localized fields follow the same localized-jsonb convention as Product.
 *
 * landr-y3oj.3 codegen note: NOT sourced from the generated
 * `components['schemas']['OperatorProductGroup']` (src/types/api.gen.ts).
 * Field names line up 1:1, but openapi-typescript widens the two
 * `_localized` jsonb columns to `Record<string, unknown>` (no value-type
 * info survives the jsonb round-trip) and marks image_url/parent_id/etc.
 * optional purely because the Pydantic fields carry defaults — even
 * though `OperatorProductGroup` has no `extra=allow` and always
 * serializes every field. Kept hand-written for the stricter
 * `Record<string, string>` + required-field guarantees; adopting the
 * generated type as-is would force casts at every call site for no
 * behavioural gain. Codegen gap, not a widget bug.
 */
export interface ProductGroup {
  id: string
  slug: string
  name: string
  name_localized: Record<string, string> | null
  description: string | null
  description_localized: Record<string, string> | null
  image_url: string | null
  sort_order: number
  parent_id: string | null
  product_count: number
  /**
   * landr-872c: server-computed count of currently-bookable products in the
   * group's descendant subtree — same subtree as product_count, narrowed to
   * the SAME bookability predicate Product.bookable already reports (see
   * public_get_operator_product_groups). Always <= product_count. Governs
   * PER-CATEGORY visibility: product_count > 0 && bookable_count === 0 means
   * the category is FULLY SOLD OUT and must render as a disabled/"Fully
   * booked" tile+section rather than being hidden — see
   * isCategoryFullySoldOut() in bookability.ts and the contract table in
   * ExpandedCatalog.tsx.
   *
   * OPTIONAL for back-compat with an API that predates the field. FAIL OPEN
   * like Product.bookable/isBookable(): an ABSENT bookable_count must never
   * be treated as "fully sold out" — isCategoryFullySoldOut() only fires on
   * an explicit 0, so an older API can never accidentally grey out a whole
   * catalogue.
   */
  bookable_count?: number
}

/**
 * landr-y3oj.3 codegen note: NOT sourced from the generated
 * `components['schemas']['OperatorProduct']` (src/types/api.gen.ts, from
 * `GET /operators/{token}/products` in app/routers/public_operators.py).
 * `OperatorProduct` is deliberately declared with only 6 fields
 * (product_id/slug/name/images/thumb_url/price_from) plus
 * `model_config = {"extra": "allow"}` so the router's RPC-passthrough
 * columns don't force a response-model bump on every migration — the
 * *actual* wire payload carries all the fields below (product_kind,
 * service_time_shape, hotel_offering, …), but the OpenAPI schema doesn't
 * declare them. Adopting `OperatorProduct` here would silently drop
 * ~25 fields' worth of type coverage. Codegen gap (by design on the API
 * side), not something to paper over.
 */
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
  /**
   * landr-5mvw: structural flag. When true, breakfast is bundled into the
   * room rate and the breakfast add-on MUST NOT be offered as a separate
   * line item in the AccommodationStep. Replaces the name-heuristic
   * isPremiumIncludesBreakfast. Defaults to false for backwards
   * compatibility with API responses that predate this field.
   */
  includes_breakfast?: boolean
  /**
   * landr-7jgo: server-computed bookability. true = the product has at
   * least one FUTURE date a customer could pick with capacity remaining
   * (an open product_availability row OR a non-full fixed-date window);
   * false = sold out / no upcoming dates. The catalogue overview hides
   * non-bookable products by default; a deep-linked single product that
   * is non-bookable renders a "Fully booked" state (no picker, no CTA).
   *
   * Optional for back-compat with API responses that predate the flag —
   * `isBookable()` treats an ABSENT flag as bookable (fail-open) so an
   * older API never accidentally hides a whole catalogue. Non-service
   * (shop) kinds are always reported bookable by the API.
   */
  bookable?: boolean
  /**
   * landr-d8rg, epic contract D: public URL of the product's primary
   * thumbnail image (first entry of images[] sorted by sort_order).
   * null when the operator has not yet uploaded any imagery. The widget
   * uses this as the cheap preview source for catalogue cards; hero_url
   * is used on the product detail page.
   *
   * OPTIONAL (rolling deploy): the API ships these fields in
   * landr-d8rg.1; until that lands on the dev/prod API, product payloads
   * arrive WITHOUT them. Consumers must treat undefined as null/empty.
   * This also keeps the dozens of existing Product test factories valid
   * (CI type-checks test files via `tsc -b` — see PR #79 red run).
   */
  thumb_url?: string | null
  /**
   * landr-d8rg, epic contract D: sorted list of WebP rendition pairs
   * for this product (max 4, by sort_order ASC). Empty array when no
   * images have been uploaded. Used by the product detail gallery.
   * Optional during rolling deploy (see thumb_url note).
   */
  images?: ProductImage[]
  /**
   * landr-d8rg, epic contract D: cheapest derivable single-day/base rate
   * as a decimal string ("€" not included, e.g. "59.00"). Computed
   * server-side from the product's active pricing scheme (cheapest
   * per_day_base or fixed_total rule). null when the rate cannot be
   * derived (e.g. tier-only schemes with no base rate, or hotel_room
   * kinds where the rate varies by occupancy). The widget renders
   * "from €{price_from}" on catalogue cards; the field is hidden when
   * null. Optional during rolling deploy (see thumb_url note).
   */
  price_from?: string | null
  /**
   * landr-4a5j: the soonest upcoming product_fixed_date_windows row for
   * this product (start_date >= today, still bookable — active, not
   * soft-deleted, not full), as ISO date strings ("YYYY-MM-DD"). Both
   * null when the product has no such window (not a fixed-window product,
   * or every window is past/full/cancelled). Lets the expanded-catalog
   * first step render a short date teaser (e.g. "12.–19.09.") without an
   * N+1 getFixedDateWindows call per product. Optional for rolling deploy
   * — absent API responses treated as null.
   */
  next_window_start?: string | null
  next_window_end?: string | null
}

/**
 * landr-ens5 — the operator's configured 3-colour brand theme, saved by
 * the dashboard to operators.theme and surfaced by the settings RPC under
 * the `theme` key. Each value is a CSS colour string (hex, e.g. #1d4ed8).
 *
 *   brand      — text / headings (maps to --foreground + --brand)
 *   accent     — buttons / CTAs   (maps to --primary)
 *   background — the page canvas  (maps to --background)
 *
 * `dark` carries optional per-colour overrides for dark mode. The widget
 * has no active dark mode today (the .dark class in index.css is never
 * applied), so these are carried for forward-compat with the dashboard's
 * matching deriveDark and are NOT consumed yet.
 */
export interface WidgetTheme {
  brand: string
  accent: string
  background: string
  dark?: {
    brand?: string
    accent?: string
    background?: string
  }
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
   * widget's default theme. name is the operator's display name (used
   * for the logo's alt text — NOT rendered as a text header; landr-nils
   * removed the name fallback so a missing logo shows nothing).
   *
   * landr-ens5 — primary_color is the LEGACY single-colour field. New
   * operators get the richer `theme` (brand/accent/background) below;
   * `theme` wins when present and primary_color is the fallback for
   * operators who only ever set the old single colour.
   */
  logo_url?: string | null
  primary_color?: string | null
  /**
   * landr-ens5 — the operator's 3-colour brand theme (brand/accent/
   * background, + optional dark overrides). When present it supersedes
   * primary_color and drives --background / --foreground / --brand /
   * --primary on the widget root. Null = no theme configured (fall back
   * to primary_color, then the built-in default).
   */
  theme?: WidgetTheme | null
  name?: string | null
  /**
   * landr-nils — operator-configurable copy rendered around the embed.
   * widget_headline + widget_description sit above the widget (header
   * block, in addition to or instead of the logo; the operator may put
   * legal info in the description). widget_footer sits below the widget
   * (no headline). All null by default. Plain text — the widget renders
   * them with line breaks preserved and never as HTML (XSS-safe).
   */
  widget_headline?: string | null
  widget_description?: string | null
  widget_footer?: string | null
  /**
   * landr-rjda — per-field "first-page-only" gates. When true the
   * corresponding text is shown only on the first step (pick-product or
   * pick-category); on all later steps it is hidden. Default false = current
   * behaviour (show on every step). Optional for rolling deploy — absent API
   * responses are treated as false.
   */
  widget_headline_first_page_only?: boolean
  widget_description_first_page_only?: boolean
  widget_footer_first_page_only?: boolean
  /**
   * landr-atwy — per-operator opt-in for the post-booking "Track this
   * booking in the LANDR app" account-link prompt. Default false: the
   * prompt (which creates a real LANDR auth account via signInWithOtp)
   * is hidden unless the operator turns it on. Optional for back-compat
   * with older API responses that predate the flag (treated as false).
   */
  offer_account_link?: boolean
  /**
   * landr-jb1k: operator-configured default visual variant for the widget
   * ('aurora' | 'summit' | 'alpine'). Null means "use the built-in default
   * (aurora)". Resolution precedence: explicit ?variant= URL param ALWAYS
   * wins; else this value (once settings resolve); else aurora.
   * Optional for rolling deploy — absent API responses treated as null.
   */
  widget_variant?: 'aurora' | 'summit' | 'alpine' | null
  /**
   * landr-jb1k: operator-configured category grid column count (1..4).
   * Null means "use improved auto-logic" (count-aware: exactly 3 visible
   * groups → 3 cols on lg; otherwise the built-in responsive default).
   * Optional for rolling deploy — absent API responses treated as null.
   */
  widget_category_columns?: number | null
  /**
   * landr-jb1k: operator-configured font key for category tile titles and
   * the CategoryStep entrance heading. Each non-system value triggers a
   * lazy @fontsource CSS import (GDPR-safe; no CDN; latin 400+700 only).
   * 'system' = no override (current behavior). Null / absent → system
   * default. Optional for rolling deploy.
   *
   * Values are kept in sync with TileFontKey in lib/tileFont.ts (separate
   * to avoid a circular import between types.ts and the fontsource module).
   */
  widget_tile_font?: 'system' | 'playfair' | 'montserrat' | 'bebas' | 'space-grotesk' | 'caveat' | null
  /**
   * landr-jb1k: operator-configured text-transform for category tile
   * titles and the CategoryStep entrance heading. Applied as a Tailwind
   * utility class from a static map (no dynamic class names):
   *   'uppercase'  → uppercase
   *   'lowercase'  → lowercase
   *   'capitalize' → capitalize
   * Null / absent → no transform (inherited / none).
   * Optional for rolling deploy.
   */
  widget_title_case?: 'uppercase' | 'lowercase' | 'capitalize' | null
  /**
   * landr-jb1k.4: operator-configured tile corner radius. Overrides the
   * variant token radius for category tiles only. Null / absent → variant
   * default (current behaviour). Values kept in sync with TileRadiusKey in
   * lib/tileStyle.ts. Optional for rolling deploy.
   */
  widget_tile_radius?: 'sharp' | 'rounded' | 'round' | null
  /**
   * landr-jb1k.4: operator-configured tile aspect ratio (1:1 / 4:3 / 16:9).
   * Overrides the variant token aspect for category tiles only. Null / absent
   * → variant default. Values kept in sync with TileAspectKey. Optional.
   */
  widget_tile_aspect?: 'square' | 'landscape' | 'wide' | null
  /**
   * landr-jb1k.4: operator-configured scrim tint behind text-over-image tile
   * titles (text-overlay / aurora layout only — the other variants have no
   * scrim). 'dark' = black gradient (current default), 'brand' = primary-tinted
   * gradient, 'light' = white gradient WITH dark title text (AA enforced).
   * Null / absent → current behaviour (dark). Values in sync with TileScrimKey.
   */
  widget_tile_scrim?: 'dark' | 'brand' | 'light' | null
  /**
   * landr-jb1k.4: operator-configured tile hover interaction. 'lift' = the
   * current card translate, 'zoom' = image scale-up, 'none' = no motion.
   * Null / absent → current behaviour (lift). Values in sync with TileHoverKey.
   */
  widget_tile_hover?: 'lift' | 'zoom' | 'none' | null
  /**
   * landr-4uyu: operator contact email surfaced on the Details step at the
   * participant max (5 additional). The widget renders a "Need a larger group
   * or a flight school booking? Get in touch:" line with a mailto: link to
   * this address. Null / absent → the contact copy still shows (graceful
   * degrade) but the broken mailto link is omitted. Optional for rolling
   * deploy — older API responses that predate the key are treated as null.
   * JSON key is exactly `contact_email` (set by public_get_operator_settings).
   */
  contact_email?: string | null
  /**
   * landr-4a5j: operator-configured first-step catalog layout.
   * 'categories' (default/current behaviour — the first step shows category
   * tiles, customer drills in to see products) or 'expanded' (the first
   * step lists ALL products grouped under category headers, no drill-in).
   * Null means "use the platform default" ('categories'). Resolution
   * precedence: explicit ?catalog= URL param ALWAYS wins; else this value
   * (once settings resolve); else 'categories'. Optional for rolling
   * deploy — absent API responses treated as null.
   */
  widget_catalog_layout?: 'categories' | 'expanded' | null
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
  /**
   * landr-a4fy: per-occupant breakfast flag. true when this participant
   * has breakfast included (tied to the breakfast add-on selection in
   * the room-assignment UI). false / omitted = no breakfast. Persisted
   * on booking_participants.has_breakfast for email/hotel-request display.
   *
   * WIRE CONTRACT (PINNED — landr-a4fy part (2) on the API builds the
   * same shape): absent/false → no breakfast; true → has breakfast.
   */
  has_breakfast?: boolean | null
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
   * landr-a4fy: per-occupant breakfast flag for companions. Mirrors the
   * Participant field exactly — true when this companion has breakfast.
   * false / omitted = no breakfast.
   *
   * WIRE CONTRACT (PINNED — landr-a4fy part (2) on the API builds the
   * same shape): absent/false → no breakfast; true → has breakfast.
   */
  has_breakfast?: boolean | null
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
  /**
   * landr-71kz.4: operator-defined custom form answers, collected by
   * CustomFormStep. Each entry carries a form_key + answers dict (hidden
   * fields already pruned by the widget; server prunes again). Optional —
   * omitted for legacy-flow operators so old submits stay byte-identical.
   * WIRE CONTRACT: matches PublicSubmitBookingIn.form_responses on the API
   * (landr-71kz.2). form_responses_not_supported (422) when sent for a
   * product with no flow; widget only sends it when a configured flow exists.
   */
  form_responses?: FormResponseEntry[]
}

/**
 * Body the STAFF submit endpoint accepts (landr-aoak.4, contract verified
 * against the merged `staff_bookings_submit.py` StaffSubmitBookingIn model).
 * The staff route — POST /api/staff/operators/{operator_id}/bookings/submit —
 * is SEPARATE from the public one: it carries NO `widget_token` (the signed
 * `staff_session` is the credential) and no `preview_token`. Everything else
 * mirrors SubmitBookingBody; the operator-only power fields are added on top.
 * Built by augmentStaffSubmit (src/components/booking/staffSubmitAdapter.ts);
 * POSTed by submitStaffBooking (src/api/client.ts).
 */
export type StaffSubmitBody = Omit<
  SubmitBookingBody,
  'widget_token' | 'preview_token'
> & {
  /** The server-signed staff session token (aoak.1 [S1]) — the credential. */
  staff_session: string
  /** Force past full / blocked days + fixed-date windows (force_book power). */
  ignore_capacity?: boolean
  /** Human reason for the force-book — written to the audit_log row. */
  force_book_reason?: string
  /** Effective gross override as a 2-decimal STRING, e.g. "199.95". */
  override_gross_total?: string
  /** Mandatory reason whenever override_gross_total is set. */
  override_reason?: string
  /** Booking channel (server forces 'agent_dashboard' regardless). */
  booking_channel?: string
}

/**
 * Parsed calendar event data returned alongside ical_url (landr-acew).
 * Mirrors the first VEVENT the ICS service emits — all-day semantics,
 * so dates are ISO-8601 date strings (no time component). The widget
 * uses these fields to build Google Calendar and Outlook deep-link URLs
 * without any additional API call.
 *
 * Optional because:
 *   - Older API deploys (pre-landr-acew) do not include the field.
 *   - Bookings whose products carry no date information (e.g. products
 *     awaiting schedule assignment) yield no VEVENT and therefore no
 *     calendar_event block.
 */
export interface BookingCalendarEvent {
  /** Event display title, e.g. "Tandem Classic — Para42". */
  title: string
  /** First day of the booking (ISO-8601, YYYY-MM-DD). */
  start_date: string
  /** Last day of the booking (ISO-8601, YYYY-MM-DD; inclusive). */
  end_date: string
  /** Plain-text event body shown inside the calendar entry. */
  description?: string | null
  /** Location string, typically the operator name or venue. */
  location?: string | null
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
  /**
   * Parsed calendar event data for building Google Calendar and Outlook
   * deep-link URLs client-side (landr-acew). Present when ical_url is
   * also present and the booking carries at least one dated product.
   * Absent on older API deploys or date-less products.
   */
  calendar_event?: BookingCalendarEvent | null
  /**
   * landr-y31z: outcome of the post-booking confirmation email send.
   * 'sent'     → Gmail delivery confirmed.
   * 'captured' → dev-fallback path (sent_via='dev_fallback'); email saved
   *              but not dispatched externally — treat as success for display.
   * 'failed'   → outbound_emails row exists but send failed (no Gmail
   *              configured, or SMTP error); booking IS saved.
   * 'pending'  → non-auto-approved booking (awaiting operator action), or
   *              enqueue failed before any row was created.
   * Absent on API responses that predate landr-2js5 — treat as 'pending'.
   */
  confirmation_email_status?: 'sent' | 'captured' | 'failed' | 'pending'
}

/**
 * One row in the PriceSidebar breakdown (landr-qez0). Returned by
 * POST /api/public/operators/{slug}/products/{id}/estimate (landr-xbqh).
 * `paid_to` mirrors revenue_flows_through_operator: 'operator' means the
 * customer pays the operator at checkout; 'hotel' means the customer
 * settles directly with the hotel on arrival.
 *
 * landr-y3oj.3 codegen note: NOT sourced from the generated
 * `components['schemas']['EstimateLineItem']` (src/types/api.gen.ts). The
 * Python `EstimateLineItem` model types `paid_to: str` (a plain string,
 * not a `Literal["operator", "hotel"]`), so openapi-typescript emits
 * `paid_to: string` — adopting it would lose the literal-union narrowing
 * this interface exists to provide. Codegen gap (needs a `Literal` on the
 * API side to fix at the source), not something to paper over here.
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
 *
 * landr-qj1g: for per_streak_tier and per_total_days_tier, detail may
 * carry base_tier: { threshold_min: number; amount_per_unit: number } —
 * the first (short-stay) bracket of the schedule. The widget uses this
 * to show "save €X/day vs standard rate" alongside the applied per-day
 * rate. Absent when the applied tier IS the base tier (no savings).
 *
 * landr-y3oj.3 codegen note: NOT sourced from the generated
 * `components['schemas']['EstimateAppliedRule']` (src/types/api.gen.ts).
 * The generated schema is a strict superset (it also carries
 * rule_id/before/after/skipped/skipped_reason, and types `kind` as plain
 * `string`) — this interface intentionally only declares the two fields
 * the sidebar tag actually reads. Already flagged as a divergence in
 * landr-y3oj.1's handoff; not re-litigated here.
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

/**
 * landr-y3oj.3 codegen note: NOT sourced from the generated
 * `components['schemas']['EstimateResponse']` (src/types/api.gen.ts). The
 * Python model has `model_config = {"extra": "allow"}`, so
 * openapi-typescript adds a `& { [key: string]: unknown }` catch-all and
 * marks `line_items`/`applied_rules` optional (they carry
 * `Field(default_factory=list)` defaults) even though the router always
 * serializes them. Kept hand-written for the required-array + nested
 * literal-type guarantees (see EstimateLineItem/EstimateAppliedRule notes
 * above). Codegen gap, not something to paper over.
 */
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

// ─── Hotel room-request reply loop (landr-em0r / landr-em0r.9) ──────────────
//
// Hand-written, NOT sourced from src/types/api.gen.ts. Originally built
// against the epic's frozen HTTP contract (landr-em0r description, section
// 7) before the API PR (landr-em0r.8) landed — the same house convention
// getBookingByToken/PublicBookingOffer already follows.
//
// RECONCILED against the real generated schema in landr-em0r.13 (the router
// merged in landr-em0r.8, commit 381026e). DECISION: kept hand-written —
// see src/api/approvalReplyTypes.contract.test.ts for the field-by-field
// compile-time proof and the one documented gap (`current_response.decision`
// is typed as a bare `string` on the API side, not the shared
// `ApprovalDecision` literal its two sibling `decision` fields use — DB
// CHECK-constrained at runtime, but not schema-guaranteed; flagged as a
// landr-api follow-up, not fixed here). Everything else below matches the
// generated components["schemas"][...] shapes exactly.

/**
 * Lifecycle state of a `booking_approval_requests` row, as returned by
 * `GET /api/public/approval-requests/{token}`. `open` and `answered` both
 * render the reply form (answered shows the recorded answer first, with a
 * "Change my answer" affordance); the other four are read-only named
 * terminal cards and NEVER a bare/opaque error.
 */
export type ApprovalRequestState =
  | 'open'
  | 'answered'
  | 'closed_confirmed'
  | 'closed_cancelled'
  | 'superseded'
  | 'expired'

/**
 * The hotel's answer. Maps 1:1 to the three reply-email buttons /
 * `/reply/{token}/{intent}` URL segments: yes → confirmed,
 * no → declined, changes → confirmed_with_changes.
 */
export type ApprovalDecision =
  | 'confirmed'
  | 'declined'
  | 'confirmed_with_changes'

/** Branding fields for the confirm page (epic decision g — branded per operator). */
export interface ApprovalRequestOperator {
  name: string
  logo_url: string | null
  primary_color: string | null
  phone: string | null
}

export interface ApprovalRequestResponder {
  location_name: string
}

export interface ApprovalRequestRoomLine {
  qty: number
  label: string
}

/** Allowlisted booking fields only — no prices, no customer PII (epic section 7). */
export interface ApprovalRequestBooking {
  reference: string
  check_in: string
  check_out: string
  nights: number
  guests_count: number
  room_lines: ApprovalRequestRoomLine[]
}

/** The currently-recorded answer, present only when `state === 'answered'`. */
export interface ApprovalRequestCurrentResponse {
  decision: ApprovalDecision
  comment: string | null
  responder_name: string | null
  responded_at: string
}

/**
 * `GET /api/public/approval-requests/{token}` response body. Read-only —
 * fetching this must NEVER record anything (prefetcher-safety layer 2 of 4,
 * epic section 4). `confirm_nonce` exists only in this body and is required
 * by the POST below (prefetcher-safety layer 3).
 */
export interface ApprovalRequestContext {
  state: ApprovalRequestState
  can_respond: boolean
  locale: string
  request_ref: string
  confirm_nonce: string
  operator: ApprovalRequestOperator
  responder: ApprovalRequestResponder
  booking: ApprovalRequestBooking
  current_response: ApprovalRequestCurrentResponse | null
}

/** `POST /api/public/approval-requests/{token}/response` request body. */
export interface ApprovalReplyRequestBody {
  decision: ApprovalDecision
  comment: string | null
  responder_name: string | null
  confirm_nonce: string
}

/**
 * `POST /api/public/approval-requests/{token}/response` 200 response.
 * `already_recorded: true` means the same decision + normalised comment was
 * already on file — no new row, no duplicate notification (epic decision d).
 * A 422 (`invalid_confirm_nonce` / `comment_required_for_changes`) throws an
 * `HttpError` instead of resolving this type — see submitApprovalReply.
 */
export interface ApprovalReplyResult {
  ok: boolean
  state: ApprovalRequestState
  decision: ApprovalDecision
  recorded_at: string
  already_recorded: boolean
  booking_advanced: boolean
  superseded_previous: boolean
}
