import type {
  AvailabilitySlot,
  EstimateRequestBody,
  EstimateResponse,
  FixedDateWindow,
  Location,
  OperatorSettings,
  Product,
  EvaluatedOffer,
  OfferEvaluateRequest,
  OfferEvaluateResponse,
  ProductGroup,
  ServiceRole,
  SubmitBookingResponse,
} from './types'

const today = () => new Date()

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

const addDays = (base: Date, n: number) => {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

const MOCK_HOTEL_ID = 'aaaaaaaa-0000-0000-0000-000000000003'

const allMockProducts: Product[] = [
  {
    product_id: '00000000-0000-0000-0000-000000000001',
    slug: 'tandem-classic',
    name: 'Tandem Classic',
    name_localized: { en: 'Tandem Classic', de: 'Tandem Classic', tr: 'Tandem Klasik' },
    short_description: 'Standard tandem experience over Babadağ.',
    short_description_localized: {
      en: 'Standard tandem experience over Babadağ.',
      de: 'Standard-Tandemerlebnis über dem Babadağ.',
      tr: 'Babadağ üzerinde standart tandem deneyimi.',
    },
    description: '**25 minutes** in the air over Babadağ.\n\n- Fully guided from launch to landing\n- Suitable for all fitness levels\n- GoPro footage available on request',
    // landr-pv2r1: [] = any language (no chip, language step skipped).
    guide_languages: [],
    product_kind: 'service',
    service_time_shape: 'time_slot',
    is_contiguous: false,
    duration_minutes: 25,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: '11111111-1111-1111-1111-111111111111',
    group_slug: 'tandemfluege',
    group_name: 'Tandemflüge',
    sort_order: 1,
    sport_subcategory_codes: ['paragliding-tandem'],
    location_ids: [],
    needs_pickup: false,
    hotel_offering: 'none',
    hotel_location_id: null,
    price_per_unit: null,
    currency: 'EUR',
    is_publicly_listed: true,
    // landr-7jgo: server-computed bookability (mock = has future open dates).
    bookable: true,
    // landr-d8rg contract D: thumbnail + hero imagery (2 images for this product).
    thumb_url: 'https://picsum.photos/seed/tandem-classic/800/600',
    images: [
      {
        thumb_url: 'https://picsum.photos/seed/tandem-classic/800/600',
        hero_url: 'https://picsum.photos/seed/tandem-classic/1600/1200',
        alt: 'Tandem paragliding flight over the valley',
      },
      {
        thumb_url: 'https://picsum.photos/seed/tandem-classic-2/800/600',
        hero_url: 'https://picsum.photos/seed/tandem-classic-2/1600/1200',
        alt: 'Launch site preparation with instructor',
      },
    ],
    // landr-d8rg contract D: cheapest derivable base rate.
    price_from: '59.00',
  },
  {
    product_id: '00000000-0000-0000-0000-000000000002',
    slug: 'tandem-long',
    name: 'Tandem Long',
    name_localized: { en: 'Tandem Long', de: 'Tandem Lang' },
    short_description: 'Extended-flight tandem when conditions allow.',
    short_description_localized: null,
    description: null,
    // landr-pv2r1: per-product guide languages (catalog chip + detail fact).
    guide_languages: ['de', 'en'],
    product_kind: 'service',
    service_time_shape: 'time_slot',
    is_contiguous: false,
    duration_minutes: 45,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: '11111111-1111-1111-1111-111111111111',
    group_slug: 'tandemfluege',
    group_name: 'Tandemflüge',
    sort_order: 2,
    sport_subcategory_codes: ['paragliding-tandem'],
    location_ids: [],
    needs_pickup: true,
    hotel_offering: 'optional',
    hotel_location_id: null,
    price_per_unit: null,
    currency: 'EUR',
    is_publicly_listed: true,
    bookable: true,
    // landr-d8rg contract D: 3 images for Tandem Long.
    thumb_url: 'https://picsum.photos/seed/tandem-long/800/600',
    images: [
      {
        thumb_url: 'https://picsum.photos/seed/tandem-long/800/600',
        hero_url: 'https://picsum.photos/seed/tandem-long/1600/1200',
        alt: 'Extended tandem flight with panoramic mountain views',
      },
      {
        thumb_url: 'https://picsum.photos/seed/tandem-long-2/800/600',
        hero_url: 'https://picsum.photos/seed/tandem-long-2/1600/1200',
        alt: 'In-flight GoPro view from above the coast',
      },
      {
        thumb_url: 'https://picsum.photos/seed/tandem-long-3/800/600',
        hero_url: 'https://picsum.photos/seed/tandem-long-3/1600/1200',
        alt: 'Landing approach over the beach',
      },
    ],
    price_from: '89.00',
  },
  {
    // landr-7jgo: a sold-out product so offline dev exercises the hide /
    // "Fully booked" overview states + the sold-out deep-link path.
    product_id: '00000000-0000-0000-0000-000000000004',
    slug: 'grundkurs-a',
    name: 'Grundkurs A',
    name_localized: { en: 'Basic Course A', de: 'Grundkurs A' },
    short_description: 'Anfängerkurs Gleitschirmfliegen — ausgebucht.',
    short_description_localized: { en: 'Beginner paragliding course — fully booked.', de: 'Anfängerkurs Gleitschirmfliegen — ausgebucht.' },
    description: null,
    // landr-pv2r1: per-product guide languages (catalog chip + detail fact).
    guide_languages: ['en', 'de', 'es', 'fr'],
    product_kind: 'service',
    service_time_shape: 'fixed_window',
    is_contiguous: false,
    duration_minutes: null,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: '22222222-2222-2222-2222-222222222222',
    group_slug: 'kurse',
    group_name: 'Kurse',
    sort_order: 3,
    sport_subcategory_codes: ['paragliding-training'],
    location_ids: [],
    needs_pickup: false,
    hotel_offering: 'none',
    hotel_location_id: null,
    price_per_unit: null,
    currency: 'EUR',
    is_publicly_listed: true,
    bookable: false,
    // landr-d8rg contract D: no imagery on this product — exercises the no-photo fallback.
    thumb_url: null,
    images: [],
    // landr-d8rg contract D: null price_from exercises the hidden-"from" path.
    price_from: null,
  },
]

/**
 * landr-7zc5.3: Draft product returned only in preview mode (when a
 * valid preview_token is supplied). Mirrors a real draft row — the API
 * RPC public_get_operator_products filters is_publicly_listed=true for
 * the live path and omits that filter on the preview path.
 */
const mockDraftProducts: Product[] = [
  {
    product_id: '00000000-0000-0000-0000-000000000003',
    slug: 'tandem-vip',
    name: 'Tandem VIP',
    name_localized: { en: 'Tandem VIP', de: 'Tandem VIP' },
    short_description: 'Exclusive VIP tandem experience (draft — not yet published).',
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'time_slot',
    is_contiguous: false,
    duration_minutes: 60,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: '11111111-1111-1111-1111-111111111111',
    group_slug: 'tandemfluege',
    group_name: 'Tandemflüge',
    sort_order: 99,
    sport_subcategory_codes: ['paragliding-tandem'],
    location_ids: [],
    needs_pickup: false,
    hotel_offering: 'none',
    hotel_location_id: null,
    price_per_unit: null,
    currency: 'EUR',
    is_publicly_listed: false,
    thumb_url: null,
    images: [],
    price_from: '149.00',
  },
]

/**
 * landr-hfvyc.2: an apartment stay with guest-based pricing (the demo seed's
 * "Familienwohnung" rule from landr-hfvyc.1). Not part of mockProducts, so
 * existing catalogue expectations are untouched; tests and mock-mode demos
 * opt in.
 */
export const mockOccupancyStay: Product = {
  product_id: '00000000-0000-0000-0000-000000000301',
  slug: 'familienwohnung',
  name: 'Familienwohnung',
  name_localized: { en: 'Family apartment', de: 'Familienwohnung' },
  short_description: 'Apartment for the whole family.',
  short_description_localized: null,
  description: null,
  product_kind: 'stay',
  service_time_shape: null,
  is_contiguous: false,
  duration_minutes: null,
  fixed_start_date: null,
  fixed_end_date: null,
  product_group_id: null,
  group_slug: null,
  group_name: null,
  sort_order: 300,
  sport_subcategory_codes: [],
  location_ids: [],
  needs_pickup: false,
  hotel_offering: 'none',
  hotel_location_id: null,
  price_per_unit: 120,
  currency: 'EUR',
  capacity_per_unit: 5,
  thumb_url: null,
  images: [],
  price_from: '120.00',
  occupancy_pricing: {
    included_adults: 2,
    extra_adult_per_night: '25.00',
    child_bands: [
      { min_age: 0, max_age: 2, per_night: '0.00' },
      { min_age: 3, max_age: 11, per_night: '12.00' },
      { min_age: 12, max_age: 17, per_night: '18.00' },
    ],
  },
}

/** Sentinel used in tests — any non-empty string acts as a preview_token. */
export const MOCK_PREVIEW_TOKEN = 'mock-preview-token-abc'

const allMockHotelRooms: Product[] = [
  {
    product_id: '00000000-0000-0000-0000-000000000101',
    slug: 'single-room',
    name: 'Single Room',
    name_localized: { en: 'Single Room', de: 'Einzelzimmer' },
    short_description: 'One twin bed, en-suite bathroom.',
    short_description_localized: null,
    description: null,
    product_kind: 'hotel_room',
    service_time_shape: null,
    is_contiguous: false,
    duration_minutes: null,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: null,
    group_slug: null,
    group_name: null,
    sort_order: 200,
    sport_subcategory_codes: [],
    location_ids: [],
    needs_pickup: false,
    hotel_offering: 'none',
    hotel_location_id: MOCK_HOTEL_ID,
    price_per_unit: 49,
    currency: 'EUR',
    capacity_per_unit: 1,
    thumb_url: null,
    images: [],
    price_from: null,
  },
  {
    product_id: '00000000-0000-0000-0000-000000000102',
    slug: 'double-room',
    name: 'Double Room',
    name_localized: { en: 'Double Room', de: 'Doppelzimmer' },
    short_description: 'Two single beds or one queen, en-suite bathroom.',
    short_description_localized: null,
    description: null,
    product_kind: 'hotel_room',
    service_time_shape: null,
    is_contiguous: false,
    duration_minutes: null,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: null,
    group_slug: null,
    group_name: null,
    sort_order: 201,
    sport_subcategory_codes: [],
    location_ids: [],
    needs_pickup: false,
    hotel_offering: 'none',
    hotel_location_id: MOCK_HOTEL_ID,
    price_per_unit: 73,
    currency: 'EUR',
    capacity_per_unit: 2,
    thumb_url: null,
    images: [],
    price_from: null,
  },
]

export const mockLocations: Location[] = [
  {
    location_id: 'aaaaaaaa-0000-0000-0000-000000000001',
    name: 'Ölüdeniz Beach',
    name_localized: { en: 'Ölüdeniz Beach', de: 'Ölüdeniz Strand', tr: 'Ölüdeniz Plajı' },
    parent_id: null,
    role_type: { code: 'beach', label: 'Beach' },
    place_roles: ['pickup'],
  },
  {
    location_id: 'aaaaaaaa-0000-0000-0000-000000000002',
    name: 'Hisarönü Main Square',
    name_localized: { en: 'Hisarönü Main Square', de: 'Hisarönü Hauptplatz', tr: 'Hisarönü Meydanı' },
    parent_id: null,
    role_type: { code: 'plaza', label: 'Plaza' },
    place_roles: ['pickup'],
  },
  {
    location_id: 'aaaaaaaa-0000-0000-0000-000000000003',
    name: 'Fethiye Harbour',
    name_localized: { en: 'Fethiye Harbour', de: 'Hafen Fethiye', tr: 'Fethiye Limanı' },
    parent_id: null,
    role_type: { code: 'hotel', label: 'Hotel' },
    // A hotel that is ALSO a pickup point (Para42's real Hotel Mirador
    // shape) — exercises both getHotelsForOperator's and
    // listPickupLocationsForOperator's filters on the same mock row.
    place_roles: ['pickup'],
  },
  {
    // landr-lmudr.12: a place with NO pickup role — the negative case for
    // listPickupLocationsForOperator's filter (client.test.ts). Kept out of
    // both PickupLocationPicker and AccommodationStep in the local preview,
    // same as an operator's private staging area would be.
    location_id: 'aaaaaaaa-0000-0000-0000-000000000004',
    name: 'Staff Storage Yard',
    name_localized: null,
    parent_id: null,
    role_type: { code: 'storage', label: 'Storage' },
    place_roles: [],
  },
]

/**
 * landr-d8rg, epic contract E: 4 realistic product groups for a German
 * paragliding operator. product_count values are kept consistent with the
 * mock product catalogue above:
 *   tandemfluege → 2 bookable (tandem-classic + tandem-long; tandem-vip is draft)
 *   kurse        → 0 bookable (grundkurs-a is sold-out / non-bookable)
 *   reisen       → 0 bookable (no current mock products assigned)
 *   verleih      → 0 bookable (no current mock products assigned)
 * The count intentionally reflects bookable=true products so the category
 * entrance can hide empty groups (groups with product_count=0) in UI slices.
 */
const allMockProductGroups: ProductGroup[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    slug: 'tandemfluege',
    name: 'Tandemflüge',
    name_localized: { en: 'Tandem Flights', de: 'Tandemflüge' },
    description: 'Erlebe das Fliegen aus der Vogelperspektive — kein Vorwissen nötig.',
    description_localized: {
      en: 'Experience the freedom of flight — no prior experience required.',
      de: 'Erlebe das Fliegen aus der Vogelperspektive — kein Vorwissen nötig.',
    },
    image_url: 'https://picsum.photos/seed/group-tandemfluege/800/600',
    sort_order: 10,
    parent_id: null,
    product_count: 2,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    slug: 'kurse',
    name: 'Kurse',
    name_localized: { en: 'Courses', de: 'Kurse' },
    description: 'Schein machen — vom Anfänger zum lizenzierten Piloten.',
    description_localized: {
      en: 'Get licensed — from beginner to certified paraglider pilot.',
      de: 'Schein machen — vom Anfänger zum lizenzierten Piloten.',
    },
    image_url: 'https://picsum.photos/seed/group-kurse/800/600',
    sort_order: 20,
    parent_id: null,
    product_count: 0,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    slug: 'reisen',
    name: 'Reisen',
    name_localized: { en: 'Trips', de: 'Reisen' },
    description: 'Geführte Flugwochen in den schönsten Paragliding-Destinationen Europas.',
    description_localized: {
      en: 'Guided flying weeks at the finest paragliding destinations in Europe.',
      de: 'Geführte Flugwochen in den schönsten Paragliding-Destinationen Europas.',
    },
    image_url: 'https://picsum.photos/seed/group-reisen/800/600',
    sort_order: 30,
    parent_id: null,
    product_count: 0,
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    slug: 'verleih',
    name: 'Verleih',
    name_localized: { en: 'Rental', de: 'Verleih' },
    description: 'Schirme, Gurte und Ausrüstung für eigene Piloten tageweise mieten.',
    description_localized: {
      en: 'Rent gliders, harnesses and gear by the day for licensed pilots.',
      de: 'Schirme, Gurte und Ausrüstung für eigene Piloten tageweise mieten.',
    },
    image_url: null,
    sort_order: 40,
    parent_id: null,
    product_count: 0,
  },
]

