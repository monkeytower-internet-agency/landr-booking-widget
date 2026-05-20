import type {
  AvailabilitySlot,
  EstimateRequestBody,
  EstimateResponse,
  FixedDateWindow,
  Hotel,
  Location,
  OperatorSettings,
  Product,
  ProductAddon,
  SubmitBookingBody,
  SubmitBookingResponse,
} from './types'
import {
  mockAvailability,
  mockEstimate,
  mockFixedDateWindows,
  mockHotelRooms,
  mockLocations,
  mockOperatorSettings,
  mockProductAddons,
  mockProducts,
  mockSubmit,
} from './mocks'

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === '1'
const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE) throw new Error('VITE_API_BASE_URL is not configured')
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ''}`)
  }
  return (await res.json()) as T
}

export async function listProducts(
  operatorSlug: string,
  options?: { group?: string; includeHotelRooms?: boolean },
): Promise<Product[]> {
  let raw: Product[]
  if (USE_MOCKS) {
    raw = mockProducts(options?.group)
  } else {
    const qs = new URLSearchParams()
    if (options?.group) {
      qs.append('group', options.group)
    }
    const path = `/api/public/operators/${encodeURIComponent(operatorSlug)}/products`
    raw = await http<Product[]>(qs.toString() ? `${path}?${qs}` : path)
  }
  // Hotel rooms (landr-vyaz) are surfaced only inside AccommodationStep,
  // never in the main catalogue. Callers that need rooms use
  // getHotelRoomsForHotel which opts in via includeHotelRooms.
  if (options?.includeHotelRooms) return raw
  return raw.filter((p) => p.product_kind !== 'hotel_room')
}

export async function getAvailability(
  productId: string,
  fromIso: string,
  toIso: string,
): Promise<AvailabilitySlot[]> {
  if (USE_MOCKS) return mockAvailability(productId)
  const qs = new URLSearchParams({ from: fromIso, to: toIso })
  return http<AvailabilitySlot[]>(
    `/api/public/products/${encodeURIComponent(productId)}/availability?${qs}`,
  )
}

/**
 * Operator-level rendering/behaviour flags (landr-e10.9). The widget
 * calls this once on App mount and caches the result in OperatorContext.
 */
export async function getOperatorSettings(
  operatorSlug: string,
): Promise<OperatorSettings> {
  if (USE_MOCKS) return mockOperatorSettings(operatorSlug)
  return http<OperatorSettings>(
    `/api/public/operators/${encodeURIComponent(operatorSlug)}/settings`,
  )
}

/**
 * Stub pointing at the future GET /api/public/operators/{slug}/locations endpoint (landr-e10.8).
 * Falls back to mock data until the backend lands.
 */
export async function listLocations(operatorSlug: string): Promise<Location[]> {
  if (USE_MOCKS) return mockLocations
  return http<Location[]>(
    `/api/public/operators/${encodeURIComponent(operatorSlug)}/locations`,
  )
}

/**
 * Operator's hotels (locations.role_type.code === 'hotel'). Used by the
 * widget AccommodationStep (landr-vyaz). Filtered client-side because
 * the public locations RPC already returns role_type and the catalogue
 * is tiny — a second RPC would cost a migration for no benefit.
 */
export async function getHotelsForOperator(
  operatorSlug: string,
): Promise<Hotel[]> {
  const locations = await listLocations(operatorSlug)
  return locations.filter((loc) => loc.role_type?.code === 'hotel')
}

/**
 * Hotel rooms (kind=hotel_room, hotel_location_id=hotelId) for a given
 * hotel under an operator (landr-vyaz). Filtered client-side off the
 * existing public_get_operator_products RPC — same rationale as
 * getHotelsForOperator.
 */
export async function getHotelRoomsForHotel(
  operatorSlug: string,
  hotelLocationId: string,
): Promise<Product[]> {
  if (USE_MOCKS) return mockHotelRooms(hotelLocationId)
  // opt-in: bypass the default hotel_room filter on listProducts so
  // the AccommodationStep can see the rooms it owns.
  const products = await listProducts(operatorSlug, { includeHotelRooms: true })
  return products.filter(
    (p) =>
      p.product_kind === 'hotel_room' &&
      p.hotel_location_id === hotelLocationId,
  )
}

/**
 * Returns upcoming, non-deleted, active windows for a fixed_date_range product.
 * Backed by public_get_product_fixed_date_windows RPC (landr-m05.28).
 * Uses the Supabase REST RPC endpoint exposed by Kong.
 */
export async function getFixedDateWindows(
  productId: string,
): Promise<FixedDateWindow[]> {
  if (USE_MOCKS) return mockFixedDateWindows()
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is not configured')
  const res = await fetch(
    `${supabaseUrl}/rest/v1/rpc/public_get_product_fixed_date_windows`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ p_product_id: productId }),
    },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ''}`)
  }
  return (await res.json()) as FixedDateWindow[]
}

/**
 * Add-ons configured for a parent product (landr-cip6 / epic landr-ie8g).
 * Backed by GET /api/public/products/{id}/addons → SECURITY DEFINER RPC
 * public_get_product_addons. Returns an empty array when the parent has
 * no add-ons configured (or is itself hidden) — the widget treats empty
 * as "no add-ons UI to render".
 */
export async function getProductAddons(
  productId: string,
): Promise<ProductAddon[]> {
  if (USE_MOCKS) return mockProductAddons(productId)
  return http<ProductAddon[]>(
    `/api/public/products/${encodeURIComponent(productId)}/addons`,
  )
}

export async function submitBooking(
  body: SubmitBookingBody,
): Promise<SubmitBookingResponse> {
  if (USE_MOCKS) return mockSubmit()
  return http<SubmitBookingResponse>('/api/public/bookings', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 * Live booking-price estimator for the PriceSidebar (landr-qez0).
 * Backed by POST /api/public/operators/{slug}/products/{id}/estimate
 * (landr-xbqh) — reuses the canonical compute_booking_price engine so
 * the sidebar preview matches the gross_total persisted by
 * submit_booking bit-for-bit. No DB write. Returns the multi-line
 * breakdown (per-product line items, operator/hotel split, applied
 * pricing rules). The widget calls this debounced 300ms whenever
 * selected_days / participants_count / addon_lines changes.
 */
export async function estimateBookingPrice(
  operatorSlug: string,
  productId: string,
  body: EstimateRequestBody,
): Promise<EstimateResponse> {
  if (USE_MOCKS) return mockEstimate(productId, body)
  return http<EstimateResponse>(
    `/api/public/operators/${encodeURIComponent(operatorSlug)}/products/${encodeURIComponent(productId)}/estimate`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
}
