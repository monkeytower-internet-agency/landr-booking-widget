import type {
  AvailabilitySlot,
  EstimateRequestBody,
  EstimateResponse,
  FixedDateWindow,
  Location,
  OperatorSettings,
  Product,
  ProductAddon,
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
    product_kind: 'service',
    service_time_shape: 'time_slot',
    is_contiguous: false,
    duration_minutes: 25,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: '11111111-1111-1111-1111-111111111111',
    group_slug: 'courses',
    group_name: 'Courses',
    sort_order: 1,
    sport_subcategory_codes: ['paragliding-tandem'],
    location_ids: [],
    needs_pickup: false,
    hotel_offering: 'none',
    hotel_location_id: null,
    price_per_unit: null,
    currency: 'EUR',
    is_publicly_listed: true,
  },
  {
    product_id: '00000000-0000-0000-0000-000000000002',
    slug: 'tandem-long',
    name: 'Tandem Long',
    name_localized: { en: 'Tandem Long', de: 'Tandem Lang' },
    short_description: 'Extended-flight tandem when conditions allow.',
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'time_slot',
    is_contiguous: false,
    duration_minutes: 45,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: '22222222-2222-2222-2222-222222222222',
    group_slug: 'guided-days',
    group_name: 'Guided Days',
    sort_order: 2,
    sport_subcategory_codes: ['paragliding-tandem'],
    location_ids: [],
    needs_pickup: true,
    hotel_offering: 'optional',
    hotel_location_id: null,
    price_per_unit: null,
    currency: 'EUR',
    is_publicly_listed: true,
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
    product_group_id: null,
    group_slug: null,
    group_name: null,
    sort_order: 99,
    sport_subcategory_codes: ['paragliding-tandem'],
    location_ids: [],
    needs_pickup: false,
    hotel_offering: 'none',
    hotel_location_id: null,
    price_per_unit: null,
    currency: 'EUR',
    is_publicly_listed: false,
  },
]

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
  },
]

export const mockLocations: Location[] = [
  {
    location_id: 'aaaaaaaa-0000-0000-0000-000000000001',
    name: 'Ölüdeniz Beach',
    name_localized: { en: 'Ölüdeniz Beach', de: 'Ölüdeniz Strand', tr: 'Ölüdeniz Plajı' },
    parent_id: null,
    role_type: { code: 'beach', label: 'Beach' },
  },
  {
    location_id: 'aaaaaaaa-0000-0000-0000-000000000002',
    name: 'Hisarönü Main Square',
    name_localized: { en: 'Hisarönü Main Square', de: 'Hisarönü Hauptplatz', tr: 'Hisarönü Meydanı' },
    parent_id: null,
    role_type: { code: 'plaza', label: 'Plaza' },
  },
  {
    location_id: 'aaaaaaaa-0000-0000-0000-000000000003',
    name: 'Fethiye Harbour',
    name_localized: { en: 'Fethiye Harbour', de: 'Hafen Fethiye', tr: 'Fethiye Limanı' },
    parent_id: null,
    role_type: { code: 'hotel', label: 'Hotel' },
  },
]

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
  name: operatorSlug,
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

export const mockProductAddons = (productId: string): ProductAddon[] => {
  // Service example: Tandem Long → Video Package (optional).
  if (productId === '00000000-0000-0000-0000-000000000002') {
    return [
      {
        product_addon_id: 'mock-addon-1',
        addon_product_id: MOCK_VIDEO_ADDON_ID,
        name: 'Video Package',
        name_localized: { en: 'Video Package', de: 'Video-Paket' },
        is_required: false,
        min_qty: 0,
        max_qty: null,
        sort_order: 10,
        price_per_unit: 39,
        currency: 'EUR',
      },
    ]
  }
  // Hotel-room example: every mock room offers Breakfast.
  if (
    productId === '00000000-0000-0000-0000-000000000101' ||
    productId === '00000000-0000-0000-0000-000000000102'
  ) {
    return [
      {
        product_addon_id: `mock-addon-breakfast-${productId}`,
        addon_product_id: MOCK_BREAKFAST_ADDON_ID,
        name: 'Breakfast',
        name_localized: { en: 'Breakfast', de: 'Frühstück' },
        is_required: false,
        min_qty: 0,
        max_qty: null,
        sort_order: 10,
        price_per_unit: 10,
        currency: 'EUR',
      },
    ]
  }
  return []
}

export const mockSubmit = (): SubmitBookingResponse => ({
  booking_id: '00000000-0000-0000-0000-0000000000bb',
  reference: 'P42-MOCK-0001',
  state: 'pending',
  // landr-3vr5: mock the per-booking iCal URL so storybook/dev mode
  // exercises the "Add to calendar" anchor branch in Confirmation.tsx.
  ical_url:
    'https://api.dev.landr.de/api/public/bookings/00000000-0000-0000-0000-0000000000bb/calendar.ics',
})

/**
 * Mock estimate response for the PriceSidebar (landr-qez0). Uses a
 * deterministic per-day price (€60) for the parent service, €49/night
 * for the single-room mock, €73/night for the double-room mock, and
 * €10/night for the Breakfast add-on. Hotel rooms bill by nights
 * (days + 1) per the engine convention, services bill by days.
 *
 * Surfaces a tier-discount applied_rule when 3+ days are selected so
 * tests can exercise the discount-tag rendering path.
 */
export const mockEstimate = (
  productId: string,
  body: EstimateRequestBody,
): EstimateResponse => {
  const lineItems: EstimateResponse['line_items'] = []
  const rules: EstimateResponse['applied_rules'] = []
  const days = body.selected_days.length
  const productMap: Record<string, { name: string; price: number; kind: 'service' | 'hotel_room' | 'addon'; paidTo: 'operator' | 'hotel' }> = {
    '00000000-0000-0000-0000-000000000001': { name: 'Tandem Classic', price: 60, kind: 'service', paidTo: 'operator' },
    '00000000-0000-0000-0000-000000000002': { name: 'Tandem Long', price: 80, kind: 'service', paidTo: 'operator' },
    '00000000-0000-0000-0000-000000000101': { name: 'Single Room', price: 49, kind: 'hotel_room', paidTo: 'hotel' },
    '00000000-0000-0000-0000-000000000102': { name: 'Double Room', price: 73, kind: 'hotel_room', paidTo: 'hotel' },
    '00000000-0000-0000-0000-000000000401': { name: 'Video Package', price: 39, kind: 'addon', paidTo: 'operator' },
    '00000000-0000-0000-0000-000000000402': { name: 'Breakfast', price: 10, kind: 'addon', paidTo: 'hotel' },
  }
  const main = productMap[productId]
  if (main) {
    const units = days
    const lineTotal = (main.price * units).toFixed(2)
    lineItems.push({
      product_id: productId,
      label: main.name,
      qty: 1,
      units,
      unit_price: main.price.toFixed(2),
      line_total: lineTotal,
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
  for (const addon of body.addon_lines) {
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
    })
  }
  let opTotal = 0
  let hotelTotal = 0
  for (const li of lineItems) {
    const v = Number(li.line_total)
    if (li.paid_to === 'operator') opTotal += v
    else hotelTotal += v
  }
  return {
    line_items: lineItems,
    operator_total: opTotal.toFixed(2),
    hotel_total: hotelTotal.toFixed(2),
    grand_total: (opTotal + hotelTotal).toFixed(2),
    currency: 'EUR',
    applied_rules: rules,
  }
}