/**
 * landr-d8rg, epic contract E: mock for listProductGroups. The operatorToken
 * arg is accepted (signature symmetry with the real fetch) and voided — all
 * mock operators share the same catalogue in dev/test mode. previewToken is
 * accepted for future extensibility (e.g. groups gated behind preview) but
 * currently has no effect on the returned list.
 */
export const mockProductGroups = (
  operatorToken: string,
  previewToken?: string,
): ProductGroup[] => {
  void operatorToken
  void previewToken
  return allMockProductGroups
}

/**
 * landr-7zc5.3: when previewToken is non-empty the mock returns both
 * published and draft products (mirroring the API preview path). Without
 * a token only published products are returned (live embed behaviour).
 */
export const mockProducts = (groupSlug?: string, previewToken?: string): Product[] => {
  const base = previewToken
    ? [...allMockProducts, ...mockDraftProducts]
    : allMockProducts
  if (!groupSlug) return base
  return base.filter((p) => p.group_slug === groupSlug)
}

/**
 * Mock helper for the widget AccommodationStep — returns hotel_room
 * products linked to a hotel location (landr-vyaz).
 */
export const mockHotelRooms = (hotelLocationId: string): Product[] =>
  allMockHotelRooms.filter((p) => p.hotel_location_id === hotelLocationId)

export const mockAvailability = (productId: string): AvailabilitySlot[] => {
  const base = today()
  return Array.from({ length: 14 }, (_, i) => i + 1)
    .filter((n) => n % 3 !== 0)
    .map((offset) => {
      const d = addDays(base, offset)
      return {
        availability_id: `${productId}-${offset}`,
        date: isoDate(d),
        start_time: '09:00',
        end_time: '10:00',
        capacity: 6,
        capacity_reserved: offset % 2,
        available_seats: 6 - (offset % 2),
        status: 'open',
      }
    })
}

export const mockFixedDateWindows = (): FixedDateWindow[] => {
  const base = today()
  return [0, 28, 56].map((offset, idx) => {
    const start = addDays(base, 14 + offset)
    return {
      id: `mock-window-${idx}`,
      start_date: isoDate(start),
      end_date: isoDate(addDays(start, 6)),
      capacity: 8,
      capacity_reserved: idx === 1 ? 8 : idx,
    }
  })
}

export const mockOperatorSettings = (operatorSlug: string): OperatorSettings => ({
  slug: operatorSlug,
  expose_seats_to_customer: false,
  // landr-yp8x — null mirrors the API default (operator hasn't picked
  // a brand yet). Widget falls back to its built-in theme.
  logo_url: null,
  primary_color: null,
  // landr-ens5 — no 3-colour theme in the mock (operator hasn't picked one;
  // widget falls back to primary_color → built-in default).
  theme: null,
  name: operatorSlug,
  // landr-nils — embed copy null by default (operator hasn't written any).
  widget_headline: null,
  widget_description: null,
  widget_footer: null,
  // landr-rjda — first-page-only gates off by default (show on every step).
  widget_headline_first_page_only: false,
  widget_description_first_page_only: false,
  widget_footer_first_page_only: false,
  // landr-atwy — account-link prompt off by default (opt-in per operator).
  offer_account_link: false,
  // landr-jb1k.4 — tile-style options null by default (operator hasn't picked
  // any; widget keeps the variant token defaults / current behaviour).
  widget_tile_radius: null,
  widget_tile_aspect: null,
  widget_tile_scrim: null,
  widget_tile_hover: null,
  // landr-4uyu — operator contact email surfaced at the participant max
  // ("larger group / flight school" contact-us line). Provided in the mock so
  // local mock-mode dev exercises the mailto path; real operators set their own
  // (or leave it null → the copy shows without a link).
  contact_email: `bookings@${operatorSlug}.example`,
  // landr-y1t4 — mock operators run no membership programme, so the
  // member-perk code field stays hidden in mock mode. Flip to true locally to
  // exercise the member path.
  has_member_perks: false,
})

/**
 * Mock for getOperatorServiceRoles (landr-mg0a). Returns a single
 * 'participant' row by default — the auto-seeded shape every new
 * operator gets via the AFTER INSERT trigger. The slug arg is unused
 * today; we keep the signature symmetric with the real fetch so the
 * App can swap between mocks/real without rewiring.
 *
 * landr-sbhz.4: the project ESLint config (typescript-eslint
 * recommended) doesn't honour the `_`-prefix convention for unused
 * args, so the previous `_operatorSlug` tripped no-unused-vars (a
 * required CI gate). We keep the param (signature symmetry) and
 * reference it via a no-op `void` so the rule is satisfied without
 * relaxing it project-wide or changing the call site.
 */
export const mockOperatorServiceRoles = (
  operatorSlug: string,
): ServiceRole[] => {
  void operatorSlug
  return [
    {
      id: '00000000-0000-0000-0000-000000000501',
      code: 'participant',
      label: 'Participant',
      label_localized: null,
      sort_order: 0,
    },
  ]
}

/**
 * Mock helper for the widget add-on rendering (landr-cip6). Tandem
 * Classic has no add-ons; Tandem Long is wired to a sample video
 * package; the mock rooms each expose a breakfast add-on. Keep the
 * IDs deterministic so component tests can assert against them.
 */
const MOCK_VIDEO_ADDON_ID = '00000000-0000-0000-0000-000000000401'
const MOCK_BREAKFAST_ADDON_ID = '00000000-0000-0000-0000-000000000402'
// landr-hzovu.14: a pilot-paid (paid_to='performer') add-on, so the dev mock
// flow exercises the "Paid to your Tandem pilot" block.
const MOCK_PILOT_PHOTOS_ADDON_ID = '00000000-0000-0000-0000-000000000403'

/** One mock offer row; every field the evaluator returns, overridable. */
function mockOffer(
  id: string,
  parentProductId: string | null,
  productId: string,
  name: string,
  over: Partial<EvaluatedOffer> = {},
): EvaluatedOffer {
  return {
    id,
    parent_product_id: parentProductId,
    product_id: productId,
    rules: { mode: 'all', items: [] },
    binding: 'booking',
    schedule: 'locked',
    collection: 'online',
    mode: 'optional',
    options: [],
    required_attributes: [],
    min_qty: 0,
    max_qty: null,
    sort_order: 0,
    name,
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    product_kind: 'service',
    day_selection: null,
    in_cart: false,
    price_preview: null,
    stock: null,
    server_attached: false,
    draft: false,
    ...over,
  }
}

const preview = (totalCents: number, priceUnit: 'booking' | 'night' | 'guest_night' = 'booking') => ({
  quantity: 1,
  unit_price_cents: totalCents,
  total_cents: totalCents,
  price_unit: priceUnit,
  currency: 'EUR',
})

/**
 * A neutral demo stay with offers on every binding / schedule / collection:
 * the "demo courtyard apartment". For 2 adults + a child of 8 over 4 nights:
 * tourist tax EUR 20 (mandatory, per person, paid on arrival, attached by the
 * server), air conditioning EUR 40 (optional, pick the nights), cot free
 * (optional, per person), bedding EUR 35 and garage EUR 40 (optional, per
 * booking), Wi-Fi included (info).
 */
export const mockOfferStay: Product = {
  ...mockOccupancyStay,
  product_id: '00000000-0000-0000-0000-000000000351',
  slug: 'demo-courtyard-apartment',
  name: 'Demo courtyard apartment',
  name_localized: null,
  short_description: 'A demo apartment around a courtyard.',
  price_per_unit: 90,
  price_from: '90.00',
  capacity_per_unit: 5,
  occupancy_pricing: undefined,
}

export const MOCK_OFFER_IDS = {
  touristTax: '00000000-0000-0000-0000-0000000005a1',
  airCon: '00000000-0000-0000-0000-0000000005a2',
  cot: '00000000-0000-0000-0000-0000000005a3',
  bedding: '00000000-0000-0000-0000-0000000005a4',
  garage: '00000000-0000-0000-0000-0000000005a5',
  wifi: '00000000-0000-0000-0000-0000000005a6',
} as const

export const MOCK_OFFER_PRODUCTS = {
  touristTax: '00000000-0000-0000-0000-0000000006a1',
  airCon: '00000000-0000-0000-0000-0000000006a2',
  cot: '00000000-0000-0000-0000-0000000006a3',
  bedding: '00000000-0000-0000-0000-0000000006a4',
  garage: '00000000-0000-0000-0000-0000000006a5',
  wifi: '00000000-0000-0000-0000-0000000006a6',
} as const

/** The demo courtyard apartment's offers (see mockOfferStay). */
export function mockOfferStayOffers(): EvaluatedOffer[] {
  const stay = mockOfferStay.product_id
  return [
    mockOffer(MOCK_OFFER_IDS.touristTax, stay, MOCK_OFFER_PRODUCTS.touristTax, 'Tourist tax', {
      mode: 'mandatory',
      binding: 'person',
      collection: 'on_site',
      server_attached: true,
      sort_order: 1,
      rules: { mode: 'all', items: [{ cond: 'guest_attr', key: 'age', op: 'gte', value: 10 }] },
      price_preview: preview(2000, 'guest_night'),
    }),
    mockOffer(MOCK_OFFER_IDS.airCon, stay, MOCK_OFFER_PRODUCTS.airCon, 'Air conditioning', {
      schedule: 'subset',
      sort_order: 2,
      price_preview: preview(4000, 'night'),
    }),
    mockOffer(MOCK_OFFER_IDS.cot, stay, MOCK_OFFER_PRODUCTS.cot, 'Baby cot', {
      binding: 'person',
      collection: 'free',
      sort_order: 3,
      price_preview: { ...preview(0), unit_price_cents: 0 },
    }),
    mockOffer(MOCK_OFFER_IDS.bedding, stay, MOCK_OFFER_PRODUCTS.bedding, 'Bed linen and towels', {
      sort_order: 4,
      price_preview: preview(3500),
    }),
    mockOffer(MOCK_OFFER_IDS.garage, stay, MOCK_OFFER_PRODUCTS.garage, 'Garage', {
      sort_order: 5,
      price_preview: preview(4000),
    }),
    mockOffer(MOCK_OFFER_IDS.wifi, stay, MOCK_OFFER_PRODUCTS.wifi, 'Wi-Fi', {
      mode: 'info',
      sort_order: 6,
      short_description: 'Fast Wi-Fi in every room.',
    }),
  ]
}

/** Per-product mock offers (deterministic ids, so tests can assert on them). */
function mockOffersFor(productId: string, nights: number): EvaluatedOffer[] {
  if (productId === mockOfferStay.product_id) return mockOfferStayOffers()
  // Service example: Tandem Long -> Video Package / Pilot Photos (optional).
  if (productId === '00000000-0000-0000-0000-000000000002') {
    return [
      mockOffer('mock-offer-video', productId, MOCK_VIDEO_ADDON_ID, 'Video Package', {
        name_localized: { en: 'Video Package', de: 'Video-Paket' },
        sort_order: 10,
        price_preview: preview(3900),
      }),
      mockOffer('mock-offer-photos', productId, MOCK_PILOT_PHOTOS_ADDON_ID, 'Pilot Photos', {
        name_localized: { en: 'Pilot Photos', de: 'Pilotenfotos' },
        sort_order: 20,
        price_preview: preview(2500),
      }),
    ]
  }
  // Hotel-room example: every mock room offers Breakfast, one per guest.
  if (
    productId === '00000000-0000-0000-0000-000000000101' ||
    productId === '00000000-0000-0000-0000-000000000102'
  ) {
    return [
      mockOffer(`mock-offer-breakfast-${productId}`, productId, MOCK_BREAKFAST_ADDON_ID, 'Breakfast', {
        name_localized: { en: 'Breakfast', de: 'Frühstück' },
        binding: 'free',
        product_kind: 'hotel_room',
        sort_order: 10,
        price_preview: preview(1000 * Math.max(1, nights), 'night'),
      }),
    ]
  }
  return []
}

/**
 * Mock POST /offers/evaluate: every line eligible, each line's offers with
 * `in_cart` set for the products already hanging off it.
 */
export function mockEvaluateOffers(body: OfferEvaluateRequest): OfferEvaluateResponse {
  return {
    lines: body.lines.map((ln) => {
      const children = new Set(
        body.lines.filter((o) => o.parent_line_id === ln.line_id).map((o) => o.product_id),
      )
      return {
        line_id: ln.line_id,
        eligible: true,
        eligibility_reason_key: null,
        eligibility_reason_params: null,
        draft: false,
        offers: mockOffersFor(ln.product_id, ln.selected_days?.length ?? 0).map((o) => ({
          ...o,
          in_cart: children.has(o.product_id),
        })),
      }
    }),
    required_attribute_keys: [],
  }
}

export const mockSubmit = (): SubmitBookingResponse => ({
  // Mirror the real public_submit_booking jsonb response so dev/storybook
  // mode renders the same fields the live API returns (no `reference`,
  // and `semantic_state` rather than `state`).
  booking_id: '00000000-0000-0000-0000-0000000000bb',
  semantic_state: 'pending',
  stage_code: 'awaiting_payment',
  next_steps: 'Awaiting operator approval',
  approval_outcome: 'auto_approved',
  // landr-3vr5: mock the per-booking iCal URL so storybook/dev mode
  // exercises the "Add to calendar" anchor branch in Confirmation.tsx.
  // landr-5aih0.4: token-scoped (signed booking token, not the UUID).
  ical_url:
    'https://api.dev.landr.de/api/public/bookings/000000000000000000000000000000bb.1900000000.mock-signature/calendar.ics',
  // landr-acew: parsed calendar event data so the confirmation screen can
  // build Google Calendar and Outlook deep-link URLs without an extra
  // API call. Mirrors the first VEVENT the ICS service would emit for a
  // mock Tandem Classic booking spanning 15–17 Jun 2026 — three
  // consecutive days, matching the summary's streak-discount example
  // below (landr-nva1a.4).
  calendar_event: {
    title: 'Tandem Classic — Para42',
    start_date: '2026-06-15',
    end_date: '2026-06-17',
    description: 'Booking for Jane Doe. Confirmed via Para42. Please arrive on time and bring your confirmation email.',
    location: 'Para42',
  },
  // landr-y31z: default mock to 'sent' — exercises the success copy path in
  // dev mode (the most common happy-path outcome for auto-approved bookings).
  confirmation_email_status: 'sent',
  // landr-nva1a.4: realistic `summary` so dev/demo mode shows the full
  // success screen — booking card, savings congrats, price breakdown, and
  // after-booking content — not just the pre-nva1a.4 legacy rendering.
  // Numbers mirror mockEstimate's 3-day streak discount (€30/day off the
  // €60/day Tandem Classic rate over 3 days = €90 saved).
  summary: {
    booking_id: '00000000-0000-0000-0000-0000000000bb',
    booking_reference: 'PARA42-DEMO-01',
    operator_name: 'Para42',
    product_label: 'Tandem Classic',
    products: [
      {
        product_id: '00000000-0000-0000-0000-000000000001',
        label: 'Tandem Classic',
        qty: 1,
        selected_days: ['2026-06-15', '2026-06-16', '2026-06-17'],
      },
    ],
    dates: {
      days: ['2026-06-15', '2026-06-16', '2026-06-17'],
      start: '2026-06-15',
      end: '2026-06-17',
      label: '15–17 Jun 2026',
    },
    participant_count: 1,
    participants: [{ name: 'Jane Doe' }],
    pickup_location: null,
    pickup_locations: [],
    hotel: null,
    line_items: [
      {
        product_id: '00000000-0000-0000-0000-000000000001',
        label: 'Tandem Classic',
        qty: 1,
        units: 3,
        unit_price: '30.00',
        line_total: '90.00',
        paid_to: 'operator',
      },
    ],
    operator_total: '90.00',
    hotel_total: '0.00',
    grand_total: '90.00',
    currency: 'EUR',
    savings: [
      { kind: 'multi_day', label: 'Multi-day savings', amount: '90.00' },
    ],
    savings_total: '90.00',
    subtotal_before_savings: '180.00',
    amount_due: '90.00',
    multi_day_savings: { days: 3, amount: '90.00', consecutive: true },
    price_overridden: false,
    // landr-nva1a.2 shape: {product_id, html, link} — no `label` on the
    // item itself (see PostBookingContent's doc comment in api/types.ts).
    post_booking: [
      {
        product_id: '00000000-0000-0000-0000-000000000001',
        html: '<p>Please arrive <strong>15 minutes early</strong> for check-in and bring comfortable shoes.</p>',
        link: {
          url: 'https://example.com/para42/waiver',
          label: 'Sign the digital waiver',
        },
      },
    ],
  },
})

/**
 * Mock estimate response for the PriceSidebar (landr-qez0). Uses a
 * deterministic per-day price (€60) for the parent service, €49/night
 * for the single-room mock, €73/night for the double-room mock, and
 * €10/night for the Breakfast add-on. Hotel rooms bill by nights
 * (days + 1) per the engine convention, services bill by days.
 *
 * Surfaces a tier-discount applied_rule when 3+ days are selected so
 * tests can exercise the discount-tag rendering path. landr-nva1a.4:
 * also surfaces the matching savings/subtotal_before_savings/amount_due/
 * multi_day_savings fields (€30/day off the €60/day base for 3+ days —
 * a 3-day booking demos exactly the -€90 example from the epic's review
 * round) so dev/demo mode exercises the new PriceSidebar/Confirmation
 * savings rows, not just the discount tag.
 */
export const mockEstimate = (
  productId: string,
  body: EstimateRequestBody,
): EstimateResponse => {
  const lineItems: EstimateResponse['line_items'] = []
  const rules: EstimateResponse['applied_rules'] = []
  const days = body.selected_days.length
  const productMap: Record<string, { name: string; price: number; kind: 'service' | 'hotel_room' | 'addon'; paidTo: 'operator' | 'hotel' | 'performer' }> = {
    '00000000-0000-0000-0000-000000000001': { name: 'Tandem Classic', price: 60, kind: 'service', paidTo: 'operator' },
    '00000000-0000-0000-0000-000000000002': { name: 'Tandem Long', price: 80, kind: 'service', paidTo: 'operator' },
    '00000000-0000-0000-0000-000000000101': { name: 'Single Room', price: 49, kind: 'hotel_room', paidTo: 'hotel' },
    '00000000-0000-0000-0000-000000000102': { name: 'Double Room', price: 73, kind: 'hotel_room', paidTo: 'hotel' },
    '00000000-0000-0000-0000-000000000401': { name: 'Video Package', price: 39, kind: 'addon', paidTo: 'operator' },
    '00000000-0000-0000-0000-000000000402': { name: 'Breakfast', price: 10, kind: 'addon', paidTo: 'hotel' },
    '00000000-0000-0000-0000-000000000403': { name: 'Pilot Photos', price: 25, kind: 'addon', paidTo: 'performer' },
  }
  const main = productMap[productId]
  // Multi-day streak saving: €30/day off the base rate for a 3+ day
  // booking of the MAIN product only (mirrors the API's convention of
  // discounting the operator-paid parent line, not add-ons/hotel).
  let multiDaySavingAmount = 0
  if (main) {
    const units = days
    const perDaySaving = days >= 3 ? 30 : 0
    const discountedRate = main.price - perDaySaving
    multiDaySavingAmount = perDaySaving * units
    lineItems.push({
      product_id: productId,
      label: main.name,
      qty: 1,
      units,
      unit_price: discountedRate.toFixed(2),
      line_total: (discountedRate * units).toFixed(2),
      paid_to: main.paidTo,
    })
    rules.push({ kind: 'per_day_base', detail: { product_id: productId } })
    if (days >= 3) {
      rules.push({
        kind: 'per_total_days_tier',
        detail: { days, tier: { threshold_min: 3, label: 'Multi-day discount' } },
      })
    }
  }
  if (productId === mockOfferStay.product_id) {
    lineItems.push({
      product_id: productId,
      label: mockOfferStay.name,
      qty: 1,
      units: days,
      unit_price: '90.00',
      line_total: (90 * days).toFixed(2),
      paid_to: 'operator',
      line_id: body.main_line_id ?? 'main',
    })
  }
  // Offer lines of the demo courtyard apartment, priced like the evaluator's
  // preview (per night for a day-pick), echoed with their offer fields.
  const stayOffers = new Map(mockOfferStayOffers().map((o) => [o.id, o]))
  for (const addon of body.addon_lines) {
    const offer = addon.offer_id ? stayOffers.get(addon.offer_id) : undefined
    if (!offer) continue
    const nights = addon.selected_days?.length ?? days
    const perNight = offer.price_preview?.price_unit === 'night'
    const total =
      offer.collection === 'free'
        ? 0
        : ((offer.price_preview?.total_cents ?? 0) / 100) * (perNight ? nights / Math.max(1, days) : 1) * addon.qty
    lineItems.push({
      product_id: addon.product_id,
      label: offer.name,
      qty: addon.qty,
      units: nights,
      unit_price: total.toFixed(2),
      line_total: total.toFixed(2),
      paid_to: 'operator',
      line_id: addon.line_id ?? null,
      parent_line_id: addon.parent_line_id ?? null,
      offer_id: offer.id,
      collection: offer.collection,
      mode: offer.mode,
      participant_ids: addon.participant_id ? [addon.participant_id] : null,
    })
  }
  // The server attaches the tourist tax itself: EUR 2.50 per night for each
  // guest of 10 or more (an unanswered age counts as an adult here).
  let onSite = 0
  if (productId === mockOfferStay.product_id && body.guests && body.guests.length > 0) {
    const tax = stayOffers.get(MOCK_OFFER_IDS.touristTax)!
    const covered = body.guests.filter((g) => typeof g.attributes.age !== 'number' || g.attributes.age >= 10)
    if (covered.length > 0) {
      onSite = 2.5 * days * covered.length
      lineItems.push({
        product_id: tax.product_id,
        label: tax.name,
        qty: covered.length,
        units: days,
        unit_price: '2.50',
        line_total: onSite.toFixed(2),
        paid_to: 'operator',
        offer_id: tax.id,
        parent_line_id: body.main_line_id ?? 'main',
        collection: 'on_site',
        collection_amount: onSite.toFixed(2),
        mode: 'mandatory',
        auto_attached: true,
        participant_ids: covered.map((g) => g.id),
      })
    }
  }
  for (const addon of body.addon_lines) {
    if (addon.offer_id && stayOffers.has(addon.offer_id)) continue
    const a = productMap[addon.product_id]
    if (!a) continue
    const units = a.kind === 'hotel_room' || (a.kind === 'addon' && a.paidTo === 'hotel') ? days + 1 : days
    const lineTotal = (a.price * units * addon.qty).toFixed(2)
    lineItems.push({
      product_id: addon.product_id,
      label: a.name,
      qty: addon.qty,
      units,
      unit_price: a.price.toFixed(2),
      line_total: lineTotal,
      paid_to: a.paidTo,
      ...(a.paidTo === 'performer' ? { payee_label: 'Tandem pilot' } : {}),
    })
  }
  let opTotal = 0
  let hotelTotal = 0
  let performerTotal = 0
  for (const li of lineItems) {
    const v = Number(li.line_total)
    // An on-site line is paid on arrival: never part of any total here.
    if (li.collection === 'on_site') continue
    if (li.paid_to === 'operator') opTotal += v
    else if (li.paid_to === 'performer') performerTotal += v
    else hotelTotal += v
  }
  return {
    line_items: lineItems,
    operator_total: opTotal.toFixed(2),
    hotel_total: hotelTotal.toFixed(2),
    performer_total: performerTotal.toFixed(2),
    // Performer money is paid on the day, outside the booking total.
    grand_total: (opTotal + hotelTotal).toFixed(2),
    currency: 'EUR',
    applied_rules: rules,
    // landr-zenj.1: the mock catalogue has no misconfigured products, so
    // mock mode never simulates un_priceable — always priceable, no
    // warnings. Real API responses carry both keys on every estimate.
    warnings: [],
    un_priceable: false,
    ...(onSite > 0 ? { on_site_total: onSite.toFixed(2) } : {}),
    // landr-nva1a.4: only present when there's an actual multi-day saving —
    // mirrors the real API, which omits these on an estimate with nothing
    // to discount, and lets PriceSidebar's no-savings fallback render too.
    ...(multiDaySavingAmount > 0
      ? {
          savings: [
            {
              kind: 'multi_day' as const,
              label: 'Multi-day savings',
              amount: multiDaySavingAmount.toFixed(2),
            },
          ],
          savings_total: multiDaySavingAmount.toFixed(2),
          subtotal_before_savings: (opTotal + multiDaySavingAmount).toFixed(2),
          amount_due: opTotal.toFixed(2),
          multi_day_savings: {
            days,
            amount: multiDaySavingAmount.toFixed(2),
            consecutive: true,
          },
        }
      : {}),
  }
}
